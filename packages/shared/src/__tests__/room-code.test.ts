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

  describe.each([
    { name: "normalizeRoomCode", normalize: normalizeRoomCode },
    { name: "normalizeRoomCodeInput", normalize: normalizeRoomCodeInput },
  ])("$name", ({ normalize }) => {
    it.each([
      ["abc234", "ABC234"],
      [" mn2-k7a ", "MN2K7A"],
      ["ABC 234", "ABC234"],
      ["ABC123", "ABC23"],
      ["AB", "AB"],
      ["", ""],
      ["Room code: ABC234", "ABC234"],
      ["Join us in room ABC234?", "ABC234"],
      ["Room code: ABC234.", "ABC234"],
    ])("preserves ordinary input %s", (input, expected) => {
      expect(normalize(input)).toBe(expected);
    });

    it.each(["lobby", "play", "werewolf/join", "mafia/join"])(
      "extracts only the %s route's code, ignoring query and fragment",
      (route) => {
        for (const prefix of ["https://senkite.com/", "http://localhost:3000/", "/", ""]) {
          expect(normalize(`${prefix}${route}/abc234?utm_source=whatsapp&code=MN2K7A#RAVN42`))
            .toBe("ABC234");
        }
      },
    );

    it.each([
      "https://senkite.com/lobby/ABC234?utm_source=whatsapp",
      "https://senkite.com/lobby/ABC234/#RAVN42",
      "https://senkite.com/play/%41BC234?mode=mafia_free",
      "//senkite.com/lobby/ABC234",
      "senkite.com/lobby/ABC234",
      "Mila, room code ABC234: https://senkite.com/lobby/ABC234?utm_source=whatsapp",
      "Join us at https://senkite.com/lobby/ABC234?utm_source=whatsapp tonight!",
      "Invitation: (https://senkite.com/lobby/ABC234).",
      "Invitation: <https://senkite.com/lobby/ABC234>",
    ])("accepts a pasted invitation %s", (input) => {
      expect(normalize(input)).toBe("ABC234");
    });

    it.each(["join", "werewolf/join", "mafia/join"])(
      "preserves the explicit code parameter on the %s entry route",
      (route) => {
        expect(normalize(`https://senkite.com/${route}?code=abc234&utm_source=whatsapp#MN2K7A`))
          .toBe("ABC234");
        expect(normalize(`/${route}?code=ABC234`)).toBe("ABC234");
      },
    );

    it.each([
      "https://senkite.com/lobby/ABC123?code=ABC234#MN2K7A",
      "https://senkite.com/lobby/INVALIDABC234?code=MN2K7A",
      "https://senkite.com/lobby/ABC-234?code=MN2K7A",
      "https://senkite.com/lobby/ABC234/extra?code=MN2K7A",
      "/lobby/ABC123?utm_source=whatsapp",
      "/lobby/?code=ABC234",
      "/lobby?code=ABC234",
      "/unknown/ABC234?code=MN2K7A",
      "/werewolf/join/ABC123?code=ABC234",
      "https://senkite.com/?code=ABC234",
      "https://senkite.com/#/lobby/ABC234",
      "https://senkite.com/lobby/%?code=ABC234",
      "https://senkite.com/lobby/%2FABC234?code=MN2K7A",
      "https://senkite.com/join?code=ABC123&utm_source=whatsapp",
      "/join?code=ABC234&code=MN2K7A",
      "/join?redirect=/lobby/ABC234",
      "https:/lobby/ABC234?utm_source=whatsapp",
      "https:///lobby/ABC234?utm_source=whatsapp",
      "https://[invalid/lobby/ABC234?utm_source=whatsapp",
      "ftp://senkite.com/lobby/ABC234",
      "https://user:password@senkite.com/lobby/ABC234",
      "https://senkite.com\\lobby\\ABC234?utm_source=whatsapp",
      "https://senkite.com/lobby/ABC234 https://senkite.com/lobby/MN2K7A",
      "Room code ABC234: https://senkite.com/lobby/INVALID?code=ABC234",
      "Invitation: (javascript:ABC234)",
      "senkite.com?code=ABC234",
      "?code=ABC234",
    ])("does not guess a code from an invalid or ambiguous URL: %s", (input) => {
      expect(normalize(input)).toBe("");
    });
  });
});
