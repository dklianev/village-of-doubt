import { describe, expect, it } from "vitest";
import { createGameConfigFromOptions, NARRATOR_VOICES, NARRATOR_VOICE_LABELS_BG } from "../game-config.js";
import type { NarratorVoice } from "../narrator-voices.js";
import { getNarratorArchetype, NARRATOR_VOICE_PROFILES } from "../narrator-voices.js";
import { createRoomOptionsFromConfig } from "../repeat-room-options.js";

describe("approved narrator profiles", () => {
  it("retains all legacy IDs and adds only the two approved variants", () => {
    expect(NARRATOR_VOICES).toEqual(["classic", "classic_nikolay", "old_villager", "inspector", "witch", "witch_moonglow"]);
    expect(Object.keys(NARRATOR_VOICE_LABELS_BG)).toEqual([...NARRATOR_VOICES]);
    expect(Object.values(NARRATOR_VOICE_PROFILES).map((profile) => profile.performer)).toEqual(["Kosta", "Nikolay", "Peter K", "Yordan", "Milena", "Moonglow"]);
    expect(new Set(NARRATOR_VOICES.map(getNarratorArchetype))).toEqual(new Set(["classic", "old_villager", "inspector", "witch"]));
    expect(getNarratorArchetype("classic_nikolay")).toBe("classic");
    expect(getNarratorArchetype("witch_moonglow")).toBe("witch");
  });

  it.each(NARRATOR_VOICES)("accepts and preserves %s through config and repeat-room serialization", (narratorVoice) => {
    for (const mode of ["mafia_sport", "mafia_free", "werewolves_classic"] as const) {
      const options = { mode, narratorVoice };
      const config = createGameConfigFromOptions(options);
      expect(config.narratorVoice).toBe(narratorVoice);
      expect(createRoomOptionsFromConfig(config).narratorVoice).toBe(narratorVoice);
    }
  });

  it("preserves the default and refuses provider names or unapproved IDs", () => {
    expect(createGameConfigFromOptions().narratorVoice).toBe("classic");
    for (const narratorVoice of ["Kosta", "Nikolay", "Moonglow", "classic_other", "__proto__", "witch_moonglow "]) {
      expect(() => createGameConfigFromOptions({ narratorVoice: narratorVoice as NarratorVoice })).toThrow("Невалиден глас на Разказвача.");
    }
  });
});
