import { describe, expect, it } from "vitest";
import { derivePersistenceId } from "./persistence-idempotency.js";

describe("derivePersistenceId", () => {
  it("derives stable, namespaced UUIDs from idempotency keys", () => {
    const gameId = derivePersistenceId("game", "room-instance-1");

    expect(derivePersistenceId("game", "room-instance-1")).toBe(gameId);
    expect(derivePersistenceId("game", "room-instance-2")).not.toBe(gameId);
    expect(derivePersistenceId("event", "room-instance-1")).not.toBe(gameId);
    expect(gameId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("rejects empty idempotency keys", () => {
    expect(() => derivePersistenceId("event", "   ")).toThrow("Idempotency key must not be empty");
  });
});
