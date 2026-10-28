import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@colyseus/core";
import type { ClientCommand, GamePhase, NightActionCommand, RoleCode } from "@werewolf/shared";
import { ROLE_DEFINITIONS } from "@werewolf/shared";
import { GameRoom } from "../rooms/GameRoom.js";
import { generateRoomCode, type PrivatePlayerState } from "../rooms/game-room-runtime.js";
import { PlayerPresenceManager } from "../rooms/player-presence-manager.js";
import { MemoryPlayerSecurityStore } from "../rooms/player-security-store.js";
import type { SubmittedNightAction } from "../game-logic/night-resolver.js";

interface Internals {
  privatePlayers: Map<string, PrivatePlayerState>;
  playerPresence: PlayerPresenceManager;
  activeRoomUserIds: Set<string>;
  membershipOperations: Map<string, Promise<void>>;
  hostUserId: string | undefined;
  pendingNightActions: Map<string, SubmittedNightAction[]>;
  immediateNightActorIds: Set<string>;
  currentWitchVictimByTeam: Map<string, string>;
  pendingHunterRevengeUserId: string | undefined;
  pendingHunterRevengeQueue: Set<string>;
  handleCommand(client: Client, command: ClientCommand): void;
  advancePhase(): void;
  transitionTo(phase: GamePhase): void;
}

const rooms: GameRoom[] = [];
const fakeClient = (sessionId: string) => ({ sessionId, send: vi.fn(), leave: vi.fn() }) as unknown as Client;
const identity = (userId: string) => ({ userId, displayName: `Synthetic ${userId}`, avatarId: "portrait-m03" as const });

beforeEach(() => PlayerPresenceManager.resetForTests());
afterEach(async () => {
  vi.restoreAllMocks();
  for (const room of rooms.splice(0)) {
    await room.onDispose();
    room.clock.clear();
    room.clock.stop();
  }
  PlayerPresenceManager.resetForTests();
});

async function fixture(
  roles: Partial<Record<RoleCode, number>> = { werewolf: 2, ordinary_villager: 6 },
  options: Partial<Parameters<GameRoom["onCreate"]>[0]> = {},
) {
  const room = new GameRoom();
  room.roomId = generateRoomCode();
  rooms.push(room);
  const count = Object.values(roles).reduce((sum, value) => sum + value, 0);
  for (const [role, copies] of Object.entries(roles)) {
    expect(count).toBeGreaterThanOrEqual(ROLE_DEFINITIONS[role as RoleCode].minPlayers);
    expect(copies).toBeLessThanOrEqual(ROLE_DEFINITIONS[role as RoleCode].maxCopies);
  }
  room.onCreate({
    code: room.roomId, mode: "werewolves_classic", playerCount: count, rolePreset: "manual", roles,
    tempoProfile: "manual", firstNightKill: true, advancedMode: true,
    loversEnabled: Boolean(roles.cupid), narratorMode: "automatic", mayorMode: "secret_role",
    ...options,
  });
  const internals = room as unknown as Internals;
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
  const start = () => {
    command("player0", { type: "startGame" });
    expect(room.state.phase).toBe("role_reveal");
    const assigned: Partial<Record<RoleCode, number>> = {};
    for (const player of internals.privatePlayers.values()) {
      assigned[player.role!] = (assigned[player.role!] ?? 0) + 1;
    }
    expect(assigned).toEqual(roles);
  };
  const roleIds = (role: RoleCode) => [...internals.privatePlayers.values()]
    .filter((player) => player.role === role).map((player) => player.userId);
  const submit = (userId: string, action: NightActionCommand) => command(userId, { type: "submitNightAction", action });
  return { room, internals, clients, command, start, roleIds, submit };
}

