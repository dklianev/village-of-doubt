import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@colyseus/core";
import { ROLE_DEFINITIONS, type ClientCommand, type GamePhase, type NightActionCommand, type RoleCode } from "@werewolf/shared";
import type { SubmittedNightAction } from "../game-logic/night-resolver.js";
import type { GamePersistence } from "../persistence/game-persistence.js";
import { GameRoom } from "../rooms/GameRoom.js";
import { generateRoomCode, type PrivatePlayerState } from "../rooms/game-room-runtime.js";
import { PlayerPresenceManager } from "../rooms/player-presence-manager.js";
import { RoomPersistenceCoordinator } from "../rooms/room-persistence-coordinator.js";

interface Internals {
  privatePlayers: Map<string, PrivatePlayerState>;
  pendingNightActions: Map<string, SubmittedNightAction[]>;
  pendingHunterRevengeUserId?: string;
  pendingVampireBites: Map<string, unknown>;
  persistenceCoordinator: RoomPersistenceCoordinator;
  handleCommand(client: Client, command: ClientCommand): void;
  advancePhase(): void;
}

const rooms: GameRoom[] = [];
const identity = (userId: string) => ({ userId, displayName: `Synthetic ${userId}`, avatarId: "portrait-m03" as const });
const fakeClient = (sessionId: string) => ({ sessionId, send: vi.fn(), leave: vi.fn() }) as unknown as Client;

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("SENTRY_DSN", "");
  PlayerPresenceManager.resetForTests();
});
afterEach(async () => {
  for (const room of rooms.splice(0)) {
    await room.onDispose();
    room.clock.clear();
    room.clock.stop();
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  PlayerPresenceManager.resetForTests();
});

async function fixture(
  roles: Partial<Record<RoleCode, number>>,
  options: Partial<Parameters<GameRoom["onCreate"]>[0]> = {},
) {
  const count = Object.values(roles).reduce((sum, copies) => sum + copies, 0);
  for (const [role, copies] of Object.entries(roles)) {
    expect(count).toBeGreaterThanOrEqual(ROLE_DEFINITIONS[role as RoleCode].minPlayers);
    expect(copies).toBeLessThanOrEqual(ROLE_DEFINITIONS[role as RoleCode].maxCopies);
  }
  const room = new GameRoom();
  rooms.push(room);
  room.roomId = generateRoomCode();
  room.onCreate({
    code: room.roomId, mode: "werewolves_classic", playerCount: count, roles, rolePreset: "manual",
    tempoProfile: "manual", advancedMode: true, firstNightKill: true,
    loversEnabled: Boolean(roles.cupid), mayorMode: "secret_role", revealRolesOnDeath: false,
    ...options,
  });
  const internals = room as unknown as Internals;
  expect(internals.persistenceCoordinator.enabled).toBe(false);
  const clients: Record<string, Client> = {};
  for (let i = 0; i < count; i++) {
    const userId = `player${i}`;
    clients[userId] = fakeClient(userId);
    await room.onJoin(clients[userId]!, { code: room.state.code }, identity(userId));
  }
  const command = (userId: string, payload: ClientCommand) => {
    const client = clients[userId]!;
    vi.mocked(client.send).mockClear();
    internals.handleCommand(client, payload);
    expect(client.send).not.toHaveBeenCalledWith("safe_error", expect.anything());
  };
  command("player0", { type: "startGame" });
  expect(room.state.phase).toBe("role_reveal");
  const assigned: Partial<Record<RoleCode, number>> = {};
  for (const player of internals.privatePlayers.values()) {
    assigned[player.role!] = (assigned[player.role!] ?? 0) + 1;
  }
  expect(assigned).toEqual(roles);
  const roleIds = (role: RoleCode) => [...internals.privatePlayers.values()]
    .filter((player) => player.role === role).map((player) => player.userId);
  const id = (role: RoleCode) => roleIds(role)[0]!;
  const player = (userId: string) => internals.privatePlayers.get(userId)!;
  const submit = (userId: string, action: NightActionCommand) => command(userId, { type: "submitNightAction", action });
  const advanceTo = (phase: GamePhase, round?: number) => {
    for (let i = 0; i < 20 && (room.state.phase !== phase || (round !== undefined && room.state.round !== round)); i++) {
      expect(room.state.phase).not.toBe("game_over");
      internals.advancePhase();
    }
    expect(room.state.phase).toBe(phase);
    if (round !== undefined) expect(room.state.round).toBe(round);
  };
  const voteOut = (targetUserId: string) => {
    advanceTo("voting");
    for (const voter of internals.privatePlayers.values()) {
      if (voter.alive && voter.userId !== targetUserId) command(voter.userId, { type: "submitVote", targetUserId });
    }
    internals.advancePhase();
    expect(player(targetUserId).alive).toBe(false);
  };
  const availability = (userId: string) => vi.mocked(clients[userId]!.send).mock.calls
    .findLast(([type]) => type === "private_role")?.[1]?.hunterRevengeAvailable;
  return { room, internals, clients, command, submit, roleIds, id, player, advanceTo, voteOut, availability };
}

function attachPersistence(internals: Internals) {
  const persistence = {
    enabled: true,
    ensureGame: vi.fn<GamePersistence["ensureGame"]>(async () => "synthetic-game"),
    markGameActive: vi.fn<GamePersistence["markGameActive"]>(async () => {}),
    upsertPlayers: vi.fn<GamePersistence["upsertPlayers"]>(async () => {}),
    recordEvent: vi.fn<GamePersistence["recordEvent"]>(async () => {}),
    recordAchievement: vi.fn<GamePersistence["recordAchievement"]>(async () => {}),
    finishGame: vi.fn<GamePersistence["finishGame"]>(async () => {}),
    recordGameCompletion: vi.fn<GamePersistence["recordGameCompletion"]>(async () => {}),
  } satisfies GamePersistence;
  const errors = vi.fn();
  internals.persistenceCoordinator = new RoomPersistenceCoordinator(persistence, errors);
  const flush = async () => {
    expect(await internals.persistenceCoordinator.flush(1_000)).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  };
  return { persistence, flush };
}

describe("Thief actor readiness", () => {
  it.each(["check", "skip"] as const)("requires a fresh Seer %s after replacing the Thief's skip", async (decision) => {
    const f = await fixture({ werewolf: 2, thief: 1, seer: 1, ordinary_villager: 9 }, {
      customTimers: { autoAdvanceWhenReady: true },
    });
    f.advanceTo("first_night");
    const thief = f.id("thief");
    const seer = f.id("seer");
    f.submit(thief, { kind: "skip" });
    for (const wolf of f.roleIds("werewolf")) f.submit(wolf, { kind: "skip" });
    f.submit(thief, { kind: "thief_steal", targetUserId: seer });
    expect(f.player(thief).role).toBe("seer");
    expect(f.player(seer).role).toBe("ordinary_villager");
    expect(f.internals.pendingNightActions.has(thief)).toBe(false);
    expect(f.room.state.phase).toBe("first_night");
    f.submit(thief, decision === "check" ? { kind: "check_role", targetUserId: f.id("werewolf") } : { kind: "skip" });
    expect(f.room.state.phase).toBe("day_announcement");
    if (decision === "check") {
      expect(f.clients[thief]!.send).toHaveBeenCalledWith("private_check_result", expect.objectContaining({ isEvil: true }));
    }
    expect(f.clients[seer]!.send).not.toHaveBeenCalledWith("private_check_result", expect.anything());
  });

  it("does not require a fresh action for a stolen passive role", async () => {
    const f = await fixture({ werewolf: 2, thief: 1, ordinary_villager: 10 }, {
      customTimers: { autoAdvanceWhenReady: true },
    });
    f.advanceTo("first_night");
    const thief = f.id("thief");
    const [firstWolf, lastWolf] = f.roleIds("werewolf");
    f.submit(thief, { kind: "skip" });
    f.submit(firstWolf!, { kind: "skip" });
    f.submit(thief, { kind: "thief_steal", targetUserId: f.id("ordinary_villager") });
    expect(f.internals.pendingNightActions.has(thief)).toBe(false);
    f.submit(lastWolf!, { kind: "skip" });
    expect(f.room.state.phase).toBe("day_announcement");
  });

  it("requires both Witch choices or a fresh skip after theft", async () => {
    const f = await fixture({ werewolf: 2, thief: 1, witch: 1, ordinary_villager: 9 }, {
      customTimers: { autoAdvanceWhenReady: true },
    });
    f.advanceTo("first_night");
    const thief = f.id("thief");
    const [victim, poisoned] = f.roleIds("ordinary_villager");
    f.submit(thief, { kind: "skip" });
    for (const wolf of f.roleIds("werewolf")) f.submit(wolf, { kind: "faction_kill", targetUserId: victim! });
    f.submit(thief, { kind: "thief_steal", targetUserId: f.id("witch") });
    expect(f.room.state.phase).toBe("first_night");
    f.submit(thief, { kind: "witch_heal", targetUserId: victim! });
    expect(f.room.state.phase).toBe("first_night");
    f.submit(thief, { kind: "witch_poison", targetUserId: poisoned! });
    expect(f.room.state.phase).toBe("day_announcement");
    expect(f.player(victim!).alive).toBe(true);
    expect(f.player(poisoned!).alive).toBe(false);
  });
});

describe("Hood protection and immediate lover deaths", () => {
  it.each(["direct", "lover", "surviving", "healed-lover", "healed-hood", "hood-is-lover", "cook-is-lover"] as const)(
    "resolves Hunter-dependent protection for %s", async (scenario) => {
      const f = await fixture({ werewolf: 2, witch: 1, cupid: 1, hunter: 1, red_riding_hood: 1,
        healer: 1, cook: 1, ordinary_villager: 2 });
      f.advanceTo("first_night");
      const hunter = f.id("hunter");
      const hood = f.id("red_riding_hood");
      const lover = scenario === "hood-is-lover" ? hood : scenario === "cook-is-lover" ? f.id("cook") : f.id("ordinary_villager");
      f.submit(f.id("cupid"), { kind: "cupid_link", firstUserId: hunter, secondUserId: lover });
      for (const wolf of f.roleIds("werewolf")) {
        f.submit(wolf, { kind: "faction_kill", targetUserId: scenario === "cook-is-lover" ? lover : hood });
      }
      if (!["surviving", "hood-is-lover", "cook-is-lover"].includes(scenario)) {
        f.submit(f.id("witch"), { kind: "witch_poison", targetUserId: scenario === "direct" ? hunter : lover });
      }
      if (scenario === "healed-lover" || scenario === "healed-hood") {
        f.submit(f.id("healer"), { kind: "healer_protect", targetUserId: scenario === "healed-lover" ? lover : hood });
      }
      f.internals.advancePhase();
      const hunterDies = ["direct", "lover", "healed-hood"].includes(scenario);
      const hoodDies = scenario === "direct" || scenario === "lover";
      expect(f.player(hunter).alive).toBe(!hunterDies);
      expect(f.player(hood).alive).toBe(!hoodDies);
      const deathEvents = [...f.room.state.publicEvents].filter((event) => event.type === "death");
      expect(deathEvents.some((event) => event.messageBg.includes(`Synthetic ${hood} `))).toBe(hoodDies);
      if (hunterDies) {
        expect(f.room.state.phase).toBe("hunter_revenge");
        expect(f.internals.pendingHunterRevengeUserId).toBe(hunter);
        expect(f.availability(hunter)).toBe(true);
        expect([...f.room.state.publicEvents].some((event) => event.messageBg.includes("още пази"))).toBe(false);
      } else expect(f.room.state.phase).toBe("day_announcement");
      expect(JSON.stringify(f.room.state.toJSON())).not.toContain("loverId");
    },
  );

  it("keeps Hood protected when the Drunk's second Hunter survives the first Hunter's lover death", async () => {
    const f = await fixture({ werewolf: 3, hunter: 1, drunk: 1, seer: 1, oracle: 1, witch: 1, mayor: 1, cupid: 1, red_riding_hood: 1 });
    const hunter = f.id("hunter");
    const drunk = f.id("drunk");
    expect(f.player(drunk).drunkRealRole).toBe("hunter");
    f.advanceTo("first_night");
    f.submit(f.id("cupid"), { kind: "cupid_link", firstUserId: hunter, secondUserId: f.id("seer") });
    f.advanceTo("night", 2);
    expect(f.player(drunk).role).toBe("hunter");
    for (const wolf of f.roleIds("werewolf")) f.submit(wolf, { kind: "faction_kill", targetUserId: f.id("red_riding_hood") });
    f.submit(f.id("witch"), { kind: "witch_poison", targetUserId: f.id("seer") });
    f.internals.advancePhase();
    expect(f.player(hunter).alive).toBe(false);
    expect(f.player(drunk).alive).toBe(true);
    expect(f.player(f.id("red_riding_hood")).alive).toBe(true);
    expect(f.availability(hunter)).toBe(true);
    expect(f.availability(drunk)).toBe(false);
  });
});

describe("Mafia exact-role checks", () => {
  it.each([false, true])("keeps Jester investigations private with Lawyer cover=%s", async (covered) => {
    const f = await fixture({ mafioso: 2, informant: 1, commissioner: 1, jester: 1, lawyer: 1, civilian: 6 }, {
      mode: "mafia_free", commissionerResultMode: "exact_role",
    });
    const informant = f.id("informant");
    const commissioner = f.id("commissioner");
    const jester = f.id("jester");
    f.advanceTo("first_night");
    if (covered) f.submit(f.id("lawyer"), { kind: "lawyer_cover", targetUserId: jester });
    f.submit(informant, { kind: "check_role", targetUserId: jester });
    f.submit(commissioner, { kind: "check_alignment", targetUserId: jester });
    const broadcast = vi.spyOn(f.room, "broadcast");
    f.internals.advancePhase();
    const result = (userId: string) => vi.mocked(f.clients[userId]!.send).mock.calls
      .findLast(([type]) => type === "private_check_result")?.[1];
    const informantResult = result(informant);
    expect(informantResult).toMatchObject({ targetUserId: jester, role: covered ? "civilian" : "jester" });
    expect(result(commissioner)).toMatchObject(covered ? { targetUserId: jester, isEvil: false } : { targetUserId: jester, role: "jester" });
    if (covered) expect(result(commissioner)).not.toHaveProperty("role");
    for (const [userId, client] of Object.entries(f.clients)) {
      if (userId !== informant && userId !== commissioner) expect(client.send).not.toHaveBeenCalledWith("private_check_result", expect.anything());
    }
    expect(broadcast).not.toHaveBeenCalledWith("private_check_result", expect.anything());
    expect([...f.room.state.players.values()].every((player) => player.revealedRole === "")).toBe(true);
    expect(JSON.stringify(f.room.state.toJSON())).not.toContain("targetUserId");
    const previous = f.clients[informant]!;
    f.clients[informant] = fakeClient(`replacement-${informant}`);
    await f.room.onJoin(f.clients[informant]!, { code: f.room.state.code }, identity(informant));
    await f.room.onLeave(previous);
    f.command(informant, { type: "syncPrivateState" });
    expect(result(informant)).toEqual(informantResult);
  });
});

describe("Hunter achievement completion", () => {
  it.each(["one-shooter", "both-shoot", "first-times-out", "no-shot"] as const)(
    "persists and privately delivers only proven shooters for %s", async (scenario) => {
      const f = await fixture({ werewolf: 3, hunter: 1, drunk: 1, seer: 1, oracle: 1, witch: 1, mayor: 1 });
      const hunter = f.id("hunter");
      const drunk = f.id("drunk");
      f.advanceTo("night", 2);
      expect(f.roleIds("hunter")).toHaveLength(2);
      const { persistence, flush } = attachPersistence(f.internals);
      const wolves = f.roleIds("werewolf");
      const timer = vi.spyOn(f.room.clock, "setTimeout");
      for (const wolf of wolves) f.submit(wolf, { kind: "faction_kill", targetUserId: hunter });
      f.internals.advancePhase();
      expect(f.room.state.phase).toBe("hunter_revenge");
      const shooters: string[] = [];
      if (scenario === "one-shooter" || scenario === "both-shoot") {
        f.command(hunter, { type: "submitHunterRevenge", targetUserId: wolves[0]! });
        shooters.push(hunter);
      } else {
        const timeout = timer.mock.calls.at(-1)?.[0];
        expect(timeout).toBeTypeOf("function");
        timeout!();
      }
      await flush();
      const event = [...f.room.state.publicEvents].find((entry) => entry.type === "hunter_shot");
      if (shooters.length) {
        expect(event).toBeDefined();
        expect(event!.toJSON()).not.toHaveProperty("actorId");
        expect([...f.room.state.players.values()].every((player) => player.revealedRole === "")).toBe(true);
      }
      f.voteOut(wolves[1]!);
      await flush();
      f.advanceTo("night", 3);
      if (scenario === "both-shoot" || scenario === "first-times-out") {
        for (const wolf of wolves.filter((userId) => f.player(userId).alive)) f.submit(wolf, { kind: "faction_kill", targetUserId: drunk });
        f.internals.advancePhase();
        expect(f.room.state.phase).toBe("hunter_revenge");
        f.command(drunk, { type: "submitHunterRevenge", targetUserId: wolves[2]! });
        shooters.push(drunk);
      } else {
        f.submit(f.id("witch"), { kind: "witch_poison", targetUserId: wolves[2]! });
        f.internals.advancePhase();
        expect(f.player(drunk).alive).toBe(true);
      }
      await flush();
      if (scenario === "first-times-out" || scenario === "no-shot") {
        f.voteOut(wolves[0]!);
        expect(f.room.state.phase).toBe("resolution");
        f.internals.advancePhase();
      }
      expect(f.room.state.phase).toBe("game_over");
      expect(f.room.state.winnerTeam).toBe("village");
      await flush();
      const shotEvents = persistence.recordEvent.mock.calls.map(([, entry]) => entry).filter((entry) => entry.type === "hunter_shot");
      expect(shotEvents.map((entry) => entry.actorId).sort()).toEqual([...shooters].sort());
      expect(shotEvents.every((entry) => entry.visibility === "moderator" && entry.targetId)).toBe(true);
      expect(persistence.recordGameCompletion).toHaveBeenCalledTimes(1);
      const awards = persistence.recordGameCompletion.mock.calls[0]![1].achievements
        .filter((award) => award.achievementId === "hunter_revenge");
      expect(awards.map((award) => award.userId).sort()).toEqual([...shooters].sort());
      for (const [userId, client] of Object.entries(f.clients)) {
        const announced = vi.mocked(client.send).mock.calls.some(([type, payload]) => type === "achievements_unlocked"
          && payload.achievementIds.includes("hunter_revenge"));
        expect(announced).toBe(shooters.includes(userId));
      }
    },
  );
});

describe("Immediate victory cancels pending Vampire bites", () => {
  it("keeps the final village victory even when a bite would eliminate both remaining lovers", async () => {
    const f = await fixture({ vampire: 3, witch: 1, cupid: 1, ordinary_villager: 7 }, { werewolfVariant: "vampires_vs_village" });
    const vampires = f.roleIds("vampire");
    const witch = f.id("witch");
    const [lover, ...villagers] = f.roleIds("ordinary_villager");
    f.advanceTo("first_night");
    f.submit(f.id("cupid"), { kind: "cupid_link", firstUserId: witch, secondUserId: lover! });
    f.voteOut(vampires[0]!);
    f.advanceTo("night", 2);
    f.voteOut(vampires[1]!);
    // Reach the three-player finale through ordinary votes, not seeded deaths.
    for (const target of [f.id("cupid"), ...villagers]) {
      f.advanceTo("night");
      f.voteOut(target);
    }
    f.advanceTo("night");
    expect([...f.internals.privatePlayers.values()].filter((player) => player.alive).map((player) => player.userId).sort())
      .toEqual([vampires[2]!, witch, lover!].sort());
    expect(f.player(witch).loverId).toBe(lover);
    const { persistence, flush } = attachPersistence(f.internals);
    f.submit(vampires[2]!, { kind: "faction_kill", targetUserId: witch });
    f.submit(witch, { kind: "witch_poison", targetUserId: vampires[2]! });
    f.internals.advancePhase();
    expect(f.room.state.phase).toBe("game_over");
    expect(f.room.state.winnerTeam).toBe("village");
    expect(f.internals.pendingVampireBites.size).toBe(0);
    expect(f.player(witch).alive).toBe(true);
    expect(f.player(lover!).alive).toBe(true);
    await flush();
    expect(persistence.recordEvent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      type: "vampire_bite_delayed", targetId: witch, visibility: "moderator",
    }));
    const final = f.room.state.toJSON();
    f.internals.advancePhase();
    f.command(witch, { type: "syncPrivateState" });
    expect(f.room.state.toJSON()).toEqual(final);
    expect(JSON.stringify(final)).not.toContain("pendingVampireBites");
    expect(JSON.stringify(final)).not.toContain("vampire_bite_delayed");
    expect(persistence.recordGameCompletion).toHaveBeenCalledTimes(1);
  });
});
