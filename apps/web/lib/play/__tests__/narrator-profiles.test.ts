import { describe, expect, it } from "vitest";
import { NARRATOR_VOICES, type GamePhase } from "@werewolf/shared";
import { parseRoomCreateOptions, roomOptionsToQuery } from "@/lib/room-options";
import { phaseNarratorLine } from "../phase-display";

describe("narrator variant contracts", () => {
  it.each(NARRATOR_VOICES)("round-trips %s through Create links", (narratorVoice) => {
    const query = roomOptionsToQuery({ narratorVoice });
    expect(parseRoomCreateOptions(Object.fromEntries(new URLSearchParams(query))).narratorVoice).toBe(narratorVoice);
  });
  it("ignores unknown narrator URL values", () => {
    expect(parseRoomCreateOptions({ narratorVoice: "not-approved" }).narratorVoice).toBeUndefined();
  });
  it.each(["mafia_free", "mafia_sport", "werewolves_classic"] as const)("shares only archetype copy across variants in %s", (mode) => {
    const phases: GamePhase[] = ["role_reveal", "first_night", "night", "day_announcement", "day_discussion", "nomination", "defense", "voting", "resolution", "hunter_revenge", "mayor_successor", "game_over"];
    for (const phase of phases) {
      expect(phaseNarratorLine(phase, mode, "classic_nikolay")).toBe(phaseNarratorLine(phase, mode, "classic"));
      expect(phaseNarratorLine(phase, mode, "witch_moonglow")).toBe(phaseNarratorLine(phase, mode, "witch"));
    }
  });
});
