import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import type { ServerEvent } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";
import {
  advanceToPhase,
  connectPlayers,
  connectWithRetry,
  delay,
  restoreEnvValue,
  startGameAndCollectRoles,
} from "./helpers.js";

describe("GameRoom authoritative Sport Mafia day flow", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeEach(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2687);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("authorizes only the current speaker, replaces public nominations, sequences unique defenses, and restricts voting", async () => {
    const serverRoom = await createSportRoom(colyseus, "SPDAY2");
    const clients = await connectPlayers(colyseus, serverRoom, 10, "sport-day");
    await startGameAndCollectRoles(clients);
    await advanceToPhase(clients[0]?.client, serverRoom, "day_discussion");

    const firstSpeaker = clients[0];
    const secondSpeaker = clients[1];
    const firstTarget = clients[2];
    const replacementTarget = clients[3];
    const secondUniqueTarget = clients[4];
    const thirdUniqueTarget = clients[5];
    expect(firstSpeaker && secondSpeaker && firstTarget && replacementTarget && secondUniqueTarget && thirdUniqueTarget).toBeTruthy();
    expect(serverRoom.state.currentSpeakerUserId).toBe(firstSpeaker?.userId);
    expect(serverRoom.state.phaseEndsAt - Date.now()).toBeGreaterThan(58_000);
    expect(serverRoom.state.phaseEndsAt - Date.now()).toBeLessThanOrEqual(60_000);

    await expectSafeError(
      secondSpeaker?.client,
      "submitNomination",
      { targetUserId: firstTarget?.userId },
      "Само текущият говорител може да направи номинация.",
    );
    await expectSafeError(
      firstSpeaker?.client,
      "submitNomination",
      { targetUserId: firstSpeaker?.userId },
      "Не можеш да номинираш себе си.",
    );
    await expectSafeError(
      firstSpeaker?.client,
      "submitNomination",
      { targetUserId: "missing-player" },
      "Можеш да номинираш само жив участник.",
    );

    const firstAck = firstSpeaker?.client.waitForMessage("nomination_ack") as Promise<ServerEvent>;
    firstSpeaker?.client.send("submitNomination", { targetUserId: firstTarget?.userId });
    await expect(firstAck).resolves.toMatchObject({
      type: "nomination_ack",
      targetUserId: firstTarget?.userId,
      replaced: false,
    });

    const replacementAck = firstSpeaker?.client.waitForMessage("nomination_ack") as Promise<ServerEvent>;
    firstSpeaker?.client.send("submitNomination", { targetUserId: replacementTarget?.userId });
    await expect(replacementAck).resolves.toMatchObject({
      type: "nomination_ack",
      targetUserId: replacementTarget?.userId,
      replaced: true,
    });
    expect([...serverRoom.state.nominations]).toEqual([
      expect.objectContaining({
        nominatorUserId: firstSpeaker?.userId,
        targetUserId: replacementTarget?.userId,
      }),
    ]);

    const reconnecting = clients[9];
    reconnecting?.client.leave();
    await delay(40);
    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: reconnecting?.userId ?? "",
      displayName: reconnecting?.displayName ?? "",
    });
    const reconnectedState = await waitForClientDayState(
      reconnected,
      firstSpeaker?.userId ?? "",
      replacementTarget?.userId ?? "",
    );
    expect(reconnectedState.currentSpeakerUserId).toBe(firstSpeaker?.userId);
    expect([...reconnectedState.nominations]).toEqual([
      expect.objectContaining({
        nominatorUserId: firstSpeaker?.userId,
        targetUserId: replacementTarget?.userId,
      }),
    ]);
    for (const publicPlayer of reconnectedState.players.values()) {
      expect(Object.prototype.hasOwnProperty.call(publicPlayer, "role")).toBe(false);
    }
    expect(Object.keys(reconnectedState.nominations[0]?.toJSON() ?? {}).sort()).toEqual([
      "nominatorUserId",
      "targetUserId",
    ]);

    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.currentSpeakerUserId).toBe(secondSpeaker?.userId);
    const duplicateAck = secondSpeaker?.client.waitForMessage("nomination_ack") as Promise<ServerEvent>;
    secondSpeaker?.client.send("submitNomination", { targetUserId: replacementTarget?.userId });
    await duplicateAck;

    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.currentSpeakerUserId).toBe(firstTarget?.userId);
    const uniqueAck = firstTarget?.client.waitForMessage("nomination_ack") as Promise<ServerEvent>;
    firstTarget?.client.send("submitNomination", { targetUserId: secondUniqueTarget?.userId });
    await uniqueAck;

    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.currentSpeakerUserId).toBe(replacementTarget?.userId);
    const thirdUniqueAck = replacementTarget?.client.waitForMessage("nomination_ack") as Promise<ServerEvent>;
    replacementTarget?.client.send("submitNomination", { targetUserId: thirdUniqueTarget?.userId });
    await thirdUniqueAck;

    for (let guard = 0; guard < 12 && serverRoom.state.phase === "day_discussion"; guard += 1) {
      await advanceOnce(firstSpeaker?.client, serverRoom);
    }
    expect(serverRoom.state.phase).toBe("nomination");
    expect(serverRoom.state.currentSpeakerUserId).toBe("");
    expect([...serverRoom.state.nominations].map((item) => item.targetUserId)).toEqual([
      replacementTarget?.userId,
      replacementTarget?.userId,
      secondUniqueTarget?.userId,
      thirdUniqueTarget?.userId,
    ]);

    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.phase).toBe("defense");
    expect(serverRoom.state.currentDefenseUserId).toBe(replacementTarget?.userId);
    expect(serverRoom.state.phaseEndsAt - Date.now()).toBeGreaterThan(58_000);

    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.phase).toBe("defense");
    expect(serverRoom.state.currentDefenseUserId).toBe(secondUniqueTarget?.userId);
    expect(serverRoom.state.phaseEndsAt - Date.now()).toBeGreaterThan(58_000);

    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.phase).toBe("defense");
    expect(serverRoom.state.currentDefenseUserId).toBe(thirdUniqueTarget?.userId);
    expect(serverRoom.state.phaseEndsAt - Date.now()).toBeGreaterThan(58_000);

    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.phase).toBe("voting");
    expect(serverRoom.state.currentDefenseUserId).toBe("");
    expect(serverRoom.state.nominations).toHaveLength(4);

    await expectSafeError(
      firstSpeaker?.client,
      "submitVote",
      { targetUserId: clients[6]?.userId },
      "В Спортна Мафия се гласува само за номиниран играч.",
    );
    await expectSafeError(
      firstSpeaker?.client,
      "submitVote",
      { targetUserId: "skip" },
      "В Спортна Мафия се гласува само за номиниран играч.",
    );

    const voteAck = firstSpeaker?.client.waitForMessage("vote_ack") as Promise<ServerEvent>;
    firstSpeaker?.client.send("submitVote", { targetUserId: replacementTarget?.userId });
    await expect(voteAck).resolves.toMatchObject({
      type: "vote_ack",
      targetUserId: replacementTarget?.userId,
    });

    const secondVoteAck = secondSpeaker?.client.waitForMessage("vote_ack") as Promise<ServerEvent>;
    secondSpeaker?.client.send("submitVote", { targetUserId: secondUniqueTarget?.userId });
    await secondVoteAck;
    await advanceOnce(firstSpeaker?.client, serverRoom);
    expect(serverRoom.state.phase).toBe("voting");
    expect([...serverRoom.state.revoteEligibleUserIds]).toEqual(
      expect.arrayContaining([replacementTarget?.userId, secondUniqueTarget?.userId]),
    );

    await expectSafeError(
      firstTarget?.client,
      "submitVote",
      { targetUserId: thirdUniqueTarget?.userId },
      "При прегласуване може да избереш само играч от равенството.",
    );
  });

  it("reviews an empty nomination list and proceeds directly to resolution", async () => {
    const serverRoom = await createSportRoom(colyseus, "SPNNE2");
    const clients = await connectPlayers(colyseus, serverRoom, 10, "sport-none");
    await startGameAndCollectRoles(clients);
    await advanceToPhase(clients[0]?.client, serverRoom, "day_discussion");

    for (let guard = 0; guard < 12 && serverRoom.state.phase === "day_discussion"; guard += 1) {
      await advanceOnce(clients[0]?.client, serverRoom);
    }
    expect(serverRoom.state.phase).toBe("nomination");
    expect(serverRoom.state.nominations).toHaveLength(0);

    await advanceOnce(clients[0]?.client, serverRoom);
    expect(serverRoom.state.phase).toBe("resolution");
    expect(serverRoom.state.currentDefenseUserId).toBe("");
  });

  it("keeps Mafia Free on the existing discussion-to-voting flow", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "FREEDY",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      firstNightKill: false,
      roles: { civilian: 2, commissioner: 1, mafioso: 1 },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "mafia-free-day");
    await startGameAndCollectRoles(clients);
    await advanceToPhase(clients[0]?.client, serverRoom, "day_discussion");

    expect(serverRoom.state.currentSpeakerUserId).toBe("");
    expect(serverRoom.state.nominations).toHaveLength(0);
    await advanceOnce(clients[0]?.client, serverRoom);
    expect(serverRoom.state.phase).toBe("voting");
  });

  it("normalizes canonical room codes and rejects invalid creation codes", async () => {
    const room = await createSportRoom(colyseus, " spday2 ");
    expect(room.state.code).toBe("SPDAY2");

    await expect(createSportRoom(colyseus, "SPDAY1")).rejects.toThrow("Невалиден код на стая.");
  });
});

