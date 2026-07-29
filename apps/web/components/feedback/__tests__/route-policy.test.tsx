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

  it.each(["/account", "/achievements", "/friends", "/history/game-1/replay"])(
    "waits for authentication before mounting feedback on %s",
    (pathname) => {
      expect(shouldMountFeedback(pathname, false)).toBe(false);
      expect(shouldMountFeedback(pathname, true)).toBe(true);
    },
  );
});
