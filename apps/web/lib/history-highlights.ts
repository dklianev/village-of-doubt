import type { GameMode } from "@werewolf/shared";

export interface HistoryTimelineEventView {
  id: string;
  round: number;
  phase: string;
  type: string;
  actorId: string | null;
  targetId: string | null;
  visibility: string;
  payload: unknown;
  createdAt: string;
}

export interface HistoryGameView {
  id: string;
  code: string;
  config: unknown;
  status: string;
  winnerTeam: string | null;
  startedAt: string | null;
  endedAt: string | null;
  eventCount: number;
  mode: GameMode;
  timeline: HistoryTimelineEventView[];
}

export interface CaseFileHighlight {
  id: string;
  label: string;
}

const HIGH_VALUE_TYPES = new Set([
  "game_over",
  "death",
  "reveal",
  "personal_win",
  "night_action",
  "night_action_submitted",
  "vote_tally",
]);

export function topMoments(timeline: HistoryTimelineEventView[], limit = 2): CaseFileHighlight[] {
  const candidates = timeline.filter((event) => HIGH_VALUE_TYPES.has(event.type));
  const taken = candidates.slice(0, limit);

  if (taken.length > 0) {
    return taken.map((event) => ({
      id: event.id,
      label: event.round > 0 ? `Рунд ${event.round}: ${formatHighlight(event)}` : formatHighlight(event),
    }));
  }

  return [{ id: "tiha-nosht", label: "Тиха нощ - без явни обрати." }];
}

function formatHighlight(event: HistoryTimelineEventView): string {
  switch (event.type) {
    case "game_over":
      return "Развръзка на масата";
    case "death":
      return "Смърт в нощта";
    case "reveal":
      return "Разкрита роля";
    case "personal_win":
      return "Лична победа";
    case "night_action":
    case "night_action_submitted":
      return "Тежко нощно действие";
    case "vote_tally":
      return "Гласовете се обърнаха";
    default:
      return "Записано събитие";
  }
}
