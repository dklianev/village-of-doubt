import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameSnapshot } from "@/lib/play/types";
import { DeferredPostGameExtras } from "../DeferredPostGameExtras";

vi.mock("../PostGameExtras", () => { throw new Error("Chunk unavailable"); });

const snapshot: GameSnapshot = {
  code: "STORY", mode: "werewolves_classic", playerCount: 6,
  narratorMode: "automatic", communicationMode: "built_in_chat", tempoProfile: "normal_online",
  dayDiscussionSeconds: 180, voteSeconds: 60, revealRolesOnDeath: false,
  loversEnabled: false, allowSkipVote: true, majorityMode: "simple", narratorVoice: "classic",
  phase: "game_over", round: 3, phaseEndsAt: 0, winnerTeam: "village", winnerReasonBg: "",
  players: [], roleCounts: [], voteTally: [], publicEvents: [], publicChat: [],
};

describe("deferred post-game failure", () => {
  it.each([
    ["werewolves_classic", "/werewolf/create"],
    ["mafia_free", "/mafia/create"],
  ] as const)("keeps an honest way out for %s when the optional chunk fails", async (mode, href) => {
    render(<>
      <h1>Край на играта</h1>
      <DeferredPostGameExtras section="actions" snapshot={{ ...snapshot, mode }} recordedGameId={null} currentUserId="viewer" />
      <DeferredPostGameExtras section="story" snapshot={{ ...snapshot, mode }} recordedGameId={null} currentUserId="viewer" />
    </>);
    expect(await screen.findByRole("link", { name: "Нова игра" })).toHaveAttribute("href", href);
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("heading", { name: "Край на играта" })).toBeVisible();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Обобщението не се зареди.");
    expect(screen.queryByRole("link", { name: "Повтори настройките" })).not.toBeInTheDocument();
  });
});