describe("audit lifecycle regressions", () => {
  it("rechecks client and generation after the periodic revocation lookup", async () => {
    const { room, internals, clients } = await fixture();
    const oldClient = clients.player0!;
    (oldClient.userData as { tokenIssuedAtMs?: number }).tokenIssuedAtMs = 1_000;
    room.clients.push(oldClient);
    const lookup = Promise.withResolvers<boolean>();
    vi.spyOn(PlayerPresenceManager, "isGameSessionRevoked").mockReturnValueOnce(lookup.promise);
    const reconciling = GameRoom.reconcileRevokedConnections();
    const replacement = fakeClient("replacement");
    try {
      await room.onJoin(replacement, { code: room.state.code }, { ...identity("player0"), tokenIssuedAtMs: 2_000 });
      const generation = (replacement.userData as { connectionGeneration: number }).connectionGeneration;
      lookup.resolve(true);
      await expect(reconciling).resolves.toBe(0);
      expect(replacement.leave).not.toHaveBeenCalled();
      expect(internals.playerPresence.getClient("player0")).toBe(replacement);
      expect(internals.playerPresence.isCurrentConnectionGeneration("player0", generation)).toBe(true);
    } finally {
      lookup.resolve(false);
      room.clients.splice(room.clients.indexOf(oldClient), 1);
    }
  });

  it.each(["same-user", "new-user", "failed-release"] as const)(
    "keeps one authoritative host and the replacement claim during %s leave/join",
    async (scenario) => {
      PlayerPresenceManager.configureSecurityStore(new MemoryPlayerSecurityStore({ maxActiveRooms: 1 }));
      const { room, internals, clients } = await fixture();
      const gate = Promise.withResolvers<void>();
      const entered = Promise.withResolvers<void>();
      const originalRelease = PlayerPresenceManager.releaseActiveRoom.bind(PlayerPresenceManager);
      vi.spyOn(PlayerPresenceManager, "releaseActiveRoom").mockImplementationOnce(async (userId, code) => {
        entered.resolve();
        await gate.promise;
        if (scenario === "failed-release") throw new Error("synthetic release failure");
        await originalRelease(userId, code);
      });
      const leaving = room.onLeave(clients.player0!);
      await entered.promise;
      expect([...room.state.players.values()].filter((player) => player.host).map((player) => player.userId))
        .toEqual(["player1"]);
      const userId = scenario === "new-user" ? "new-player" : "player0";
      const replacement = fakeClient("replacement");
      const joining = room.onJoin(replacement, { code: room.state.code }, identity(userId));
      if (scenario === "new-user") await joining;
      gate.resolve();
      await leaving;
      await joining;
      expect([...room.state.players.values()].filter((player) => player.host).map((player) => player.userId))
        .toEqual(["player1"]);
      expect(internals.hostUserId).toBe("player1");
      expect(internals.activeRoomUserIds.has(userId)).toBe(true);
      expect(internals.membershipOperations.size).toBe(0);
      await expect(PlayerPresenceManager.claimActiveRoom(userId, "EXTRA2", Date.now() + 60_000)).resolves.toBe(false);
      internals.handleCommand(replacement, { type: "startGame" });
      expect(replacement.send).toHaveBeenCalledWith("safe_error", expect.anything());
      expect(room.state.phase).toBe("lobby");
      internals.handleCommand(clients.player1!, { type: "startGame" });
      expect(room.state.phase).toBe("role_reveal");
    },
  );

  it("bounds departed spectator generations and never revalidates an old reconnect", async () => {
    const { room, internals } = await fixture();
    let departed: Client | undefined;
    let oldGeneration: number | undefined;
    for (let i = 0; i < 70; i++) {
      const userId = `spectator${i}`;
      const client = fakeClient(userId);
      await room.onJoin(client, { code: room.state.code, spectator: true }, identity(userId));
      if (i === 0) {
        departed = client;
        oldGeneration = (client.userData as { connectionGeneration: number }).connectionGeneration;
      }
      await room.onLeave(client);
    }
    const generations = (internals.playerPresence as unknown as { connectionGenerationByUserId: Map<string, number> })
      .connectionGenerationByUserId;
    expect(room.state.players.size).toBe(8);
    expect(generations.size).toBe(8);
    expect(internals.membershipOperations.size).toBe(0);
    expect(internals.activeRoomUserIds.size).toBe(8);
    const returning = fakeClient("returning");
    await room.onJoin(returning, { code: room.state.code, spectator: true }, identity("spectator0"));
    expect(internals.playerPresence.isCurrentConnectionGeneration("spectator0", oldGeneration)).toBe(false);
    await room.onReconnect(departed!);
    expect(departed!.leave).toHaveBeenCalledWith(4029);
    expect(internals.playerPresence.getClient("spectator0")).toBe(returning);
  });

  it("does not release an existing member's claim when another join replays a nonce", async () => {
    PlayerPresenceManager.configureSecurityStore(new MemoryPlayerSecurityStore({ maxActiveRooms: 1 }));
    const { room, internals, clients } = await fixture();
    const expiresAt = Date.now() + 60_000;
    await PlayerPresenceManager.consumeTokenNonce("used-nonce", expiresAt);
    const rejected = fakeClient("rejected");
    await expect(room.onJoin(rejected, { code: room.state.code }, {
      ...identity("player0"), tokenNonce: "used-nonce", tokenExpiresAtMs: expiresAt,
    })).rejects.toMatchObject({ code: 4029, message: "Този токен вече е използван." });
    expect(internals.playerPresence.getClient("player0")).toBe(clients.player0);
    expect(internals.activeRoomUserIds.has("player0")).toBe(true);
    await expect(PlayerPresenceManager.claimActiveRoom("player0", "EXTRA2", expiresAt)).resolves.toBe(false);
  });
});

