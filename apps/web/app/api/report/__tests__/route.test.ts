import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const { getSession, renderFeedbackEmail, sendEmail } = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ user: { name: string | null; email: string } } | null>>(
    () => Promise.resolve(null),
  ),
  renderFeedbackEmail: vi.fn((_input: unknown) => ({
    subject: "Сигнал",
    html: "<p>Сигнал</p>",
    text: "Сигнал",
  })),
  sendEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("../delivery", async (importOriginal) => ({
  ...await importOriginal<typeof import("../delivery")>(),
  sendReportEmail: sendEmail,
}));
vi.mock("@/lib/email-templates", () => ({ renderFeedbackEmail }));

let ipCounter = 1;

function reportRequest(body: unknown, ip = `198.51.100.${ipCounter++}`) {
  return new Request("http://localhost:3000/api/report", {
    method: "POST",
    headers: {
      "content-type": "application/json", "x-forwarded-for": ip,
      "idempotency-key": `${Date.now()}.${randomBytes(32).toString("hex")}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/report", () => {
  const previousNotifyEmail = process.env.REPORTS_NOTIFY_EMAIL;

  afterEach(() => {
    vi.resetAllMocks();
    if (previousNotifyEmail === undefined) {
      delete process.env.REPORTS_NOTIFY_EMAIL;
    } else {
      process.env.REPORTS_NOTIFY_EMAIL = previousNotifyEmail;
    }
  });

  it("отхвърля payload над byte лимита преди обработка", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const response = await POST(reportRequest({ type: "bug", body: "x".repeat(32_769) }));

    expect(response.status).toBe(413);
    expect(getSession).not.toHaveBeenCalled();
    expect(renderFeedbackEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["Bulgarian", "я"], ["three-byte UTF-8", "界"],
    ["surrogate pairs", "\ud83d\udcdd"], ["JSON escapes", "\u0000"],
  ])("accepts full multibyte fields (%s) without truncation", async (_name, character) => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const body = character.repeat(4000 / character.length);
    const evidence = character.repeat(500 / character.length);
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.bg`;
    const request = reportRequest({ type: "copyright", body, evidence, email });

    expect(email).toHaveLength(254);
    expect(new TextEncoder().encode(await request.clone().text()).byteLength).toBeGreaterThan(8192);
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(renderFeedbackEmail).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`Доказателство: ${evidence}\n\n${body}`),
      reporterEmail: email,
    }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("accepts JSON-escaped Bulgarian at both field limits", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const json = JSON.stringify({ type: "other", body: "я".repeat(4000), evidence: "я".repeat(500) })
      .replaceAll("я", "\\u044f");
    const request = new Request("http://localhost:3000/api/report", {
      method: "POST",
      headers: {
        "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipCounter++}`,
        "idempotency-key": `${Date.now()}.${randomBytes(32).toString("hex")}`,
      },
      body: json,
    });

    expect((await POST(request)).status).toBe(200);
    expect(renderFeedbackEmail).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining("я".repeat(4000)),
    }));
  });

  it.each([
    ["body", "я".repeat(4001)],
    ["body", "界".repeat(4001)],
    ["evidence", "я".repeat(501)],
    ["email", `${"a".repeat(243)}@example.com`],
  ])("enforces individual %s length below the request byte cap", async (field, value) => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const response = await POST(reportRequest({ body: "Подробно описание на проблема.", [field]: value }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Сигналът съдържа прекалено дълго поле." });
    expect(getSession).not.toHaveBeenCalled();
    expect(renderFeedbackEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([32_768, 32_769])("enforces the exact transport limit at %i bytes", async (size) => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const json = JSON.stringify({ body: "Подробно описание на проблема." });
    const padding = " ".repeat(size - new TextEncoder().encode(json).byteLength);
    const request = new Request("http://localhost:3000/api/report", {
      method: "POST",
      headers: {
        "x-forwarded-for": `198.51.100.${ipCounter++}`,
        "idempotency-key": `${Date.now()}.${randomBytes(32).toString("hex")}`,
      },
      body: json + padding,
    });
    expect(new TextEncoder().encode(await request.clone().text()).byteLength).toBe(size);

    expect((await POST(request)).status).toBe(size === 32_768 ? 200 : 413);
    expect(sendEmail).toHaveBeenCalledTimes(size === 32_768 ? 1 : 0);
  });

  it("rejects an oversized declared length before reading the body", async () => {
    const request = reportRequest({ body: "Подробно описание на проблема." });
    request.headers.set("content-length", "32769");
    const read = vi.spyOn(request.body!, "getReader");

    expect((await POST(request)).status).toBe(413);
    expect(read).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([null, "1"])("cancels an oversized stream despite content-length %s", async (declaredLength) => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16_384));
        controller.enqueue(new Uint8Array(16_384));
        controller.enqueue(new Uint8Array(1));
      },
      cancel,
    });
    const headers = new Headers({ "x-forwarded-for": `198.51.100.${ipCounter++}` });
    if (declaredLength) headers.set("content-length", declaredLength);
    const request = new Request("http://localhost:3000/api/report", {
      method: "POST", body, headers, duplex: "half",
    } as RequestInit & { duplex: "half" });

    expect((await POST(request)).status).toBe(413);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([null, [], 17, { body: " ".repeat(25) }, { body: 123 }])("rejects malformed report fields: %j", async (body) => {
    expect((await POST(reportRequest(body))).status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without resolving identity or sending", async () => {
    const request = new Request("http://localhost:3000/api/report", {
      method: "POST", body: "{", headers: { "x-forwarded-for": `198.51.100.${ipCounter++}` },
    });
    expect((await POST(request)).status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("налага rate limit по хеширан request fingerprint", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const ip = "203.0.113.20";
    const body = { type: "bug", body: "Подробно описание на проблем в играта." };

    for (let index = 0; index < 5; index += 1) {
      expect((await POST(reportRequest(body, ip))).status).toBe(200);
    }
    const blocked = await POST(reportRequest(body, ip));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("не логва PII или съдържание при липсващ notifier", async () => {
    delete process.env.REPORTS_NOTIFY_EMAIL;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sensitive = "Личен сигнал от private.person@example.com";

    const response = await POST(
      reportRequest({ type: "gdpr", body: `${sensitive} с достатъчно подробно описание.`, email: "private.person@example.com" }),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(sensitive);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("private.person@example.com");
    consoleError.mockRestore();
  });

  it("не чете или изпраща session identity при анонимен сигнал", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    getSession.mockResolvedValueOnce({
      user: { name: "Тайно име", email: "private.person@example.com" },
    });

    const response = await POST(
      reportRequest({ type: "abuse", body: "Подробно описание на анонимен сигнал.", email: null }),
    );

    expect(response.status).toBe(200);
    expect(getSession).not.toHaveBeenCalled();
    expect(renderFeedbackEmail).toHaveBeenCalledWith(
      expect.objectContaining({ reporterEmail: null }),
    );
    const templateInput = renderFeedbackEmail.mock.calls[0]?.[0];
    expect(JSON.stringify(templateInput)).not.toContain("private.person@example.com");
    expect(JSON.stringify(templateInput)).not.toContain("Тайно име");
  });

  it("отхвърля невалиден имейл и при директна API заявка", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";

    const response = await POST(
      reportRequest({
        type: "bug",
        body: "Подробно описание на възпроизводим проблем.",
        email: "това не е имейл",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Въведи валиден имейл." });
    expect(getSession).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("връща сървърната референция и я включва в операторския имейл", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";

    const response = await POST(
      reportRequest({
        type: "bug",
        body: "Подробно описание на възпроизводим проблем.",
        email: "reporter@example.com",
      }),
    );
    const payload = (await response.json()) as { referenceId: string };

    expect(response.status).toBe(200);
    expect(payload.referenceId).toMatch(/^СИГ-[A-F0-9]{10}$/);
    expect(renderFeedbackEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining(payload.referenceId) }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining(payload.referenceId) }),
      expect.any(String),
    );
  });

  it("does not include a mismatched session's name or email", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    getSession.mockResolvedValueOnce({ user: { name: "Друго име", email: "other@example.com" } });
    expect((await POST(reportRequest({ body: "Подробно описание на проблема.", email: "reporter@example.com" }))).status).toBe(200);
    const input = JSON.stringify(renderFeedbackEmail.mock.calls[0]?.[0]);
    expect(input).toContain("reporter@example.com");
    expect(input).not.toContain("other@example.com");
    expect(input).not.toContain("Друго име");
  });

  it("returns a retryable failure without logging report or delivery secrets", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    sendEmail.mockRejectedValueOnce(new Error("delivery-secret reporter@example.com"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(reportRequest({ body: "Подробно описание на проблема.", email: "reporter@example.com" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Не успяхме да потвърдим изпращането. Опитай отново след малко." });
    expect(consoleError).toHaveBeenCalledWith("[report] email delivery failed");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("reporter@example.com");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("delivery-secret");
  });
});
