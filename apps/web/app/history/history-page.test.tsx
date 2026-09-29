import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "./page";
import type { EvidenceWall } from "@/components/history/EvidenceWall";
import type { ComponentProps } from "react";

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(), getPublicGameArchive: vi.fn(), getPublicGameTimelinesBatch: vi.fn(),
  cacheLife: vi.fn(), cacheTag: vi.fn(),
}));
vi.mock("@werewolf/database", () => mocks);
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife, cacheTag: mocks.cacheTag }));
vi.mock("next/form", () => ({ default: "form" }));

async function archive(params: Record<string, string> = {}) {
  const root = HistoryPage({ searchParams: Promise.resolve(params) });
  const boundary = root.props.children[2];
  const content = boundary.props.children;
  const wall = await content.type(content.props) as ReactElement<ComponentProps<typeof EvidenceWall>>;
  return wall.props;
}

describe("archive route data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/mock");
    vi.stubEnv("HISTORY_EVIDENCE_FIXTURE", "0");
    mocks.createDatabase.mockReturnValue({ fixture: true });
    mocks.getPublicGameArchive.mockResolvedValue({ games: [], hasOlder: false, hasNewer: false });
    mocks.getPublicGameTimelinesBatch.mockResolvedValue(new Map());
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("passes normalized filters and cursor into the database, not into a local 20-game filter", async () => {
    const before = "00000000-0000-4000-8000-000000000001";
    const result = await archive({ family: "mafia", outcome: "village", before });
    expect(mocks.getPublicGameArchive).toHaveBeenCalledWith({ fixture: true }, { family: "mafia", outcome: "village", before, limit: 12 });
    expect(result.selection).toEqual({ family: "mafia", outcome: "village", before });
    expect(mocks.cacheTag).toHaveBeenCalledWith("public-game-history");
  });

  it("does not expose room codes or host identities in archive props", async () => {
    mocks.getPublicGameArchive.mockResolvedValue({ games: [{
      id: "00000000-0000-4000-8000-000000000001", code: "SYNTHETIC_PRIVATE_CODE", hostId: "SYNTHETIC_HOST",
      config: { mode: "mafia_free", playerCount: 10 }, status: "ended", winnerTeam: "mafia", startedAt: null,
      endedAt: new Date(0), eventCount: 12,
    }], hasOlder: true, hasNewer: false });
    const result = await archive();
    expect(result.hasOlder).toBe(true);
    expect(result.games[0]).toMatchObject({ mode: "mafia_free", eventCount: 12, endedAt: new Date(0).toISOString() });
    expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_PRIVATE_CODE|SYNTHETIC_HOST/);
  });

  it("ignores all visual fixtures in production", async () => {
    vi.stubEnv("HISTORY_EVIDENCE_FIXTURE", "1");
    const result = await archive({ visualHistory: "paginated" });
    expect(result.games).toEqual([]);
    expect(result.visualHistory).toBeUndefined();
    expect(mocks.getPublicGameArchive).toHaveBeenCalledOnce();
  });

  it("distinguishes a database failure from a successful empty query", async () => {
    expect((await archive()).status).toBe("ready");
    mocks.getPublicGameArchive.mockRejectedValue(new Error("SYNTHETIC_PRIVATE_ERROR"));
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await archive()).status).toBe("unavailable");
    expect(JSON.stringify(logger.mock.calls)).not.toContain("SYNTHETIC_PRIVATE_ERROR");
  });

  it("does not query a missing database or call it empty", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await archive()).status).toBe("unavailable");
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });

  it("can traverse all fixture pages and return to the same first page", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const first = await archive({ visualHistory: "paginated" });
    const second = await archive({ visualHistory: "paginated", before: first.games.at(-1)!.id });
    const third = await archive({ visualHistory: "paginated", before: second.games.at(-1)!.id });
    expect(new Set([...first.games, ...second.games, ...third.games].map(game => game.id)).size).toBe(36);
    expect(third.hasOlder).toBe(false);
    const previous = await archive({ visualHistory: "paginated", after: second.games[0]!.id });
    expect(previous.games).toEqual(first.games);
    expect(previous.hasNewer).toBe(false);
  });
});
