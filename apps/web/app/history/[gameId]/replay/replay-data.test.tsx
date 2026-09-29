import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameTimelineCursorExpiredError, getGameHistoryById, getGameReplayAchievements, getGameReplayParticipants, getGameTimeline, getPlayerRolesInGames, getReplayParticipantContext } from "@werewolf/database";
import { replayCursor } from "@/lib/replay-presentation";
import ReplayPage from "./page";

vi.mock("@werewolf/database", async (importOriginal) => ({
  GameTimelineCursorExpiredError: (await importOriginal<typeof import("@werewolf/database")>()).GameTimelineCursorExpiredError,
  createDatabase: vi.fn(() => ({})), getGameHistoryById: vi.fn(), getGameTimeline: vi.fn(),
  getPlayerRolesInGames: vi.fn(), getGameReplayParticipants: vi.fn(), getGameReplayAchievements: vi.fn(),
  getReplayParticipantContext: vi.fn(),
}));
vi.mock("@/lib/require-session", () => ({ requireSession: vi.fn(async () => ({ user: { id: "viewer" } })) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

const gameId = "00000000-0000-4000-8000-000000000001";
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const date = new Date("2026-05-14T20:00:00Z");
const game = { id: gameId, code: "4821", hostId: "viewer", status: "ended", endedAt: date,
  startedAt: date, roomVisibility: "private" as const, winnerTeam: "village", config: { mode: "werewolves_classic" }, eventCount: 4000 };
const event = { id: gameId, createdAt: date, round: 1, phase: "voting", type: "vote_submitted", actorId: null, targetId: null, payload: {}, visibility: "public" };
const roleArtPattern = /\/game-art\/(?:[\w-]+\/)*role-[\w-]+/;
function timelineHeadings() {
  return within(screen.getByRole("region", { name: "Хронология на играта" })).queryAllByRole("heading", { level: 4, hidden: true });
}
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", `/history/${gameId}/replay`);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
  vi.stubEnv("DATABASE_URL", "postgres://localhost/synthetic-test");
  vi.mocked(getGameHistoryById).mockResolvedValue(game);
  vi.mocked(getGameTimeline).mockResolvedValue([]);
  vi.mocked(getPlayerRolesInGames).mockResolvedValue(new Map());
  vi.mocked(getGameReplayParticipants).mockResolvedValue([]);
  vi.mocked(getGameReplayAchievements).mockResolvedValue([]);
  vi.mocked(getReplayParticipantContext).mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", `/history/${gameId}/replay`);
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("replay authorization, availability and continuation", () => {
  it.each(["fixture", "long"])("expires missing %s fixture anchors and offers a cursor-free restart", async (visualReplay) => {
    vi.stubEnv("NODE_ENV", "development");
    const after = replayCursor({ ...event, id: "00000000-0000-4000-8000-000000009999" });
    const { unmount } = render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ visualReplay, after }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Продължението на записа вече не е достъпно");
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", `/history/${gameId}/replay?visualReplay=${visualReplay}`);
    expect(getGameHistoryById).not.toHaveBeenCalled();
    unmount();
    render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ visualReplay }) }));
    expect(screen.getByRole("heading", { name: "Ходът на вечерта" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("resolves fixture position by anchor ID, not by the supplied rounded timestamp", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const after = replayCursor({ ...event, id: "00000000-0000-4000-8000-000000000200", createdAt: new Date(0) });
    render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ visualReplay: "long", after }) }));
    expect(timelineHeadings()).toHaveLength(200);
    expect(timelineHeadings()[0]!.closest("li")!.querySelector("time")).toHaveAttribute("dateTime", "2026-05-14T20:33:20.000Z");
  });
  it("retains a spectator name and classification beyond the page containing their join", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another", roomVisibility: "public" });
    vi.mocked(getGameTimeline).mockResolvedValue([{ ...event, type: "player_left", actorId: "observer" }]);
    vi.mocked(getReplayParticipantContext).mockResolvedValue([
      { ...event, id: "join", type: "player_joined", actorId: "observer", payload: { displayName: "Неда", spectator: true } },
      { ...event, id: "private", type: "player_joined", actorId: "hidden", visibility: "moderator", payload: { displayName: "secret-name" } },
    ]);
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: replayCursor(event) }) }));
    expect(getReplayParticipantContext).toHaveBeenCalledWith(expect.anything(), gameId, ["observer"], "public");
    expect(screen.getByText("Неда", { exact: true }).closest("li")).toHaveTextContent(/Неда\s*Наблюдател/);
    expect(container).toHaveTextContent("Неда излезе от стаята.");
    expect(container).not.toHaveTextContent("secret-name");
  });
  it("renders a retryable unavailable state for DB failure instead of claiming 404", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getGameHistoryById).mockRejectedValue(new Error("offline"));
    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Записът временно не е достъпен");
    expect(screen.getByRole("link", { name: "Опитай отново" })).toHaveAttribute("href", `/history/${gameId}/replay`);
  });
  it("offers an explicit restart for an expired anchor instead of an outage or false empty result", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getGameTimeline).mockRejectedValue(new GameTimelineCursorExpiredError());
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: replayCursor(event) }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Продължението на записа вече не е достъпно");
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", `/history/${gameId}/replay`);
    expect(screen.queryByRole("link", { name: "Опитай отново" })).toBeNull();
    expect(container).not.toHaveTextContent("Няма следващи събития");
    expect(screen.queryByRole("region", { name: "Хронология на играта" })).toBeNull();
    expect(getReplayParticipantContext).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
  it("retains the cursor when retrying an actual continuation query failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getGameTimeline).mockRejectedValue(new Error("synthetic outage"));
    const cursor = replayCursor(event);
    render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: cursor }) }));
    const href = screen.getByRole("link", { name: "Опитай отново" }).getAttribute("href")!;
    expect(new URL(href, "http://local").searchParams.get("after")).toBe(cursor);
    expect(screen.queryByRole("link", { name: "Към началото" })).toBeNull();
  });
  it("does not disclose private games to an outsider", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another" });
    await expect(ReplayPage({ params: Promise.resolve({ gameId }) })).rejects.toThrow("NOT_FOUND");
    expect(getGameTimeline).not.toHaveBeenCalled();
    expect(getGameReplayAchievements).not.toHaveBeenCalled();
  });
  it("keeps missing records indistinguishable from denied records", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue(null);
    await expect(ReplayPage({ params: Promise.resolve({ gameId }) })).rejects.toThrow("NOT_FOUND");
  });
  it.each([
    { status: "active", endedAt: null }, { status: "abandoned", endedAt: date }, { status: "ended", endedAt: null },
  ])("never serves an incomplete game: $status / $endedAt", async (fields) => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, ...fields });
    await expect(ReplayPage({ params: Promise.resolve({ gameId }) })).rejects.toThrow("NOT_FOUND");
    expect(getGameTimeline).not.toHaveBeenCalled();
  });
  it("allows completed private participant replays without requiring host ownership", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another" });
    vi.mocked(getPlayerRolesInGames).mockResolvedValue(new Map([[gameId, "jester"]]));
    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(getGameTimeline).toHaveBeenCalledWith(expect.anything(), gameId, 201, expect.objectContaining({ visibilityFilter: "all" }));
    expect(screen.getByText("Пълен запис")).toBeInTheDocument();
  });
  it("excludes private events, roles and achievement inference for public outsiders", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another", roomVisibility: "public" });
    vi.mocked(getGameTimeline).mockResolvedValue([event, { ...event, id: "secret", visibility: "moderator", payload: { messageBg: "private-content" } }]);
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(getGameTimeline).toHaveBeenCalledWith(expect.anything(), gameId, 201, expect.objectContaining({ visibilityFilter: "public" }));
    expect(getGameReplayParticipants).toHaveBeenCalledWith(expect.anything(), gameId, { includeRoles: false });
    expect(getGameReplayAchievements).not.toHaveBeenCalled();
    expect(container).not.toHaveTextContent("private-content");
    expect(container).toHaveTextContent("1 събитие в тази част");
    expect(container).not.toHaveTextContent("4000");
  });
  it("uses persisted awards for authorized viewers, not partial timeline guesses", async () => {
    vi.mocked(getGameReplayAchievements).mockResolvedValue(["first_blood"]);
    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(screen.getByRole("region", { name: "Отличия от тази вечер" })).toHaveTextContent("Първа кръв");
  });
  it("fetches one bounded extra row and continues from the last displayed event", async () => {
    const events = Array.from({ length: 201 }, (_, index) => ({ ...event,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, createdAt: new Date(date.getTime() + index) }));
    vi.mocked(getGameTimeline).mockResolvedValue(events);
    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(getGameTimeline).toHaveBeenCalledWith(expect.anything(), gameId, 201, expect.objectContaining({ order: "asc" }));
    expect(timelineHeadings()).toHaveLength(200);
    expect(timelineHeadings().at(-1)!.closest("li")!.querySelector("time")).toHaveAttribute("dateTime", events[199]!.createdAt.toISOString());
    const href = screen.getByRole("link", { name: "Следващи събития" }).getAttribute("href")!;
    expect(new URL(href, "http://local").searchParams.get("after")).toBe(replayCursor(events[199]!));
    expect(screen.queryByRole("link", { name: "Към развръзката" })).toBeNull();
  });
  it.each([0, 1, 200])("does not offer a next page for a terminal chunk of %i events", async (count) => {
    vi.mocked(getGameTimeline).mockResolvedValue(Array.from({ length: count }, (_, index) => ({
      ...event, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    })));
    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(timelineHeadings()).toHaveLength(count);
    expect(screen.queryByRole("link", { name: "Следващи събития" })).toBeNull();
  });
  it("opens the first chapter when following the cursor into a final multi-chapter page", async () => {
    const events = Array.from({ length: 200 }, (_, index) => ({ ...event,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, createdAt: new Date(date.getTime() + index) }));
    const continuation = ["resolution", "night", "day_announcement", "voting", "resolution", "game_over"].map((phase, index) => ({
      ...event, id: `00000000-0000-4000-8000-${String(index + 201).padStart(12, "0")}`,
      createdAt: new Date(date.getTime() + 200 + index), phase, round: index === 0 ? 1 : 2,
      type: "phase_change", payload: { phase },
    }));
    vi.mocked(getGameTimeline).mockResolvedValueOnce([...events, continuation[0]!]).mockResolvedValueOnce(continuation);
    const { unmount } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    const href = screen.getByRole("link", { name: "Следващи събития" }).getAttribute("href")!;
    const url = new URL(href, "http://local");
    expect(url.searchParams.get("after")).toBe(replayCursor(events[199]!));
    unmount();
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: url.searchParams.get("after")! }) }));

    expect(screen.getByRole("heading", { name: "Продължение на записа" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Ден 1" })).toBeVisible();
    expect(document.getElementById("chapter-3")).toHaveAttribute("aria-label", "Ден 2");
    expect(document.getElementById("chapter-3")).not.toBeVisible();
    const index = screen.getByRole("navigation", { name: "Фази в тази част" });
    expect(within(index).getByRole("link", { current: "location" })).toHaveTextContent("Ден 1");
    expect(timelineHeadings()[0]).toBeVisible();
    expect(timelineHeadings()).toHaveLength(continuation.length);
    expect(screen.queryByRole("link", { name: "Следващи събития" })).toBeNull();
  });
  it("keeps public continuation cursors on the last displayed authorized event", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another", roomVisibility: "public" });
    const events = Array.from({ length: 201 }, (_, index) => ({
      ...event, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    }));
    vi.mocked(getGameTimeline).mockResolvedValue([
      { ...event, id: "private-anchor", visibility: "private" }, ...events,
      { ...event, id: "moderator-anchor", visibility: "moderator" },
    ]);
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(timelineHeadings()).toHaveLength(200);
    const next = new URL(screen.getByRole("link", { name: "Следващи събития" }).getAttribute("href")!, "http://local");
    expect(next.searchParams.get("after")).toBe(replayCursor(events[199]!));
    expect(container).not.toHaveTextContent("4000");
    expect(container.innerHTML).not.toMatch(/private-anchor|moderator-anchor/);
  });
  it("links to the resolution only when the actual final event is in the displayed chunk", async () => {
    const finalEvent = { ...event, id: "final", phase: "game_over", type: "game_over", payload: { winnerTeam: "village" } };
    const events = Array.from({ length: 200 }, (_, index) => ({ ...event, id: String(index) }));
    vi.mocked(getGameTimeline).mockResolvedValue([...events, finalEvent]);
    const { unmount } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(screen.queryByRole("link", { name: "Към развръзката" })).toBeNull();
    unmount();
    vi.mocked(getGameTimeline).mockResolvedValue([finalEvent]);
    render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: replayCursor(event) }) }));
    const link = screen.getByRole("link", { name: "Към развръзката" });
    expect(link.getAttribute("href")).toMatch(/^#.+/);
    const target = document.getElementById(link.getAttribute("href")!.slice(1))!;
    expect(target).toContainElement(within(screen.getByRole("region", { name: "Хронология на играта" })).getByRole("heading", { level: 4, name: "Селото печели" }));
  });
  it("does not treat a postgame departure as the final event on a continuation page", async () => {
    vi.mocked(getGameTimeline).mockResolvedValue([{ ...event, phase: "game_over", type: "player_left", actorId: "synthetic-player" }]);
    render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: replayCursor(event) }) }));
    expect(screen.getByRole("heading", { level: 4, name: "Играч излезе" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Към развръзката" })).toBeNull();
  });
  it("preserves cursor on a subsequent page and exposes a return to the beginning", async () => {
    render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: replayCursor(event) }) }));
    expect(getGameTimeline).toHaveBeenCalledWith(expect.anything(), gameId, 201, expect.objectContaining({ after: { id: gameId, createdAt: date } }));
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", `/history/${gameId}/replay`);
  });
});

