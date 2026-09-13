import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { createGameConfigFromOptions, type CreateRoomOptions } from "@werewolf/shared";
import appConfig from "../app.config.js";
import { GameRoom } from "../rooms/GameRoom.js";
import { PlayerPublicState } from "../rooms/schemas/GameState.js";
import { connectPlayers, startGameAndCollectRoles } from "./helpers.js";

describe("authoritative invitation and repeat-room contracts", () => {
  let colyseus: ColyseusTestServer;
  beforeAll(async () => {
    vi.stubEnv("ALLOW_DEV_AUTH", "true");
    vi.stubEnv("NODE_ENV", "test");
    colyseus = await boot(appConfig, 2794);
  });
  afterEach(async () => { await colyseus.cleanup(); });
  afterAll(async () => {
    await colyseus?.shutdown();
    vi.unstubAllEnvs();
  });

  it("reflects player slots while preserving a verified participant's return path", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PRE234", mode: "mafia_free", playerCount: 4, maxPlayers: 4, roomVisibility: "private",
    });
    expect(GameRoom.getRoomPreview("PRE234")).toMatchObject({
      mode: "mafia_free", roomVisibility: "private", viewerMembership: "none",
      canJoinAsPlayer: true, canSpectate: true,
    });
    for (let index = 0; index < 4; index += 1) addPlayer(room, `player-${index}`);
    addPlayer(room, "spectator", false);
    expect(GameRoom.getRoomPreview("PRE234", "new-player")).toMatchObject({
      playerCount: 4, viewerMembership: "none", canJoinAsPlayer: false, canSpectate: true,
    });
    expect(GameRoom.getRoomPreview("PRE234", "player-0")).toMatchObject({
      viewerMembership: "participant", canJoinAsPlayer: true, canSpectate: false,
    });
    expect(GameRoom.getRoomPreview("PRE234", "spectator")).toMatchObject({
      viewerMembership: "spectator", canJoinAsPlayer: false, canSpectate: true,
    });
    room.state.players.delete("player-3");
    expect(GameRoom.getRoomPreview("PRE234", "spectator")?.canJoinAsPlayer).toBe(true);
  });

  it.each(["role_reveal", "night", "game_over"])("uses locked membership rules in %s", async (phase) => {
    const room = await colyseus.createRoom<GameRoom>("game", { code: "PRE234", playerCount: 6 });
    addPlayer(room, "participant").connected = false;
    addPlayer(room, "spectator", false);
    const narrator = addPlayer(room, "narrator", false);
    narrator.narrator = true;
    room.state.phase = phase;
    room.state.locked = true;
    expect(GameRoom.getRoomPreview("PRE234", "participant")).toMatchObject({ canJoinAsPlayer: true, canSpectate: false });
    expect(GameRoom.getRoomPreview("PRE234", "narrator")).toMatchObject({ viewerMembership: "participant", canJoinAsPlayer: true, canSpectate: false });
    expect(GameRoom.getRoomPreview("PRE234", "spectator")).toMatchObject({ canJoinAsPlayer: false, canSpectate: true });
    expect(GameRoom.getRoomPreview("PRE234")).toMatchObject({ canJoinAsPlayer: false, canSpectate: true });
  });

  it("honors the transport client limit independently of playing capacity", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", { code: "PRE234", playerCount: 6 });
    await colyseus.connectTo(room, { code: "PRE234", userId: "viewer", displayName: "Viewer" });
    room.maxClients = 1;
    expect(GameRoom.getRoomPreview("PRE234", "viewer")).toMatchObject({ canJoinAsPlayer: false, canSpectate: false });
    expect(GameRoom.getRoomPreview("PRE234")).toMatchObject({ playerCount: 1, canJoinAsPlayer: false, canSpectate: false });
  });

  it("synchronizes full safe configuration and only baseline role counts", async () => {
    const options: CreateRoomOptions = {
      code: "PRE234", mode: "mafia_free", playerCount: 4, maxPlayers: 8, roomName: "Repeat room",
      roles: { civilian: 2, mafioso: 1, doctor: 1 }, roomVisibility: "public",
      tempoProfile: "manual", customTimers: { voteSeconds: 74, autoAdvanceWhenReady: false },
      doctorCanSelfProtect: true, tieBreaker: "revote", firstNightKill: false,
    };
    const room = await colyseus.createRoom<GameRoom>("game", options);
    const client = await colyseus.connectTo(room, { code: "PRE234", userId: "private-user", displayName: "Viewer" });
    await room.waitForNextPatch();
    const wire = (client.state as { nextRoomOptionsJson: string }).nextRoomOptionsJson;
    const settings = JSON.parse(wire) as CreateRoomOptions;
    expect(createGameConfigFromOptions(settings)).toEqual(createGameConfigFromOptions(options));
    expect(settings.roles).toEqual(Object.fromEntries([...room.state.roleCounts].map(({ role, count }) => [role, count])));
    expect(settings).not.toHaveProperty("code");
    expect(settings).not.toHaveProperty("spectator");
    expect(wire).not.toContain("private-user");
    expect(GameRoom.getRoomPreview("PRE234", "private-user")).not.toHaveProperty("userId");
  });

  it("preserves the named nine-player beginner setup on the wire after game start", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PRE234", mode: "werewolves_classic", playerCount: 9, maxPlayers: 12,
      roomName: "Friday review table", rolePreset: "beginner", loversEnabled: true,
      roomVisibility: "public", tempoProfile: "manual",
      customTimers: { voteSeconds: 73, autoAdvanceWhenReady: false },
      firstNightKill: false, revealRolesOnDeath: false,
    });
    const beforeStart = JSON.parse(room.state.nextRoomOptionsJson) as CreateRoomOptions;
    const clients = await connectPlayers(colyseus, room, 9, "repeat-player");
    for (const { client } of clients) client.onMessage("private_faction_roster", () => {});
    await startGameAndCollectRoles(clients);
    await room.waitForNextPatch();

    expect(room.state.phase).toBe("role_reveal");
    for (const { client } of clients) {
      const wire = client.state.nextRoomOptionsJson;
      const settings = JSON.parse(wire) as CreateRoomOptions;
      expect(settings.roomName).toBe("Friday review table");
      expect(settings).toEqual(beforeStart);
      expect(settings.rolePreset).toBe("beginner");
      expect(settings.roles).toEqual({ ordinary_villager: 4, werewolf: 2, seer: 1, healer: 1, cupid: 1 });
      expect(wire).not.toContain("repeat-player");
    }
  });
});

function addPlayer(room: GameRoom, userId: string, playing = true) {
  const player = new PlayerPublicState();
  player.userId = userId;
  player.playing = playing;
  room.state.players.set(userId, player);
  return player;
}
