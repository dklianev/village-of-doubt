import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameSnapshot } from "@/lib/play/types";
import { DeferredGameConclusion } from "../DeferredGameConclusion";

vi.mock("../GameConclusion", () => { throw new Error("Chunk unavailable"); });

const snapshot: GameSnapshot = {
  code: "SYNTH", mode: "werewolves_classic", playerCount: 6,
  narratorMode: "automatic", communicationMode: "built_in_chat", tempoProfile: "normal_online",
  dayDiscussionSeconds: 180, voteSeconds: 60, revealRolesOnDeath: false,
  loversEnabled: false, allowSkipVote: true, majorityMode: "simple", narratorVoice: "classic",
  phase: "game_over", round: 3, phaseEndsAt: 0, winnerTeam: "draw", winnerReasonBg: "Отборите не успяха да победят.",
  players: [], roleCounts: [], voteTally: [], publicEvents: [], publicChat: [],
  terminalResult: { winnerTeam: "draw", winnerPlayerIds: [], personalWinnerPlayerIds: ["jester"],
    finalRoles: [{ userId: "jester", role: "jester" }] },
};

describe("conclusion chunk failure", () => {
  it.each([
    ["werewolves_classic", "/werewolf/create"], ["mafia_free", "/mafia/create"],
  ] as const)("preserves personal victory and a way out for %s", async (mode, href) => {
    render(<DeferredGameConclusion snapshot={{ ...snapshot, mode }} currentUserId="viewer" recordedGameId={null} />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Край на играта");
    expect(screen.getByText(snapshot.winnerReasonBg)).toBeInTheDocument();
    expect(screen.queryByText("Никой не печели")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Нова игра" })).toHaveAttribute("href", href);
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("status")).toHaveTextContent("Обобщението не се зареди.");
  });
});
