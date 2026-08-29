import { describe, expect, it, vi } from "vitest";
import { DeployDrainController } from "./deploy-drain.js";

describe("DeployDrainController", () => {
  it("stops new matchmaking once while allowing existing rooms to drain", async () => {
    let now = 0;
    let activeRooms = 2;
    const stopMatchmaking = vi.fn();
    const controller = new DeployDrainController({
      getActiveRooms: () => activeRooms,
      now: () => now,
      sleep: async (milliseconds) => {
        now += milliseconds;
        activeRooms -= 1;
      },
      stopMatchmaking,
    });

    expect(controller.begin()).toMatchObject({ draining: true, activeRooms: 2 });
    expect(controller.begin()).toMatchObject({ draining: true, activeRooms: 2 });

    const result = await controller.waitForEmpty({ timeoutMs: 1_000, pollIntervalMs: 100 });

    expect(stopMatchmaking).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ drained: true, timedOut: false, activeRooms: 0, waitedMs: 200 });
  });

  it("returns a bounded timeout without destroying active rooms", async () => {
    let now = 0;
    const controller = new DeployDrainController({
      getActiveRooms: () => 3,
      now: () => now,
      sleep: async (milliseconds) => {
        now += milliseconds;
      },
      stopMatchmaking: vi.fn(),
    });

    const result = await controller.waitForEmpty({ timeoutMs: 250, pollIntervalMs: 100 });

    expect(result).toEqual({ drained: false, timedOut: true, activeRooms: 3, waitedMs: 250 });
  });

  it("can cancel a failed deploy drain and start a later drain cleanly", () => {
    const stopMatchmaking = vi.fn();
    const controller = new DeployDrainController({
      getActiveRooms: () => 2,
      now: () => 1_750_000_000_000,
      stopMatchmaking,
    });

    expect(controller.begin()).toMatchObject({
      draining: true,
      drainStartedAt: "2025-06-15T15:06:40.000Z",
    });
    expect(controller.cancel()).toEqual({
      draining: false,
      activeRooms: 2,
      drainStartedAt: null,
    });
    expect(controller.begin()).toMatchObject({ draining: true });
    expect(stopMatchmaking).toHaveBeenCalledTimes(2);
  });

  it("expires an orphaned drain so matchmaking cannot remain blocked forever", () => {
    let now = 10_000;
    const stopMatchmaking = vi.fn();
    const controller = new DeployDrainController({
      getActiveRooms: () => 0,
      maxAgeMs: 60_000,
      now: () => now,
      stopMatchmaking,
    });

    controller.begin();
    now += 59_999;
    expect(controller.isDraining()).toBe(true);

    now += 1;
    expect(controller.status()).toEqual({
      draining: false,
      activeRooms: 0,
      drainStartedAt: null,
    });

    controller.begin();
    expect(stopMatchmaking).toHaveBeenCalledTimes(2);
  });
});
