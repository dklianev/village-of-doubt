export const NARRATOR_VOICES = ["classic", "classic_nikolay", "old_villager", "inspector", "witch", "witch_moonglow"] as const;
export type NarratorVoice = typeof NARRATOR_VOICES[number];
export type NarratorArchetype = "classic" | "old_villager" | "inspector" | "witch";

export const NARRATOR_VOICE_PROFILES = {
  classic: { archetype: "classic", performer: "Kosta", detailBg: "Спокоен и близък разказ." },
  classic_nikolay: { archetype: "classic", performer: "Nikolay", detailBg: "Плътен глас с уверен ритъм." },
  old_villager: { archetype: "old_villager", performer: "Peter K", detailBg: "Селска мъдрост и сухо чувство за хумор." },
  inspector: { archetype: "inspector", performer: "Yordan", detailBg: "Сдържан тон и криминално напрежение." },
  witch: { archetype: "witch", performer: "Milena", detailBg: "Топъл глас с тъмни предчувствия." },
  witch_moonglow: { archetype: "witch", performer: "Moonglow", detailBg: "Загадъчен и мек нощен разказ." },
} as const satisfies Record<NarratorVoice, { archetype: NarratorArchetype; performer: string; detailBg: string }>;

export function getNarratorArchetype(voice: NarratorVoice): NarratorArchetype {
  if (voice === "classic_nikolay") return "classic";
  if (voice === "witch_moonglow") return "witch";
  return voice;
}
