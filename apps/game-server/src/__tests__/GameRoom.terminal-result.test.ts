import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { parseTerminalGameResult, type GamePhase, type RoleCode, type WinResult } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { PrivatePlayerState } from "../rooms/game-room-runtime.js";
import { PlayerPublicState } from "../rooms/schemas/GameState.js";
import { connectPlayers, connectWithRetry, findPublicPlayer, startGameAndCollectRoles, waitForCondition } from "./helpers.js";

interface RoomInternals {
  privatePlayers: Map<string, PrivatePlayerState>;
  personalWinnerUserIds: Set<string>;
  evaluateWin(): WinResult;
  transitionTo(phase: GamePhase): void;
}

describe("GameRoom authoritative terminal results", () => {
  let colyseus: ColyseusTestServer;
  beforeAll(async () => {
    vi.stubEnv("ALLOW_DEV_AUTH", "true");
    colyseus = await boot(appConfig, 2708);
  });
  afterEach(async () => { await colyseus.cleanup(); });
  afterAll(async () => {
    await colyseus.shutdown();
    vi.unstubAllEnvs();
  });

  it.each([
    { winner: "village", role: "drunk", allyRole: "ordinary_villager", winners: ["leader", "ally"] },
    { winner: "werewolves", role: "werewolf", allyRole: "werewolf", winners: ["leader", "ally"] },
    { winner: "vampires", role: "vampire", allyRole: "vampire", winners: ["leader", "ally"] },
    { winner: "mafia", role: "don", allyRole: "mafioso", winners: ["leader", "ally"] },
    { winner: "maniac", role: "maniac", allyRole: "civilian", winners: ["leader"] },
    { winner: "lovers", role: "civilian", allyRole: "mafioso", winners: ["leader", "ally"] },
    { winner: "draw", role: "seer", allyRole: "werewolf", winners: [] },
  ] as const)("publishes %s from the existing win evaluator only at game over", async ({ winner, role, allyRole, winners }) => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "TERMNL", mode: "werewolves_classic", playerCount: 6,
      tempoProfile: "manual", revealRolesOnDeath: false,
    });
    const internal = room as unknown as RoomInternals;
    const roles: Array<[string, RoleCode]> = [["leader", role], ["ally", allyRole], ["jester", "jester"], ["loser", "jester"]];
    for (const [userId, actualRole] of roles) {
      const alive = winner !== "draw" && (userId === "leader" || (winner === "lovers" && userId === "ally"));
      const player = new PlayerPublicState();
      Object.assign(player, { userId, displayName: `Synthetic ${userId}`, alive });
      room.state.players.set(userId, player);
      internal.privatePlayers.set(userId, {
        userId, role: actualRole, alive,
        ...(winner === "lovers" && (userId === "leader" || userId === "ally") ? { loverId: userId === "leader" ? "ally" : "leader" } : {}),
      });
    }
    const observer = new PlayerPublicState();
    Object.assign(observer, { userId: "observer", displayName: "Synthetic observer", playing: false, narrator: true });
    room.state.players.set("observer", observer);
    internal.privatePlayers.set("observer", { userId: "observer", alive: false });
    internal.personalWinnerUserIds.add("jester");
    internal.transitionTo("resolution");
    expect(room.state.toJSON().terminalResultJson).toBe("");
    expect([...room.state.players.values()].every((player) => player.revealedRole === "")).toBe(true);

    const win = internal.evaluateWin();
    expect(win.winner).toBe(winner);
    room.state.winnerTeam = win.winner!;
    room.state.winnerReasonBg = win.reasonBg ?? "";
    internal.transitionTo("game_over");
    const terminal = parseTerminalGameResult(JSON.parse(room.state.toJSON().terminalResultJson));
    expect(terminal).toEqual({
      winnerTeam: winner,
      winnerPlayerIds: [...winners],
      personalWinnerPlayerIds: ["jester"],
      finalRoles: roles.map(([userId, actualRole]) => ({ userId, role: actualRole })),
    });
    const json = room.state.terminalResultJson;
    internal.transitionTo("game_over");
    expect(room.state.terminalResultJson).toBe(json);
  });

  it("synchronizes final actual roles and winner IDs to connected and rejoining clients without early disclosure", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "TERMRC", mode: "werewolves_classic", playerCount: 6,
      tempoProfile: "manual", revealRolesOnDeath: false,
      roles: { ordinary_villager: 5, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "terminal");
    const roles = await startGameAndCollectRoles(clients);
    const internal = room as unknown as RoomInternals;
    const surviving = roles.find((player) => player.role === "ordinary_villager")!;
    const wolf = roles.find((player) => player.role === "werewolf")!;
    await room.waitForNextPatch();
    expect(clients[0]!.client.state.terminalResultJson).toBe("");
    const repeatOptions = room.state.nextRoomOptionsJson;
    // Model a transformed final role; baseline role counts must not reconstruct it.
    internal.privatePlayers.get(wolf.userId)!.role = "vampire";
    for (const player of internal.privatePlayers.values()) {
      player.alive = player.userId === surviving.userId;
      findPublicPlayer(room, player.userId)!.alive = player.alive;
    }
    await surviving.client.leave();
    await waitForCondition(() => !findPublicPlayer(room, surviving.userId)?.connected, "terminal fixture disconnect");
    const win = internal.evaluateWin();
    room.state.winnerTeam = win.winner!;
    room.state.winnerReasonBg = win.reasonBg ?? "";
    internal.transitionTo("game_over");
    const connected = roles.find((player) => player.userId !== surviving.userId)!.client;
    await waitForCondition(() => Boolean(connected.state.terminalResultJson), "terminal patch");
    const terminal = parseTerminalGameResult(JSON.parse(connected.state.terminalResultJson));
    expect(terminal?.winnerPlayerIds).toEqual(win.winnerPlayerIds);
    expect(terminal?.personalWinnerPlayerIds).toEqual([]);
    expect(terminal?.finalRoles).toHaveLength(6);
    expect(terminal?.finalRoles).toContainEqual({ userId: wolf.userId, role: "vampire" });
    expect(room.state.nextRoomOptionsJson).toBe(repeatOptions);

    const rejoined = await connectWithRetry(colyseus, room, {
      code: room.state.code, userId: surviving.userId, displayName: surviving.displayName,
    });
    await waitForCondition(() => Boolean(rejoined.state.terminalResultJson), "terminal reconnect snapshot");
    expect(JSON.parse(rejoined.state.terminalResultJson)).toEqual(terminal);
    expect([...room.state.players.values()].filter((player) => player.userId === surviving.userId)).toHaveLength(1);
  });

  it.each(["werewolves_classic", "mafia_free"] as const)("keeps an earned Jester win private across reconnect until the %s game ends", async (mode) => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "TERMJS", mode, playerCount: 8, tempoProfile: "manual", revealRolesOnDeath: true,
      roles: mode === "mafia_free" ? { civilian: 6, mafioso: 1, jester: 1 }
        : { ordinary_villager: 6, werewolf: 1, jester: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 8, `terminal-${mode}`);
    const observer = await connectWithRetry(colyseus, room, {
      code: room.state.code, userId: `observer-${mode}`, displayName: "Synthetic observer", spectator: true,
    });
    const roles = await startGameAndCollectRoles(clients);
    const internal = room as unknown as RoomInternals;
    const jester = roles.find((player) => player.role === "jester")!;
    const enemy = roles.find((player) => player.role === "werewolf" || player.role === "mafioso")!;
    room.state.round = 2;
    internal.transitionTo("voting");
    for (const { client, userId } of clients) {
      const ack = client.waitForMessage("vote_ack");
      client.send("submitVote", { targetUserId: userId === jester.userId ? enemy.userId : jester.userId });
      await ack;
    }
    if (room.state.phase === "voting") clients[0]!.client.send("narratorAdvance", {});
    await waitForCondition(() => room.state.phase === "resolution", "Jester ballot resolution");
    expect(internal.personalWinnerUserIds.has(jester.userId)).toBe(true);
    expect(room.state.revealRolesOnDeath).toBe(false);
    expect(room.state.terminalResultJson).toBe("");
    expect(findPublicPlayer(room, jester.userId)?.revealedRole).toBe("");
    await room.waitForNextPatch();
    expect(observer.state.terminalResultJson).toBe("");
    expect([...observer.state.publicEvents].some((event) => event.messageBg.includes("лична победа"))).toBe(false);

    // Always exercise host migration, including when crypto assignment gives the host another role.
    const originalHost = clients[0]!;
    if (originalHost.userId !== jester.userId) {
      await originalHost.client.leave();
      await waitForCondition(() => !findPublicPlayer(room, originalHost.userId)?.connected, "original host disconnect");
    }
    await jester.client.leave();
    await waitForCondition(() => !findPublicPlayer(room, jester.userId)?.connected, "Jester disconnect");
    const rejoined = await connectWithRetry(colyseus, room, {
      code: room.state.code, userId: jester.userId, displayName: jester.displayName,
    });
    if (originalHost.userId !== jester.userId) {
      originalHost.client = await connectWithRetry(colyseus, room, {
        code: room.state.code, userId: originalHost.userId, displayName: originalHost.displayName,
      });
    }
    expect(findPublicPlayer(room, originalHost.userId)?.host).toBe(false);
    expect(findPublicPlayer(room, jester.userId)?.host).toBe(false);
    await rejoined.request("syncPrivateState");
    expect(rejoined.state.terminalResultJson).toBe("");
    expect([...rejoined.state.players.values()].every((player) => player.revealedRole === "")).toBe(true);

    internal.transitionTo("voting");
    for (const { client, userId } of clients) {
      if (userId === jester.userId) continue;
      const ack = client.waitForMessage("vote_ack");
      client.send("submitVote", { targetUserId: enemy.userId });
      await ack;
    }
    const hostUserId = [...room.state.players.values()].find((player) => player.host && player.connected)?.userId;
    const host = hostUserId === jester.userId ? rejoined : clients.find((player) => player.userId === hostUserId)?.client;
    expect(host, "a connected current host must drive the final ballot").toBeDefined();
    if (room.state.phase === "voting") host!.send("narratorAdvance", {});
    await waitForCondition(() => room.state.phase === "resolution", "final ballot resolution");
    host!.send("narratorAdvance", {});
    await waitForCondition(() => observer.state.phase === "game_over", "terminal observer snapshot");
    const terminal = parseTerminalGameResult(JSON.parse(observer.state.terminalResultJson));
    expect(terminal?.winnerTeam).toBe("village");
    expect(terminal?.winnerPlayerIds).toEqual(internal.evaluateWin().winnerPlayerIds);
    expect(terminal?.winnerPlayerIds).not.toContain(jester.userId);
    expect(terminal?.personalWinnerPlayerIds).toEqual([jester.userId]);
    expect(terminal?.finalRoles).toHaveLength(8);
    expect(terminal?.finalRoles).toContainEqual({ userId: jester.userId, role: "jester" });
    await waitForCondition(() => Boolean(rejoined.state.terminalResultJson), "terminal Jester patch");
    expect(JSON.parse(rejoined.state.terminalResultJson)).toEqual(terminal);

    await rejoined.leave();
    await waitForCondition(() => !findPublicPlayer(room, jester.userId)?.connected, "terminal Jester disconnect");
    const afterGame = await connectWithRetry(colyseus, room, {
      code: room.state.code, userId: jester.userId, displayName: jester.displayName,
    });
    await waitForCondition(() => Boolean(afterGame.state.terminalResultJson), "terminal Jester reconnect");
    expect(JSON.parse(afterGame.state.terminalResultJson)).toEqual(terminal);
    expect([...room.state.players.values()].filter((player) => player.userId === jester.userId)).toHaveLength(1);
  });
});
