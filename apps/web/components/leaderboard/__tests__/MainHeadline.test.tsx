import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainHeadline } from "../MainHeadline";
import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";

vi.mock("next/image", () => ({
  default: ({ alt, priority: _priority, ...props }: { alt: string; src: string; width: number; height: number; className?: string; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

describe("MainHeadline", () => {
  it("renders the undefeated headline", () => {
    render(<MainHeadline entry={entry({ displayName: "Мила", games: 5, wins: 5 })} />);

    expect(screen.getByRole("heading", { name: "Мила още не познава поражение" })).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders the debut headline", () => {
    render(<MainHeadline entry={entry({ displayName: "Анна", games: 1, wins: 1 })} />);

    expect(screen.getByRole("heading", { name: "Първа победа: Анна взе вечерта" })).toBeInTheDocument();
  });

  it("renders the fallback headline", () => {
    render(<MainHeadline entry={entry({ displayName: "Борис", games: 4, wins: 1 })} />);

    expect(screen.getByRole("heading", { name: "Борис оцелява най-често" })).toBeInTheDocument();
  });
});

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    displayName: "Играч",
    games: 1,
    wins: 0,
    lastPlayed: null,
    ...overrides,
  };
}
