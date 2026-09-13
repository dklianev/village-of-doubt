import { describe, expect, it } from "vitest";
import { parseRoomCreateOptions } from "@/lib/room-options";
import { createGameConfigFromOptions, createRoomOptionsFromConfig, type CreateRoomOptions } from "@werewolf/shared";
import { initialState, queryFromState } from "@/lib/lobby-form";
import { canOpenRecordedReplay, historyHrefForGame, repeatGameHref } from "@/lib/play/post-game-links";
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
  it("preserves the complete permitted setup through creation and submission", () => {
    const nextRoomOptions: CreateRoomOptions = {
      mode: "werewolves_classic", playerCount: 8, maxPlayers: 12, roomName: "Evening table",
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
    const url = new URL(repeatGameHref({ ...snapshot, nextRoomOptions }), "https://senkite.test");
    const parsed = parseRoomCreateOptions(Object.fromEntries(url.searchParams));
    expect(parsed).toEqual(nextRoomOptions);
    const form = initialState({ urlParams: url.searchParams });
    const submitted = parseRoomCreateOptions(Object.fromEntries(new URLSearchParams(queryFromState(form))));
    expect(form.formError).toBe("");
    expect(createGameConfigFromOptions(submitted)).toEqual(createGameConfigFromOptions(nextRoomOptions));
  });

  it("does not carry room identity or spectator admission into the next game", () => {
    const url = new URL(repeatGameHref({ ...snapshot, nextRoomOptions: {
      mode: "mafia_free", roomVisibility: "private", code: "OLD123", spectator: true,
    } }), "https://senkite.test");
    expect(url.pathname).toBe("/mafia/create");
    expect(url.searchParams.has("code")).toBe(false);
    expect(url.searchParams.has("spectator")).toBe(false);
  });

  it.each([
    { mode: "werewolves_classic", playerCount: 12, rolePreset: "classic", loversEnabled: false, firstNightKill: false },
    {
      mode: "werewolves_classic", playerCount: 9, rolePreset: "beginner", loversEnabled: false,
      roomName: "Friday review table", roomVisibility: "public", maxPlayers: 12,
      tempoProfile: "manual", customTimers: { voteSeconds: 73, autoAdvanceWhenReady: false },
      firstNightKill: false, revealRolesOnDeath: false, tieBreaker: "revote",
    },
    { mode: "mafia_free", playerCount: 10, rolePreset: "free", doctorCanSelfProtect: false },
    { mode: "mafia_sport", playerCount: 10, rolePreset: "sport" },
  ] satisfies CreateRoomOptions[])("keeps preset settings through the next %j game", (options) => {
    const original = createGameConfigFromOptions(options);
    const { timers, ...configuration } = original;
    const url = new URL(repeatGameHref({ ...snapshot, nextRoomOptions: { ...configuration, customTimers: timers } }), "https://senkite.test");
    expect(url.searchParams.has("roles")).toBe(false);
    const form = initialState({ urlParams: url.searchParams });
    expect(form.rolePreset).toBe(original.rolePreset);
    const submitted = parseRoomCreateOptions(Object.fromEntries(new URLSearchParams(queryFromState(form))));
    expect(createGameConfigFromOptions(submitted)).toEqual(original);
  });

  it("preserves Cupid when repeating the server-accepted nine-player beginner setup", () => {
    const original = createGameConfigFromOptions({
      mode: "werewolves_classic", playerCount: 9, rolePreset: "beginner", loversEnabled: true,
      roomName: "Friday review table", roomVisibility: "public", maxPlayers: 12,
      tempoProfile: "manual", customTimers: { voteSeconds: 73, autoAdvanceWhenReady: false },
      firstNightKill: false, revealRolesOnDeath: false,
    });
    const nextRoomOptions = createRoomOptionsFromConfig(original);
    const url = new URL(repeatGameHref({ ...snapshot, nextRoomOptions }), "https://senkite.test");
    const form = initialState({ urlParams: url.searchParams });
    const submitted = parseRoomCreateOptions(Object.fromEntries(new URLSearchParams(queryFromState(form))));
    const repeated = createGameConfigFromOptions(submitted);

    expect(form.formError).toBe("");
    expect(repeated.roles).toEqual({ ordinary_villager: 4, werewolf: 2, seer: 1, healer: 1, cupid: 1 });
    expect(repeated.loversEnabled).toBe(true);
    expect(url.searchParams.get("preset")).toBe("manual");
    expect(repeated).toEqual({ ...original, rolePreset: "manual" });
  });

  it("uses authoritative counts when they disagree with a named preset", () => {
    const original = createGameConfigFromOptions({
      mode: "werewolves_classic", playerCount: 9,
      roles: { ordinary_villager: 5, werewolf: 2, seer: 1, healer: 1 },
    });
    const nextRoomOptions: CreateRoomOptions = { ...createRoomOptionsFromConfig(original), rolePreset: "classic" };
    const url = new URL(repeatGameHref({ ...snapshot, nextRoomOptions }), "https://senkite.test");
    const form = initialState({ urlParams: url.searchParams });
    const submitted = parseRoomCreateOptions(Object.fromEntries(new URLSearchParams(queryFromState(form))));

    expect(form.formError).toBe("");
    expect(url.searchParams.get("preset")).toBe("manual");
    expect(createGameConfigFromOptions(submitted)).toEqual(original);
  });

  it.each([
    ...(["beginner", "classic", "advanced"] as const).flatMap((rolePreset) =>
      Array.from({ length: 25 }, (_, index) => index + 6).flatMap((playerCount) =>
        [false, true].map((loversEnabled) => ({
          mode: "werewolves_classic" as const, rolePreset, playerCount, loversEnabled,
        })))),
    ...Array.from({ length: 21 }, (_, index) => index + 4).flatMap((playerCount) =>
      [false, true].map((jesterEnabled) => ({
        mode: "mafia_free" as const, rolePreset: "free" as const, playerCount, jesterEnabled,
      }))),
    { mode: "mafia_sport", rolePreset: "sport", playerCount: 10 },
  ] satisfies CreateRoomOptions[])("round-trips the real creation form for %j", (options) => {
    const original = createGameConfigFromOptions({ ...options, roomName: "Repeat table" });
    const url = new URL(repeatGameHref({ ...snapshot, nextRoomOptions: createRoomOptionsFromConfig(original) }), "https://senkite.test");
    const form = initialState({ urlParams: url.searchParams });
    const submitted = parseRoomCreateOptions(Object.fromEntries(new URLSearchParams(queryFromState(form))));
    const repeated = createGameConfigFromOptions(submitted);

    expect(form.formError).toBe("");
    // Manual is the safe fallback when a named preset cannot reproduce the accepted table.
    expect({ ...repeated, rolePreset: original.rolePreset }).toEqual(original);
  });

  it("preserves public manual timers through the create form URL", () => {
    const href = repeatGameHref({ ...snapshot, tempoProfile: "manual", dayDiscussionSeconds: 300, voteSeconds: 90 });
    const url = new URL(href, "https://senkite.test");
    const options = parseRoomCreateOptions(Object.fromEntries(url.searchParams.entries()));

    expect(options.customTimers).toMatchObject({ dayDiscussionSeconds: 300, voteSeconds: 90 });
    expect(url.searchParams.has("tempoNight")).toBe(false);
  });

  it("does not turn a preset tempo into custom timers", () => {
    const url = new URL(repeatGameHref(snapshot), "https://senkite.test");
    expect(url.searchParams.has("tempoDay")).toBe(false);
    expect(url.searchParams.has("tempoVote")).toBe(false);
  });

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
    expect(historyHrefForGame("7b877d37-0000-5000-8000-123456789abc", true)).toBe(
      "/history/7b877d37-0000-5000-8000-123456789abc/replay",
    );
  });

  it("requires explicit replay eligibility before linking to a persisted game", () => {
    expect(historyHrefForGame("private-game")).toBe("/history");
    expect(historyHrefForGame("private-game", false)).toBe("/history");
    expect(historyHrefForGame(null, true)).toBe("/history");
  });

  it("never offers a private recorded replay to a spectator or unknown viewer", () => {
    const spectator = { userId: "spectator", playing: false, narrator: false, host: false } as GameSnapshot["players"][number];
    expect(canOpenRecordedReplay({ ...snapshot, players: [spectator] }, "spectator")).toBe(false);
    expect(canOpenRecordedReplay(snapshot, "unknown")).toBe(false);
    expect(canOpenRecordedReplay(snapshot, "")).toBe(false);
  });

  it("offers a recorded replay to an actual player, even after elimination", () => {
    expect(canOpenRecordedReplay({ ...snapshot, players: [{ userId: "player", playing: true, alive: false } as GameSnapshot["players"][number]] }, "player")).toBe(true);
  });

  it("offers the host narrator a replay but does not treat every narrator as a recorded player", () => {
    const narrator = { userId: "narrator", playing: false, narrator: true, host: true } as GameSnapshot["players"][number];
    expect(canOpenRecordedReplay({ ...snapshot, players: [narrator] }, "narrator")).toBe(true);
    expect(canOpenRecordedReplay({ ...snapshot, players: [{ ...narrator, host: false }] }, "narrator")).toBe(false);
  });

  it("allows public replays but never links to a game that has not ended", () => {
    const publicRoom = { ...snapshot, nextRoomOptions: { roomVisibility: "public" as const } };
    expect(canOpenRecordedReplay(publicRoom, "spectator")).toBe(true);
    expect(canOpenRecordedReplay({ ...publicRoom, phase: "night" }, "spectator")).toBe(false);
  });
});
