import type { GameFamily, GameMode, NarratorVoice, RolePreset } from "./game-config.js";
import type { GamePhase } from "./protocol.js";

export const GAME_MODE_DEFINITIONS: Record<
  GameMode,
  {
    family: GameFamily;
    nameBg: string;
    shortBg: string;
    recommendedPlayersBg: string;
    themeKey: GameFamily;
    phaseLabelsBg: Partial<Record<GamePhase, string>>;
  }
> = {
  werewolves_classic: {
    family: "werewolves",
    nameBg: "Върколак",
    shortBg: "Класическа игра с тайни роли, нощни заплахи и дневно гласуване.",
    recommendedPlayersBg: "6-30 играчи, най-добре 8-18.",
    themeKey: "werewolves",
    phaseLabelsBg: {},
  },
  mafia_sport: {
    family: "mafia",
    nameBg: "Спортна Мафия",
    shortBg: "Строг 10-играчов формат с Комисар, Кръстник и точна реч.",
    recommendedPlayersBg: "Точно 10 играчи.",
    themeKey: "mafia",
    phaseLabelsBg: {
      first_night: "Първи договор",
      night: "Нощни договорки",
      day_announcement: "Градът се събужда",
      day_discussion: "Речи на масата",
      voting: "Обвинение",
      resolution: "Присъда",
    },
  },
  mafia_free: {
    family: "mafia",
    nameBg: "Мафия",
    shortBg: "Градска мистерия с гъвкав брой играчи и роли по избор.",
    recommendedPlayersBg: "4-24 играчи.",
    themeKey: "mafia",
    phaseLabelsBg: {
      first_night: "Първи договор",
      night: "Сделките започват",
      day_announcement: "Градът се събужда",
      day_discussion: "Градът говори",
      voting: "Обвинение",
      resolution: "Присъда",
    },
  },
};

export const ROLE_PRESET_LABELS_BG: Record<RolePreset, string> = {
  sport: "Спортна Мафия",
  free: "Свободна Мафия",
  beginner: "Начинаещи",
  classic: "Класическа игра",
  advanced: "Разширена игра",
  wolves_vampires: "Върколаци и вампири",
  classic_clean: "Класическа чиста",
  mvp: "Готово разпределение",
  manual: "Персонализирана",
};

export const NARRATOR_VOICE_LABELS_BG: Record<NarratorVoice, string> = {
  classic: "Класически Разказвач",
  old_villager: "Старият селянин",
  inspector: "Инспекторът",
  witch: "Вещицата",
};

export function getGameFamily(mode: GameMode): GameFamily {
  return GAME_MODE_DEFINITIONS[mode].family;
}

export function getGameModeNameBg(mode: GameMode): string {
  return GAME_MODE_DEFINITIONS[mode].nameBg;
}
