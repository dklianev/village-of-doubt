import {
  getGameFamily,
  phaseLabelBg,
  type GameFamily,
  type GameMode,
  type GamePhase,
  type NarratorVoice,
} from "@werewolf/shared";

export const PHASE_RAIL: Array<{ label: string; iconPhase: string; phases: string[] }> = [
  { label: "Лоби", iconPhase: "lobby", phases: ["lobby"] },
  { label: "Роля", iconPhase: "role_reveal", phases: ["role_reveal"] },
  { label: "Нощ", iconPhase: "night", phases: ["first_night", "night"] },
  {
    label: "Ден",
    iconPhase: "day_discussion",
    phases: ["day_announcement", "day_discussion", "nomination", "defense"],
  },
  { label: "Глас", iconPhase: "voting", phases: ["voting"] },
  {
    label: "Развръзка",
    iconPhase: "resolution",
    phases: ["resolution", "hunter_revenge", "mayor_successor", "game_over"],
  },
];

export function phaseSigil(phase: string) {
  const sigils: Record<string, string> = {
    lobby: "◇",
    role_reveal: "✦",
    first_night: "☾",
    night: "☾",
    day_announcement: "◉",
    day_discussion: "☼",
    nomination: "△",
    defense: "▱",
    voting: "◆",
    resolution: "✣",
    hunter_revenge: "✕",
    mayor_successor: "♜",
    paused: "Ⅱ",
    game_over: "◈",
  };

  return sigils[phase] ?? "◇";
}

export function phaseNarratorLine(phase: GamePhase, mode: GameMode, narratorVoice: NarratorVoice = "classic") {
  const mafia = getGameFamily(mode) === "mafia";
  if (narratorVoice !== "classic") {
    const voiceLines = narratorVoiceLineBg(narratorVoice, mafia);
    if (voiceLines[phase]) {
      return voiceLines[phase];
    }
  }
  const lines: Partial<Record<GamePhase, string>> = mafia
    ? {
        role_reveal: "Досиетата се раздават. Градът още не знае кой държи ножа.",
        first_night: "Първият договор се подписва без свидетели.",
        night: "Неонът трепти, а алибитата чакат сутринта.",
        day_announcement: "Градът се буди и брои липсващите.",
        day_discussion: "Сега всяка дума тежи повече от факт.",
        voting: "Обвинението вече има име.",
        resolution: "Присъдата влиза в протокола.",
        game_over: "Последната версия остана единствената.",
      }
    : {
        role_reveal: "Картите се обръщат само пред очите на собственика си.",
        first_night: "Мъглата пада ниско. Първите сенки се будят.",
        night: "Селото спи, но гората не.",
        day_announcement: "Утрото казва какво е оцеляло.",
        day_discussion: "Площадът търси глас, който звучи като истина.",
        voting: "Сега подозрението става решение.",
        resolution: "Картата пада на масата.",
        hunter_revenge: "Ловецът не си тръгва сам.",
        game_over: "Последната песен е за победителите.",
      };

  return lines[phase] ?? "Разказвачът обръща следващата страница.";
}

function narratorVoiceLineBg(voice: NarratorVoice, mafia: boolean): Partial<Record<GamePhase, string>> {
  if (voice === "old_villager") {
    return {
      first_night: "Слушай старите греди. Те винаги знаят кой не спи.",
      night: "Никой не става по това време без причина.",
      day_discussion: "Не бързайте с обвиненията. Лъжата обича шум.",
      voting: "Сега ръката тежи повече от думите.",
    };
  }
  if (voice === "inspector") {
    return mafia
      ? {
          first_night: "Първият протокол започва без свидетели.",
          night: "Всички алибита ще бъдат проверени сутринта.",
          day_discussion: "Запишете фактите. После ще останат само версиите.",
          voting: "Обвинението влиза в делото.",
        }
      : {
          first_night: "Първата нощ се записва като особено рискова.",
          night: "Движението в селото се наблюдава.",
          day_discussion: "Съберете показанията преди присъдата.",
          voting: "Решението трябва да издържи на съмнение.",
        };
  }
  if (voice === "witch") {
    return {
      first_night: "Имената кипват като билки в черна вода.",
      night: "Тъмното не крие всичко. Само това, което още не си готов да видиш.",
      day_discussion: "Думите оставят следи по-силни от кръв.",
      voting: "Изберете внимателно. Всяка присъда има вкус.",
    };
  }
  return {};
}

export function phaseBg(phase: string, familyOrMode: GameFamily | GameMode = "werewolves") {
  return isKnownPhase(phase) ? phaseLabelBg(phase, familyOrMode) : phase;
}

function isKnownPhase(phase: string): phase is GamePhase {
  return [
    "lobby",
    "role_reveal",
    "first_night",
    "night",
    "day_announcement",
    "day_discussion",
    "nomination",
    "defense",
    "voting",
    "resolution",
    "hunter_revenge",
    "mayor_successor",
    "paused",
    "game_over",
  ].includes(phase);
}
