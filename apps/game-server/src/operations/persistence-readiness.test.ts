import { describe, expect, it, vi } from "vitest";
import { PersistenceReadinessGate } from "./persistence-readiness.js";

describe("PersistenceReadinessGate", () => {
  it("updates the cached create gate without throwing probe details", async () => {
    const probe = vi.fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("postgres://user:secret@private-host/db"));
    const gate = new PersistenceReadinessGate(probe, false);

    await expect(gate.refresh()).resolves.toBe(true);
    expect(gate.isReady()).toBe(true);

    await expect(gate.refresh()).resolves.toBe(false);
    expect(gate.isReady()).toBe(false);
  });

  it("shares one in-flight probe across concurrent health checks", async () => {
    let resolveProbe: ((ready: boolean) => void) | undefined;
    const probe = vi.fn(() => new Promise<boolean>((resolve) => {
      resolveProbe = resolve;
    }));
    const gate = new PersistenceReadinessGate(probe, false);

    const first = gate.refresh();
    const second = gate.refresh();
    resolveProbe?.(true);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(probe).toHaveBeenCalledOnce();
    expect(gate.isReady()).toBe(true);
  });
});
