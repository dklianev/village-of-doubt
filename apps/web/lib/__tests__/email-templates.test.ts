import { describe, expect, it } from "vitest";
import { renderFeedbackEmail } from "../email-templates";

describe("email templates", () => {
  it("scrubs control characters from feedback email subjects", () => {
    const template = renderFeedbackEmail({
      brandUrl: "https://example.invalid",
      body: "Бележка с достатъчно съдържание.",
      reporterEmail: null,
      page: "/report\r\nBcc: attacker@example.invalid",
    });

    expect(template.subject).toBe("Бележка от /report Bcc: attacker@example.invalid");
    expect(template.subject).not.toMatch(/[\r\n]/);
  });
});
