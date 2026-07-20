import { describe, expect, it } from "vitest";
import { shouldMountFeedback } from "../route-policy";

describe("feedback route policy", () => {
  it.each(["/privacy", "/terms", "/faq", "/status", "/report"])(
    "keeps feedback available on the service route %s",
    (pathname) => {
      expect(shouldMountFeedback(pathname)).toBe(true);
    },
  );

  it("keeps the floating launcher out of an active game", () => {
    expect(shouldMountFeedback("/play/ABCD12")).toBe(false);
  });
});
