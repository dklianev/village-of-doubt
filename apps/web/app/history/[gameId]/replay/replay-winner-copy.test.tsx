import { render, screen, within } from "@testing-library/react";
import { getGameHistoryById, getGameReplayParticipants, getGameTimeline } from "@werewolf/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replayCursor } from "@/lib/replay-presentation";
import ReplayPage from "./page";

vi.mock("@werewolf/database", () => ({
  createDatabase: vi.fn(() => ({})),
  getGameHistoryById: vi.fn(),
  getGameTimeline: vi.fn(),
  getPlayerRolesInGames: vi.fn(async () => new Map()),
  getGameReplayParticipants: vi.fn(async () => []),
  getGameReplayAchievements: vi.fn(async () => []),
  getReplayParticipantContext: vi.fn(async () => []),
}));

vi.mock("@/lib/require-session", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "viewer" } })),
}));

const gameId = "b8d281c8-a264-4a3c-b89b-4d8d1c3e1f20";
const endedAt = new Date("2026-05-14T21:18:00.000Z");
type TimelineEvent = Awaited<ReturnType<typeof getGameTimeline>>[number];

function recordedEvent(index: number, fields: Partial<TimelineEvent>): TimelineEvent {
  return { id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    round: 3, phase: "voting", type: "vote_submitted", actorId: null, targetId: null,
    visibility: "public", payload: {}, createdAt: new Date(endedAt.getTime() - 10_000 + index), ...fields };
}

// GameRoom resolves the death while still voting, then enters resolution before evaluating the team win.
function recordedVoteEnding(causeBg: string, revealRole: string | null = null): TimelineEvent[] {
  return [
    recordedEvent(0, { type: "vote_tally", visibility: "moderator", payload: { tally: [{ userId: "eliminated", count: 3 }] } }),
    recordedEvent(1, { type: "death", targetId: "eliminated", payload: { causeBg, revealRole } }),
    recordedEvent(2, { type: "phase_change", phase: "resolution", payload: { phase: "resolution" } }),
    recordedEvent(3, { type: "phase_change", phase: "game_over", payload: { phase: "game_over" } }),
  ];
}

const voteSubtitle = "Последният глас сложи край на вечерта.";
const genericSubtitle = "Гласовете, съмненията и развръзката на една вечер.";

function expectFinaleNarrative(finalVote: boolean) {
  expect(screen.getByText(finalVote ? voteSubtitle : genericSubtitle, { selector: "p" })).toBeVisible();
  expect(screen.queryByText(finalVote ? genericSubtitle : voteSubtitle, { selector: "p" })).toBeNull();
  expect(screen.queryByText("Последният вот", { selector: "p" }) !== null).toBe(finalVote);
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/replay-copy-test");
  window.history.replaceState(null, "", `/history/${gameId}/replay`);
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", `/history/${gameId}/replay`);
});

