import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { parseTerminalGameResult, type CreateRoomOptions } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import {
  advanceToPhase, connectPlayers, connectWithRetry, findPublicPlayer,
  startGameAndCollectRoles, waitForCondition, type RoleClient,
} from "./helpers.js";

describe("command-driven multiplayer finale and repeat", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    vi.stubEnv("ALLOW_DEV_AUTH", "true");
    colyseus = await boot(appConfig, 2714);
  });
  afterEach(async () => { await colyseus.cleanup(); });
  afterAll(async () => {
    await colyseus?.shutdown();
    vi.unstubAllEnvs();
  });

  it.each(["werewolves_classic", "mafia_free"] as const)(
    "%s keeps the Jester private, reaches faction victory through commands and starts a clean repeat",
    async (mode) => {
      const factionRole = mode === "mafia_free" ? "mafioso" : "werewolf";
      const villageRole = mode === "mafia_free" ? "civilian" : "ordinary_villager";
      const room = await colyseus.createRoom<GameRoom>("game", {
        code: "FLAWJS", mode, playerCount: 8, rolePreset: "manual",
        tempoProfile: "manual", firstNightKill: false, mafiaNightKill: true,
        revealRolesOnDeath: true, loversEnabled: false, autoStart: false,
        roles: { [villageRole]: 5, [factionRole]: 2, jester: 1 },
      });
      const clients = await connectPlayers(colyseus, room, 8, `flow-${mode}`);
      const observer = await connectWithRetry(colyseus, room, {
        code: room.state.code, userId: `observer-${mode}`, displayName: "Synthetic observer", spectator: true,
      });
      for (const { client } of clients) client.send("ready", { ready: true });
      await waitForCondition(() => [...room.state.players.values()].filter((player) => player.playing).every((player) => player.ready), "ready roster");
      const roles = await startGameAndCollectRoles(clients);
      let host = roles[0]!;
      const jester = roles.find((player) => player.role === "jester")!;
      const enemies = roles.filter((player) => player.role === factionRole);
      const villagers = roles.filter((player) => player.role === villageRole);
      const privateWin = vi.fn();
      const publicWin = vi.fn();
      observer.onMessage("system", publicWin);
      const acceptedSetup = room.state.nextRoomOptionsJson;

      const formerHost = host;
      await reconnect(formerHost);
      expect(host.userId).not.toBe(formerHost.userId);
      const rejectedAdvance = formerHost.client.waitForMessage("safe_error");
      formerHost.client.send("narratorAdvance", {});
      await expect(rejectedAdvance).resolves.toMatchObject({ messageBg: "Само Разказвачът или домакинът може да смени фазата." });
      expect(room.state.phase).toBe("role_reveal");
      jester.client.onMessage("system", privateWin);

      await advanceToPhase(host.client, room, "voting");
      await voteOut(jester);
      await assertHidden();
      expect(privateWin).toHaveBeenCalledWith(expect.objectContaining({ messageBg: expect.stringContaining("лична победа") }));
      expect(publicWin).not.toHaveBeenCalled();

      await reconnect(jester);
      const restored = jester.client.waitForMessage("system");
      const restoredRole = jester.client.waitForMessage("private_role");
      await jester.client.request("syncPrivateState");
      await expect(restored).resolves.toMatchObject({ messageBg: expect.stringContaining("лична победа") });
      await expect(restoredRole).resolves.toMatchObject({ role: "jester" });
      await assertHidden();
      expect(publicWin).not.toHaveBeenCalled();

      // Eliminate one faction member so the finale must also credit a dead teammate.
      await nightKill(villagers[0]!);
      await advanceToPhase(host.client, room, "voting");
      await voteOut(enemies[1]!);
      await assertHidden();
      await nightKill(villagers[1]!);
      await advanceToPhase(host.client, room, "voting");
      await voteOut(villagers[2]!);
      await assertHidden();
      await nightKill(villagers[3]!);
      await advanceToPhase(host.client, room, "game_over");

      const viewers = [...roles.map(({ client }) => client), observer];
      await waitForCondition(() => viewers.every((client) => Boolean(client.state.terminalResultJson)), "terminal snapshots");
      const terminal = parseTerminalGameResult(JSON.parse(observer.state.terminalResultJson));
      expect(terminal).toBeDefined();
      expect(terminal?.winnerTeam).toBe(mode === "mafia_free" ? "mafia" : "werewolves");
      expect(terminal?.winnerPlayerIds.toSorted()).toEqual(enemies.map(({ userId }) => userId).toSorted());
      expect(terminal?.personalWinnerPlayerIds).toEqual([jester.userId]);
      expect(terminal?.winnerPlayerIds).not.toContain(jester.userId);
      expect(terminal?.finalRoles).toHaveLength(8);
      expect(terminal?.finalRoles).toEqual(expect.arrayContaining(roles.map(({ userId, role }) => ({ userId, role }))));
      expect(terminal?.finalRoles.some(({ userId }) => userId === `observer-${mode}`)).toBe(false);
      for (const client of viewers) expect(JSON.parse(client.state.terminalResultJson)).toEqual(terminal);
      expect([...observer.state.publicEvents.values()].filter((event) => event.messageBg.includes("беше Шут"))).toHaveLength(1);
      expect(room.state.nextRoomOptionsJson).toBe(acceptedSetup);

      await reconnect(jester);
      await waitForCondition(() => Boolean(jester.client.state.terminalResultJson), "postgame reconnect");
      expect(JSON.parse(jester.client.state.terminalResultJson)).toEqual(terminal);
      expect([...jester.client.state.players.values()].filter((player) => player.userId === jester.userId)).toHaveLength(1);

      const repeatOptions = JSON.parse(acceptedSetup) as CreateRoomOptions;
      expect(repeatOptions).not.toHaveProperty("code");
      expect(repeatOptions).not.toHaveProperty("spectator");
      const repeated = await colyseus.createRoom<GameRoom>("game", { ...repeatOptions, code: "FLAWRP" });
      expect(repeated.roomId).not.toBe(room.roomId);
      expect(repeated.state.nextRoomOptionsJson).toBe(acceptedSetup);
      expect(repeated.state.terminalResultJson).toBe("");
      expect(repeated.state.winnerTeam).toBe("");
      const repeatedClients = [];
      for (const { userId, displayName } of roles) {
        repeatedClients.push({ userId, displayName, client: await connectWithRetry(colyseus, repeated, {
          code: repeated.state.code, userId, displayName,
        }) });
      }
      const repeatedRoles = await startGameAndCollectRoles(repeatedClients);
      expect(repeatedRoles.map(({ role }) => role).toSorted()).toEqual(roles.map(({ role }) => role).toSorted());
      await repeated.waitForNextPatch();
      for (const { client } of repeatedRoles) {
        expect(client.state.phase).toBe("role_reveal");
        expect(client.state.terminalResultJson).toBe("");
        expect([...client.state.players.values()].every((player) => player.alive && !player.revealedRole)).toBe(true);
      }
      expect(JSON.parse(observer.state.terminalResultJson)).toEqual(terminal);

      async function voteOut(target: RoleClient) {
        for (const actor of roles.filter(({ userId }) => findPublicPlayer(room, userId)?.alive)) {
          const ack = actor.client.waitForMessage("vote_ack");
          actor.client.send("submitVote", { targetUserId: target.userId });
          await expect(ack).resolves.toMatchObject({ targetUserId: target.userId, phase: "voting" });
        }
        await advanceToPhase(host.client, room, "resolution");
        expect(findPublicPlayer(room, target.userId)?.alive).toBe(false);
      }

      async function nightKill(target: RoleClient) {
        await advanceToPhase(host.client, room, "night");
        for (const actor of enemies.filter(({ userId }) => findPublicPlayer(room, userId)?.alive)) {
          const ack = actor.client.waitForMessage("night_action_ack");
          actor.client.send("submitNightAction", { action: { kind: "faction_kill", targetUserId: target.userId } });
          await expect(ack).resolves.toMatchObject({ phase: "night" });
        }
        host.client.send("narratorAdvance", {});
        await waitForCondition(() => !findPublicPlayer(room, target.userId)?.alive, "night action resolution");
      }

      async function assertHidden() {
        await room.waitForNextPatch();
        for (const client of [...roles.map(({ client }) => client), observer]) {
          expect(client.state.phase).not.toBe("game_over");
          expect(client.state.terminalResultJson).toBe("");
          expect(client.state.winnerTeam).toBe("");
          expect([...client.state.players.values()].every((player) => !player.revealedRole)).toBe(true);
          expect([...client.state.publicEvents.values()].some((event) => /лична победа|беше Шут/.test(event.messageBg))).toBe(false);
        }
      }

      async function reconnect(player: RoleClient) {
        await player.client.leave();
        await waitForCondition(() => !findPublicPlayer(room, player.userId)?.connected, "player disconnect");
        player.client = await connectWithRetry(colyseus, room, {
          code: room.state.code, userId: player.userId, displayName: player.displayName,
        });
        await waitForCondition(() => Boolean(findPublicPlayer(room, player.userId)?.connected), "player reconnect");
        host = roles.find(({ userId }) => findPublicPlayer(room, userId)?.host)!;
        expect(host).toBeDefined();
      }
    },
    20_000,
  );
});
