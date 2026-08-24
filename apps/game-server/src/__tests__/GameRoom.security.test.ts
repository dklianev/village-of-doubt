import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import type { NightActionCapabilities, PrivateFactionRoster, RoleCode } from "@werewolf/shared";
import { createGameToken } from "@werewolf/shared/server";
import appConfig, { OperationalGameRoom } from "../app.config.js";
import { authenticateGameJoin, GameRoom } from "../rooms/GameRoom.js";
import { PlayerPresenceManager } from "../rooms/player-presence-manager.js";
import type { GameState } from "../rooms/schemas/GameState.js";

const GAME_TOKEN_SECRET = "test-secret-that-is-long-enough-32-chars";

describe("GameRoom security boundaries", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousGameTokenSecret: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeEach(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousGameTokenSecret = process.env.GAME_TOKEN_SECRET;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.GAME_TOKEN_SECRET = GAME_TOKEN_SECRET;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    PlayerPresenceManager.resetForTests();
    colyseus = await boot(appConfig, 2678);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    PlayerPresenceManager.resetForTests();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("GAME_TOKEN_SECRET", previousGameTokenSecret);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("keeps role data out of the synchronized public state", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "SEC223",
      mode: "werewolves_classic",
      playerCount: 8,
    });

    const clients = await connectPlayers(colyseus, serverRoom, 8, "user");

    const privateRoleMessages = clients.map((client) => waitForPrivateRole(client));
    clients[0]?.send("startGame", {});
    await Promise.all(privateRoleMessages);
    await serverRoom.waitForNextPatch();

    const state = clients[1]?.state as GameState;
    expect(state.phase).toBe("role_reveal");
    expect("winnerPlayerIds" in (state as unknown as Record<string, unknown>)).toBe(false);
    expect("personalWinnerPlayerIds" in (state as unknown as Record<string, unknown>)).toBe(false);

    for (const player of state.players.values()) {
      expect("role" in player).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(player, "role")).toBe(false);
      expect("won" in (player as unknown as Record<string, unknown>)).toBe(false);
      expect("loverUserId" in (player as unknown as Record<string, unknown>)).toBe(false);
      // revealedRole must be an empty string for living players — never leak the secret role.
      expect(player.revealedRole).toBe("");
    }
  });

  it("keeps night action capabilities private to the acting viewer", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "CAP223",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        healer: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });

    const clients = await connectPlayers(colyseus, serverRoom, 6, "cap-user");
    const rolePromises = clients.map(async (client, index) => ({
      client,
      userId: `cap-user-${index + 1}`,
      ...((await waitForPrivateRole(client)) as { role: RoleCode; roleNameBg: string }),
    }));
    clients[0]?.send("startGame", {});
    const roleClients = await Promise.all(rolePromises);
    const healer = roleClients.find((client) => client.role === "healer");
    const villager = roleClients.find((client) => client.role === "ordinary_villager");
    expect(healer).toBeTruthy();
    expect(villager).toBeTruthy();

    const healerCapabilities = healer?.client.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    const villagerCapabilities = villager?.client.waitForMessage("night_action_capabilities", 150) as Promise<unknown>;
    clients[0]?.send("narratorAdvance", {});

    await expect(healerCapabilities).resolves.toMatchObject({
      capabilities: expect.objectContaining({
        availableKinds: expect.arrayContaining(["healer_protect"]),
      }),
    });
    await expect(villagerCapabilities).rejects.toThrow("timed out");

    const state = clients[1]?.state as GameState;
    expect("nightActionCapabilities" in (state as unknown as Record<string, unknown>)).toBe(false);
    for (const player of state.players.values()) {
      expect("nightActionCapabilities" in (player as unknown as Record<string, unknown>)).toBe(false);
      expect("role" in player).toBe(false);
    }
  });

  it("sends faction rosters only to faction viewers and keeps them out of synchronized state", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "FSEC23",
      mode: "mafia_free",
      playerCount: 6,
      roles: {
        mafioso: 2,
        civilian: 4,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "faction-user");
    const rosterPromises = clients.map((client) =>
      (client.waitForMessage("private_faction_roster", 600) as Promise<PrivateFactionRoster>)
        .catch(() => null),
    );
    const rolePromises = clients.map((client) => waitForPrivateRole(client));

    clients[0]?.send("startGame", {});
    const roles = await Promise.all(rolePromises);
    const rosters = await Promise.all(rosterPromises);
    const mafiaUserIds = roles
      .map((role, index) => role.role === "mafioso" ? `faction-user-${index + 1}` : null)
      .filter((userId): userId is string => Boolean(userId));

    expect(mafiaUserIds).toHaveLength(2);
    for (const [index, role] of roles.entries()) {
      const roster = rosters[index];
      if (role.role === "mafioso") {
        expect(roster).toMatchObject({
          faction: "mafia",
          members: [{ userId: mafiaUserIds.find((userId) => userId !== `faction-user-${index + 1}`) }],
        });
      } else {
        expect(roster).toBeNull();
      }
    }

    const state = clients[0]?.state as GameState;
    expect("privateFactionRoster" in (state as unknown as Record<string, unknown>)).toBe(false);
    for (const player of state.players.values()) {
      expect("factionRoster" in (player as unknown as Record<string, unknown>)).toBe(false);
      expect("priestBlessed" in (player as unknown as Record<string, unknown>)).toBe(false);
    }
  });

  it("rejects a signed game token created for another room code", async () => {
    process.env.ALLOW_DEV_AUTH = "false";

    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "GPPD23",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const wrongRoomToken = createGameToken({
      userId: "user-1",
      displayName: "Играч 1",
      roomCode: "PTHER3",
      secret: GAME_TOKEN_SECRET,
    });

    await expect(
      authenticateGameJoin({
        code: "GPPD23",
        token: wrongRoomToken,
      }, { consumeNonce: true }),
    ).rejects.toThrow();
  });

  it("rejects invalid authentication before a room instance is created", async () => {
    process.env.ALLOW_DEV_AUTH = "false";
    await expect(OperationalGameRoom.onAuth("", {
      code: "AUTH23",
      mode: "werewolves_classic",
      playerCount: 8,
      token: "not-a-signed-token",
    }, {} as never)).rejects.toThrow();
  });

  it("terminates only the revoked user's active game connection", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "REVK23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const clients = await connectPlayers(colyseus, serverRoom, 2, "revoked-user");
    const revokedClient = clients[0];
    const otherClient = clients[1];
    expect(revokedClient).toBeTruthy();
    expect(otherClient).toBeTruthy();

    const safeError = revokedClient?.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    const leaveCode = new Promise<number>((resolve) => revokedClient?.onLeave(resolve));

    expect(GameRoom.revokeUserConnections("revoked-user-1")).toBe(1);
    await expect(safeError).resolves.toEqual({
      type: "safe_error",
      messageBg: "Сесията ти беше прекратена. Влез отново, за да продължиш.",
    });
    await expect(leaveCode).resolves.toBe(4029);
    expect(otherClient?.connection.isOpen).toBe(true);
  });

  it("does not revoke a newer active client because an older client is still listed", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RACE23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const oldClient = fakeClient("revocation-race-old");
    const newClient = fakeClient("revocation-race-new");
    const identity = {
      userId: "revocation-race-user",
      displayName: "Повторно влязъл играч",
      avatarId: "portrait-m03" as const,
    };

    await serverRoom.onJoin(oldClient, { code: "RACE23" }, { ...identity, tokenIssuedAtMs: 1_000 });
    await serverRoom.onJoin(newClient, { code: "RACE23" }, { ...identity, tokenIssuedAtMs: 2_000 });
    serverRoom.clients.push(oldClient, newClient);
    vi.mocked(oldClient.leave).mockClear();
    vi.mocked(newClient.leave).mockClear();
    vi.spyOn(PlayerPresenceManager, "isGameSessionRevoked")
      .mockImplementation(async (_userId, tokenIssuedAtMs) => tokenIssuedAtMs <= 1_500);

    try {
      await expect(GameRoom.reconcileRevokedConnections()).resolves.toBe(0);
      expect(oldClient.leave).not.toHaveBeenCalled();
      expect(newClient.leave).not.toHaveBeenCalled();
    } finally {
      serverRoom.clients.splice(serverRoom.clients.indexOf(oldClient), 1);
      serverRoom.clients.splice(serverRoom.clients.indexOf(newClient), 1);
    }
  });

  it("consumes signed game tokens before matchmaking reserves a room seat", async () => {
    process.env.ALLOW_DEV_AUTH = "false";
    const token = createGameToken({
      userId: "matchmaking-token-user",
      displayName: "Играч с еднократен токен",
      roomCode: "AUTH24",
      secret: GAME_TOKEN_SECRET,
    });
    const options = { code: "AUTH24", token };

    await expect(OperationalGameRoom.onAuth("", options, {} as never)).resolves.toMatchObject({
      userId: "matchmaking-token-user",
      tokenNonceConsumed: true,
    });
    await expect(OperationalGameRoom.onAuth("", options, {} as never)).rejects.toThrow(
      "Този токен вече е използван.",
    );
  });

  it("rate-limits authenticated matchmaking attempts before room reservation", async () => {
    process.env.ALLOW_DEV_AUTH = "false";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = createGameToken({
        userId: "matchmaking-rate-user",
        displayName: "Играч с много опити",
        roomCode: "RATE24",
        secret: GAME_TOKEN_SECRET,
      });
      await expect(
        OperationalGameRoom.onAuth("", { code: "RATE24", token }, {} as never),
      ).resolves.toMatchObject({ userId: "matchmaking-rate-user" });
    }

    const blockedToken = createGameToken({
      userId: "matchmaking-rate-user",
      displayName: "Играч с много опити",
      roomCode: "RATE24",
      secret: GAME_TOKEN_SECRET,
    });
    await expect(
      OperationalGameRoom.onAuth("", { code: "RATE24", token: blockedToken }, {} as never),
    ).rejects.toThrow("Твърде много опити за вход. Изчакай малко.");
  });

  it("rejects replayed signed game tokens", async () => {
    process.env.ALLOW_DEV_AUTH = "false";

    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "TPK223",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const token = createGameToken({
      userId: "token-user-1",
      displayName: "Играч с токен",
      roomCode: "TPK223",
      secret: GAME_TOKEN_SECRET,
    });

    const options = { code: "TPK223", token };
    await expect(authenticateGameJoin(options, { consumeNonce: true })).resolves.toMatchObject({
      userId: "token-user-1",
      displayName: "Играч с токен",
    });
    await expect(authenticateGameJoin(options, { consumeNonce: true })).rejects.toThrow(
      "Този токен вече е използван.",
    );
  });

  it("publishes only the curated portrait identity carried by the signed token", async () => {
    process.env.ALLOW_DEV_AUTH = "false";

    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "AVTR23",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const token = createGameToken({
      userId: "avatar-user-1",
      displayName: "Играч с портрет",
      avatarId: "portrait-f07",
      roomCode: "AVTR23",
      secret: GAME_TOKEN_SECRET,
    });

    const client = fakeClient("avatar-session");
    const options = { code: "AVTR23", token };
    const auth = await authenticateGameJoin(options, { consumeNonce: true });
    await serverRoom.onJoin(client, options, auth);
    const player = [...serverRoom.state.players.values()].find(
      (candidate) => candidate.userId === "avatar-user-1",
    );

    expect(player?.avatarId).toBe("portrait-f07");
    expect(player && "role" in player).toBe(false);
  });

  it("rate-limits rapid join attempts from the same user", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RATE23",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const auth = { userId: "rate-user-1", displayName: "Митко", avatarId: "portrait-m03" as const };
    const options = { code: "RATE23" };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await serverRoom.onJoin(fakeClient(`rate-session-${attempt}`), options, auth);
    }

    const blockedClient = fakeClient("rate-session-blocked");
    await serverRoom.onJoin(blockedClient, options, auth);

    expect(blockedClient.send).toHaveBeenCalledWith(
      "safe_error",
      expect.objectContaining({
        messageBg: "Твърде много опити за вход. Изчакай малко.",
      }),
    );
    expect(blockedClient.leave).toHaveBeenCalledWith(4029);
  });

  it("releases the matchmaking room claim when a full-room join is rejected", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "FULL24",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    await connectPlayers(colyseus, serverRoom, 6, "full-user");

    const auth = await OperationalGameRoom.onAuth("", {
      code: "FULL24",
      userId: "full-rejected-user",
      displayName: "Пълен отказ",
      avatarId: "portrait-m03",
      mode: "werewolves_classic",
      playerCount: 6,
    }, {} as never);
    const rejectedClient = fakeClient("full-rejected-session");
    const releaseSpy = vi.spyOn(PlayerPresenceManager, "releaseActiveRoom");

    try {
      await serverRoom.onJoin(rejectedClient, { code: "FULL24" }, auth);
      expect(rejectedClient.send).toHaveBeenCalledWith(
        "safe_error",
        expect.objectContaining({ messageBg: "Стаята е пълна." }),
      );
      expect(rejectedClient.leave).toHaveBeenCalled();
      expect(releaseSpy).toHaveBeenCalledWith("full-rejected-user", "FULL24");
    } finally {
      releaseSpy.mockRestore();
    }
  });

  it("releases the matchmaking room claim when the join rate limit rejects onJoin", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RATE24",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const userId = "rate-rejected-user";
    const auth = {
      userId,
      displayName: "Ограничен вход",
      avatarId: "portrait-m03" as const,
      matchmakingGuardsApplied: false,
    };
    await expect(
      PlayerPresenceManager.claimActiveRoom(userId, "RATE24", Date.now() + 60_000),
    ).resolves.toBe(true);
    const rateLimitSpy = vi.spyOn(PlayerPresenceManager, "checkJoinRateLimit").mockResolvedValue(false);
    const releaseSpy = vi.spyOn(PlayerPresenceManager, "releaseActiveRoom");

    try {
      const rejectedClient = fakeClient("rate-rejected-session");
      await serverRoom.onJoin(rejectedClient, { code: "RATE24" }, auth);

      expect(rejectedClient.leave).toHaveBeenCalledWith(4029);
      expect(releaseSpy).toHaveBeenCalledWith(userId, "RATE24");
    } finally {
      rateLimitSpy.mockRestore();
      releaseSpy.mockRestore();
    }
  });

  it("releases the matchmaking room claim when a replayed nonce rejects onJoin", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "NQNC24",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const userId = "nonce-rejected-user";
    const auth = {
      userId,
      displayName: "Повторен токен",
      avatarId: "portrait-m03" as const,
      tokenNonce: "nonce-replayed",
      tokenExpiresAtMs: Date.now() + 60_000,
      tokenNonceConsumed: false,
    };
    await expect(
      PlayerPresenceManager.claimActiveRoom(userId, "NQNC24", Date.now() + 60_000),
    ).resolves.toBe(true);
    const nonceSpy = vi.spyOn(PlayerPresenceManager, "consumeTokenNonce").mockResolvedValue(false);
    const releaseSpy = vi.spyOn(PlayerPresenceManager, "releaseActiveRoom");

    try {
      const rejectedClient = fakeClient("nonce-rejected-session");
      await serverRoom.onJoin(rejectedClient, { code: "NQNC24" }, auth);

      expect(rejectedClient.leave).toHaveBeenCalledWith(4029);
      expect(releaseSpy).toHaveBeenCalledWith(userId, "NQNC24");
    } finally {
      nonceSpy.mockRestore();
      releaseSpy.mockRestore();
    }
  });

  it("keeps concurrent first joins for one user as a single roster entry", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "DUPE23",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const firstClient = fakeClient("dupe-session-a");
    const secondClient = fakeClient("dupe-session-b");
    const identity = {
      userId: "dupe-user",
      displayName: "Един играч",
      avatarId: "portrait-m03" as const,
    };

    await Promise.all([
      serverRoom.onJoin(firstClient, { code: "DUPE23" }, identity),
      serverRoom.onJoin(secondClient, { code: "DUPE23" }, identity),
    ]);

    const matchingRows = [...serverRoom.state.players.values()].filter(
      (player) => player.userId === identity.userId,
    );
    expect(matchingRows).toHaveLength(1);
    expect(matchingRows[0]?.connected).toBe(true);
  });

  it("promotes a raced lobby spectator when the concurrent join requests a player slot", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "DUPE24",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const spectatorClient = fakeClient("dupe-spectator");
    const playerClient = fakeClient("dupe-player");
    const identity = {
      userId: "dupe-spectator-user",
      displayName: "Наблюдател играч",
      avatarId: "portrait-m03" as const,
    };

    await Promise.all([
      serverRoom.onJoin(spectatorClient, { code: "DUPE24", spectator: true }, identity),
      serverRoom.onJoin(playerClient, { code: "DUPE24" }, identity),
    ]);

    const matchingRows = [...serverRoom.state.players.values()].filter(
      (player) => player.userId === identity.userId,
    );
    expect(matchingRows).toHaveLength(1);
    expect(matchingRows[0]).toMatchObject({ playing: true, alive: true, connected: true });
  });

  it("rechecks display-name uniqueness after a concurrent join claim", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "NAME24",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const firstClient = fakeClient("name-session-a");
    const secondClient = fakeClient("name-session-b");
    const firstIdentity = {
      userId: "name-user-a",
      displayName: "Едно и също име",
      avatarId: "portrait-m03" as const,
    };
    const secondIdentity = {
      userId: "name-user-b",
      displayName: "Едно и също име",
      avatarId: "portrait-m04" as const,
    };

    await Promise.all([
      serverRoom.onJoin(firstClient, { code: "NAME24" }, firstIdentity),
      serverRoom.onJoin(secondClient, { code: "NAME24" }, secondIdentity),
    ]);

    const matchingRows = [...serverRoom.state.players.values()].filter(
      (player) => player.displayName === firstIdentity.displayName,
    );
    expect(matchingRows).toHaveLength(1);
    const rejectedClients = [firstClient, secondClient].filter((client) =>
      vi.mocked(client.send).mock.calls.some(
        ([type, payload]) => type === "safe_error"
          && (payload as { messageBg?: string }).messageBg === "Това име вече се използва в стаята.",
      ),
    );
    expect(rejectedClients).toHaveLength(1);
    expect(rejectedClients[0]?.leave).toHaveBeenCalled();
  });

  it("does not let a stale reconnection replace a newer active connection", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RECN23",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const options = { code: "RECN23" };
    const firstClient = fakeClient("reconnect-old");
    const secondClient = fakeClient("reconnect-new");

    await serverRoom.onJoin(firstClient, options, {
      userId: "reconnect-user",
      displayName: "Играч с две връзки",
      avatarId: "portrait-m03",
    });
    await serverRoom.onJoin(secondClient, options, {
      userId: "reconnect-user",
      displayName: "Играч с две връзки",
      avatarId: "portrait-m03",
    });
    vi.mocked(firstClient.send).mockClear();
    vi.mocked(firstClient.leave).mockClear();

    serverRoom.onReconnect(firstClient);

    expect(firstClient.send).toHaveBeenCalledWith(
      "safe_error",
      expect.objectContaining({ messageBg: "Тази връзка е заменена от по-нова сесия." }),
    );
    expect(firstClient.leave).toHaveBeenCalledWith(4029);
    expect(firstClient.send).not.toHaveBeenCalledWith("private_role", expect.anything());
  });

  it("rejects a current reconnection after its game session was revoked", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RVRK23",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const client = fakeClient("reconnect-revoked");

    await serverRoom.onJoin(client, { code: "RVRK23" }, {
      userId: "reconnect-revoked-user",
      displayName: "Прекратен играч",
      avatarId: "portrait-m03",
      tokenIssuedAtMs: 1_000,
    });
    vi.mocked(client.send).mockClear();
    vi.mocked(client.leave).mockClear();
    vi.spyOn(PlayerPresenceManager, "isGameSessionRevoked").mockResolvedValueOnce(true);

    await serverRoom.onReconnect(client);

    expect(client.send).toHaveBeenCalledWith(
      "safe_error",
      expect.objectContaining({ messageBg: "Сесията ти беше прекратена. Влез отново, за да продължиш." }),
    );
    expect(client.leave).toHaveBeenCalledWith(4029);
    expect(client.send).not.toHaveBeenCalledWith("private_role", expect.anything());
  });

  it("fails a reconnect closed when the revocation store is unavailable", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RVFL23",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const client = fakeClient("reconnect-store-failure");

    await serverRoom.onJoin(client, { code: "RVFL23" }, {
      userId: "reconnect-store-failure-user",
      displayName: "Играч без Redis",
      avatarId: "portrait-m03",
      tokenIssuedAtMs: 1_000,
    });
    vi.mocked(client.send).mockClear();
    vi.mocked(client.leave).mockClear();
    vi.spyOn(PlayerPresenceManager, "isGameSessionRevoked").mockRejectedValueOnce(new Error("redis unavailable"));

    await serverRoom.onReconnect(client);

    expect(client.send).toHaveBeenCalledWith(
      "safe_error",
      expect.objectContaining({ messageBg: "Не успяхме да възстановим сигурно връзката. Опитай отново." }),
    );
    expect(client.leave).toHaveBeenCalledWith(4029);
    expect(client.send).not.toHaveBeenCalledWith("private_role", expect.anything());
  });

  it("replaces manual-only roles unless the room uses full human narrator", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MAN223",
      mode: "werewolves_classic",
      playerCount: 8,
      narratorMode: "automatic",
      rolePreset: "manual",
      roles: {
        ordinary_villager: 4,
        werewolf: 2,
        stray_cat: 1,
        guard_dog: 1,
      },
    });

    const roleCounts = new Map([...serverRoom.state.roleCounts.values()].map((role) => [role.role, role.count]));
    expect(roleCounts.get("stray_cat")).toBeUndefined();
    expect(roleCounts.get("guard_dog")).toBeUndefined();
    expect(roleCounts.get("ordinary_villager")).toBe(6);
  });

  it("requires full narrator consent and sends all roles only to the full narrator", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "NARR23",
      mode: "mafia_free",
      playerCount: 4,
      narratorMode: "full_human",
    });

    const clients = await connectPlayers(colyseus, serverRoom, 5, "narr-user");

    const blockedStart = clients[0]?.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    clients[0]?.send("startGame", {});
    await expect(blockedStart).resolves.toMatchObject({
      messageBg: "Всички играчи трябва да приемат предупреждението за Пълен Разказвач.",
    });

    for (const client of clients) {
      client.send("acceptFullNarrator", {});
    }
    await delay(50);

    const narratorSnapshot = clients[0]?.waitForMessage("narrator_role_snapshot") as Promise<{
      roles: Array<{ userId: string; role: string; roleNameBg: string }>;
    }>;
    const privateRoleMessages = clients.slice(1).map((client) => waitForPrivateRole(client));
    clients[0]?.send("startGame", {});

    await Promise.all(privateRoleMessages);
    await expect(narratorSnapshot).resolves.toMatchObject({
      roles: expect.arrayContaining([
        expect.objectContaining({ userId: "narr-user-2" }),
        expect.objectContaining({ userId: "narr-user-3" }),
        expect.objectContaining({ userId: "narr-user-4" }),
        expect.objectContaining({ userId: "narr-user-5" }),
      ]),
    });
  });
});

