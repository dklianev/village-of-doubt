import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(() => ({ mocked: true })),
  recordGameSessionRevocation: vi.fn(async () => undefined),
  publishRuntimeRedisMessage: vi.fn(async () => undefined),
  writeRuntimeRedisValue: vi.fn(async () => undefined),
}));

vi.mock("@werewolf/database", () => ({
  createDatabase: mocks.createDatabase,
  recordGameSessionRevocation: mocks.recordGameSessionRevocation,
}));
vi.mock("../runtime-rate-limit", () => ({
  publishRuntimeRedisMessage: mocks.publishRuntimeRedisMessage,
  writeRuntimeRedisValue: mocks.writeRuntimeRedisValue,
}));

import { revokeActiveGameSessions } from "../game-session-revocation";

describe("revokeActiveGameSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
  });

  it("persists the durable marker before publishing the realtime marker", async () => {
    const order: string[] = [];
    mocks.recordGameSessionRevocation.mockImplementationOnce(async () => { order.push("database"); });
    mocks.writeRuntimeRedisValue.mockImplementationOnce(async () => { order.push("redis"); });
    mocks.publishRuntimeRedisMessage.mockImplementationOnce(async () => { order.push("publish"); });

    await expect(revokeActiveGameSessions("user-1")).resolves.toMatchObject({ realtimeDelivered: true });
    expect(order).toEqual(["database", "redis", "publish"]);
  });

  it("keeps a successful durable revocation when Redis is unavailable", async () => {
    mocks.writeRuntimeRedisValue.mockRejectedValueOnce(new Error("redis unavailable"));

    await expect(revokeActiveGameSessions("user-1")).resolves.toMatchObject({ realtimeDelivered: false });
    expect(mocks.recordGameSessionRevocation).toHaveBeenCalledOnce();
    expect(mocks.publishRuntimeRedisMessage).not.toHaveBeenCalled();
  });

  it("fails closed when the durable marker cannot be written", async () => {
    mocks.recordGameSessionRevocation.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(revokeActiveGameSessions("user-1")).rejects.toThrow("database unavailable");
    expect(mocks.writeRuntimeRedisValue).not.toHaveBeenCalled();
  });
});
