import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CreateRoomOptions } from "@werewolf/shared";
import { parseRoomCreateOptions } from "@/lib/room-options";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";
import { GameConclusion } from "../GameConclusion";
import { PostGameExtras } from "../PostGameExtras";

const options: CreateRoomOptions = {
  mode: "werewolves_classic", playerCount: 8, maxPlayers: 12, roomName: "Synthetic repeat table",
  roomVisibility: "public", rolePreset: "manual", autoStart: true,
  narratorMode: "automatic", communicationMode: "secret_channels", tempoProfile: "manual",
  roles: { ordinary_villager: 4, werewolf: 2, seer: 1, cupid: 1 },
  loversEnabled: true, revealRolesOnDeath: false, allowSkipVote: false, majorityMode: "absolute",
  beginnerMode: false, advancedMode: true, werewolfVariant: "werewolves_vs_village",
  mayorMode: "public_vote", promoRolesEnabled: false, tieBreaker: "revote", firstNightKill: true,
  mafiaNightKill: false, doctorCanSelfProtect: false, commissionerResultMode: "exact_role",
  maniacEnabled: false, jesterEnabled: false, narratorVoice: "witch",
  customTimers: {
    roleRevealSeconds: 15, factionNightActionSeconds: 75, personalNightActionSeconds: 45,
    dayDiscussionSeconds: 300, playerSpeechSeconds: 50, voteSeconds: 60,
    resolutionSeconds: 12, minimumPhaseSeconds: 8, autoAdvanceWhenReady: false,
  },
};

const viewer: PublicPlayer = {
  userId: "synthetic-viewer", displayName: "Synthetic viewer", playing: false, alive: false,
  connected: true, ready: false, host: false, narrator: false, acceptedFullNarrator: false,
  mayor: false, hasVoted: false, actedThisPhase: false, revealedRole: "",
};

const snapshot: GameSnapshot = {
  code: "SYNTH", mode: "werewolves_classic", playerCount: 8,
  narratorMode: "automatic", communicationMode: "built_in_chat", tempoProfile: "normal_online",
  dayDiscussionSeconds: 180, voteSeconds: 60, revealRolesOnDeath: true, loversEnabled: false,
  allowSkipVote: true, majorityMode: "simple", narratorVoice: "classic", phase: "game_over",
  round: 3, phaseEndsAt: 0, winnerTeam: "village", winnerReasonBg: "Synthetic result.",
  players: [viewer], roleCounts: [], voteTally: [], publicEvents: [], publicChat: [],
};

const surfaces = [
  {
    name: "GameConclusion",
    renderSnapshot: (state: GameSnapshot, currentUserId = viewer.userId) => (
      <GameConclusion snapshot={state} recordedGameId="synthetic-recording" currentUserId={currentUserId} />
    ),
    repeatLabel: "Още една игра",
    fallbackLabel: "Още една игра",
    repeatCopy: /Нова стая със същите настройки\. Участниците се канят отново\./,
    fallbackCopy: /Нова стая за следващата вечер\. Участниците се канят отново\./,
    replayLabel: "Виж записа",
  },
  {
    name: "PostGameExtras",
    renderSnapshot: (state: GameSnapshot, currentUserId = viewer.userId) => (
      <PostGameExtras section="actions" snapshot={state} recordedGameId="synthetic-recording" currentUserId={currentUserId} />
    ),
    repeatLabel: "Повтори настройките",
    fallbackLabel: "Нова игра",
    repeatCopy: "Настройки за нова стая. Участниците се канят отново.",
    fallbackCopy: "Нова стая с тази игра. Провери настройките и покани участниците отново.",
    replayLabel: "Виж записа на играта",
  },
];