describe("audit Thief regressions", () => {
  it.each(["werewolf", "vampire"] as const)("invalidates stolen %s consensus without spending Witch healing", async (role) => {
    const { room, internals, start, roleIds, submit } = await fixture({
      [role]: 2, witch: 1, thief: 1, ordinary_villager: 9,
    });
    start();
    internals.advancePhase();
    const [first, second] = roleIds(role);
    const witch = roleIds("witch")[0]!;
    const thief = roleIds("thief")[0]!;
    const [victim, poisoned] = roleIds("ordinary_villager");
    submit(first!, { kind: "faction_kill", targetUserId: victim! });
    submit(second!, { kind: "faction_kill", targetUserId: victim! });
    submit(witch, { kind: "witch_heal", targetUserId: victim! });
    submit(witch, { kind: "witch_poison", targetUserId: poisoned! });
    const before = room.state.toJSON();
    submit(thief, { kind: "thief_steal", targetUserId: first! });
    submit(thief, { kind: "skip" });
    expect(internals.currentWitchVictimByTeam.size).toBe(0);
    expect(internals.pendingNightActions.get(witch)?.map((item) => item.action.kind)).toEqual(["witch_poison"]);
    expect(room.state.toJSON()).toEqual(before);
    internals.advancePhase();
    expect(internals.privatePlayers.get(witch)?.witchHealUsed).not.toBe(true);
    expect(internals.privatePlayers.get(witch)?.witchPoisonUsed).toBe(true);
    expect(internals.privatePlayers.get(victim!)?.alive).toBe(true);
    expect(internals.privatePlayers.get(poisoned!)?.alive).toBe(false);
  });

  it("retains healing when another faction still targets the same victim after theft", async () => {
    const { internals, start, roleIds, submit } = await fixture({
      werewolf: 3, vampire: 3, witch: 1, thief: 1, ordinary_villager: 8,
    });
    start();
    internals.advancePhase();
    const victim = roleIds("ordinary_villager")[0]!;
    const witch = roleIds("witch")[0]!;
    for (const userId of [...roleIds("werewolf"), ...roleIds("vampire")]) {
      submit(userId, { kind: "faction_kill", targetUserId: victim });
    }
    submit(witch, { kind: "witch_heal", targetUserId: victim });
    submit(roleIds("thief")[0]!, { kind: "thief_steal", targetUserId: roleIds("werewolf")[0]! });
    expect([...internals.currentWitchVictimByTeam.entries()]).toEqual([["vampires", victim]]);
    expect(internals.pendingNightActions.get(witch)?.[0]?.action.kind).toBe("witch_heal");
    internals.advancePhase();
    expect(internals.privatePlayers.get(witch)?.witchHealUsed).toBe(true);
    expect(internals.privatePlayers.get(victim)?.alive).toBe(true);
  });

  it.each(["villager", "active-role-skip", "non-neighbor"] as const)("reports immediate theft privately: %s", async (scenario) => {
    const { room, internals, clients, start, roleIds, submit } = await fixture({
      werewolf: 2, thief: 1, insomniac: 1, seer: 1, ordinary_villager: 8,
    });
    start();
    const thief = roleIds("thief")[0]!;
    const observer = roleIds("insomniac")[0]!;
    const [neighbor, other] = roleIds("ordinary_villager");
    // Fix seating only; roles still come from real startGame assignment.
    const seats = scenario === "non-neighbor" ? [neighbor!, observer, other!, thief] : [neighbor!, observer, thief, other!];
    internals.privatePlayers = new Map([
      ...seats.map((id) => [id, internals.privatePlayers.get(id)!] as const),
      ...[...internals.privatePlayers].filter(([id]) => !seats.includes(id)),
    ]);
    internals.advancePhase();
    const before = room.state.toJSON();
    submit(thief, { kind: "thief_steal", targetUserId: scenario === "active-role-skip" ? roleIds("seer")[0]! : other! });
    if (scenario === "active-role-skip") submit(thief, { kind: "skip" });
    expect(room.state.toJSON()).toEqual(before);
    for (const client of Object.values(clients)) vi.mocked(client.send).mockClear();
    internals.advancePhase();
    const result = vi.mocked(clients[observer]!.send).mock.calls.findLast(([type]) => type === "private_check_result")?.[1];
    expect(result?.targetUserIds).toEqual([neighbor, scenario === "non-neighbor" ? other : thief]);
    expect(result?.messageBg).toMatch(scenario === "non-neighbor" ? /^Не усети/ : /^Усети движение/);
    for (const [id, client] of Object.entries(clients)) {
      if (id !== observer) expect(client.send).not.toHaveBeenCalledWith("private_check_result", expect.anything());
    }
    expect(internals.immediateNightActorIds.size).toBe(0);
    for (let i = 0; i < 5; i++) internals.advancePhase();
    const nextResult = vi.mocked(clients[observer]!.send).mock.calls.findLast(([type]) => type === "private_check_result")?.[1];
    expect(nextResult?.messageBg).toMatch(/^Не усети/);
  });
});

