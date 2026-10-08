import { Activity, StrictMode, useLayoutEffect, useRef, useState } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGameClient, GAME_ROOM_NAME } from "@/lib/colyseus-client";
import { useGameRoom } from "@/hooks/play/use-game-room";
import { useActionReceipt } from "@/hooks/play/use-action-receipt";
import { isVisualGameFixtureEnabled, parseVisualGameFixture } from "@/hooks/play/visual-game-fixture";
import type { PublicChatMessage, PublicEvent, PublicRoleCount, VoteTallyItem } from "@/lib/play/types";

const mocks = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  useSession: vi.fn(),
  createGameClient: vi.fn(),
}));

vi.mock("@/lib/use-auth-session", () => ({ useAuthSession: mocks.useSession }));

vi.mock("@/lib/colyseus-client", () => ({
  GAME_ROOM_NAME: "game_room",
  createGameClient: mocks.createGameClient,
}));

type StateHandler = (state: unknown) => void;
type MessageHandler = (message: unknown) => void;
type LeaveHandler = (code: number) => void;
type ErrorHandler = (code: number, message?: string) => void;

function createFakeRoom(token = "reconnect-token") {
  const stateHandlers: StateHandler[] = [];
  const leaveHandlers: LeaveHandler[] = [];
  const errorHandlers: ErrorHandler[] = [];
  const dropHandlers: LeaveHandler[] = [];
  const reconnectHandlers: Array<() => void> = [];
  const messageHandlers = new Map<string, MessageHandler[]>();
  const subscribe = <Handler,>(handlers: Handler[], handler: Handler) => {
    handlers.push(handler);
    return () => {
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    };
  };
  const signal = <Handler,>(handlers: Handler[]) => Object.assign(
    vi.fn((handler: Handler) => { handlers.push(handler); }),
    { remove: vi.fn((handler: Handler) => {
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    }) },
  );

  return {
    reconnectionToken: token,
    leave: vi.fn(),
    send: vi.fn(),
    request: vi.fn().mockResolvedValue({ synchronized: true }),
    onStateChange: signal(stateHandlers),
    onMessage: vi.fn((type: string, handler: MessageHandler) => {
      const handlers = messageHandlers.get(type) ?? [];
      messageHandlers.set(type, handlers);
      return subscribe(handlers, handler);
    }),
    onLeave: signal(leaveHandlers),
    onError: signal(errorHandlers),
    onDrop: signal(dropHandlers),
    onReconnect: signal(reconnectHandlers),
    listenerCount() {
      return [stateHandlers, leaveHandlers, errorHandlers, dropHandlers, reconnectHandlers,
        ...messageHandlers.values()].reduce((count, handlers) => count + handlers.length, 0);
    },
    emitState(state: unknown) {
      for (const handler of stateHandlers) {
        handler(state);
      }
    },
    emitMessage(type: string, message: unknown) {
      for (const handler of messageHandlers.get(type) ?? []) {
        handler(message);
      }
    },
    emitLeave(code: number) {
      for (const handler of leaveHandlers) {
        handler(code);
      }
    },
    emitError(code: number, message?: string) {
      for (const handler of errorHandlers) {
        handler(code, message);
      }
    },
    emitDrop() {
      for (const handler of dropHandlers) handler(1006);
    },
    emitReconnect() {
      for (const handler of reconnectHandlers) handler();
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function createClient(joinRoom = createFakeRoom(), reconnectRoom = createFakeRoom("reconnected-token")) {
  return {
    joinRoom,
    reconnectRoom,
    client: {
      joinOrCreate: vi.fn().mockResolvedValue(joinRoom),
      reconnect: vi.fn().mockResolvedValue(reconnectRoom),
    },
  };
}

function makeState() {
  return {
    code: "ABCD",
    mode: "werewolves_classic",
    playerCount: 1,
    narratorMode: "automatic",
    communicationMode: "built_in_chat",
    tempoProfile: "normal",
    dayDiscussionSeconds: 90,
    voteSeconds: 45,
    revealRolesOnDeath: true,
    loversEnabled: true,
    doctorCanSelfProtect: true,
    allowSkipVote: false,
    majorityMode: "simple",
    narratorVoice: "classic",
    phase: "lobby",
    round: 0,
    phaseEndsAt: 0,
    currentSpeakerUserId: "",
    currentDefenseUserId: "",
    winnerTeam: "",
    winnerReasonBg: "",
    players: new Map([
      ["u1", {
        userId: "u1",
        displayName: "Играч",
        connected: true,
        ready: false,
        playing: true,
        alive: true,
        host: true,
        narrator: false,
        acceptedFullNarrator: true,
        mayor: false,
        hasVoted: false,
        actedThisPhase: false,
      }],
    ]),
    roleCounts: [],
    voteTally: [],
    nominations: [],
    publicEvents: [],
    publicChat: [],
  };
}

function makeStateWithPublicRows() {
  return {
    ...makeState(),
    roleCounts: [
      { role: "werewolf", count: 2 },
      { role: "ordinary_villager", count: 6 },
    ] as PublicRoleCount[],
    voteTally: [
      { targetUserId: "u1", targetName: "Player 1", count: 1, hasMayorVote: false },
      { targetUserId: "u2", targetName: "Player 2", count: 2, hasMayorVote: false },
    ] as VoteTallyItem[],
    publicEvents: [
      { id: "event-1", type: "system", messageBg: "Synthetic event" },
      { id: "event-2", type: "phase", messageBg: "Synthetic phase" },
    ] as PublicEvent[],
    publicChat: [
      { id: "chat-1", channel: "public", senderName: "Player 1", message: "Synthetic message" },
      { id: "chat-2", channel: "public", senderName: "Player 2", message: "Another message" },
    ] as PublicChatMessage[],
  };
}

describe("useGameRoom", () => {
  it("retains a duplicate-name rejection after normal close and retries with a fresh token", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    act(() => {
      joinRoom.emitMessage("safe_error", { messageBg: "Това име вече се използва в стаята." });
      joinRoom.emitLeave(1000);
    });
    expect(result.current.connectionStatus).toBe("error");
    expect(result.current.connectionMessage).toBe("Това име вече се използва в стаята.");
    expect(result.current.room).toBeNull();
    expect(result.current.privateRole).toBeNull();

    client.joinOrCreate.mockResolvedValueOnce(reconnectRoom);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "updated-name-token", userId: "u1", displayName: "Рада", roomCode: "ABCD" }),
    } as Response);
    act(() => result.current.reconnectNow());
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(client.joinOrCreate).toHaveBeenCalledTimes(2);
    expect(client.joinOrCreate).toHaveBeenLastCalledWith(GAME_ROOM_NAME, { code: "ABCD", token: "updated-name-token" });
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it("keeps explicit leave cleanup and ordinary action errors separate from join rejection", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result, unmount } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    act(() => joinRoom.emitMessage("safe_error", { messageBg: "Действието не е достъпно." }));
    expect(result.current.connectionStatus).toBe("connected");
    expect(joinRoom.leave).not.toHaveBeenCalled();
    unmount();
    expect(joinRoom.leave).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.useRealTimers();
    mocks.refreshSession.mockReset();
    mocks.useSession.mockReset();
    mocks.createGameClient.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "game-token",
        userId: "u1",
        displayName: "Играч",
        roomCode: "ABCD",
      }),
    }));
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("builds the dev visual fixture without requesting a game token or opening a room", () => {
    const fixture = parseVisualGameFixture(
      "?visualGame=1&phase=voting&family=mafia&players=10&dead=2&role=commissioner&voteTally=full",
      "VISUAL",
      undefined,
      "test",
    );

    expect(fixture?.snapshot.code).toBe("VISUAL");
    expect(fixture?.snapshot.phase).toBe("voting");
    expect(fixture?.snapshot.mode).toBe("mafia_sport");
    expect(fixture?.snapshot.players).toHaveLength(10);
    expect(fixture?.snapshot.players.filter((player) => player.playing && !player.alive)).toHaveLength(2);
    expect(fixture?.snapshot.voteTally.map((item) => item.targetName)).toEqual(["Вера", "Георги"]);
    expect(fixture?.privateRole?.role).toBe("commissioner");
    expect(fixture?.currentUserId).toBe("visual-player-1");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(createGameClient).not.toHaveBeenCalled();
  });

  it("keeps the visual fixture disabled in production", () => {
    expect(isVisualGameFixtureEnabled("?visualGame=1", "production")).toBe(false);
    expect(isVisualGameFixtureEnabled("?visualGame=1", "test")).toBe(true);
  });

  it("clamps visual fixture player and death counts", () => {
    const fixture = parseVisualGameFixture(
      "?visualGame=1&players=99&dead=99&viewer=dead&family=werewolves",
      "VISUAL",
      undefined,
      "test",
    );

    expect(fixture?.snapshot.players).toHaveLength(30);
    expect(fixture?.snapshot.players.filter((player) => player.playing && !player.alive)).toHaveLength(29);
    expect(fixture?.snapshot.players[0]?.alive).toBe(false);
  });

  it("renders exhausted private night abilities without exposing new public state", () => {
    const fixture = parseVisualGameFixture(
      "?visualGame=1&phase=night&family=werewolves&role=witch&capabilities=spent",
      "VISUAL",
      undefined,
      "test",
    );

    expect(fixture?.nightActionCapabilities).toMatchObject({
      availableKinds: [],
      usedFlags: {
        witch_heal: { reasonBg: "Лечебната отвара вече е използвана." },
        witch_poison: { reasonBg: "Отровата вече е използвана." },
      },
    });
    expect("nightActionCapabilities" in (fixture?.snapshot as unknown as Record<string, unknown>)).toBe(false);
    expect(fixture?.snapshot.players.every((player) => (
      !("nightActionCapabilities" in (player as unknown as Record<string, unknown>))
    ))).toBe(true);
  });

  it("blocks unauthenticated users before creating a room client", async () => {
    mocks.useSession.mockReturnValue({
      data: null,
      isError: false,
      isPending: false,
      refresh: mocks.refreshSession,
    });
    const toast = vi.fn();

    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("disconnected"));
    expect(result.current.connectionMessage).toBe("Трябва да влезеш, за да се присъединиш към стаята.");
    expect(createGameClient).not.toHaveBeenCalled();
  });

  it("joins from the initial server session without waiting for another auth request", async () => {
    const initialSession = { user: { id: "u1", name: "Играч" } };
    mocks.useSession.mockImplementation((session) => ({
      data: session ?? null,
      isError: false,
      isPending: false,
      refresh: mocks.refreshSession,
    }));
    const { client } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();

    const { result } = renderHook(() => useGameRoom({
      code: "ABCD",
      createOptions: undefined,
      initialSession,
      toast,
    }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    expect(client.joinOrCreate).toHaveBeenCalledTimes(1);
  });

  it("exposes session verification failures through the existing retry action", async () => {
    mocks.useSession.mockReturnValue({
      data: null,
      isError: true,
      isPending: false,
      refresh: mocks.refreshSession,
    });
    const { result } = renderHook(() => useGameRoom({
      code: "ABCD",
      createOptions: undefined,
      toast: vi.fn(),
    }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("error"));
    expect(result.current.connectionMessage).toBe("Не успяхме да потвърдим сесията ти.");

    act(() => result.current.reconnectNow());
    expect(mocks.refreshSession).toHaveBeenCalledWith({ fresh: true });
    expect(createGameClient).not.toHaveBeenCalled();
  });

  it("joins the room and projects the public state into a snapshot", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();

    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    expect(client.joinOrCreate).toHaveBeenCalledWith(GAME_ROOM_NAME, {
      code: "ABCD",
      token: "game-token",
    });

    act(() => joinRoom.emitState(makeState()));

    await waitFor(() => expect(result.current.snapshot?.code).toBe("ABCD"));
    expect(result.current.currentUserId).toBe("u1");
    expect(result.current.snapshot?.players[0]?.displayName).toBe("Играч");
    expect(result.current.snapshot?.doctorCanSelfProtect).toBe(true);
  });

  it("registers private handlers before requesting the retained private state", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);

    renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast: vi.fn() }));

    await waitFor(() => expect(joinRoom.request).toHaveBeenCalledWith("syncPrivateState"));
    const privateRoleRegistration = joinRoom.onMessage.mock.calls.findIndex(([type]) => type === "private_role");
    expect(privateRoleRegistration).toBeGreaterThanOrEqual(0);
    expect(joinRoom.onMessage.mock.invocationCallOrder[privateRoleRegistration]).toBeLessThan(
      joinRoom.request.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it.each([
    { slice: "roleCounts", patch: { role: "seer" } },
    { slice: "roleCounts", patch: { count: 3 } },
    { slice: "voteTally", patch: { targetUserId: "u2" } },
    { slice: "voteTally", patch: { targetName: "Player 2" } },
    { slice: "voteTally", patch: { count: 2 } },
    { slice: "voteTally", patch: { hasMayorVote: true } },
    { slice: "publicEvents", patch: { id: "event-2" } },
    { slice: "publicEvents", patch: { type: "phase" } },
    { slice: "publicEvents", patch: { messageBg: "Updated event" } },
    { slice: "publicChat", patch: { id: "chat-2" } },
    { slice: "publicChat", patch: { channel: "updated-public-channel" } },
    { slice: "publicChat", patch: { senderName: "Player 2" } },
    { slice: "publicChat", patch: { message: "Updated message" } },
  ] as const)("detects an in-place SDK $slice patch $patch without mutating a retained snapshot", async ({ slice, patch }) => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const state = makeStateWithPublicRows();
    act(() => joinRoom.emitState(state));
    const previous = result.current.snapshot!;
    const previousRows = previous[slice].map((row) => ({ ...row }));

    Object.assign(state[slice][0]!, patch);
    expect.soft(previous[slice]).toEqual(previousRows);
    act(() => joinRoom.emitState(state));
    const next = result.current.snapshot!;
    expect(next).not.toBe(previous);
    expect(next[slice]).not.toBe(previous[slice]);
    expect(next[slice]).toEqual(state[slice]);
    expect(previous[slice]).toEqual(previousRows);
    for (const other of ["players", "roleCounts", "voteTally", "publicEvents", "publicChat"] as const) {
      if (other !== slice) expect(next[other]).toBe(previous[other]);
    }

    act(() => joinRoom.emitState(state));
    expect(result.current.snapshot).toBe(next);
  });

  it("keeps populated public slices stable across no-op notifications and unrelated shell changes", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useGameRoom({ code: "ABCD", createOptions: undefined, toast });
    });
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const state = makeStateWithPublicRows();
    act(() => joinRoom.emitState(state));
    const first = result.current.snapshot!;
    const initialRenders = renders;
    act(() => {
      joinRoom.emitState(state);
      joinRoom.emitState(makeStateWithPublicRows());
      joinRoom.emitState(state);
    });
    expect(result.current.snapshot).toBe(first);
    expect(renders).toBe(initialRenders);

    act(() => joinRoom.emitState({ ...state, narratorVoice: "witch_moonglow" }));
    const next = result.current.snapshot!;
    expect(next.narratorVoice).toBe("witch_moonglow");
    for (const slice of ["players", "roleCounts", "voteTally", "publicEvents", "publicChat"] as const) {
      expect(next[slice]).toBe(first[slice]);
    }
    expect(first.narratorVoice).toBe("classic");
  });

  it.each(["roleCounts", "voteTally", "publicEvents", "publicChat"] as const)(
    "tracks reordering, removal and clearing of %s without changing older snapshots", async (slice) => {
      mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
      const { client, joinRoom } = createClient();
      mocks.createGameClient.mockReturnValue(client);
      const toast = vi.fn();
      const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
      await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
      const state = makeStateWithPublicRows();
      act(() => joinRoom.emitState(state));
      const first = result.current.snapshot!;
      const originalRows = first[slice].map((row) => ({ ...row }));

      state[slice].reverse();
      act(() => joinRoom.emitState(state));
      const reordered = result.current.snapshot!;
      expect(reordered[slice]).toEqual([...originalRows].reverse());
      expect(first[slice]).toEqual(originalRows);

      state[slice].shift();
      act(() => joinRoom.emitState(state));
      const shortened = result.current.snapshot!;
      expect(shortened[slice]).toEqual([originalRows[0]]);
      expect(reordered[slice]).toHaveLength(2);

      state[slice].splice(0);
      act(() => joinRoom.emitState(state));
      const cleared = result.current.snapshot!;
      expect(cleared[slice]).toEqual([]);
      expect(shortened[slice]).toHaveLength(1);
      act(() => joinRoom.emitState(state));
      expect(result.current.snapshot).toBe(cleared);
    },
  );

  it("projects only declared public row fields, not mutable SDK metadata", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const state = makeStateWithPublicRows();
    const expected = makeStateWithPublicRows();
    const slices = ["roleCounts", "voteTally", "publicEvents", "publicChat"] as const;
    for (const slice of slices) {
      Object.assign(state[slice][0]!, { sdkMetadata: { revision: 1 } });
    }
    act(() => joinRoom.emitState(state));
    const snapshot = result.current.snapshot!;
    for (const slice of slices) {
      expect(snapshot[slice]).toEqual(expected[slice]);
      expect(snapshot[slice][0]).not.toBe(state[slice][0]);
      Object.assign(state[slice][0]!, { sdkMetadata: { revision: 2 } });
    }
    act(() => joinRoom.emitState(state));
    expect(result.current.snapshot).toBe(snapshot);
  });

  it("propagates a voting-cycle-only patch to the real receipt hook after the final voter ACK", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => {
      const game = useGameRoom({ code: "ABCD", createOptions: undefined, toast });
      const receipt = useActionReceipt(game.room, game.snapshot?.phase ?? "lobby", game.snapshot?.round ?? 0, {
        hasVoted: game.snapshot?.players[0]?.hasVoted,
        revoteEligibleUserIds: game.snapshot?.revoteEligibleUserIds,
        votingCycle: game.snapshot?.votingCycle,
      });
      return { ...game, receipt };
    });
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const state = { ...makeState(), phase: "voting", round: 2, votingCycle: 2, phaseEndsAt: 1000, revoteEligibleUserIds: ["u2", "u3"] };
    act(() => joinRoom.emitState(state));
    act(() => joinRoom.emitMessage("vote_ack", { phase: "voting", round: 2, votingCycle: 2, targetUserId: "u2" }));
    expect(result.current.receipt).toEqual({ kind: "vote", targetUserId: "u2" });

    act(() => joinRoom.emitState({ ...state, phaseEndsAt: 5000 }));
    expect(result.current.receipt).toEqual({ kind: "vote", targetUserId: "u2" });
    const extendedSnapshot = result.current.snapshot;
    act(() => joinRoom.emitState({ ...state, phaseEndsAt: 5000 }));
    expect(result.current.snapshot).toBe(extendedSnapshot);

    act(() => joinRoom.emitState({ ...state, phaseEndsAt: 5000, votingCycle: 3 }));
    expect(result.current.receipt).toBeNull();
    expect(result.current.snapshot?.votingCycle).toBe(3);
    expect(result.current.snapshot?.players[0]?.hasVoted).toBe(false);
    act(() => joinRoom.emitMessage("vote_ack", { phase: "voting", round: 2, votingCycle: 2, targetUserId: "u2" }));
    expect(result.current.receipt).toBeNull();
  });

  it("retains raw repeat-room settings independently of the phase and preserves unchanged snapshots", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const options = {
      mode: "werewolves_classic",
      playerCount: 8,
      autoStart: false,
      tempoProfile: "manual",
      roles: { werewolf: 2, ordinary_villager: 6 },
      customTimers: { dayDiscussionSeconds: 90 },
    };
    const state = { ...makeState(), nextRoomOptionsJson: JSON.stringify(options) };

    act(() => joinRoom.emitState(state));
    expect(result.current.snapshot?.nextRoomOptionsJson).toBe(state.nextRoomOptionsJson);
    expect(result.current.snapshot).not.toHaveProperty("nextRoomOptions");
    const firstSnapshot = result.current.snapshot;
    act(() => joinRoom.emitState({ ...state }));
    expect(result.current.snapshot).toBe(firstSnapshot);

    const updatedJson = JSON.stringify({ ...options, autoStart: true });
    act(() => joinRoom.emitState({ ...state, nextRoomOptionsJson: updatedJson }));
    expect(result.current.snapshot?.nextRoomOptionsJson).toBe(updatedJson);
    expect(result.current.snapshot).not.toBe(firstSnapshot);
    expect(result.current.snapshot?.phase).toBe("lobby");

    act(() => joinRoom.emitState(makeState()));
    expect(result.current.snapshot?.nextRoomOptionsJson).toBeUndefined();
    const withoutSettings = result.current.snapshot;
    act(() => joinRoom.emitState(makeState()));
    expect(result.current.snapshot).toBe(withoutSettings);
  });

  it.each(["not-json", '{"roomVisibility":"public"}'])(
    "retains malformed repeat-room wire data for post-game validation: %s", async (nextRoomOptionsJson) => {
      mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
      const { client, joinRoom } = createClient();
      mocks.createGameClient.mockReturnValue(client);
      const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast: vi.fn() }));
      await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
      const state = { ...makeState(), nextRoomOptionsJson };

      act(() => joinRoom.emitState(state));
      expect(result.current.snapshot?.nextRoomOptionsJson).toBe(nextRoomOptionsJson);
      expect(result.current.snapshot).not.toHaveProperty("nextRoomOptions");
      const snapshot = result.current.snapshot;
      act(() => joinRoom.emitState({ ...state }));
      expect(result.current.snapshot).toBe(snapshot);
    },
  );

  it("consumes terminal results on patches and reconnect, without inferring them from public text", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const terminalResult = {
      winnerTeam: "draw", winnerPlayerIds: [], personalWinnerPlayerIds: ["u1"],
      finalRoles: [{ userId: "u1", role: "jester" }],
    };
    const state = { ...makeState(), phase: "game_over", winnerTeam: "draw", winnerReasonBg: "Synthetic result." };
    act(() => joinRoom.emitState(state));
    expect(result.current.snapshot?.terminalResult).toBeUndefined();
    const terminalState = { ...state, terminalResultJson: JSON.stringify(terminalResult) };
    act(() => joinRoom.emitState(terminalState));
    expect(result.current.snapshot?.terminalResult).toEqual(terminalResult);
    const snapshot = result.current.snapshot;
    act(() => joinRoom.emitState(terminalState));
    expect(result.current.snapshot).toBe(snapshot);

    vi.useFakeTimers();
    act(() => joinRoom.emitLeave(4001));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.room).toBe(reconnectRoom);
    act(() => reconnectRoom.emitState(terminalState));
    expect(result.current.snapshot?.terminalResult).toEqual(terminalResult);
    act(() => reconnectRoom.emitState({ ...terminalState, phase: "night" }));
    expect(result.current.snapshot?.terminalResult).toBeUndefined();
    vi.useRealTimers();
  });

  it("uses join-or-create when invite URLs also carry room creation options", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client } = createClient();
    mocks.createGameClient.mockReturnValue(client);

    renderHook(() => useGameRoom({
      code: "ABCD",
      createOptions: { mode: "werewolves_classic", playerCount: 8 },
      toast: vi.fn(),
    }));

    await waitFor(() => expect(client.joinOrCreate).toHaveBeenCalledWith(GAME_ROOM_NAME, {
      code: "ABCD",
      mode: "werewolves_classic",
      playerCount: 8,
      token: "game-token",
    }));
  });

  it("announces success only after the authoritative night-action acknowledgement", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();

    renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(client.joinOrCreate).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalledWith({ message: "Нощното действие е прието.", kind: "success" });

    act(() => joinRoom.emitMessage("night_action_ack", { phase: "night", round: 1 }));

    expect(toast).toHaveBeenCalledWith({ message: "Нощното действие е прието.", kind: "success" });
  });

  it.each([
    { cueMode: "silent", tempoProfile: "normal" },
    { cueMode: "visual", tempoProfile: "normal" },
    { cueMode: "audio_vibration", tempoProfile: "normal" },
    { cueMode: "audio_vibration", tempoProfile: "live" },
  ])("acknowledges night actions without extra haptics in $cueMode mode ($tempoProfile)", async ({ cueMode, tempoProfile }) => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { onLine: true, vibrate });
    window.localStorage.setItem("werewolf-cue-mode", cueMode);
    try {
      mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
      const { client, joinRoom } = createClient();
      mocks.createGameClient.mockReturnValue(client);
      const toast = vi.fn();
      const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
      await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
      act(() => joinRoom.emitState({ ...makeState(), phase: "night", round: 1, tempoProfile }));

      act(() => joinRoom.emitMessage("night_action_ack", { phase: "night", round: 1 }));

      expect(toast).toHaveBeenCalledWith({ message: "Нощното действие е прието.", kind: "success" });
      expect(vibrate).not.toHaveBeenCalled();
    } finally {
      window.localStorage.removeItem("werewolf-cue-mode");
      vi.unstubAllGlobals();
    }
  });

  it("projects speaker and nomination replacements without requiring a phase change", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    const state = {
      ...makeState(),
      mode: "mafia_sport",
      phase: "day_discussion",
      round: 2,
      phaseEndsAt: 60_000,
      currentSpeakerUserId: "u1",
      nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }],
    };
    act(() => joinRoom.emitState(state));
    await waitFor(() => expect(result.current.snapshot?.nominations?.[0]?.targetUserId).toBe("u2"));

    act(() => joinRoom.emitState({
      ...state,
      nominations: [{ nominatorUserId: "u1", targetUserId: "u3" }],
    }));
    await waitFor(() => expect(result.current.snapshot?.nominations?.[0]?.targetUserId).toBe("u3"));
    expect(result.current.snapshot?.currentSpeakerUserId).toBe("u1");
  });

  it("announces authoritative nomination acknowledgements in Bulgarian", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();

    renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(client.joinOrCreate).toHaveBeenCalled());
    act(() => joinRoom.emitMessage("nomination_ack", { replaced: true }));

    expect(toast).toHaveBeenCalledWith({ message: "Номинацията е сменена.", kind: "success" });
  });

  it("publishes the persisted game id only after the server confirms the record", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    expect(result.current.recordedGameId).toBeNull();
    act(() => joinRoom.emitMessage("game_recorded", { gameId: "game-1" }));

    expect(result.current.recordedGameId).toBe("game-1");
  });

  it("consumes viewer-owned faction rosters and retained investigation results", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    act(() => {
      joinRoom.emitMessage("private_role", { role: "mafioso", roleNameBg: "Мафиот" });
      joinRoom.emitMessage("private_faction_roster", {
        faction: "mafia",
        members: [{ userId: "u2", displayName: "Борис" }],
      });
      joinRoom.emitMessage("private_check_result", {
        targetUserId: "u3",
        isCommissioner: true,
      });
    });

    expect(result.current.privateFactionRoster).toEqual({
      faction: "mafia",
      members: [{ userId: "u2", displayName: "Борис" }],
    });
    expect(result.current.privateResult).toEqual({ targetUserId: "u3", isCommissioner: true });

    act(() => joinRoom.emitMessage("private_role", { role: "civilian", roleNameBg: "Гражданин" }));
    expect(result.current.privateFactionRoster).toBeNull();
  });

  it("clears every viewer-private value when the signed-in account changes", async () => {
    let sessionUserId: string | undefined = "u1";
    mocks.useSession.mockImplementation(() => ({
      data: sessionUserId ? { user: { id: sessionUserId } } : null,
      isPending: false,
    }));
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result, rerender } = renderHook(() =>
      useGameRoom({ code: "ABCD", createOptions: undefined, toast }),
    );
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    act(() => {
      joinRoom.emitMessage("private_role", { role: "seer", roleNameBg: "Гадателка" });
      joinRoom.emitMessage("private_check_result", { targetUserId: "u3", role: "werewolf" });
      joinRoom.emitMessage("private_faction_roster", {
        faction: "werewolves",
        members: [{ userId: "u2", displayName: "Борис" }],
      });
      joinRoom.emitMessage("private_lovers", { partnerUserId: "u2", partnerName: "Борис" });
      joinRoom.emitMessage("night_action_capabilities", {
        capabilities: { availableKinds: ["check_role"], usedFlags: {}, disallowedTargetsByKind: {} },
      });
      joinRoom.emitMessage("narrator_role_snapshot", { players: [] });
      joinRoom.emitMessage("private_chat", {
        type: "private_chat",
        id: "private-chat-1",
        channel: "werewolves",
        senderUserId: "u2",
        senderName: "Борис",
        message: "Тайна",
        createdAt: 1,
      });
      joinRoom.emitMessage("typing", {
        type: "typing",
        channel: "werewolves",
        senderUserId: "u2",
        senderName: "Борис",
        active: true,
        createdAt: 1,
      });
      joinRoom.emitMessage("private_blessing", {});
    });

    expect(result.current.privateRole?.role).toBe("seer");
    expect(result.current.privateChats).toHaveLength(1);
    expect(result.current.isBlessed).toBe(true);

    sessionUserId = undefined;
    rerender();

    await waitFor(() => {
      expect(result.current.currentUserId).toBe("");
      expect(result.current.privateRole).toBeNull();
      expect(result.current.privateResult).toBeNull();
      expect(result.current.privateFactionRoster).toBeNull();
      expect(result.current.privateLover).toBeNull();
      expect(result.current.nightActionCapabilities).toBeNull();
      expect(result.current.narratorSnapshot).toBeNull();
      expect(result.current.privateChats).toEqual([]);
      expect(result.current.typingNotices).toEqual([]);
      expect(result.current.isBlessed).toBe(false);
    });
  });

  it("restores private data silently on a fresh page and still announces new live results", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const restoredResult = { targetUserId: "u2", isEvil: true };
    joinRoom.request.mockImplementation(async () => {
      joinRoom.emitMessage("private_check_result", restoredResult);
      joinRoom.emitMessage("private_lovers", { loverUserId: "u2", loverName: "Борис" });
      joinRoom.emitMessage("private_blessing", { targetUserId: "u1", targetName: "Рада" });
      joinRoom.emitMessage("narrator_role_snapshot", { roles: [] });
      return { synchronized: true };
    });
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.privateResult).toEqual(restoredResult));
    expect(result.current.privateLover?.loverUserId).toBe("u2");
    expect(result.current.isBlessed).toBe(true);
    expect(result.current.narratorSnapshot).toEqual({ roles: [] });
    expect(toast).not.toHaveBeenCalled();
    act(() => joinRoom.emitMessage("private_check_result", { targetUserId: "u3", isEvil: false }));
    expect(toast).toHaveBeenCalledExactlyOnceWith({ message: "Получен е личен резултат от нощното действие.", kind: "info" });
  });

  it("reconnects with the persisted token without announcing restored private data as new", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const restoredResult = { targetUserId: "u2", isEvil: true };
    reconnectRoom.request.mockImplementation(async () => {
      reconnectRoom.emitMessage("private_check_result", restoredResult);
      reconnectRoom.emitMessage("private_lovers", { loverUserId: "u2", loverName: "Борис" });
      reconnectRoom.emitMessage("private_blessing", { targetUserId: "u1", targetName: "Рада" });
      reconnectRoom.emitMessage("narrator_role_snapshot", { roles: [] });
      return { synchronized: true };
    });

    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    vi.useFakeTimers();
    act(() => joinRoom.emitLeave(4001));
    expect(result.current.connectionStatus).toBe("reconnecting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    expect(result.current.connectionMessage).toBe("Връзката е възстановена.");
    expect(client.reconnect).toHaveBeenCalledWith("reconnect-token");
    expect(reconnectRoom.onStateChange).toHaveBeenCalled();
    expect(reconnectRoom.request).toHaveBeenCalledWith("syncPrivateState");
    expect(toast).toHaveBeenCalledWith({ message: "Върнахме те в стаята.", kind: "success" });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(result.current.privateResult).toEqual(restoredResult);
    expect(result.current.privateLover?.loverUserId).toBe("u2");
    expect(result.current.isBlessed).toBe(true);
    expect(result.current.narratorSnapshot).toEqual({ roles: [] });
    act(() => reconnectRoom.emitMessage("private_check_result", { targetUserId: "u3", isEvil: false }));
    expect(toast).toHaveBeenLastCalledWith({ message: "Получен е личен резултат от нощното действие.", kind: "info" });
    vi.useRealTimers();
  });

  it("recovers an open room only after private resync, without duplicate joins or sync requests", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const onReconnectSuppressed = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast, onReconnectSuppressed }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const sync = deferred<{ synchronized: boolean }>();
    joinRoom.request.mockReturnValueOnce(sync.promise);

    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.connectionStatus).toBe("reconnecting");
    act(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
      result.current.reconnectNow();
      joinRoom.emitState(makeState());
    });
    expect(result.current.connectionStatus).toBe("reconnecting");
    expect(joinRoom.request).toHaveBeenCalledTimes(2);
    expect(joinRoom.request).toHaveBeenLastCalledWith("syncPrivateState");

    await act(async () => {
      joinRoom.emitMessage("private_role", { role: "seer", roleNameBg: "Гадателка" });
      sync.resolve({ synchronized: true });
    });

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.room).toBe(joinRoom);
    expect(result.current.privateRole?.role).toBe("seer");
    expect(onReconnectSuppressed).toHaveBeenCalledOnce();
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
    expect(joinRoom.leave).not.toHaveBeenCalled();
  });

  it("does not replay an achievement celebration after a transport reconnect", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    act(() => joinRoom.emitMessage("achievements_unlocked", { achievementIds: ["first_win"] }));
    expect(result.current.unlockedAchievementIds).toEqual(["first_win"]);
    act(() => joinRoom.emitDrop());
    expect(result.current.unlockedAchievementIds).toEqual([]);
    await act(async () => joinRoom.emitReconnect());
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.unlockedAchievementIds).toEqual([]);
    act(() => joinRoom.emitMessage("achievements_unlocked", { achievementIds: ["first_blood"] }));
    expect(result.current.unlockedAchievementIds).toEqual(["first_blood"]);
  });

  it.each(["offline", "error", "leave"] as const)("clears the transient achievement on %s", async (reason) => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    act(() => joinRoom.emitMessage("achievements_unlocked", { achievementIds: ["first_win"] }));
    act(() => {
      if (reason === "offline") window.dispatchEvent(new Event("offline"));
      else if (reason === "error") joinRoom.emitError(4000);
      else joinRoom.emitLeave(1000);
    });
    expect(result.current.unlockedAchievementIds).toEqual([]);
  });

  it.each([false, undefined])("keeps recovery retryable when private resync does not acknowledge success (%s)", async (synchronized) => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    joinRoom.request.mockResolvedValueOnce({ synchronized });

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.connectionStatus).toBe("error");

    await act(async () => result.current.reconnectNow());
    expect(result.current.connectionStatus).toBe("connected");
    expect(joinRoom.request).toHaveBeenCalledTimes(3);
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it("does not let a stale resync revive a left room or start a second reconnect", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const sync = deferred<{ synchronized: boolean }>();
    joinRoom.request.mockReturnValueOnce(sync.promise);
    vi.useFakeTimers();

    act(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });
    expect(joinRoom.request).toHaveBeenCalledTimes(2);
    act(() => {
      joinRoom.emitLeave(4001);
      window.dispatchEvent(new Event("online"));
      result.current.reconnectNow();
    });
    await act(async () => sync.resolve({ synchronized: true }));
    expect(result.current.connectionStatus).toBe("reconnecting");

    await act(async () => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.room).toBe(reconnectRoom);
    expect(client.reconnect).toHaveBeenCalledExactlyOnceWith("reconnect-token");
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(reconnectRoom.request).toHaveBeenCalledExactlyOnceWith("syncPrivateState");
    vi.useRealTimers();
  });

  it("lets SDK transport recovery finish and resyncs the same room without another join", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    act(() => joinRoom.emitDrop());
    expect(result.current.connectionStatus).toBe("reconnecting");
    act(() => {
      window.dispatchEvent(new Event("online"));
      result.current.reconnectNow();
    });
    expect(joinRoom.request).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();

    const sync = deferred<{ synchronized: boolean }>();
    joinRoom.request.mockReturnValueOnce(sync.promise);
    act(() => joinRoom.emitReconnect());
    expect(result.current.connectionStatus).toBe("reconnecting");
    expect(joinRoom.request).toHaveBeenCalledTimes(2);
    await act(async () => sync.resolve({ synchronized: true }));

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.room).toBe(joinRoom);
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it("resyncs a room joined while the browser was already offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.room).toBe(joinRoom));
    expect(result.current.connectionStatus).toBe("reconnecting");

    await act(async () => window.dispatchEvent(new Event("online")));

    expect(result.current.connectionStatus).toBe("connected");
    expect(joinRoom.request).toHaveBeenCalledExactlyOnceWith("syncPrivateState");
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it("retains the rotated SDK token and clears a recovered transport error", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    await act(async () => {
      joinRoom.emitError(1006, "transport interrupted");
      joinRoom.emitDrop();
      // The SDK rotates this token after dispatching onReconnect.
      joinRoom.emitReconnect();
      joinRoom.reconnectionToken = "rotated-token";
    });

    expect(result.current.connectionStatus).toBe("connected");
    expect(window.sessionStorage.getItem("room-reconnect:ABCD")).toBe("rotated-token");
    await act(async () => result.current.reconnectNow());
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it.each([false, true])("cleans up transport reconnect after unmount (request started: %s)", async (requestStarted) => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    const reconnect = deferred<typeof reconnectRoom>();
    client.reconnect.mockReturnValueOnce(reconnect.promise);
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result, unmount } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    vi.useFakeTimers();
    act(() => joinRoom.emitLeave(4001));
    if (requestStarted) {
      await act(async () => vi.advanceTimersByTimeAsync(1000));
    }
    unmount();

    await act(async () => {
      reconnect.resolve(reconnectRoom);
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();
    });

    expect(client.reconnect).toHaveBeenCalledTimes(requestStarted ? 1 : 0);
    expect(reconnectRoom.leave).toHaveBeenCalledTimes(requestStarted ? 1 : 0);
    expect(reconnectRoom.request).not.toHaveBeenCalled();
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(toast).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("ignores late recovery replies and browser events after unmount", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result, unmount } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const sync = deferred<{ synchronized: boolean }>();
    joinRoom.request.mockReturnValueOnce(sync.promise);
    act(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });
    expect(joinRoom.request).toHaveBeenCalledTimes(2);
    unmount();

    await act(async () => {
      sync.resolve({ synchronized: true });
      window.dispatchEvent(new Event("online"));
      joinRoom.emitReconnect();
    });

    expect(joinRoom.leave).toHaveBeenCalledOnce();
    expect(joinRoom.request).toHaveBeenCalledTimes(2);
    expect(client.reconnect).not.toHaveBeenCalled();
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(toast).not.toHaveBeenCalled();
  });

  it("ignores old room state and private resync events after the signed-in session changes", async () => {
    let signedIn = true;
    mocks.useSession.mockImplementation(() => ({ data: signedIn ? { user: { id: "u1" } } : null, isPending: false }));
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result, rerender } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    const sync = deferred<{ synchronized: boolean }>();
    joinRoom.request.mockReturnValueOnce(sync.promise);
    act(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });
    signedIn = false;
    rerender();
    expect(result.current.connectionStatus).toBe("disconnected");

    await act(async () => {
      joinRoom.emitState(makeState());
      joinRoom.emitMessage("private_role", { role: "seer", roleNameBg: "Гадателка" });
      joinRoom.emitMessage("night_action_capabilities", { capabilities: { availableKinds: ["check_role"], usedFlags: {}, disallowedTargetsByKind: {} } });
      joinRoom.emitMessage("private_chat", { id: "old-chat", message: "Old private message" });
      joinRoom.emitMessage("system", { messageBg: "Old room message" });
      sync.resolve({ synchronized: true });
    });

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.room).toBeNull();
    expect(result.current.snapshot).toBeNull();
    expect(result.current.privateRole).toBeNull();
    expect(result.current.nightActionCapabilities).toBeNull();
    expect(result.current.privateChats).toEqual([]);
    expect(toast).not.toHaveBeenCalled();
  });

  it("does not revive a normally left room after browser offline and online events", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    await act(async () => {
      joinRoom.emitLeave(1000);
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.room).toBeNull();
    expect(joinRoom.request).toHaveBeenCalledOnce();
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it("does not start another connection while an initial signed token is pending", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const token = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(token.promise);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
      result.current.reconnectNow();
    });
    expect(result.current.connectionStatus).not.toBe("lost");
    expect(client.reconnect).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();

    await act(async () => token.resolve({ ok: true, json: async () => ({ token: "game-token", userId: "u1", roomCode: "ABCD" }) } as Response));
    expect(result.current.connectionStatus).toBe("connected");
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
  });

  it("does not join after unmount while a game token request is pending", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const token = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(token.promise);
    const toast = vi.fn();
    const { unmount } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    unmount();

    await act(async () => token.resolve({ ok: true, json: async () => ({ token: "game-token", userId: "u1", roomCode: "ABCD" }) } as Response));

    expect(client.joinOrCreate).not.toHaveBeenCalled();
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it.each(["room", "account", "auth-pending"] as const)(
    "clears retained room and private data during %s changes before the next join",
    async (change) => {
      let userId = "u1";
      let isPending = false;
      mocks.useSession.mockImplementation(() => ({ data: { user: { id: userId } }, isPending }));
      const { client, joinRoom } = createClient();
      mocks.createGameClient.mockReturnValue(client);
      const toast = vi.fn();
      const { result, rerender } = renderHook(({ code }) => useGameRoom({ code, createOptions: undefined, toast }), {
        initialProps: { code: "ABCD" },
      });
      await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
      act(() => {
        joinRoom.emitState(makeStateWithPublicRows());
        joinRoom.emitMessage("private_role", { role: "seer", roleNameBg: "Synthetic role" });
        joinRoom.emitMessage("private_chat", { id: "old-private-chat", message: "Synthetic private message" });
        joinRoom.emitMessage("game_recorded", { gameId: "old-game" });
      });
      expect(result.current.snapshot).not.toBeNull();
      expect(result.current.privateChats).toHaveLength(1);
      vi.mocked(fetch).mockReturnValueOnce(deferred<Response>().promise);
      if (change === "account") userId = "u2";
      if (change === "auth-pending") isPending = true;
      rerender({ code: change === "room" ? "EFGH" : "ABCD" });

      expect(result.current.privateRole).toBeNull();
      expect(result.current.privateChats).toEqual([]);
      expect(result.current.room).toBeNull();
      expect(result.current.snapshot).toBeNull();
      expect(result.current.recordedGameId).toBeNull();
      expect(result.current.connectionStatus).toBe("connecting");
      expect(joinRoom.leave).toHaveBeenCalledOnce();
      expect(joinRoom.listenerCount()).toBe(0);
      act(() => {
        joinRoom.emitState(makeState());
        joinRoom.emitMessage("private_role", { role: "werewolf", roleNameBg: "Late role" });
        joinRoom.emitMessage("private_chat", { id: "late-chat", message: "Late private message" });
        joinRoom.emitMessage("system", { messageBg: "Late event" });
      });
      expect(result.current.privateRole).toBeNull();
      expect(result.current.privateChats).toEqual([]);
      expect(result.current.snapshot).toBeNull();
      expect(toast).not.toHaveBeenCalled();
    },
  );

  it.each(["room", "account", "logout", "auth-pending", "hidden-account"] as const)(
    "does not commit the previous viewer's private data before passive effects after %s changes",
    async (change) => {
      let userId: string | undefined = "u1";
      let isPending = false;
      mocks.useSession.mockImplementation(() => ({ data: userId ? { user: { id: userId } } : null, isPending }));
      const { client, joinRoom } = createClient();
      mocks.createGameClient.mockReturnValue(client);
      const toast = vi.fn();
      const observations: Array<{ value: ReturnType<typeof useGameRoom>; text: string }> = [];
      function BeforePaint({ value }: { value: ReturnType<typeof useGameRoom> }) {
        const ref = useRef<HTMLDivElement>(null);
        // A child layout effect observes committed props/DOM before the parent's effects.
        useLayoutEffect(() => {
          observations.push({ value, text: ref.current?.textContent ?? "" });
        });
        return <div ref={ref}>{value.privateRole?.roleNameBg}{value.privateChats.map((message) => message.message).join("")}</div>;
      }
      function Probe({ code }: { code: string }) {
        const value = useGameRoom({ code, createOptions: undefined, toast });
        return <BeforePaint value={value} />;
      }
      const view = (code: string, mode: "visible" | "hidden" = "visible") => (
        <Activity mode={mode}><Probe code={code} /></Activity>
      );
      const { rerender } = render(view("ABCD"));
      await waitFor(() => expect(joinRoom.request).toHaveBeenCalledOnce());
      act(() => {
        joinRoom.emitState({ ...makeState(), phase: "night" });
        joinRoom.emitMessage("private_role", { role: "seer", roleNameBg: "Synthetic secret role" });
        joinRoom.emitMessage("private_check_result", { targetUserId: "u3", role: "werewolf" });
        joinRoom.emitMessage("private_faction_roster", { faction: "werewolves", members: [{ userId: "u2", displayName: "Synthetic player" }] });
        joinRoom.emitMessage("private_lovers", { partnerUserId: "u2", partnerName: "Synthetic player" });
        joinRoom.emitMessage("night_action_capabilities", { capabilities: { availableKinds: ["check_role"], usedFlags: {}, disallowedTargetsByKind: {} } });
        joinRoom.emitMessage("narrator_role_snapshot", { players: [] });
        joinRoom.emitMessage("private_chat", { id: "old-chat", message: "Synthetic secret chat" });
        joinRoom.emitMessage("typing", { channel: "werewolves", senderUserId: "u2", senderName: "Synthetic player", active: true });
        joinRoom.emitMessage("private_blessing", {});
        joinRoom.emitMessage("achievements_unlocked", { achievementIds: ["old-achievement"] });
        joinRoom.emitMessage("game_recorded", { gameId: "old-game" });
      });
      expect(observations.at(-1)?.text).toContain("Synthetic secret role");
      expect(observations.at(-1)?.text).toContain("Synthetic secret chat");
      if (change === "hidden-account") rerender(view("ABCD", "hidden"));
      observations.length = 0;
      const nextToken = deferred<Response>();
      const nextRoom = createFakeRoom("next-owner-token");
      vi.mocked(fetch).mockReturnValueOnce(nextToken.promise);
      client.joinOrCreate.mockResolvedValueOnce(nextRoom);
      if (change === "account" || change === "hidden-account") userId = "u2";
      if (change === "logout") userId = undefined;
      if (change === "auth-pending") isPending = true;
      rerender(view(change === "room" ? "EFGH" : "ABCD"));

      expect(observations.length).toBeGreaterThan(0);
      for (const { value, text } of observations) {
        expect(text).toBe("");
        expect(value.privateRole).toBeNull();
        expect(value.privateResult).toBeNull();
        expect(value.privateFactionRoster).toBeNull();
        expect(value.privateLover).toBeNull();
        expect(value.nightActionCapabilities).toBeNull();
        expect(value.narratorSnapshot).toBeNull();
        expect(value.privateChats).toEqual([]);
        expect(value.typingNotices).toEqual([]);
        expect(value.isBlessed).toBe(false);
        expect(value.unlockedAchievementIds).toEqual([]);
        expect(value.recordedGameId).toBeNull();
        if (change !== "room") expect(value.currentUserId).not.toBe("u1");
        expect(value.room).toBeNull();
        expect(value.snapshot).toBeNull();
      }

      const nextCode = change === "room" ? "EFGH" : "ABCD";
      if (change === "logout") userId = "u2";
      isPending = false;
      rerender(view(nextCode));
      await act(async () => nextToken.resolve({
        ok: true,
        json: async () => ({ token: "next-game-token", userId, roomCode: nextCode }),
      } as Response));
      act(() => {
        nextRoom.emitState({ ...makeState(), code: nextCode, phase: "night" });
        nextRoom.emitMessage("private_role", { role: "doctor", roleNameBg: "Current role" });
        nextRoom.emitMessage("private_chat", { id: "current-chat", message: "Current chat" });
      });
      const restored = observations.at(-1);
      expect(restored?.text).toBe("Current roleCurrent chat");
      expect(restored?.value.currentUserId).toBe(userId);
      expect(restored?.value.room).toBe(nextRoom);
      expect(restored?.value.snapshot?.code).toBe(nextCode);
      expect(restored?.value.privateChats).toHaveLength(1);
      expect(client.joinOrCreate).toHaveBeenCalledTimes(2);
    },
  );

  it("reuses an Activity subtree without retaining room data or accumulating listeners", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const browserListeners = () => addListener.mock.calls.filter(([type]) => type === "offline" || type === "online");
    const removedBrowserListeners = () => removeListener.mock.calls.filter(([type]) => type === "offline" || type === "online");
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const rooms = [createFakeRoom(), createFakeRoom("second"), createFakeRoom("third")];
    const { client } = createClient();
    client.joinOrCreate.mockReset();
    for (const nextRoom of rooms) client.joinOrCreate.mockResolvedValueOnce(nextRoom);
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const initialize = vi.fn(() => "preserved");
    let current!: ReturnType<typeof useGameRoom>;
    function Probe() {
      useState(initialize);
      current = useGameRoom({ code: "ABCD", createOptions: undefined, toast });
      return null;
    }
    const view = (mode: "hidden" | "visible") => <Activity mode={mode}><Probe /></Activity>;
    const { rerender, unmount } = render(view("visible"));
    await waitFor(() => expect(current.room).toBe(rooms[0]));
    const expectedListeners = rooms[0]!.listenerCount();
    expect(expectedListeners).toBeGreaterThan(0);
    const state = makeStateWithPublicRows();

    for (let index = 0; index < 2; index += 1) {
      const previousRoom = rooms[index]!;
      const nextRoom = rooms[index + 1]!;
      act(() => {
        previousRoom.emitState(state);
        previousRoom.emitMessage("private_role", { role: "seer", roleNameBg: "Synthetic role" });
        previousRoom.emitMessage("private_chat", { id: "private-chat", message: "Synthetic private message" });
        previousRoom.emitMessage("game_recorded", { gameId: "old-game" });
      });
      expect(current.snapshot?.publicChat).toHaveLength(2);
      rerender(view("hidden"));
      expect(previousRoom.leave).toHaveBeenCalledOnce();
      expect(previousRoom.listenerCount()).toBe(0);
      expect(removedBrowserListeners()).toEqual(browserListeners());
      await act(async () => {
        previousRoom.emitMessage("system", { messageBg: "Hidden event" });
        window.dispatchEvent(new Event("offline"));
        window.dispatchEvent(new Event("online"));
      });
      expect(client.joinOrCreate).toHaveBeenCalledTimes(index + 1);
      rerender(view("visible"));
      await waitFor(() => expect(current.room).toBe(nextRoom));
      expect(current.privateRole).toBeNull();
      expect(current.privateChats).toEqual([]);
      expect(current.snapshot).toBeNull();
      expect(current.recordedGameId).toBeNull();
      expect(nextRoom.listenerCount()).toBe(expectedListeners);
      expect(browserListeners().length - removedBrowserListeners().length).toBe(2);
      act(() => nextRoom.emitState(state));
      expect(current.snapshot?.publicChat).toHaveLength(2);
      expect(current.snapshot?.voteTally).toHaveLength(2);
      expect(nextRoom.request).toHaveBeenCalledExactlyOnceWith("syncPrivateState");
    }
    expect(initialize).toHaveBeenCalledOnce();
    expect(client.reconnect).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    unmount();
    expect(rooms.every((room) => room.listenerCount() === 0)).toBe(true);
    expect(removedBrowserListeners()).toEqual(browserListeners());
  });

  it("disposes a stale Activity join after the reactivated subtree has joined another socket", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    const join = deferred<typeof joinRoom>();
    client.joinOrCreate.mockReturnValueOnce(join.promise).mockResolvedValueOnce(reconnectRoom);
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    let current!: ReturnType<typeof useGameRoom>;
    function Probe() {
      current = useGameRoom({ code: "ABCD", createOptions: undefined, toast });
      return null;
    }
    const view = (mode: "hidden" | "visible") => <Activity mode={mode}><Probe /></Activity>;
    const { rerender } = render(view("visible"));
    await waitFor(() => expect(client.joinOrCreate).toHaveBeenCalledOnce());
    rerender(view("hidden"));
    rerender(view("visible"));
    await waitFor(() => expect(current.room).toBe(reconnectRoom));
    await act(async () => join.resolve(joinRoom));
    expect(current.room).toBe(reconnectRoom);
    expect(current.connectionStatus).toBe("connected");
    expect(joinRoom.leave).toHaveBeenCalledOnce();
    expect(joinRoom.listenerCount()).toBe(0);
    expect(joinRoom.request).not.toHaveBeenCalled();
    expect(client.joinOrCreate).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem("room-reconnect:ABCD")).toBe("reconnected-token");
    expect(toast).not.toHaveBeenCalled();
  });

  it("opens only one socket under Strict Mode effect replay", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result, rerender, unmount } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.room).toBe(joinRoom));
    rerender();
    expect(client.joinOrCreate).toHaveBeenCalledOnce();
    expect(joinRoom.request).toHaveBeenCalledExactlyOnceWith("syncPrivateState");
    expect(joinRoom.onStateChange).toHaveBeenCalledOnce();
    expect(joinRoom.onLeave).toHaveBeenCalledOnce();
    unmount();
    expect(joinRoom.leave).toHaveBeenCalledOnce();
    expect(joinRoom.listenerCount()).toBe(0);
  });

  it("joins a refresh-like remount once with fresh authentication and ignores the old room", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    client.joinOrCreate.mockResolvedValueOnce(joinRoom).mockResolvedValueOnce(reconnectRoom);
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const first = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(first.result.current.room).toBe(joinRoom));
    first.unmount();
    const second = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(second.result.current.room).toBe(reconnectRoom));
    act(() => {
      joinRoom.emitMessage("private_role", { role: "seer", roleNameBg: "Old role" });
      joinRoom.emitLeave(1000);
      joinRoom.emitDrop();
      joinRoom.emitReconnect();
    });
    expect(second.result.current.connectionStatus).toBe("connected");
    expect(second.result.current.privateRole).toBeNull();
    expect(client.joinOrCreate).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(client.reconnect).not.toHaveBeenCalled();
    expect(joinRoom.listenerCount()).toBe(0);
    expect(reconnectRoom.request).toHaveBeenCalledExactlyOnceWith("syncPrivateState");
  });

  it("disposes a stale async join that finishes after cleanup without binding private handlers", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom } = createClient();
    const join = deferred<typeof joinRoom>();
    client.joinOrCreate.mockReturnValueOnce(join.promise);
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { unmount } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(client.joinOrCreate).toHaveBeenCalledOnce());
    unmount();
    await act(async () => join.resolve(joinRoom));
    expect(joinRoom.leave).toHaveBeenCalledOnce();
    expect(joinRoom.listenerCount()).toBe(0);
    expect(joinRoom.request).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("room-reconnect:ABCD")).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it("retires the previous socket and ignores its leave while a fresh retry is joining", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    joinRoom.request.mockRejectedValueOnce(new Error("private sync unavailable"));
    const join = deferred<typeof reconnectRoom>();
    client.joinOrCreate.mockResolvedValueOnce(joinRoom).mockReturnValueOnce(join.promise);
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("error"));
    await act(async () => result.current.reconnectNow());
    expect(client.joinOrCreate).toHaveBeenCalledTimes(2);
    // The server replaces the previous connection before the fresh join resolves.
    act(() => joinRoom.emitLeave(1000));
    await act(async () => join.resolve(reconnectRoom));
    expect(result.current.currentUserId).toBe("u1");
    expect(result.current.room).toBe(reconnectRoom);
    expect(result.current.connectionStatus).toBe("connected");
    expect(joinRoom.listenerCount()).toBe(0);
    expect(reconnectRoom.request).toHaveBeenCalledExactlyOnceWith("syncPrivateState");
  });

  it("closes the replaced socket after a fresh retry even if its server close is delayed", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    joinRoom.request.mockRejectedValueOnce(new Error("private sync unavailable"));
    client.joinOrCreate.mockResolvedValueOnce(joinRoom).mockResolvedValueOnce(reconnectRoom);
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result, unmount } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));
    await waitFor(() => expect(result.current.connectionStatus).toBe("error"));
    await act(async () => result.current.reconnectNow());
    expect(result.current.room).toBe(reconnectRoom);
    expect(joinRoom.leave).toHaveBeenCalledOnce();
    expect(joinRoom.listenerCount()).toBe(0);
    unmount();
    expect(reconnectRoom.leave).toHaveBeenCalledOnce();
  });

  it("uses a fresh signed token when retrying a room-level connection error", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const firstRoom = createFakeRoom();
    const freshRoom = createFakeRoom("fresh-token");
    const client = {
      joinOrCreate: vi.fn()
        .mockResolvedValueOnce(firstRoom)
        .mockResolvedValueOnce(freshRoom),
      reconnect: vi.fn(),
    };
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    act(() => firstRoom.emitError(4210, "transport failed"));

    expect(result.current.connectionStatus).toBe("error");
    act(() => result.current.reconnectNow());

    await waitFor(() => expect(client.joinOrCreate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(client.reconnect).not.toHaveBeenCalled();
  });

  it("uses a fresh signed token when retained private-state synchronization fails", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const firstRoom = createFakeRoom();
    const freshRoom = createFakeRoom("fresh-private-state-token");
    firstRoom.request.mockRejectedValueOnce(new Error("private state unavailable"));
    const client = {
      joinOrCreate: vi.fn()
        .mockResolvedValueOnce(firstRoom)
        .mockResolvedValueOnce(freshRoom),
      reconnect: vi.fn(),
    };
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();
    const { result } = renderHook(() => useGameRoom({
      code: "ABCD",
      createOptions: undefined,
      toast,
    }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("error"));
    expect(result.current.connectionMessage).toContain("личните ти данни");
    act(() => result.current.reconnectNow());

    await waitFor(() => expect(client.joinOrCreate).toHaveBeenCalledTimes(2));
    expect(client.reconnect).not.toHaveBeenCalled();
  });
});
