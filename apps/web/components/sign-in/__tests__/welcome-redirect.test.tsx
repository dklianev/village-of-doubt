import { beforeEach, describe, expect, it } from "vitest";
import { resolveWelcomeRedirect } from "../welcome-redirect";

describe("welcome redirect", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the full safe invite through onboarding", () => {
    const target = "/mafia/join/ABC123?source=invite#entry";
    const result = new URL(resolveWelcomeRedirect(target), "https://example.invalid");
    expect(result.pathname).toBe("/tutorial");
    expect(result.searchParams.get("redirect")).toBe(target);
  });

  it.each(["https://other.example", "//other.example", "/%2fother.example", "/\\other.example", "javascript:alert(1)"])(
    "never navigates or carries an unsafe target (%s)", (target) => {
      expect(new URL(resolveWelcomeRedirect(target), "https://example.invalid").searchParams.get("redirect")).toBe("/");
      window.localStorage.setItem("tutorial-completed", "1");
      expect(resolveWelcomeRedirect(target)).toBe("/");
    },
  );
});