describe("legal Drunk-generated Hunter interruptions", () => {
  it.each(["shot-chain", "same-batch", "timeout", "lover-chain"] as const)("preserves both shots for %s", async (scenario) => {
    const { room, internals, clients, start, roleIds, submit, command } = await fixture({
      werewolf: 3, hunter: 1, drunk: 1, seer: 1, oracle: 1, witch: 1, mayor: 1,
      ...(scenario === "lover-chain" ? { cupid: 1 } : {}),
    }, { customTimers: { resolutionSeconds: 30 } });
    start();
    const hunter = roleIds("hunter")[0]!;
    const drunk = roleIds("drunk")[0]!;
    const seer = roleIds("seer")[0]!;
    expect(internals.privatePlayers.get(drunk)?.drunkRealRole).toBe("hunter");
    internals.advancePhase();
    if (scenario === "lover-chain") {
      submit(roleIds("cupid")[0]!, { kind: "cupid_link", firstUserId: drunk, secondUserId: seer });
    }
    for (let i = 0; i < 10 && !(room.state.phase === "night" && room.state.round === 2); i++) internals.advancePhase();
    expect(room.state.phase).toBe("night");
    expect(room.state.round).toBe(2);
    expect(roleIds("hunter")).toHaveLength(2);
    for (const wolf of roleIds("werewolf")) submit(wolf, { kind: "faction_kill", targetUserId: hunter });
    if (scenario === "same-batch" || scenario === "timeout") {
      submit(roleIds("witch")[0]!, { kind: "witch_poison", targetUserId: drunk });
    }
    const timer = vi.spyOn(room.clock, "setTimeout");
    internals.advancePhase();
    expect(room.state.phase).toBe("hunter_revenge");
    const first = internals.pendingHunterRevengeUserId!;
    const second = first === hunter ? drunk : hunter;
    const availability = (userId: string) => vi.mocked(clients[userId]!.send).mock.calls
      .findLast(([type]) => type === "private_role")?.[1]?.hunterRevengeAvailable;
    expect(availability(first)).toBe(true);
    expect(availability(second)).toBe(false);
    if (scenario === "timeout") {
      const timeoutCallback = timer.mock.calls.at(-1)?.[0];
      expect(timeoutCallback).toBeTypeOf("function");
      timeoutCallback!();
    }
    else command(first, { type: "submitHunterRevenge", targetUserId: scenario === "shot-chain" ? drunk : seer });
    expect(room.state.phase).toBe("hunter_revenge");
    expect(internals.pendingHunterRevengeUserId).toBe(second);
    expect(availability(first)).toBe(false);
    expect(availability(second)).toBe(true);
    expect(internals.privatePlayers.get(second)?.alive).toBe(false);
    expect(internals.pendingHunterRevengeQueue.size).toBe(0);
    internals.handleCommand(clients[first]!, { type: "submitHunterRevenge", targetUserId: roleIds("werewolf")[0]! });
    expect(clients[first]!.send).toHaveBeenCalledWith("safe_error", expect.anything());
    command(second, { type: "submitHunterRevenge", targetUserId: roleIds("werewolf")[0]! });
    expect(room.state.phase).toBe("day_announcement");
    expect(internals.pendingHunterRevengeUserId).toBeUndefined();
    expect(internals.pendingHunterRevengeQueue.size).toBe(0);
  });

  it("keeps queued Hunter availability private and current across reconnect, pause, resync and later rounds", async () => {
    const { room, internals, clients, start, roleIds, submit, command } = await fixture({
      werewolf: 3, hunter: 1, drunk: 1, seer: 1, oracle: 1, witch: 1, mayor: 1,
    }, { revealRolesOnDeath: false, customTimers: { resolutionSeconds: 30 } });
    start();
    for (let i = 0; i < 10 && !(room.state.phase === "night" && room.state.round === 2); i++) internals.advancePhase();
    const [hunter, otherHunter] = roleIds("hunter");
    expect(roleIds("hunter")).toHaveLength(2);
    for (const wolf of roleIds("werewolf")) submit(wolf, { kind: "faction_kill", targetUserId: hunter! });
    submit(roleIds("witch")[0]!, { kind: "witch_poison", targetUserId: otherHunter! });
    for (const client of Object.values(clients)) vi.mocked(client.send).mockClear();
    const broadcast = vi.spyOn(room, "broadcast");
    internals.advancePhase();
    const first = internals.pendingHunterRevengeUserId!;
    const second = first === hunter ? otherHunter! : hunter!;
    const availability = (userId: string) => vi.mocked(clients[userId]!.send).mock.calls
      .findLast(([type]) => type === "private_role")?.[1]?.hunterRevengeAvailable;
    let reconnectCount = 0;
    const reconnect = async (userId: string) => {
      const previous = clients[userId]!;
      clients[userId] = fakeClient(`replacement-${userId}-${++reconnectCount}`);
      await room.onJoin(clients[userId]!, { code: room.state.code }, identity(userId));
      await room.onLeave(previous);
      command(userId, { type: "syncPrivateState" });
    };
    for (const [userId, client] of Object.entries(clients)) {
      if (userId !== first && userId !== second) {
        expect(client.send).not.toHaveBeenCalledWith("private_role", expect.anything());
      }
    }
    await reconnect(second);
    expect(availability(second)).toBe(false);
    await reconnect(first);
    expect(availability(first)).toBe(true);
    command("player0", { type: "narratorPause" });
    expect(availability(first)).toBe(false);
    command(first, { type: "syncPrivateState" });
    expect(availability(first)).toBe(false);
    command("player0", { type: "narratorAdvance" });
    expect(availability(first)).toBe(true);
    command(first, { type: "submitHunterRevenge", targetUserId: roleIds("werewolf")[0]! });
    expect(availability(first)).toBe(false);
    expect(availability(second)).toBe(true);
    command(first, { type: "syncPrivateState" });
    expect(availability(first)).toBe(false);
    await reconnect(second);
    expect(availability(second)).toBe(true);
    internals.advancePhase();
    expect(availability(first)).toBe(false);
    expect(availability(second)).toBe(false);
    for (let i = 0; i < 10 && !(room.state.phase === "night" && room.state.round === 3); i++) internals.advancePhase();
    expect(room.state.round).toBe(3);
    for (const userId of [first, second]) {
      command(userId, { type: "syncPrivateState" });
      expect(availability(userId)).toBe(false);
    }
    expect(broadcast).not.toHaveBeenCalledWith("private_role", expect.anything());
    expect(JSON.stringify(room.state.toJSON())).not.toContain("hunterRevengeAvailable");
    expect([...room.state.players.values()].every((player) => player.revealedRole === "")).toBe(true);
  });

  it("finishes all Hunter interruptions before public Mayor succession", async () => {
    const { room, internals, start, roleIds, submit, command } = await fixture({
      werewolf: 3, hunter: 1, drunk: 1, seer: 1, oracle: 1, witch: 1, mayor: 1,
    }, { mayorMode: "public_vote" });
    command("player0", { type: "setMayor", targetUserId: "player0" });
    start();
    const hunter = roleIds("hunter")[0]!;
    const drunk = roleIds("drunk")[0]!;
    for (let i = 0; i < 10 && !(room.state.phase === "night" && room.state.round === 2); i++) internals.advancePhase();
    for (const wolf of roleIds("werewolf")) submit(wolf, { kind: "faction_kill", targetUserId: hunter });
    submit(roleIds("witch")[0]!, { kind: "witch_poison", targetUserId: drunk });
    internals.advancePhase();
    const first = internals.pendingHunterRevengeUserId!;
    const second = first === hunter ? drunk : hunter;
    const mayor = [...room.state.players.values()].find((player) => player.mayor);
    // If the randomly assigned Mayor is one of the Hunters, its death already queued succession.
    if (mayor) command(first, { type: "submitHunterRevenge", targetUserId: mayor.userId });
    else internals.advancePhase();
    expect(room.state.phase).toBe("hunter_revenge");
    expect(internals.pendingHunterRevengeUserId).toBe(second);
    internals.advancePhase();
    expect(room.state.phase).toBe("mayor_successor");
    internals.advancePhase();
    expect(["day_announcement", "game_over"]).toContain(room.state.phase);
  });
});
