import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoomPreviewCredential } from "@werewolf/shared/server";
import { createInternalRoomPreviewHandler, handleGameSessionRevocationMessage } from "../app.config.js";
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

    expect(getRoomPreview).toHaveBeenCalledWith("ABC234");
    expect(response.json).toHaveBeenCalledWith(preview);
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

function fakeRequest(code: string, credential: string) {
  return {
    params: { code },
    header: vi.fn((name: string) => name.toLowerCase() === "x-werewolf-room-preview" ? credential : undefined),
  } as never;
}

function fakeResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, value: { json, status } as never };
}
