import type { GameMode } from "@werewolf/shared";
import { groupReplayTimeline, type ReplayEvent } from "./replay-presentation";

export type ReplayPhaseGroup = ReturnType<typeof groupReplayTimeline>[number];

export type ReplayChapter = {
  key: string;
  label: string;
  phase: string;
  round: number;
  groups: ReplayPhaseGroup[];
};

function chapterHeading(group: ReplayPhaseGroup): Pick<ReplayChapter, "phase" | "label"> {
  switch (group.phase) {
    case "lobby":
    case "role_reveal":
      return { phase: "role_reveal", label: "Начало" };
    case "first_night":
    case "night":
      return { phase: "night", label: `Нощ ${group.round}` };
    case "day_announcement":
    case "day_discussion":
    case "nomination":
    case "defense":
    case "voting":
    case "resolution":
      return { phase: "day_discussion", label: `Ден ${group.round}` };
    case "game_over":
      return { phase: "game_over", label: "Край" };
    default:
      return { phase: group.phase, label: group.phaseLabel };
  }
}

// Events must already be authorized and ordered; chapters only change their presentation.
export function groupReplayChapters(events: readonly ReplayEvent[], mode: GameMode): ReplayChapter[] {
  const chapters: ReplayChapter[] = [];
  for (const group of groupReplayTimeline(events, mode)) {
    const previous = chapters.at(-1);
    if (previous && (group.phase === "paused" || group.phase === "game_over")) {
      previous.groups.push(group);
      continue;
    }

    const heading = chapterHeading(group);
    if (previous && previous.phase === heading.phase
      && (previous.round === group.round || heading.phase === "role_reveal")) {
      previous.groups.push(group);
    } else {
      // Canonical heading phases do not replace the original phase-N deep-link groups.
      chapters.push({ key: `chapter-${chapters.length + 1}`, ...heading, round: group.round, groups: [group] });
    }
  }
  return chapters;
}
