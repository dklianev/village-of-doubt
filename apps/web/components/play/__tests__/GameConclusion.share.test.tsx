import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";
import { GameConclusion } from "../GameConclusion";

vi.mock("../PostGameStory", () => ({ PostGameStory: () => <div /> }));

const player = (userId: string, displayName: string): PublicPlayer => ({
  userId, displayName, playing: true, alive: true, connected: true, ready: true,
  host: false, narrator: false, acceptedFullNarrator: false, mayor: false,
  hasVoted: false, actedThisPhase: false, revealedRole: "",
});

const snapshot: GameSnapshot = {
  code: "SYNTH", mode: "werewolves_classic", playerCount: 2,
  narratorMode: "automatic", communicationMode: "built_in_chat", tempoProfile: "normal",
  dayDiscussionSeconds: 90, voteSeconds: 45, revealRolesOnDeath: false, loversEnabled: false,
  allowSkipVote: false, majorityMode: "simple", narratorVoice: "classic", phase: "game_over",
  round: 2, phaseEndsAt: 0, winnerTeam: "werewolves", winnerReasonBg: "Синтетичен резултат.",
  players: [player("one", "Антон"), player("two", "Мира")],
  roleCounts: [], voteTally: [], publicEvents: [], publicChat: [],
  terminalResult: {
    winnerTeam: "werewolves", winnerPlayerIds: ["one"], personalWinnerPlayerIds: [],
    finalRoles: [{ userId: "one", role: "werewolf" }, { userId: "two", role: "seer" }],
  },
};

let observed: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

describe("GameConclusion sharing and reveal", () => {
  beforeEach(() => {
    observed = null;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { observed = callback; }
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "share");
  });

  it("copies only the public outcome when native sharing is unavailable", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<GameConclusion snapshot={snapshot} recordedGameId={null} currentUserId="one" />);

    fireEvent.click(screen.getByRole("button", { name: "Сподели резултата" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain("Върколаците победиха");
    expect(text).not.toMatch(/Гадателка|Ясновидка|werewolf|seer/);
    expect(await screen.findByRole("button", { name: /Копирано/ })).toBeInTheDocument();
  });

  it("turns the role cards only once the roster is actually seen", () => {
    const { container } = render(<GameConclusion snapshot={snapshot} recordedGameId={null} currentUserId="one" />);
    const roster = container.querySelector('[aria-labelledby="conclusion-roles"]')!;
    // Face down from the first paint, so cards already on screen never flash before turning.
    expect(roster).toHaveAttribute("data-reveal", "waiting");

    act(() => observed?.([{ isIntersecting: true }]));
    expect(roster).toHaveAttribute("data-reveal", "revealed");
    expect(container.querySelector("li")?.getAttribute("style")).toContain("--reveal-index: 0");
  });

  it("leaves the cards face up when nothing could turn them", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<GameConclusion snapshot={snapshot} recordedGameId={null} currentUserId="one" />);
    expect(container.querySelector('[aria-labelledby="conclusion-roles"]')).not.toHaveAttribute("data-reveal");
  });
});
