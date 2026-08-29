import { describe, expect, it } from "vitest";
import { BULGARIAN_TIME_ZONE, formatBulgarianDateTime } from "../date-time";

describe("Bulgarian date/time boundaries", () => {
  it("uses Europe/Sofia when a UTC instant crosses the Bulgarian calendar boundary", () => {
    expect(BULGARIAN_TIME_ZONE).toBe("Europe/Sofia");
    expect(formatBulgarianDateTime(new Date("2026-01-01T22:30:00Z"), {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })).toBe("02 януари 2026 г.");
  });

  it("does not allow a caller to replace the shared timezone", () => {
    expect(formatBulgarianDateTime(new Date("2026-08-27T11:58:41Z"), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    })).toBe("14:58:41");
  });
});
