import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { createGameClient, GAME_ROOM_NAME } from "@/lib/colyseus-client";
import { useGameRoom } from "@/hooks/play/use-game-room";
import { isVisualGameFixtureEnabled, parseVisualGameFixture } from "@/hooks/play/visual-game-fixture";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  createGameClient: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mocks.useSession,
  },
}));

vi.mock("@/lib/colyseus-client", () => ({
  GAME_ROOM_NAME: "game_room",
  createGameClient: mocks.createGameClient,
}));

type StateHandler = (state: unknown) => void;
type MessageHandler = (message: unknown) => void;
type LeaveHandler = (code: number) => void;

function createFakeRoom(token = "reconnect-token") {
  const stateHandlers: StateHandler[] = [];
  const leaveHandlers: LeaveHandler[] = [];
  const messageHandlers = new Map<string, MessageHandler[]>();

  return {
    reconnectionToken: token,
    leave: vi.fn(),
    send: vi.fn(),
    onStateChange: vi.fn((handler: StateHandler) => {
      stateHandlers.push(handler);
    }),
    onMessage: vi.fn((type: string, handler: MessageHandler) => {
      const handlers = messageHandlers.get(type) ?? [];
      handlers.push(handler);
      messageHandlers.set(type, handlers);
    }),
    onLeave: vi.fn((handler: LeaveHandler) => {
      leaveHandlers.push(handler);
    }),
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
  };
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
    publicEvents: [],
    publicChat: [],
  };
}

describe("useGameRoom", () => {
  beforeEach(() => {
    vi.useRealTimers();
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

  it("uses the dev visual fixture without requesting a game token or opening a room", () => {
    window.history.pushState(
      {},
      "",
      "/play/VISUAL?visualGame=1&phase=voting&family=mafia&players=10&dead=2&role=commissioner&voteTally=full",
    );
    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    const toast = vi.fn();

    const { result } = renderHook(() => useGameRoom({ code: "VISUAL", createOptions: undefined, toast }));

    expect(result.current.snapshot?.code).toBe("VISUAL");
    expect(result.current.snapshot?.phase).toBe("voting");
    expect(result.current.snapshot?.mode).toBe("mafia_sport");
    expect(result.current.snapshot?.players).toHaveLength(10);
    expect(result.current.snapshot?.players.filter((player) => player.playing && !player.alive)).toHaveLength(2);
    expect(result.current.snapshot?.voteTally).toHaveLength(3);
    expect(result.current.privateRole?.role).toBe("commissioner");
    expect(result.current.currentUserId).toBe("visual-player-1");
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

    expect(fixture?.snapshot.players).toHaveLength(18);
    expect(fixture?.snapshot.players.filter((player) => player.playing && !player.alive)).toHaveLength(17);
    expect(fixture?.snapshot.players[0]?.alive).toBe(false);
  });

  it("blocks unauthenticated users before creating a room client", async () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    const toast = vi.fn();

    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("disconnected"));
    expect(result.current.status).toBe("Трябва да влезеш, за да се присъединиш към стаята.");
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

  it("reconnects with the persisted room token after an abnormal leave", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    const { client, joinRoom, reconnectRoom } = createClient();
    mocks.createGameClient.mockReturnValue(client);
    const toast = vi.fn();

    const { result } = renderHook(() => useGameRoom({ code: "ABCD", createOptions: undefined, toast }));

    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));

    vi.useFakeTimers();
    act(() => joinRoom.emitLeave(4001));
    expect(result.current.connectionStatus).toBe("reconnecting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("Връзката е възстановена.");
    expect(client.reconnect).toHaveBeenCalledWith("reconnect-token");
    expect(reconnectRoom.onStateChange).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({ message: "Върнахме те в стаята.", kind: "success" });
    vi.useRealTimers();
  });
});
