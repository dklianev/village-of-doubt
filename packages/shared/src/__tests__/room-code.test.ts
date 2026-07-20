import { describe, expect, it } from "vitest";
import { ROOM_CODE_REGEX, normalizeRoomCode, normalizeRoomCodeInput } from "../room-code.js";

describe("room code helpers", () => {
  it("extracts a valid room code from invite links", () => {
    expect(normalizeRoomCode("https://werewolf.app/play/MN2K7A")).toBe("MN2K7A");
    expect(normalizeRoomCodeInput("mn2-k7a")).toBe("MN2K7A");
  });

  it("keeps the server room code alphabet strict", () => {
    expect(ROOM_CODE_REGEX.test("MN2K7A")).toBe(true);
    expect(ROOM_CODE_REGEX.test("ABC123")).toBe(false);
    expect(normalizeRoomCodeInput("ABC123")).toBe("ABC23");
  });
});
