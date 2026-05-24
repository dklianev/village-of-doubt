import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RulesSummary } from "@/components/play/RulesSummary";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Анна",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: false,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
    ...overrides,
  };
}

const snapshot: GameSnapshot = {
  code: "4821",
  mode: "werewolves_classic",
  playerCount: 4,
  narratorMode: "full_human",
  communicationMode: "secret_channels",
  tempoProfile: "normal_online",
  dayDiscussionSeconds: 180,
  voteSeconds: 60,
  revealRolesOnDeath: true,
  loversEnabled: true,
  allowSkipVote: false,
  majorityMode: "simple",
  narratorVoice: "classic",
  phase: "lobby",
  round: 0,
  phaseEndsAt: 0,
  winnerTeam: "",
  winnerReasonBg: "",
  players: [
    player({ userId: "u1", displayName: "Анна", playing: true }),
    player({ userId: "u2", displayName: "Борис", playing: true }),
    player({ userId: "u3", displayName: "Вяра", playing: false }),
  ],
  roleCounts: [
    { role: "seer", count: 1 },
    { role: "werewolf", count: 1 },
  ],
  voteTally: [],
  publicEvents: [],
  publicChat: [],
};

describe("RulesSummary", () => {
  it("summarizes room settings and counts only playing players", () => {
    render(<RulesSummary snapshot={snapshot} />);

    expect(screen.getByText("правила преди старт")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByText("Пълен човек")).toBeInTheDocument();
    expect(screen.getByText("Тайни канали")).toBeInTheDocument();
    expect(screen.getByText("180s / 60s")).toBeInTheDocument();
    expect(screen.getByText("Класически Разказвач")).toBeInTheDocument();
    expect(screen.getByText("Гадателка")).toBeInTheDocument();
    expect(screen.getAllByText("Върколак").length).toBeGreaterThan(0);
    expect(screen.getByText("В тази стая Пълният Разказвач вижда всички роли и действия.")).toBeInTheDocument();
  });
});
