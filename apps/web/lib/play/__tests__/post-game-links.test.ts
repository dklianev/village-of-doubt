import { describe, expect, it } from "vitest";
import { parseRoomCreateOptions } from "@/lib/room-options";
import { historyHrefForGame, repeatGameHref } from "@/lib/play/post-game-links";
import type { GameSnapshot } from "@/lib/play/types";

const snapshot: GameSnapshot = {
  code: "NIGHT7",
  mode: "werewolves_classic",
  playerCount: 8,
  narratorMode: "automatic",
  communicationMode: "built_in_chat",
  tempoProfile: "normal_online",
  dayDiscussionSeconds: 180,
  voteSeconds: 60,
  revealRolesOnDeath: true,
  loversEnabled: true,
  doctorCanSelfProtect: false,
  allowSkipVote: true,
  majorityMode: "simple",
  narratorVoice: "classic",
  phase: "game_over",
  round: 3,
  phaseEndsAt: 0,
  winnerTeam: "village",
  winnerReasonBg: "Селото оцеля.",
  players: [],
  roleCounts: [
    { role: "ordinary_villager", count: 4 },
    { role: "werewolf", count: 2 },
    { role: "seer", count: 1 },
    { role: "cupid", count: 1 },
  ],
  voteTally: [],
  publicEvents: [],
  publicChat: [],
};

describe("post-game links", () => {
  it("reopens create with the exact public composition and table settings", () => {
    const href = repeatGameHref(snapshot);
    const url = new URL(href, "https://senkite.test");
    const options = parseRoomCreateOptions(Object.fromEntries(url.searchParams.entries()));

    expect(url.pathname).toBe("/werewolf/create");
    expect(options).toMatchObject({
      mode: "werewolves_classic",
      playerCount: 8,
      maxPlayers: 8,
      rolePreset: "manual",
      narratorMode: "automatic",
      communicationMode: "built_in_chat",
      tempoProfile: "normal_online",
      revealRolesOnDeath: true,
      loversEnabled: true,
      allowSkipVote: true,
      majorityMode: "simple",
      roles: {
        ordinary_villager: 4,
        werewolf: 2,
        seer: 1,
        cupid: 1,
      },
    });
  });

  it("uses the archive until persistence confirms a specific replay", () => {
    expect(historyHrefForGame(null)).toBe("/history");
    expect(historyHrefForGame("7b877d37-0000-5000-8000-123456789abc")).toBe(
      "/history/7b877d37-0000-5000-8000-123456789abc/replay",
    );
  });
});
