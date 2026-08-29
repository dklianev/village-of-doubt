import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const { getSession, renderFeedbackEmail, sendEmail } = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ user: { name: string | null; email: string } } | null>>(
    () => Promise.resolve(null),
  ),
  renderFeedbackEmail: vi.fn((_input: unknown) => ({
    subject: "Бележка",
    html: "<p>Бележка</p>",
    text: "Бележка",
  })),
  sendEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/email-templates", () => ({ renderFeedbackEmail }));

let ipCounter = 30;

function feedbackRequest(body: unknown, ip = `198.51.100.${ipCounter++}`) {
  return new Request("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
  const previousNotifyEmail = process.env.REPORTS_NOTIFY_EMAIL;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousNotifyEmail === undefined) {
      delete process.env.REPORTS_NOTIFY_EMAIL;
    } else {
      process.env.REPORTS_NOTIFY_EMAIL = previousNotifyEmail;
    }
  });

  it("отхвърля поле над UI/server лимита", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const response = await POST(feedbackRequest({ category: "idea", body: "x".repeat(2_001), page: "/" }));

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("налага rate limit", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    const ip = "203.0.113.40";
    const body = { category: "idea", body: "Полезна бележка за масата.", page: "/" };

    for (let index = 0; index < 10; index += 1) {
      expect((await POST(feedbackRequest(body, ip))).status).toBe(200);
    }
    expect((await POST(feedbackRequest(body, ip))).status).toBe(429);
  });

  it("не логва PII или съдържание при липсващ notifier", async () => {
    delete process.env.REPORTS_NOTIFY_EMAIL;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sensitive = "Тайна бележка от private.person@example.com";

    const response = await POST(
      feedbackRequest({ category: "other", body: sensitive, email: "private.person@example.com", page: "/privacy" }),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(sensitive);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("private.person@example.com");
    consoleError.mockRestore();
  });

  it("не добавя session identity, когато имейлът за връзка е оставен празен", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";
    getSession.mockResolvedValueOnce({
      user: { name: "Тайно име", email: "private.person@example.com" },
    });

    const response = await POST(
      feedbackRequest({ category: "idea", body: "Полезна анонимна бележка за масата.", email: null, page: "/" }),
    );

    expect(response.status).toBe(200);
    expect(getSession).not.toHaveBeenCalled();
    expect(renderFeedbackEmail).toHaveBeenCalledWith(
      expect.objectContaining({ reporterEmail: null, body: expect.stringContaining("анонимен") }),
    );
    const templateInput = renderFeedbackEmail.mock.calls[0]?.[0];
    expect(JSON.stringify(templateInput)).not.toContain("private.person@example.com");
    expect(JSON.stringify(templateInput)).not.toContain("Тайно име");
  });

  it("отхвърля невалиден имейл и при директна API заявка", async () => {
    process.env.REPORTS_NOTIFY_EMAIL = "operator@example.com";

    const response = await POST(
      feedbackRequest({
        category: "idea",
        body: "Полезна бележка за масата.",
        email: "това не е имейл",
        page: "/",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Въведи валиден имейл." });
    expect(getSession).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
