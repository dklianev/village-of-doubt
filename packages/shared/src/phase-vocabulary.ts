import { GAME_MODE_DEFINITIONS, getGameFamily, type GameFamily, type GameMode } from "./game-config.js";
import type { GamePhase } from "./protocol.js";

export const DEFAULT_PHASE_LABELS_BG: Record<GamePhase, string> = {
  lobby: "Лоби",
  role_reveal: "Разкриване на роля",
  first_night: "Първа нощ",
  night: "Нощ",
  day_announcement: "Събуждане",
  day_discussion: "Дневно обсъждане",
  nomination: "Номинации",
  defense: "Защита",
  voting: "Гласуване",
  resolution: "Развръзка",
  hunter_revenge: "Отмъщение на Ловеца",
  mayor_successor: "Наследник на Кмета",
  paused: "Пауза",
  game_over: "Край",
};

const FAMILY_PHASE_LABELS_BG: Record<GameFamily, Partial<Record<GamePhase, string>>> = {
  werewolves: {},
  mafia: {
    first_night: "Първи договор",
    night: "Сделките започват",
    day_announcement: "Градът се събужда",
    day_discussion: "Градът говори",
    voting: "Обвинение",
    resolution: "Присъда",
  },
};

export function phaseLabelBg(phase: GamePhase, familyOrMode: GameFamily | GameMode = "werewolves"): string {
  const family = isGameMode(familyOrMode) ? getGameFamily(familyOrMode) : familyOrMode;
  const modeOverride = isGameMode(familyOrMode) ? GAME_MODE_DEFINITIONS[familyOrMode].phaseLabelsBg[phase] : undefined;
  return modeOverride ?? FAMILY_PHASE_LABELS_BG[family][phase] ?? DEFAULT_PHASE_LABELS_BG[phase];
}

function isGameMode(value: GameFamily | GameMode): value is GameMode {
  return value === "werewolves_classic" || value === "mafia_sport" || value === "mafia_free";
}
