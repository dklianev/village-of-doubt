import { render, screen } from "@testing-library/react";
import type { HistoryGameView } from "@/lib/history-highlights";
import { describe, expect, it } from "vitest";
import { CaseFileCard } from "./CaseFileCard";

describe.each([
  { mode: "werewolves_classic", villageLabel: "Селото печели" },
  { mode: "mafia_free", villageLabel: "Гражданите печелят" },
  { mode: "mafia_sport", villageLabel: "Гражданите печелят" },
] as const)("archive winner copy for $mode", ({ mode, villageLabel }) => {
  it.each([
    { winner: "village", label: villageLabel },
    { winner: "werewolves", label: "Върколаците печелят" },
    { winner: "vampires", label: "Вампирите печелят" },
    { winner: "mafia", label: "Мафията печели" },
    { winner: "maniac", label: "Маниакът печели" },
    { winner: "lovers", label: "Влюбените печелят" },
    { winner: "draw", label: "Няма победител" },
    { winner: null, label: "Резултатът не е записан" },
    { winner: "future_winner", label: "Неразпозната развръзка" },
  ])("renders $winner with its family label and replay link", ({ winner, label }) => {
    const game: HistoryGameView = {
      id: "b8d281c8-a264-4a3c-b89b-4d8d1c3e1f20",
      code: "4821",
      config: { playerCount: 8 },
      mode,
      status: "ended",
      winnerTeam: winner,
      startedAt: "2026-05-14T20:30:00.000Z",
      endedAt: "2026-05-14T21:18:00.000Z",
      eventCount: 1,
      timeline: [],
    };

    const { container } = render(<CaseFileCard game={game} />);

    expect(screen.getByRole("heading", { level: 3, name: label })).toBeInTheDocument();
    if (winner === null || winner === "draw") {
      expect(container.querySelector("article")).toHaveAttribute("data-outcome", "unknown");
      expect(screen.queryByText(winner === null ? "Няма победител" : "Резултатът не е записан")).toBeNull();
    }
    expect(screen.getByRole("link", { name: /Отвори дело/ })).toHaveAttribute(
      "href", `/history/${game.id}/replay`,
    );
  });
});