describe.each([
  { mode: "werewolves_classic", villageLabel: "Селото печели" },
  { mode: "mafia_free", villageLabel: "Гражданите печелят" },
  { mode: "mafia_sport", villageLabel: "Гражданите печелят" },
] as const)("stored replay winner copy for $mode", ({ mode, villageLabel }) => {
  const game: NonNullable<Awaited<ReturnType<typeof getGameHistoryById>>> = {
    id: gameId,
    code: "4821",
    hostId: "viewer",
    config: { mode },
    roomVisibility: "private",
    status: "ended",
    winnerTeam: "village",
    startedAt: new Date("2026-05-14T20:30:00.000Z"),
    endedAt,
    eventCount: 1,
  };

  beforeEach(() => {
    vi.mocked(getGameHistoryById).mockResolvedValue(game);
    vi.mocked(getGameReplayParticipants).mockResolvedValue([]);
  });

  it.each([
    { winner: "village", label: villageLabel },
    { winner: "werewolves", label: "Върколаците печелят" },
    { winner: "vampires", label: "Вампирите печелят" },
    { winner: "mafia", label: "Мафията печели" },
    { winner: "maniac", label: "Маниакът печели" },
    { winner: "lovers", label: "Влюбените печелят" },
    { winner: "draw", label: "Няма победител" },
    { winner: null, label: "Резултатът не е записан" },
    { winner: "future_winner", label: "Победителят не е записан" },
  ])("renders $winner in the headline and actual final event without a duplicate hero verdict", async ({ winner, label }) => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, winnerTeam: winner });
    vi.mocked(getGameTimeline).mockResolvedValue([{
      id: "game-over",
      round: 3,
      phase: "game_over",
      type: "game_over",
      actorId: null,
      targetId: null,
      visibility: "public",
      payload: { winnerTeam: winner },
      createdAt: endedAt,
    }]);

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    const headline = winner === "village"
      ? mode === "werewolves_classic" ? "Селото оцеля." : "Градът оцеля."
      : `${label}.`;
    const heading = screen.getByRole("heading", { level: 1, name: headline });
    expect(heading).toBeVisible();
    const hero = within(heading.closest("header")!);
    expect(hero.queryByRole("heading", { level: 2 })).toBeNull();
    expect(hero.getByText("Гласовете, съмненията и развръзката на една вечер.", { selector: "p" })).toBeVisible();
    expect(screen.getByText("Пълен запис")).toBeInTheDocument();
    const timeline = screen.getByRole("region", { name: "Хронология на играта" });
    expect(within(timeline).getByRole("heading", { level: 4, name: label })).toBeVisible();
    expect(within(timeline).getByText(label, { selector: "p" })).toBeVisible();
    expect(timeline.querySelectorAll("[data-replay-event]")).toHaveLength(1);
    expect(document.getElementById("chapter-1")).toBeVisible();
    expect(within(screen.getByRole("navigation", { name: "Фази в тази част" })).getAllByRole("link", { name: "Край" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Към развръзката" })).toHaveAttribute("href", "#phase-1");
    expect(document.body.textContent).not.toContain("future_winner");
    expect(screen.getByRole("link", { name: "Назад към историята" })).toHaveAttribute("href", "/history");
  });

  it.each([false, true])("recognizes the recorded vote-resolution-finale sequence with revealed roles=%s", async (reveal) => {
    const role = mode === "werewolves_classic" ? "werewolf" : "mafioso";
    const roleLabel = mode === "werewolves_classic" ? "Върколак" : "Мафиот";
    const cause = `Напусна играта след дневното гласуване${reveal ? ` (${roleLabel})` : ""}.`;
    vi.mocked(getGameTimeline).mockResolvedValue(recordedVoteEnding(cause, reveal ? role : null));

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expectFinaleNarrative(true);
    expect(screen.getByRole("heading", { level: 4, name: villageLabel })).toBeVisible();
  });

  it("recognizes the public ending without requiring a private tally or hidden role", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another-host", roomVisibility: "public" });
    vi.mocked(getGameTimeline).mockResolvedValue(recordedVoteEnding("Напусна играта след дневното гласуване.").slice(1));

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expectFinaleNarrative(true);
    expect(screen.getByText("Публичен запис")).toBeVisible();
  });

  it.each([
    { name: "exact legacy/demo ending", expected: true, fields: {} },
    { name: "different round", expected: false, fields: { round: 2 } },
    { name: "different phase", expected: false, fields: { phase: "night" } },
    { name: "different cause", expected: false, fields: { payload: { causeBg: "Елиминиран след дневното гласуване. Друга причина." } } },
  ])("limits legacy compatibility to the adjacent same-round resolution death: $name", async ({ expected, fields }) => {
    vi.mocked(getGameTimeline).mockResolvedValue([
      recordedEvent(0, { type: "death", phase: "resolution", targetId: "eliminated",
        payload: { causeBg: "Елиминиран след дневното гласуване." }, ...fields }),
      recordedEvent(1, { type: "phase_change", phase: "game_over", payload: { phase: "game_over" } }),
    ]);

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expectFinaleNarrative(expected);
  });

  it("does not look past an intervening event to recover a legacy finale", async () => {
    vi.mocked(getGameTimeline).mockResolvedValue([
      recordedEvent(0, { type: "death", phase: "resolution", targetId: "eliminated", payload: { causeBg: "Елиминиран след дневното гласуване." } }),
      recordedEvent(1, { type: "jester_personal_win", phase: "resolution", targetId: "eliminated" }),
      recordedEvent(2, { type: "phase_change", phase: "game_over", payload: { phase: "game_over" } }),
    ]);

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expectFinaleNarrative(false);
  });

  it.each([
    "night", "hunter", "mayor", "delayed-death", "lover-death", "jester", "no-elimination", "other-cause", "other-round", "missing-resolution",
  ])("keeps %s endings neutral instead of inferring a decisive vote", async (scenario) => {
    const events = recordedVoteEnding("Напусна играта след дневното гласуване.");
    const extra = (fields: Partial<TimelineEvent>) => recordedEvent(10, fields);
    if (scenario === "night") {
      events[1] = { ...events[1]!, phase: "night", payload: { causeBg: "Нападнат през нощта." } };
      events.splice(2, 1);
    } else if (scenario === "hunter" || scenario === "mayor") {
      const phase = scenario === "hunter" ? "hunter_revenge" : "mayor_successor";
      events.splice(2, 0, extra({ type: "phase_change", phase, payload: { phase } }));
      if (scenario === "hunter") events.splice(3, 0, recordedEvent(11, {
        type: "death", phase, targetId: "other-player", payload: { causeBg: "Падна от последния изстрел на Ловеца." },
      }));
    } else if (scenario === "delayed-death") {
      events.splice(3, 0, extra({ type: "death", phase: "resolution", targetId: "other-player", payload: { causeBg: "Вампирско ухапване." } }));
    } else if (scenario === "lover-death") {
      events.splice(2, 0, extra({ type: "death", targetId: "other-player", payload: { causeBg: "Не преживя загубата на любимия човек." } }));
    } else if (scenario === "jester") {
      events.splice(2, 0, extra({ type: "jester_personal_win", targetId: "eliminated" }));
    } else if (scenario === "no-elimination") {
      events.splice(1, 1);
    } else if (scenario === "other-cause") {
      events[1] = { ...events[1]!, payload: { causeBg: "Друга причина." } };
    } else if (scenario === "other-round") {
      events[3] = { ...events[3]!, round: 4 };
    } else {
      events.splice(2, 1);
    }
    vi.mocked(getGameTimeline).mockResolvedValue(events.map((event, index) => ({
      ...event, createdAt: new Date(endedAt.getTime() - 10_000 + index),
    })));

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expectFinaleNarrative(false);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(mode === "werewolves_classic" ? "Селото оцеля." : "Градът оцеля.");
  });

  it.each([1, 2, 3])("requires the decisive evidence in the current cursor page, starting at event %i", async (start) => {
    const events = recordedVoteEnding("Напусна играта след дневното гласуване.");
    vi.mocked(getGameTimeline).mockResolvedValue(events.slice(start));

    render(await ReplayPage({ params: Promise.resolve({ gameId }),
      searchParams: Promise.resolve({ after: replayCursor(events[start - 1]!) }) }));

    expectFinaleNarrative(start === 1);
    expect(screen.getByRole("link", { name: "Към развръзката" })).toBeVisible();
  });

  it("does not infer a vote finale from the persisted winner before the final event is loaded", async () => {
    const events = recordedVoteEnding("Напусна играта след дневното гласуване.");
    vi.mocked(getGameTimeline).mockResolvedValue(events.slice(0, -1));

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expectFinaleNarrative(false);
    expect(screen.queryByRole("link", { name: "Към развръзката" })).toBeNull();
  });

  it("names the public Jester winner from the GameRoom producer shape without a role lookup", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another-host", roomVisibility: "public" });
    vi.mocked(getGameReplayParticipants).mockResolvedValue([
      { userId: "jester-player", displayName: "Борис", role: null },
    ]);
    vi.mocked(getGameTimeline).mockResolvedValue([{
      id: "jester-personal-win",
      round: 2,
      phase: "voting",
      type: "jester_personal_win",
      actorId: null,
      targetId: "jester-player",
      visibility: "public",
      payload: {},
      createdAt: endedAt,
    }]);

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expect(screen.getByText("Публичен запис")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(mode === "werewolves_classic" ? "Селото оцеля." : "Градът оцеля.");
    const timeline = screen.getByRole("region", { name: "Хронология на играта" });
    expect(within(timeline).getByRole("heading", { level: 4, name: "Лична победа" })).toBeVisible();
    expect(within(timeline).getByText("Борис постигна лична победа като Шут.")).toBeVisible();
    expect(within(timeline).queryByText(villageLabel, { exact: true })).toBeNull();
    expect(screen.queryByRole("link", { name: "Към развръзката" })).toBeNull();
    expect(timeline.querySelectorAll("[data-replay-event]")).toHaveLength(1);
    expect(screen.getByText("Ролята не е показана")).toBeInTheDocument();
    expect(getGameReplayParticipants).toHaveBeenLastCalledWith({}, gameId, { includeRoles: false });
  });

  it("keeps a legacy personal victory separate from the winning team", async () => {
    vi.mocked(getGameTimeline).mockResolvedValue([{
      id: "personal-win",
      round: 2,
      phase: "resolution",
      type: "personal_win",
      actorId: "jester-player",
      targetId: null,
      visibility: "public",
      payload: { role: "jester" },
      createdAt: endedAt,
    }]);

    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(mode === "werewolves_classic" ? "Селото оцеля." : "Градът оцеля.");
    const timeline = screen.getByRole("region", { name: "Хронология на играта" });
    expect(within(timeline).queryByText(villageLabel, { exact: true })).toBeNull();
    expect(screen.queryByRole("link", { name: "Към развръзката" })).toBeNull();
    expect(within(timeline).getByRole("heading", { level: 4, name: "Лична победа" })).toBeVisible();
    expect(within(timeline).getByText("Неназован участник постигна лична победа.")).toBeVisible();
    expect(timeline.querySelectorAll("[data-replay-event]")).toHaveLength(1);
  });
});