describe.each(surfaces)("$name next-room settings boundary", (surface) => {
  it("validates raw settings before rendering the full repeat URL and matching copy", () => {
    const state = {
      ...snapshot,
      nextRoomOptionsJson: JSON.stringify({
        ...options, code: "OLD123", spectator: true, token: "synthetic-token",
        privatePlayers: { "synthetic-private-user": { role: "werewolf" } },
      }),
    };
    render(surface.renderSnapshot(state));

    const href = screen.getByRole("link", { name: surface.repeatLabel }).getAttribute("href")!;
    const url = new URL(href, "https://senkite.test");
    expect(url.pathname).toBe("/werewolf/create");
    expect(parseRoomCreateOptions(Object.fromEntries(url.searchParams))).toEqual(options);
    expect(url.searchParams.has("code")).toBe(false);
    expect(url.searchParams.has("spectator")).toBe(false);
    expect(decodeURIComponent(href)).not.toMatch(/synthetic-token|synthetic-private-user|privatePlayers/);
    expect(screen.getByText(surface.repeatCopy)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: surface.replayLabel }))
      .toHaveAttribute("href", "/history/synthetic-recording/replay");
    expect(state).not.toHaveProperty("nextRoomOptions");
  });

  it.each([
    { label: "absent", json: undefined },
    { label: "empty", json: "" },
    { label: "malformed public JSON", json: '{"roomVisibility":"public"' },
    { label: "incomplete public settings", json: '{"roomVisibility":"public"}' },
    { label: "invalid public settings", json: JSON.stringify({ ...options, playerCount: 31 }) },
  ])("uses safe repeat and archive fallbacks for $label", ({ json }) => {
    render(surface.renderSnapshot({ ...snapshot, ...(json === undefined ? {} : { nextRoomOptionsJson: json }) }));

    const href = screen.getByRole("link", { name: surface.fallbackLabel }).getAttribute("href")!;
    const url = new URL(href, "https://senkite.test");
    expect(url.pathname).toBe("/werewolf/create");
    expect(url.searchParams.get("players")).toBe(String(snapshot.playerCount));
    expect(url.searchParams.has("visibility")).toBe(false);
    expect(url.searchParams.has("roomName")).toBe(false);
    expect(screen.getByText(surface.fallbackCopy)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");
    expect(screen.queryByRole("link", { name: surface.replayLabel })).not.toBeInTheDocument();
  });

  it.each([
    { label: "private spectator", visibility: "private", playing: false, host: false, userId: viewer.userId, eligible: false },
    { label: "private participant", visibility: "private", playing: true, host: false, userId: viewer.userId, eligible: true },
    { label: "private host", visibility: "private", playing: false, host: true, userId: viewer.userId, eligible: true },
    { label: "private outsider", visibility: "private", playing: true, host: true, userId: "synthetic-outsider", eligible: false },
    { label: "public spectator", visibility: "public", playing: false, host: false, userId: viewer.userId, eligible: true },
    { label: "public anonymous viewer", visibility: "public", playing: false, host: false, userId: "", eligible: true },
  ])("preserves replay eligibility for a $label", ({ visibility, playing, host, userId, eligible }) => {
    render(surface.renderSnapshot({
      ...snapshot,
      players: [{ ...viewer, playing, host }],
      nextRoomOptionsJson: JSON.stringify({ ...options, roomVisibility: visibility }),
    }, userId));

    expect(screen.getByRole("link", { name: eligible ? surface.replayLabel : "Към архива" }))
      .toHaveAttribute("href", eligible ? "/history/synthetic-recording/replay" : "/history");
    if (!eligible) expect(screen.queryByRole("link", { name: surface.replayLabel })).not.toBeInTheDocument();
  });

  it("revalidates changed wire settings without retaining public replay access or stale repeat copy", () => {
    const { rerender } = render(surface.renderSnapshot({ ...snapshot, nextRoomOptionsJson: JSON.stringify(options) }));
    expect(screen.getByRole("link", { name: surface.replayLabel })).toBeInTheDocument();

    rerender(surface.renderSnapshot({
      ...snapshot, nextRoomOptionsJson: JSON.stringify({ ...options, roomVisibility: "private" }),
    }));
    const privateUrl = new URL(screen.getByRole("link", { name: surface.repeatLabel }).getAttribute("href")!, "https://senkite.test");
    expect(privateUrl.searchParams.get("visibility")).toBe("private");
    expect(screen.getByText(surface.repeatCopy)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");

    rerender(surface.renderSnapshot({
      ...snapshot, nextRoomOptionsJson: JSON.stringify({ ...options, customTimers: { voteSeconds: "invalid" } }),
    }));
    expect(screen.getByText(surface.fallbackCopy)).toBeInTheDocument();
    expect(screen.queryByText(surface.repeatCopy)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: surface.fallbackLabel })).not.toHaveAttribute("href", expect.stringContaining("visibility="));
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");
  });
});
