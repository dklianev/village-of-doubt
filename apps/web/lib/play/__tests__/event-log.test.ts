import { describe, expect, it } from "vitest";
import { eventLineClass } from "@/lib/play/event-log";

describe("eventLineClass", () => {
  it("uses the authoritative public event kind instead of Bulgarian copy heuristics", () => {
    expect(eventLineClass("death")).toBe("event-death");
    expect(eventLineClass("hunter_shot")).toBe("event-hunter-shot");
    expect(eventLineClass("reveal")).toBe("event-reveal");
    expect(eventLineClass("system")).toBe("event-generic");
  });
});
