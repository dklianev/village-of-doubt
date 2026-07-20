import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const { getSession, renderFeedbackEmail, sendEmail } = vi.hoisted(() => ({
  getSession: vi.fn(() => Promise.resolve(null)),
  renderFeedbackEmail: vi.fn(() => ({ subject: "Сигнал", html: "<p>Сигнал</p>", text: "Сигнал" })),
  sendEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/email-templates", () => ({ renderFeedbackEmail }));

let ipCounter = 1;

function reportRequest(body: unknown, ip = `198.51.100.${ipCounter++}`) {
  return new Request("http://localhost:3000/api/report", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/report", () => {
  const previousNotifyEmail = process.env.REPORTS_NOTIFY_EMAIL;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousNotifyEmail === undefined) {
      delete process.env.REPORTS_NOTIFY_EMAIL;
    } else {
      process.env.REPORTS_NOTIFY_EMAIL = previousNotifyEmail;
    }
  });

  it("отхвърля payload над byte лимита преди обработка", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const response = await POST(reportRequest({ type: "bug", body: "x".repeat(9_000) }));

    expect(response.status).toBe(413);
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
});
