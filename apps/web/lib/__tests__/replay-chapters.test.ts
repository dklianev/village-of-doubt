import type { GameMode } from "@werewolf/shared";
import { describe, expect, it } from "vitest";
import { groupReplayChapters, type ReplayChapter } from "../replay-chapters";
import { groupReplayTimeline, type ReplayEvent } from "../replay-presentation";

const mode: GameMode = "werewolves_classic";

function timeline(...phases: [phase: string, round: number][]): ReplayEvent[] {
  return phases.map(([phase, round], index) => ({
    id: `fixture-event-${index + 1}`,
    phase,
    round,
    type: "phase_change",
    actorId: null,
    targetId: null,
    payload: { phase },
    createdAt: new Date(Date.UTC(2026, 4, 14, 20, index)),
    visibility: "public",
  }));
}

function headings(chapters: ReplayChapter[]) {
  return chapters.map(({ key, label, phase, round }) => ({ key, label, phase, round }));
}

function expectPreserved(events: readonly ReplayEvent[], chapters: ReplayChapter[], gameMode = mode) {
  const groups = chapters.flatMap((chapter) => chapter.groups);
  expect(groups).toEqual(groupReplayTimeline(events, gameMode));
  const flattened = groups.flatMap((group) => group.events);
  expect(flattened).toEqual(events);
  flattened.forEach((event, index) => expect(event).toBe(events[index]));
  const keys = [...chapters.map((chapter) => chapter.key), ...groups.map((group) => group.key)];
  expect(new Set(keys).size).toBe(keys.length);
  expect(chapters.every((chapter) => chapter.groups.length > 0)).toBe(true);
}

