import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";
import type { TerminalGameResult } from "@werewolf/shared";
import { terminalResultForState } from "@/lib/play/terminal-result";
import { GameConclusion } from "../GameConclusion";

vi.mock("../PostGameStory", () => ({ PostGameStory: () => <div /> }));

const player = (userId: string, displayName: string): PublicPlayer => ({
  userId, displayName, playing: true, alive: true, connected: true, ready: true,
  host: false, narrator: false, acceptedFullNarrator: false, mayor: false,
  hasVoted: false, actedThisPhase: false, revealedRole: "",
});
function fixture(winnerTeam: TerminalGameResult["winnerTeam"], jester = false, mafia = false): GameSnapshot {
  return {
    code: "SYNTH", mode: mafia ? "mafia_free" : "werewolves_classic", playerCount: 3,
    narratorMode: "automatic", communicationMode: "built_in_chat", tempoProfile: "normal",
    dayDiscussionSeconds: 90, voteSeconds: 45, revealRolesOnDeath: false, loversEnabled: false,
    allowSkipVote: false, majorityMode: "simple", narratorVoice: "classic", phase: "game_over",
    round: 3, phaseEndsAt: 0, winnerTeam, winnerReasonBg: "Синтетичен резултат от сървъра.",
    players: [player("one", "Антон"), player("two", "Мира"), { ...player("jester", "Борил"), alive: false }],
    roleCounts: [], voteTally: [], publicEvents: [], publicChat: [],
    terminalResult: { winnerTeam, winnerPlayerIds: winnerTeam === "draw" ? [] : ["two"],
      personalWinnerPlayerIds: jester ? ["jester"] : [],
      finalRoles: [{ userId: "one", role: "werewolf" }, { userId: "two", role: "seer" }, { userId: "jester", role: "jester" }],
    },
  };
}

describe("GameConclusion", () => {
  const variants = [
    ["village", false, "Селото победи", "village"], ["village", true, "Градът победи", "town"],
    ["werewolves", false, "Върколаците победиха", "werewolves"], ["mafia", true, "Мафията победи", "mafia"],
    ["vampires", false, "Вампирите победиха", "vampires"], ["maniac", true, "Маниакът победи", "maniac"],
    ["lovers", false, "Влюбените победиха", "lovers"], ["draw", false, "Няма победител", "draw"],
  ] as const;
  for (const [winner, mafia, title, scene] of variants) {
    it.each([false, true])(`${scene} renders the authoritative outcome with personal victory=%s`, (jester) => {
      const snapshot = fixture(winner, jester, mafia);
      const { container } = render(<GameConclusion snapshot={snapshot} currentUserId="one" recordedGameId="record-1" />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(winner === "draw" && jester ? "Няма победил отбор" : title);
      expect(container.querySelector("[data-endgame]")).toHaveAttribute("data-endgame", scene);
      expect(screen.getByText(snapshot.winnerReasonBg)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Всички роли" })).toHaveAttribute("href", mafia ? "/mafia/roles" : "/werewolf/roles");
      expect(screen.getByRole("link", { name: "Още една игра" }).getAttribute("href")).toContain(mafia ? "/mafia/create?" : "/werewolf/create?");
      expect(screen.getByRole("link", { name: "Виж записа" })).toHaveAttribute("href", "/history/record-1/replay");
      expect(screen.queryAllByText("Лична победа")).toHaveLength(jester ? 1 : 0);
      expect(container.querySelectorAll('img[src$="jester-v1.webp"]')).toHaveLength(jester ? 1 : 0);
      expect(screen.queryAllByText("Победител")).toHaveLength(winner === "draw" ? 0 : 1);
      if (winner !== "draw") expect(within(screen.getByText("Мира").closest("li")!).getByText("Победител")).toBeInTheDocument();
      expect(within(screen.getByText("Антон").closest("li")!).queryByText("Победител")).not.toBeInTheDocument();
    });
  }

  it("does not infer a Jester win or private role from the event text or composition", () => {
    const snapshot = fixture("werewolves");
    delete snapshot.terminalResult;
    snapshot.publicEvents = [{ id: "event", type: "reveal", messageBg: "Борил беше Шут. Лична победа." }];
    render(<GameConclusion snapshot={snapshot} currentUserId="one" recordedGameId={null} />);
    expect(screen.queryByText("И Шутът ви изигра.")).not.toBeInTheDocument();
    expect(screen.queryByText("Шут")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ролята не е разкрита")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("още не е получено");
  });

  it("keeps final results hidden during a nonterminal phase even with a stale payload", () => {
    const snapshot = { ...fixture("mafia", true, true), phase: "voting" as const };
    const { container } = render(<GameConclusion snapshot={snapshot} currentUserId="one" recordedGameId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("recovers missing terminal data without inferring winners, and honors final roles for eliminated players", () => {
    const snapshot = fixture("village", true);
    snapshot.players[1] = { ...snapshot.players[1]!, alive: false, revealedRole: "werewolf" };
    const { terminalResult, ...pending } = snapshot;
    const props = { currentUserId: "two", recordedGameId: null };
    const { container, rerender } = render(<GameConclusion snapshot={pending} {...props} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Победител")).not.toBeInTheDocument();
    expect(screen.queryByText("Лична победа")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");

    const restored = terminalResultForState({ ...snapshot, terminalResultJson: JSON.stringify(terminalResult) });
    expect(restored).toEqual(terminalResult);
    rerender(<GameConclusion snapshot={{ ...pending, terminalResult: restored! }} {...props} recordedGameId="saved-game" />);
    const eliminatedWinner = screen.getByText("Мира").closest("li")!;
    expect(eliminatedWinner).toHaveTextContent("Гадателка");
    expect(eliminatedWinner).not.toHaveTextContent("Върколак");
    expect(within(eliminatedWinner).getByText("Победител")).toBeInTheDocument();
    expect(screen.getByText("Борил").closest("li")).toHaveAttribute("data-personal-winner", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Виж записа" })).toHaveAttribute("href", "/history/saved-game/replay");

    rerender(<GameConclusion snapshot={{ ...snapshot, winnerTeam: "draw" }} {...props} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(container.querySelector("[data-winner], [data-personal-winner]")).toBeNull();
  });

  it("does not offer a private replay to spectators and filters the narrator out of the roster", () => {
    const snapshot = fixture("village");
    snapshot.players.push({ ...player("narrator", "Разказвачът"), playing: false, narrator: true });
    render(<GameConclusion snapshot={snapshot} currentUserId="spectator" recordedGameId="private-game" />);
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");
    expect(screen.queryByRole("link", { name: "Виж записа" })).not.toBeInTheDocument();
    expect(screen.queryByText("Разказвачът")).not.toBeInTheDocument();
  });

  it("does not steal focus when a player is already using another control", () => {
    const { rerender } = render(<button>Още</button>);
    const control = screen.getByRole("button", { name: "Още" });
    control.focus();
    rerender(<><button>Още</button><GameConclusion snapshot={fixture("village")} currentUserId="one" recordedGameId={null} /></>);
    expect(screen.getByRole("button", { name: "Още" })).toHaveFocus();
  });
});