describe("replay role artwork and participant privacy", () => {
  it.each([
    { mode: "werewolves_classic", winnerTeam: "village", title: "Селото оцеля." },
    { mode: "mafia_free", winnerTeam: "village", title: "Градът оцеля." },
    { mode: "werewolves_classic", winnerTeam: "draw", title: "Няма победител." },
    { mode: "mafia_free", winnerTeam: "draw", title: "Няма победител." },
  ])("keeps $mode / $winnerTeam separate from the public final Jester reveal", async ({ mode, winnerTeam, title }) => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another", roomVisibility: "public", winnerTeam, config: { mode } });
    vi.mocked(getGameReplayParticipants).mockResolvedValue([
      { userId: "synthetic-jester", displayName: "Борис", role: null, isAlive: false },
      { userId: "synthetic-ally", displayName: "Анна", role: null, isAlive: winnerTeam !== "draw" },
    ]);
    vi.mocked(getGameTimeline).mockResolvedValue([
      { ...event, id: "death", type: "death", targetId: "synthetic-jester", payload: { causeBg: "Напусна играта след дневното гласуване.", revealRole: null } },
      { ...event, id: "private-win", type: "jester_personal_win", actorId: "synthetic-jester", targetId: "synthetic-jester", visibility: "private" },
      { ...event, id: "final", phase: "game_over", type: "phase_change", payload: { phase: "game_over" } },
      { ...event, id: "roles", phase: "game_over", type: "reveal", payload: { roles: [
        { userId: "synthetic-jester", role: "jester" },
        { userId: "synthetic-ally", role: mode === "mafia_free" ? "civilian" : "ordinary_villager" },
      ] } },
      { ...event, id: "personal-win", phase: "game_over", type: "reveal", targetId: "synthetic-jester", payload: { role: "jester", personalWin: true } },
    ]);

    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    const timeline = screen.getByRole("region", { name: "Хронология на играта" });
    const death = within(timeline).getByRole("heading", { name: "Борис е елиминиран.", hidden: true }).closest("li")!;
    expect(death).not.toHaveTextContent(/Шут|Разкрита роля/);
    const finalReveals = within(timeline).getAllByRole("heading", { name: "Разкриване", hidden: true });
    expect(finalReveals).toHaveLength(2);
    expect(finalReveals[0]!.closest("li")).toHaveTextContent("Борис: Шут");
    expect(finalReveals[1]!.closest("li")).toHaveTextContent("Борис беше Шут и постигна лична победа.");
    expect(timeline.querySelectorAll("[data-replay-event]")).toHaveLength(4);
    expect(container).not.toHaveTextContent("Борис постигна лична победа като Шут.");
    expect(getGameReplayAchievements).not.toHaveBeenCalled();
  });

  it("uses persisted public portraits and survival state, even when this timeline chunk contains no deaths", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another", roomVisibility: "public" });
    vi.mocked(getGameReplayParticipants).mockResolvedValue([
      { userId: "anna", displayName: "Анна", role: "seer", avatarId: "portrait-f01", isAlive: true },
      { userId: "boris", displayName: "Борис", role: "werewolf", avatarId: "portrait-m02", isAlive: false },
      { userId: "rada", displayName: "Рада", role: "healer", avatarId: "../../secret" },
    ]);
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }), searchParams: Promise.resolve({ after: replayCursor(event) }) }));
    const anna = screen.getByText("Анна", { exact: true }).closest("li")!;
    const boris = screen.getByText("Борис", { exact: true }).closest("li")!;
    const rada = screen.getByText("Рада", { exact: true }).closest("li")!;
    expect(anna).toHaveTextContent("Оцеля");
    expect(anna.querySelector("img")).toHaveAttribute("src", "/game-art/avatars/portrait-f01.webp");
    expect(boris).toHaveTextContent("Елиминиран");
    expect(rada).not.toHaveTextContent(/Оцеля|Елиминиран/);
    expect(rada.querySelector("img")).toHaveAttribute("src", "/game-art/thumbs/card-back-secret.webp");
    expect(container).not.toHaveTextContent(/Гадателка|Върколак\.|Лечител/);
    expect(container.innerHTML).not.toMatch(/role-seer|role-werewolf|role-healer|\.\.\/secret/);
  });

  it.each([
    { mode: "werewolves_classic", role: "seer", label: "Гадателка" },
    { mode: "mafia_free", role: "commissioner", label: "Комисар" },
  ])("does not encode hidden $role roles in public artwork URLs or accessible text", async ({ mode, role, label }) => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another", roomVisibility: "public", config: { mode } });
    // Even an overbroad repository result must not become public role artwork.
    vi.mocked(getGameReplayParticipants).mockResolvedValue([{ userId: "synthetic-player", displayName: "Анна", role }]);
    vi.mocked(getGameTimeline).mockResolvedValue([
      { ...event, actorId: "synthetic-player", payload: {} },
      { ...event, id: "private-role", type: "role_assignment", actorId: "synthetic-player", visibility: "private", payload: { role } },
      { ...event, id: "faction-role", visibility: "faction", payload: { messageBg: "synthetic faction secret" } },
      { ...event, id: "future-role", visibility: "future_visibility", payload: { messageBg: "synthetic unknown secret" } },
    ]);
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(getGameReplayParticipants).toHaveBeenCalledWith(expect.anything(), gameId, { includeRoles: false });
    expect(screen.getByText("Ролята не е показана")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(label);
    expect(decodeURIComponent(container.innerHTML)).not.toMatch(roleArtPattern);
    expect(container.innerHTML).not.toMatch(/private-role|faction-role|future-role|synthetic (?:faction|unknown) secret/);
    expect(timelineHeadings()).toHaveLength(1);
    expect(getGameReplayAchievements).not.toHaveBeenCalled();
  });

  it("keeps a publicly revealed death role in its event without promoting it to the hidden roster", async () => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, hostId: "another", roomVisibility: "public" });
    vi.mocked(getGameReplayParticipants).mockResolvedValue([
      { userId: "synthetic-anna", displayName: "Анна", role: "seer" },
      { userId: "synthetic-boris", displayName: "Борис", role: "werewolf" },
    ]);
    vi.mocked(getGameTimeline).mockResolvedValue([{ ...event, type: "death", phase: "resolution", targetId: "synthetic-boris", payload: { revealRole: "werewolf" } }]);
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    const death = within(screen.getByRole("region", { name: "Хронология на играта" })).getByRole("heading", { name: "Борис е елиминиран." }).closest("li")!;
    expect(death).toHaveTextContent("Борис е елиминиран.");
    expect(death).toHaveTextContent("Разкрита роля: Върколак.");
    for (const name of ["Анна", "Борис"]) {
      const row = screen.getByText(name, { exact: true }).closest("li")!;
      expect(row).toHaveTextContent("Ролята не е показана");
      expect(row).not.toHaveTextContent(/Гадателка|Върколак/);
      expect(decodeURIComponent(row.outerHTML)).not.toMatch(roleArtPattern);
    }
    // Optional art is permitted only inside the already-public death event.
    const outsideDeath = container.cloneNode(true) as HTMLElement;
    within(outsideDeath).getByRole("heading", { name: "Борис е елиминиран." }).closest("li")!.remove();
    expect(decodeURIComponent(outsideDeath.innerHTML)).not.toMatch(roleArtPattern);
    expect(container).not.toHaveTextContent("Гадателка");
  });

  it.each([
    { mode: "werewolves_classic", role: "seer", art: "role-seer", label: "Гадателка" },
    { mode: "mafia_free", role: "commissioner", art: "role-commissioner", label: "Комисар" },
  ])("renders authorized $role artwork in the matching participant row", async ({ mode, role, art, label }) => {
    vi.mocked(getGameHistoryById).mockResolvedValue({ ...game, config: { mode } });
    vi.mocked(getGameReplayParticipants).mockResolvedValue([{ userId: "synthetic-player", displayName: "Анна", role }]);
    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    const row = screen.getByText("Анна", { exact: true }).closest("li")!;
    expect(row).toHaveTextContent(label);
    expect(decodeURIComponent(row.outerHTML)).toContain(art);
    expect(getGameReplayParticipants).toHaveBeenCalledWith(expect.anything(), gameId, { includeRoles: true });
  });

  it("never renders unknown role codes or nameless participant IDs as labels or artwork", async () => {
    const actorId = "00000000-0000-4000-8000-000000000998";
    const targetId = "synthetic-internal-target";
    vi.mocked(getGameReplayParticipants).mockResolvedValue([{ userId: "synthetic-player", displayName: "Анна", role: "future_role" }]);
    vi.mocked(getGameTimeline).mockResolvedValue([{ ...event, actorId, targetId }]);
    const { container } = render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    expect(container).toHaveTextContent("Неизвестна роля");
    expect(container).toHaveTextContent("Неназован участник гласува за Неназован участник.");
    expect(container.textContent).not.toMatch(/future_role|synthetic-internal-target|00000000-0000-4000-8000-000000000998/);
    expect(decodeURIComponent(container.innerHTML)).not.toMatch(/future_role|\/game-art\/(?:[\w-]+\/)*role-/);
    const accessibleAttributes = [...container.querySelectorAll("[aria-label], [title], [alt]")]
      .flatMap((element) => [element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("alt")]).join(" ");
    expect(accessibleAttributes).not.toContain(actorId);
    expect(accessibleAttributes).not.toContain(targetId);
  });

  it("keeps the first four participants visible and discloses the remaining roster natively", async () => {
    const names = ["Анна", "Борис", "Рада", "Неда", "Дара", "Иво"];
    vi.mocked(getGameReplayParticipants).mockResolvedValue(names.map((displayName, index) => ({ userId: `synthetic-${index}`, displayName, role: null })));
    render(await ReplayPage({ params: Promise.resolve({ gameId }) }));
    const roster = screen.getByRole("complementary", { name: "Участници в записа" });
    for (const name of names.slice(0, 4)) expect(within(roster).getByText(name, { exact: true })).toBeVisible();
    const summary = within(roster).getByText("Всички участници", { exact: true }).closest("summary")!;
    const details = summary.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    for (const name of names.slice(4)) expect(within(roster).getByText(name, { exact: true })).not.toBeVisible();
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
    for (const name of names) expect(within(roster).getByText(name, { exact: true })).toBeVisible();
  });
});
