import { render, screen, within } from "@testing-library/react";
import { getGameHistoryById, getGameTimeline } from "@werewolf/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReplayPage from "./page";

vi.mock("@werewolf/database", () => ({
  createDatabase: vi.fn(() => ({})),
  getGameHistoryById: vi.fn(),
  getGameTimeline: vi.fn(),
  getPlayerRolesInGames: vi.fn(async () => new Map()),
  getGameReplayParticipants: vi.fn(async () => []),
}));

vi.mock("@/lib/require-session", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "viewer" } })),
}));

const gameId = "b8d281c8-a264-4a3c-b89b-4d8d1c3e1f20";
const endedAt = new Date("2026-05-14T21:18:00.000Z");

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/replay-copy-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
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
  });

  it.each([
    { winner: "village", label: villageLabel },
    { winner: "werewolves", label: "Върколаците печелят" },
    { winner: "vampires", label: "Вампирите печелят" },
    { winner: "mafia", label: "Мафията печели" },
    { winner: "maniac", label: "Маниакът печели" },
    { winner: "lovers", label: "Влюбените печелят" },
    { winner: "draw", label: "Равенство" },
    { winner: null, label: "Няма победител" },
    { winner: "future_winner", label: "Победителят не е записан" },
  ])("renders $winner consistently in the summary, verdict and timeline", async ({ winner, label }) => {
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

    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));

    expect(container.querySelector(".replay-summary")).toHaveTextContent(`Победител${label}`);
    expect(screen.getByRole("heading", { level: 2, name: label })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Хронология на играта" }))
      .getByText(`победител: ${label}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Назад към историята" })).toHaveAttribute("href", "/history");
  });

  it("keeps the jester personal victory separate from the winning team", async () => {
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

    expect(screen.getByRole("heading", { level: 2, name: villageLabel })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Лична победа" })).toBeInTheDocument();
    expect(screen.getByText("роля: Шут")).toBeInTheDocument();
  });
});
