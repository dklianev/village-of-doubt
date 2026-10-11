import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stats = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/game-stats", () => ({ loadGameStats: () => Promise.resolve(stats.value) }));

import { HomeLiveSignal } from "../HomeLiveSignal";

const live = (activeRooms: number, connectedPlayers: number) => ({
  liveStats: { activeRooms, connectedPlayers },
  recentEndings: [],
});

describe("HomeLiveSignal", () => {
  beforeEach(() => {
    stats.value = null;
  });

  it("names open tables and players with Bulgarian plurals", async () => {
    stats.value = live(3, 17);
    render(await HomeLiveSignal());
    expect(screen.getByText("На живо: 3 маси · 17 играчи")).toBeInTheDocument();
  });

  it("uses the singular for one table and one player", async () => {
    stats.value = live(1, 1);
    render(await HomeLiveSignal());
    expect(screen.getByText("На живо: 1 маса · 1 играч")).toBeInTheDocument();
  });

  it("stays absent when nobody plays or the game server is unreachable", async () => {
    stats.value = live(0, 0);
    expect(await HomeLiveSignal()).toBeNull();
    stats.value = null;
    expect(await HomeLiveSignal()).toBeNull();
  });
});