function waitForPrivateRole(client: ClientRoom<GameRoom, GameState>) {
  return client.waitForMessage("private_role") as Promise<{ role: string; roleNameBg: string }>;
}

async function connectPlayers(
  colyseus: ColyseusTestServer,
  room: GameRoom,
  count: number,
  prefix: string,
): Promise<Array<ClientRoom<GameRoom, GameState>>> {
  const clients: Array<ClientRoom<GameRoom, GameState>> = [];
  for (let index = 0; index < count; index += 1) {
    clients.push(
      await connectWithRetry(colyseus, room, {
        code: room.state.code,
        userId: `${prefix}-${index + 1}`,
        displayName: `Играч ${index + 1}`,
      }),
    );
  }
  return clients;
}

async function connectWithRetry(
  colyseus: ColyseusTestServer,
  room: GameRoom,
  options: { code: string; userId: string; displayName: string },
): Promise<ClientRoom<GameRoom, GameState>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await colyseus.connectTo(room, options);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("fetch failed")) {
        throw error;
      }
      await delay(25 * (attempt + 1));
    }
  }
  throw lastError;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeClient(sessionId: string) {
  return {
    sessionId,
    send: vi.fn(),
    leave: vi.fn(),
    userData: undefined,
  } as unknown as Parameters<GameRoom["onJoin"]>[0];
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
