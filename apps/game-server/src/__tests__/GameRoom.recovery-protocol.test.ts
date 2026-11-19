import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { ROOM_GONE_ERROR_CODE, SESSION_ENDED_CLOSE_CODE } from "@werewolf/shared";
import appConfig from "../app.config.js";
import { PlayerPresenceManager } from "../rooms/player-presence-manager.js";

const ENV_KEYS = ["ALLOW_DEV_AUTH", "GAME_TOKEN_SECRET", "NODE_ENV"] as const;
const player = { mode: "werewolves_classic", playerCount: 6, userId: "recovery-user", displayName: "Играч" } as const;

// These run through the real SDK and sockets: Colyseus turns room-creation errors into HTTP statuses,
// which a test that calls the room directly cannot see.
describe("room recovery protocol over real sockets", () => {
  let colyseus: ColyseusTestServer;
  let running = false;
  let previousEnv: Record<(typeof ENV_KEYS)[number], string | undefined>;

  beforeEach(async () => {
    previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as typeof previousEnv;
    process.env.GAME_TOKEN_SECRET = "test-secret-that-is-long-enough-32-chars";
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    PlayerPresenceManager.resetForTests();
    colyseus = await boot(appConfig, 2691);
    running = true;
  });

  afterEach(async () => {
    if (running) {
      await colyseus.cleanup();
      await colyseus.shutdown();
    }
    PlayerPresenceManager.resetForTests();
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });

  it("ends the replaced tab's session with a reason it can show", async () => {
    const oldTab = await colyseus.sdk.joinOrCreate("game", { ...player, code: "RCVR23" });
    const reasons: string[] = [];
    oldTab.onMessage("safe_error", (message: { messageBg: string }) => reasons.push(message.messageBg));
    const oldTabLeft = new Promise<number>((resolve) => oldTab.onLeave(resolve));

    const newTab = await colyseus.sdk.joinOrCreate("game", { ...player, code: "RCVR23", requireExisting: true });

    expect(newTab.roomId).toBe(oldTab.roomId);
    await expect(oldTabLeft).resolves.toBe(SESSION_ENDED_CLOSE_CODE);
    expect(reasons).toEqual(["Профилът ти беше отворен от друго устройство."]);
  });

  it("refuses a rejoin to a missing room with a code and Bulgarian reason", async () => {
    await expect(colyseus.sdk.joinOrCreate("game", { ...player, code: "NNNE23", requireExisting: true }))
      .rejects.toMatchObject({ code: ROOM_GONE_ERROR_CODE, message: "Тази стая вече не съществува." });

    await expect(colyseus.sdk.joinOrCreate("game", { ...player, code: "NNNE23" })).resolves.toBeDefined();
  });

  it("does not reveal whether a room exists before the joiner is authenticated", async () => {
    process.env.ALLOW_DEV_AUTH = "false";

    await expect(colyseus.sdk.joinOrCreate("game", { code: "NNNE24", requireExisting: true, token: "not-a-token" }))
      .rejects.not.toMatchObject({ code: ROOM_GONE_ERROR_CODE });
  });

  it("does not spend the player's active-room slots on refused rejoins", async () => {
    for (const code of ["DEAD22", "DEAD23", "DEAD24", "DEAD25", "DEAD26", "DEAD27", "DEAD28"]) {
      await expect(colyseus.sdk.joinOrCreate("game", { ...player, code, requireExisting: true }))
        .rejects.toMatchObject({ code: ROOM_GONE_ERROR_CODE });
    }

    await expect(colyseus.sdk.joinOrCreate("game", { ...player, code: "LYVE23" })).resolves.toBeDefined();
  });

  it("tells connected players when the server shuts down", async () => {
    const room = await colyseus.sdk.joinOrCreate("game", { ...player, code: "SHUT23" });
    const left = new Promise<number>((resolve) => room.onLeave(resolve));

    running = false;
    await colyseus.shutdown();

    await expect(left).resolves.toBe(4001);
  });
});