describe("replay chapters", () => {
  it("returns no chapters for an empty page", () => {
    expect(groupReplayChapters([], mode)).toEqual([]);
  });

  it("keeps adjacent lobby and role reveal in Start even across the opening round boundary", () => {
    const events = timeline(["lobby", 0], ["paused", 0], ["role_reveal", 1], ["first_night", 1]);
    const chapters = groupReplayChapters(events, mode);

    expect(chapters.map((chapter) => chapter.label)).toEqual(["Начало", "Нощ 1"]);
    expect(chapters[0]?.groups.map((group) => group.phase)).toEqual(["lobby", "paused", "role_reveal"]);
    expectPreserved(events, chapters);
  });

  it.each<GameMode>(["werewolves_classic", "mafia_free", "mafia_sport"])(
    "groups start, night and day phases across recorded rounds in %s", (gameMode) => {
      const events = timeline(
        ["lobby", 1], ["role_reveal", 1], ["first_night", 1], ["night", 1],
        ["day_announcement", 1], ["day_discussion", 1], ["nomination", 1], ["defense", 1],
        ["voting", 1], ["resolution", 1], ["night", 2], ["day_announcement", 2], ["voting", 2],
      );
      const chapters = groupReplayChapters(events, gameMode);

      expect(headings(chapters)).toEqual([
        { key: "chapter-1", label: "Начало", phase: "role_reveal", round: 1 },
        { key: "chapter-2", label: "Нощ 1", phase: "night", round: 1 },
        { key: "chapter-3", label: "Ден 1", phase: "day_discussion", round: 1 },
        { key: "chapter-4", label: "Нощ 2", phase: "night", round: 2 },
        { key: "chapter-5", label: "Ден 2", phase: "day_discussion", round: 2 },
      ]);
      expect(chapters.map((chapter) => chapter.groups.length)).toEqual([2, 2, 6, 1, 2]);
      expectPreserved(events, chapters, gameMode);
    },
  );

  it.each(["role_reveal", "first_night", "night", "day_discussion", "voting", "resolution", "future_phase"])(
    "keeps repeated pauses and resumed %s segments in their current chapter", (phase) => {
      const events = timeline([phase, 3], ["paused", 3], ["paused", 3], [phase, 3], ["paused", 3], [phase, 3]);
      const chapters = groupReplayChapters(events, mode);

      expect(chapters).toHaveLength(1);
      expect(chapters[0]?.groups.map((group) => group.phase)).toEqual([phase, "paused", phase, "paused", phase]);
      expect(chapters[0]?.groups.map((group) => group.key)).toEqual(["phase-1", "phase-2", "phase-3", "phase-4", "phase-5"]);
      expectPreserved(events, chapters);
    },
  );

  it("does not merge a new period or round into the chapter before a pause", () => {
    const events = timeline(
      ["night", 4], ["paused", 4], ["day_announcement", 4], ["paused", 4],
      ["voting", 4], ["paused", 4], ["voting", 5], ["night", 5], ["night", 6],
    );
    const chapters = groupReplayChapters(events, mode);

    expect(chapters.map((chapter) => chapter.label)).toEqual(["Нощ 4", "Ден 4", "Ден 5", "Нощ 5", "Нощ 6"]);
    expect(chapters.map((chapter) => chapter.groups.map((group) => group.phase))).toEqual([
      ["night", "paused"], ["day_announcement", "paused", "voting", "paused"], ["voting"], ["night"], ["night"],
    ]);
    expectPreserved(events, chapters);
  });

  it("labels a page beginning at resolution without inventing earlier phases", () => {
    const events = timeline(["resolution", 7], ["night", 8], ["day_discussion", 8]);
    const chapters = groupReplayChapters(events, mode);

    expect(headings(chapters)).toEqual([
      { key: "chapter-1", label: "Ден 7", phase: "day_discussion", round: 7 },
      { key: "chapter-2", label: "Нощ 8", phase: "night", round: 8 },
      { key: "chapter-3", label: "Ден 8", phase: "day_discussion", round: 8 },
    ]);
    expect(chapters[0]?.groups.map((group) => group.phase)).toEqual(["resolution"]);
    expectPreserved(events, chapters);
  });

  it("keeps an initial pause separate instead of guessing the missing preceding phase", () => {
    const events = timeline(["paused", 6], ["paused", 6], ["voting", 6]);
    const chapters = groupReplayChapters(events, mode);

    expect(chapters.map((chapter) => chapter.label)).toEqual(["Пауза", "Ден 6"]);
    expectPreserved(events, chapters);
  });

  it("appends the finale to the day containing its votes and elimination", () => {
    const events = timeline(["night", 2], ["voting", 2], ["resolution", 2], ["game_over", 2], ["game_over", 2]);
    Object.assign(events[1]!, { type: "vote_tally", payload: { tally: [] } });
    Object.assign(events[2]!, { type: "death", targetId: "fixture-player", payload: {} });
    Object.assign(events[4]!, { type: "game_over", payload: { winnerTeam: "village" } });
    const chapters = groupReplayChapters(events, mode);

    expect(chapters.map((chapter) => chapter.label)).toEqual(["Нощ 2", "Ден 2"]);
    expect(chapters[1]?.groups.map((group) => group.key)).toEqual(["phase-2", "phase-3", "phase-4"]);
    expect(chapters[1]?.groups.flatMap((group) => group.events.map((event) => event.type)))
      .toEqual(["vote_tally", "death", "phase_change", "game_over"]);
    expectPreserved(events, chapters);
  });

  it.each(["role_reveal", "night", "resolution", "paused", "future_phase"])(
    "appends game_over to the last %s chapter even if its recorded round differs", (phase) => {
      const events = timeline([phase, 3], ["game_over", 4]);
      const chapters = groupReplayChapters(events, mode);

      expect(chapters).toHaveLength(1);
      expect(headings(chapters)).toEqual(headings(groupReplayChapters(events.slice(0, 1), mode)));
      expectPreserved(events, chapters);
    },
  );

  it("creates End only when the page has no preceding chapter", () => {
    const events = timeline(["game_over", 9], ["game_over", 9]);
    const chapters = groupReplayChapters(events, mode);

    expect(headings(chapters)).toEqual([{ key: "chapter-1", label: "Край", phase: "game_over", round: 9 }]);
    expectPreserved(events, chapters);
  });

  it("gives distinct unknown phases safe labels without assuming night or day mechanics", () => {
    const events = timeline(
      ["day_discussion", 2], ["future_phase", 2], ["night_future", 2], ["day_future", 2],
      ["<script>unknown</script>", 2], ["__proto__", 2], ["constructor", 2], ["", 2], ["resolution", 2],
    );
    const chapters = groupReplayChapters(events, mode);

    expect(chapters).toHaveLength(events.length);
    expect(chapters.map((chapter) => chapter.phase)).toEqual([
      "day_discussion", "future_phase", "night_future", "day_future", "<script>unknown</script>",
      "__proto__", "constructor", "", "day_discussion",
    ]);
    expect(chapters.map((chapter) => chapter.label)).toEqual([
      "Ден 2", ...Array<string>(7).fill("Неизвестна фаза"), "Ден 2",
    ]);
    expectPreserved(events, chapters);
  });

  it("keeps special phases labeled without guessing whether they belong to night or day", () => {
    const events = timeline(["night", 1], ["hunter_revenge", 1], ["mayor_successor", 1], ["day_announcement", 1]);
    const chapters = groupReplayChapters(events, mode);

    expect(chapters).toHaveLength(4);
    expect(chapters[1]?.label).toBe(groupReplayTimeline(events, mode)[1]?.phaseLabel);
    expect(chapters[2]?.label).toBe(groupReplayTimeline(events, mode)[2]?.phaseLabel);
    expectPreserved(events, chapters);
  });

  it("preserves chronology and unique keys when the same chapter heading recurs later", () => {
    const events = timeline(["voting", 2], ["night", 2], ["resolution", 2], ["future_phase", 2], ["voting", 2]);
    const chapters = groupReplayChapters(events, mode);

    expect(chapters.map((chapter) => chapter.label)).toEqual(["Ден 2", "Нощ 2", "Ден 2", "Неизвестна фаза", "Ден 2"]);
    expectPreserved(events, chapters);
    expect(groupReplayChapters(events, mode)).toEqual(chapters);
  });

  it("uses recorded rounds instead of renumbering a partial page", () => {
    const events = timeline(["night", 0], ["day_announcement", 0], ["night", 12], ["voting", 12]);
    const chapters = groupReplayChapters(events, mode);

    expect(chapters.map((chapter) => chapter.label)).toEqual(["Нощ 0", "Ден 0", "Нощ 12", "Ден 12"]);
    expectPreserved(events, chapters);
  });

  it("does not mutate, sort, deduplicate or filter already authorized events", () => {
    const sameTime = new Date("2026-05-14T20:00:00Z");
    const events = timeline(["voting", 2], ["paused", 2], ["voting", 2], ["resolution", 2], ["game_over", 2]);
    const visibilities = ["moderator", "public", "private", "public", "future_visibility"];
    events.forEach((event, index) => {
      event.id = `fixture-event-${events.length - index}`;
      event.createdAt = sameTime;
      event.visibility = visibilities[index]!;
      Object.freeze(event.payload);
      Object.freeze(event);
    });
    events.push(events.at(-1)!);
    Object.freeze(events);

    const chapters = groupReplayChapters(events, mode);

    expect(chapters).toHaveLength(1);
    expectPreserved(events, chapters);
    chapters[0]!.groups.pop();
    expectPreserved(events, groupReplayChapters(events, mode));
  });
});
