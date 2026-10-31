import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoomPreviewCredential } from "@werewolf/shared/server";
import appConfig, { createInternalRoomPreviewHandler, handleGameSessionRevocationMessage } from "../app.config.js";
import { GameRoom } from "../rooms/GameRoom.js";
import type { RequestHandler } from "express";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createGameSessionRevocationMessage } from "@werewolf/shared/server";

const GAME_TOKEN_SECRET = "test-secret-that-is-long-enough-32-chars";

describe("game-server internal HTTP boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("GAME_TOKEN_SECRET", GAME_TOKEN_SECRET);
  });

  it("does not resolve a preview without the internal room-bound credential", () => {
    const getRoomPreview = vi.fn();
    const response = fakeResponse();
    createInternalRoomPreviewHandler(getRoomPreview)(fakeRequest("ABC234", ""), response.value);

    expect(getRoomPreview).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("rejects a valid credential that belongs to another room", () => {
    const getRoomPreview = vi.fn();
    const response = fakeResponse();
    const credential = createRoomPreviewCredential("DEF234", GAME_TOKEN_SECRET);
    createInternalRoomPreviewHandler(getRoomPreview)(fakeRequest("ABC234", credential), response.value);

    expect(getRoomPreview).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("returns a preview only for the correctly signed room code", () => {
    const preview = { code: "ABC234", status: "lobby" };
    const getRoomPreview = vi.fn(() => preview as never);
    const response = fakeResponse();
    const credential = createRoomPreviewCredential("ABC234", GAME_TOKEN_SECRET);
    createInternalRoomPreviewHandler(getRoomPreview)(fakeRequest("ABC234", credential), response.value);

    expect(getRoomPreview).toHaveBeenCalledWith("ABC234", undefined);
    expect(response.json).toHaveBeenCalledWith(preview);
  });

  it("passes only the viewer identity bound to the service credential", () => {
    const getRoomPreview = vi.fn(() => ({ code: "ABC234", status: "lobby" }) as never);
    const response = fakeResponse();
    const credential = createRoomPreviewCredential("ABC234", GAME_TOKEN_SECRET, "viewer-1");
    createInternalRoomPreviewHandler(getRoomPreview)(fakeRequest("ABC234", credential, "viewer-1"), response.value);
    expect(getRoomPreview).toHaveBeenCalledWith("ABC234", "viewer-1");
  });

  it.each([undefined, "viewer-2"])("rejects personalized credentials with a substituted or missing viewer: %s", (viewer) => {
    const getRoomPreview = vi.fn();
    const response = fakeResponse();
    const credential = createRoomPreviewCredential("ABC234", GAME_TOKEN_SECRET, "viewer-1");
    createInternalRoomPreviewHandler(getRoomPreview)(fakeRequest("ABC234", credential, viewer), response.value);
    expect(getRoomPreview).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("ignores untrusted viewer query parameters on an anonymous signed request", () => {
    const getRoomPreview = vi.fn(() => ({ code: "ABC234", status: "lobby" }) as never);
    const response = fakeResponse();
    const credential = createRoomPreviewCredential("ABC234", GAME_TOKEN_SECRET);
    const request = { ...fakeRequest("ABC234", credential) as object, query: { viewerUserId: "viewer-1" } };
    createInternalRoomPreviewHandler(getRoomPreview)(request as never, response.value);
    expect(getRoomPreview).toHaveBeenCalledWith("ABC234", undefined);
  });
});

describe("game-session revocation control plane", () => {
  it("прекратява само съобщения с валиден минимален operational payload", () => {
    const revoke = vi.fn(() => 1);

    expect(handleGameSessionRevocationMessage(
      createGameSessionRevocationMessage("user-1", 1_000),
      revoke,
    )).toBe(true);
    expect(revoke).toHaveBeenCalledWith("user-1");
    expect(handleGameSessionRevocationMessage("not-json", revoke)).toBe(false);
    expect(revoke).toHaveBeenCalledOnce();
  });
});

describe("public game statistics", () => {
  it("serves the public consumer contract over HTTP without exposing private previews", async () => {
    const app = express();
    await appConfig.initializeExpress?.(app);
    const server = createServer(app);
    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const response = await fetch(`${origin}/stats`);
      expect(response.status).toBe(200);
      const stats = await response.json();
      expect(Object.keys(stats).sort()).toEqual(["activeRooms", "byFamily", "connectedPlayers"]);
      expect(stats.activeRooms).toEqual(expect.any(Number));
      expect(stats.connectedPlayers).toEqual(expect.any(Number));
      expect(stats).toEqual({ activeRooms: 0, connectedPlayers: 0, byFamily: {} });
      expect((await fetch(`${origin}/rooms/ABC234/preview`)).status).toBe(404);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("registers /stats with only aggregate activity, not room or operations data", async () => {
    const routes = new Map<string, RequestHandler>();
    await appConfig.initializeExpress?.({
      use: vi.fn(), post: vi.fn(), delete: vi.fn(),
      get: (path: string, handler: RequestHandler) => routes.set(path, handler),
    } as never);
    const stats = vi.spyOn(GameRoom, "getRuntimeStats").mockReturnValue({
      activeRooms: 3, connectedPlayers: 19, byFamily: { werewolves: 2, mafia: 1 },
      recentEndings: [{ code: "PRIVATE", winnerTeam: "village", winnerReasonBg: "private reason", endedAt: "2026-10-16", family: "werewolves" }],
      lastWinner: null,
    });
    try {
      const response = fakeResponse();
      expect(routes.has("/stats")).toBe(true);
      routes.get("/stats")!({ socket: { remoteAddress: "203.0.113.4" } } as never, response.value, vi.fn());
      expect(response.json).toHaveBeenCalledWith({
        activeRooms: 3, connectedPlayers: 19, byFamily: { werewolves: 2, mafia: 1 },
      });
      const operationsResponse = fakeResponse();
      routes.get("/operations/stats")!({ socket: { remoteAddress: "203.0.113.4" } } as never, operationsResponse.value, vi.fn());
      expect(operationsResponse.status).toHaveBeenCalledWith(404);
    } finally {
      stats.mockRestore();
    }
  });
});

function fakeRequest(code: string, credential: string, viewerUserId?: string) {
  return {
    params: { code },
    header: vi.fn((name: string) => name.toLowerCase() === "x-werewolf-room-preview"
      ? credential : name.toLowerCase() === "x-werewolf-room-preview-viewer" ? viewerUserId : undefined),
  } as never;
}

function fakeResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, value: { json, status } as never };
}