function createSportRoom(colyseus: ColyseusTestServer, code: string) {
  return colyseus.createRoom<GameRoom>("game", {
    code,
    mode: "mafia_sport",
    playerCount: 10,
    firstNightKill: false,
    mafiaNightKill: false,
  });
}

async function advanceOnce(client: ClientRoom | undefined, room: GameRoom) {
  if (!client) {
    throw new Error("A connected narrator client is required to advance the phase.");
  }

  const before = dayFlowState(room);
  let nextPatch = room.waitForNextPatch();
  client.send("narratorAdvance", {});

  const deadline = Date.now() + 5_000;
  while (dayFlowState(room) === before && Date.now() < deadline) {
    await waitForPatch(nextPatch);
    if (dayFlowState(room) !== before) {
      return;
    }
    nextPatch = room.waitForNextPatch();
  }

  throw new Error("The narrator command produced patches without advancing the day flow state.");
}

async function waitForClientDayState(
  room: ClientRoom,
  speakerUserId: string,
  nominationTargetUserId: string,
) {
  for (let index = 0; index < 50; index += 1) {
    const state = room.state as GameState | undefined;
    const nomination = state?.nominations?.[0];
    if (
      state?.currentSpeakerUserId === speakerUserId
      && nomination?.targetUserId === nominationTargetUserId
    ) {
      return state;
    }
    await delay(10);
  }
  return room.state as GameState;
}

function dayFlowState(room: GameRoom) {
  return JSON.stringify({
    phase: room.state.phase,
    phaseEndsAt: room.state.phaseEndsAt,
    currentSpeakerUserId: room.state.currentSpeakerUserId,
    currentDefenseUserId: room.state.currentDefenseUserId,
    revoteEligibleUserIds: [...room.state.revoteEligibleUserIds],
    nominations: [...room.state.nominations].map((nomination) => nomination.toJSON()),
    publicEventCount: room.state.publicEvents.length,
  });
}

async function waitForPatch(patch: Promise<void>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      patch,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Timed out waiting for the narrator state patch.")), 2_000);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function expectSafeError(
  client: ClientRoom | undefined,
  type: string,
  payload: Record<string, unknown>,
  messageBg: string,
) {
  const errorPromise = client?.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
  client?.send(type, payload);
  await expect(errorPromise).resolves.toMatchObject({ messageBg });
}
