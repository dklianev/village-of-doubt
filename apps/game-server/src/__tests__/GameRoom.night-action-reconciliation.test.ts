import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Client } from "@colyseus/core";
import type { GamePhase, NightActionCapabilities, NightActionCommand, RoleCode } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { SubmittedNightAction } from "../game-logic/night-resolver.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { PrivatePlayerState } from "../rooms/game-room-runtime.js";
import { PlayerPresenceManager } from "../rooms/player-presence-manager.js";

interface NightRoomInternals {
  privatePlayers: Map<string, PrivatePlayerState>;
  pendingNightActions: Map<string, SubmittedNightAction[]>;
  currentWitchVictimByTeam: Map<string, string>;
  playerPresence: PlayerPresenceManager;
  submitNightAction(client: Client, action: NightActionCommand): void;
  syncPrivateState(client: Client, userId: string): void;
  transitionTo(phase: GamePhase): void;
  advancePhase(): void;
}

describe("GameRoom night action reconciliation", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig, 2699);
  });
  afterEach(async () => {
    await colyseus.cleanup();
    PlayerPresenceManager.resetForTests();
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });

  async function fixture(actorRole: "witch" | "healer", overrides: Record<string, RoleCode> = {}) {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "NGHT23",
      mode: "werewolves_classic",
      playerCount: 8,
      tempoProfile: "manual",
      firstNightKill: true,
    });
    const internals = room as unknown as NightRoomInternals;
    const clients: Record<string, Client> = {};
    const roles: Record<string, RoleCode> = {
      wolf: "werewolf", actor: actorRole,
      a: "ordinary_villager", b: "ordinary_villager", c: "ordinary_villager",
      d: "ordinary_villager", e: "ordinary_villager", f: "ordinary_villager",
      ...overrides,
    };
    // Deterministic private-role fixtures; production queueing, validation and resolution stay intact.
    for (const [userId, role] of Object.entries(roles)) {
      const client = { sessionId: userId, send: vi.fn(), leave: vi.fn() } as unknown as Client;
      await room.onJoin(client, { code: room.state.code }, {
        userId, displayName: `Player ${userId}`, avatarId: "portrait-m03",
      });
      clients[userId] = client;
      internals.privatePlayers.set(userId, { userId, role, alive: true });
    }
    room.state.round = 1;
    internals.transitionTo("first_night");
    const submit = (userId: string, action: NightActionCommand) => internals.submitNightAction(clients[userId]!, action);
    const capabilities = (userId = "actor") => {
      const calls = vi.mocked(clients[userId]!.send).mock.calls;
      return calls.findLast(([type]) => type === "night_action_capabilities")?.[1]?.capabilities as NightActionCapabilities;
    };
    const nextNight = () => {
      internals.advancePhase();
      expect(room.state.phase).toBe("day_announcement");
      for (const phase of ["day_discussion", "voting", "resolution", "night"]) {
        internals.advancePhase();
        expect(room.state.phase).toBe(phase);
      }
    };
    return { room, internals, clients, submit, capabilities, nextNight };
  }

  it.each(["werewolf", "vampire"] as const)(
    "withdraws a %s victim privately without consuming healing or removing queued poison",
    async (factionRole) => {
      const { room, internals, clients, submit, capabilities } = await fixture("witch", { wolf: factionRole });
      submit("wolf", { kind: "faction_kill", targetUserId: "a" });
      submit("actor", { kind: "witch_heal", targetUserId: "a" });
      submit("actor", { kind: "witch_poison", targetUserId: "b" });
      const before = room.state.toJSON();
      for (const client of Object.values(clients)) vi.mocked(client.send).mockClear();

      submit("wolf", { kind: "skip" });

      expect([...internals.currentWitchVictimByTeam.values()]).toEqual([]);
      expect(internals.pendingNightActions.get("actor")).toEqual([
        { actorUserId: "actor", action: { kind: "witch_poison", targetUserId: "b" } },
      ]);
      expect(capabilities().allowedTargetIdsByKind.witch_heal).toEqual([]);
      expect(capabilities().usedFlags.witch_heal).toBeUndefined();
      expect(clients.actor!.send).toHaveBeenCalledWith("system", expect.objectContaining({
        messageBg: "Избраната жертва се промени. Реши отново дали да използваш лечебната отвара.",
      }));
      for (const userId of ["wolf", "a", "b", "c", "d", "e", "f"]) {
        expect(clients[userId]!.send).not.toHaveBeenCalledWith("system", expect.anything());
      }
      expect(room.state.toJSON()).toEqual(before);
      expect(() => submit("actor", { kind: "witch_heal", targetUserId: "a" })).toThrow();

      internals.advancePhase();
      expect(room.state.phase).toBe("day_announcement");
      expect(internals.privatePlayers.get("actor")?.witchHealUsed).not.toBe(true);
      expect(internals.privatePlayers.get("actor")?.witchPoisonUsed).toBe(true);
      expect(internals.privatePlayers.get("a")?.alive).toBe(true);
      expect(internals.privatePlayers.get("b")?.alive).toBe(false);
    },
  );

  it("clears disconnected Witch healing when one faction member skips and replays no obsolete target", async () => {
    const { internals, clients, submit, capabilities } = await fixture("witch", { f: "werewolf" });
    submit("wolf", { kind: "faction_kill", targetUserId: "a" });
    submit("f", { kind: "faction_kill", targetUserId: "a" });
    submit("actor", { kind: "witch_heal", targetUserId: "a" });
    internals.playerPresence.detachClient("actor", clients.actor);

    submit("wolf", { kind: "skip" });

    expect(internals.pendingNightActions.has("actor")).toBe(false);
    internals.playerPresence.attachClient("actor", clients.actor!);
    internals.syncPrivateState(clients.actor!, "actor");
    expect(capabilities().allowedTargetIdsByKind.witch_heal).toEqual([]);
    internals.advancePhase();
    expect(internals.privatePlayers.get("actor")?.witchHealUsed).not.toBe(true);
    expect([...internals.privatePlayers.values()].every((player) => player.alive)).toBe(true);
  });

  it("retains healing when a second faction still targets the withdrawn victim", async () => {
    const { internals, submit, capabilities } = await fixture("witch", { f: "vampire" });
    submit("wolf", { kind: "faction_kill", targetUserId: "a" });
    submit("f", { kind: "faction_kill", targetUserId: "a" });
    submit("actor", { kind: "witch_heal", targetUserId: "a" });

    submit("wolf", { kind: "skip" });

    expect([...internals.currentWitchVictimByTeam.entries()]).toEqual([["vampires", "a"]]);
    expect(capabilities().allowedTargetIdsByKind.witch_heal).toEqual(["a"]);
    expect(internals.pendingNightActions.get("actor")).toHaveLength(1);
    internals.advancePhase();
    expect(internals.privatePlayers.get("actor")?.witchHealUsed).toBe(true);
    expect(internals.privatePlayers.get("a")?.alive).toBe(true);
  });

  it.each(["skip", "no submission", "roleblocked"] as const)(
    "expires Healer protection after an intervening night with %s",
    async (interveningAction) => {
      const { room, internals, submit, capabilities, nextNight } = await fixture("healer", { f: "roleblocker" });
      submit("actor", { kind: "healer_protect", targetUserId: "a" });
      nextNight();
      expect(room.state.round).toBe(2);
      expect(capabilities().disallowedTargetsByKind.healer_protect).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "a" }),
      ]));
      expect(() => submit("actor", { kind: "healer_protect", targetUserId: "a" })).toThrow();

      if (interveningAction === "skip") submit("actor", { kind: "skip" });
      if (interveningAction === "roleblocked") {
        submit("actor", { kind: "healer_protect", targetUserId: "b" });
        submit("f", { kind: "roleblock", targetUserId: "actor" });
      }
      nextNight();

      expect(room.state.round).toBe(3);
      expect(internals.privatePlayers.get("actor")?.lastResolvedHealerTargetUserId).toBeUndefined();
      expect(capabilities().disallowedTargetsByKind.healer_protect ?? []).toEqual([]);
      expect(() => submit("actor", { kind: "healer_protect", targetUserId: "b" })).not.toThrow();
      expect(() => submit("actor", { kind: "healer_protect", targetUserId: "a" })).not.toThrow();
      nextNight();
      expect(internals.privatePlayers.get("actor")?.lastResolvedHealerTargetUserId).toBe("a");
      expect(() => submit("actor", { kind: "healer_protect", targetUserId: "a" })).toThrow();
    },
  );
});
