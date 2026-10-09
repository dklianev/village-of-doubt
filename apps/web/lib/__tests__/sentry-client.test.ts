import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NavigationMetric } from "../navigation-telemetry";

const runtime = {
  initBrowserMonitoring: vi.fn(),
  captureBrowserException: vi.fn(),
  captureBrowserNavigationMetric: vi.fn(),
};

let importRuntime: () => Promise<typeof runtime>;
let resolveImport: () => void;
let rejectImport: (error: Error) => void;
let frames: Map<number, FrameRequestCallback>;
let idleCallbacks: Map<number, IdleRequestCallback>;
let nextId: number;
let monitoring: typeof import("../sentry-client");

function paint() {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(0));
}

function idle() {
  const callbacks = [...idleCallbacks.values()];
  idleCallbacks.clear();
  callbacks.forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 10 }));
}

function errorEvent(error: unknown) {
  window.dispatchEvent(new ErrorEvent("error", { error, message: "early failure" }));
}

function rejectionEvent(reason: unknown) {
  const event = new Event("unhandledrejection");
  Object.defineProperty(event, "reason", { value: reason });
  window.dispatchEvent(event);
}

async function finishImport() {
  resolveImport();
  await vi.dynamicImportSettled();
}

function expectClean() {
  expect(frames.size).toBe(0);
  expect(idleCallbacks.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  for (const [type, listener] of vi.mocked(window.addEventListener).mock.calls) {
    if (["load", "error", "unhandledrejection"].includes(type)) {
      expect(window.removeEventListener).toHaveBeenCalledWith(type, listener);
    }
  }
  window.dispatchEvent(new Event("load"));
  expect(frames.size).toBe(0);
  expect(idleCallbacks.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", " https://public@example.test/1 ");
  vi.stubEnv("NEXT_PUBLIC_RELEASE_VERSION", "test-release");
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(window, "addEventListener");
  vi.spyOn(window, "removeEventListener");
  frames = new Map();
  idleCallbacks = new Map();
  nextId = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal("requestIdleCallback", vi.fn((callback: IdleRequestCallback) => {
    idleCallbacks.set(++nextId, callback);
    return nextId;
  }));
  vi.stubGlobal("cancelIdleCallback", vi.fn((id: number) => idleCallbacks.delete(id)));
  const pending = new Promise<typeof runtime>((resolve, reject) => {
    resolveImport = () => resolve(runtime);
    rejectImport = reject;
  });
  importRuntime = vi.fn(() => pending);
  vi.doMock("../sentry-client-runtime", importRuntime);
  monitoring = await import("../sentry-client");
});

afterEach(async () => {
  // Settle any pending startup so its global listeners cannot escape the test.
  resolveImport();
  window.dispatchEvent(new Event("load"));
  paint();
  paint();
  idle();
  await vi.dynamicImportSettled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock("../sentry-client-runtime");
});

describe("browser monitoring startup", () => {
  it("waits for load, two frames and idle, and starts only once", async () => {
    monitoring.startClientMonitoring();
    monitoring.startClientMonitoring();
    expect(importRuntime).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    window.dispatchEvent(new Event("load"));
    expect(frames.size).toBe(1);
    paint();
    expect(idleCallbacks.size).toBe(0);
    paint();
    expect(window.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2_000 });
    expect(importRuntime).not.toHaveBeenCalled();
    idle();
    monitoring.startClientMonitoring();
    await finishImport();
    expect(importRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.initBrowserMonitoring).toHaveBeenCalledExactlyOnceWith({
      dsn: "https://public@example.test/1", environment: "test", release: "test-release",
    });
    const removals = vi.mocked(window.removeEventListener).mock;
    for (const type of ["error", "unhandledrejection"]) {
      const index = removals.calls.findIndex((call: unknown[]) => call[0] === type);
      expect(removals.invocationCallOrder[index])
        .toBeLessThan(runtime.initBrowserMonitoring.mock.invocationCallOrder[0]!);
    }
    monitoring.startClientMonitoring();
    expectClean();
  });

  it.each([undefined, "", "   "])("does nothing without a configured DSN (%s)", async (dsn: string | undefined) => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    const addListener = vi.spyOn(window, "addEventListener");
    monitoring.startClientMonitoring();
    monitoring.captureClientException(new Error("disabled"));
    monitoring.captureNavigationMetric({ durationMs: 1 } as NavigationMetric);
    await vi.dynamicImportSettled();
    expect(addListener).not.toHaveBeenCalled();
    expect(importRuntime).not.toHaveBeenCalled();
    expectClean();
  });

  it("starts the paint wait when the document is already complete", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    monitoring.startClientMonitoring();
    expect(frames.size).toBe(1);
    paint();
    paint();
    idle();
    await finishImport();
    expect(runtime.initBrowserMonitoring).toHaveBeenCalledTimes(1);
    expectClean();
  });

  it.each(["loading", "complete"] as const)("skips paint for a hidden %s document", async (state: "loading" | "complete") => {
    vi.spyOn(document, "readyState", "get").mockReturnValue(state);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    monitoring.startClientMonitoring();
    if (state === "loading") {
      expect(importRuntime).not.toHaveBeenCalled();
      window.dispatchEvent(new Event("load"));
    }
    await finishImport();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(window.requestIdleCallback).not.toHaveBeenCalled();
    expect(runtime.initBrowserMonitoring).toHaveBeenCalledTimes(1);
    expectClean();
  });

  it("does not wait indefinitely when a tab is hidden between frames", async () => {
    monitoring.startClientMonitoring();
    window.dispatchEvent(new Event("load"));
    paint();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    vi.advanceTimersByTime(1_999);
    expect(importRuntime).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await finishImport();
    expect(runtime.initBrowserMonitoring).toHaveBeenCalledTimes(1);
    expectClean();
  });

  it("uses a task after paint when idle callbacks are unavailable", async () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    monitoring.startClientMonitoring();
    window.dispatchEvent(new Event("load"));
    paint();
    paint();
    expect(importRuntime).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    await finishImport();
    expect(runtime.initBrowserMonitoring).toHaveBeenCalledTimes(1);
    expectClean();
  });

  it("falls back to idle without animation frame support", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);
    monitoring.startClientMonitoring();
    window.dispatchEvent(new Event("load"));
    expect(idleCallbacks.size).toBe(1);
    idle();
    await finishImport();
    expectClean();
  });

  it("captures early global errors and rejections immediately, then flushes once", async () => {
    monitoring.startClientMonitoring();
    const thrown = new Error("thrown");
    const rejected = new Error("rejected");
    errorEvent(thrown);
    rejectionEvent(rejected);
    monitoring.captureClientException(thrown);
    rejectionEvent(rejected);
    expect(runtime.captureBrowserException).not.toHaveBeenCalled();
    await finishImport();
    expect(importRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.captureBrowserException.mock.calls).toEqual([[thrown], [rejected]]);
    expect(runtime.initBrowserMonitoring.mock.invocationCallOrder[0])
      .toBeLessThan(runtime.captureBrowserException.mock.invocationCallOrder[0]!);
    expectClean();
  });

  it("preserves message-only errors and primitive rejection reasons without suppressing events", async () => {
    monitoring.startClientMonitoring();
    const event = new ErrorEvent("error", { message: "message-only", cancelable: true });
    expect(window.dispatchEvent(event)).toBe(true);
    rejectionEvent("primitive rejection");
    rejectionEvent(null);
    await finishImport();
    expect(runtime.captureBrowserException.mock.calls).toEqual([["message-only"], ["primitive rejection"], [null]]);
    expectClean();
  });

  it("ignores resource failure events", () => {
    monitoring.startClientMonitoring();
    window.dispatchEvent(new Event("error"));
    expect(importRuntime).not.toHaveBeenCalled();
  });

  it("bounds pending errors at 20 without a duplicate consuming a slot", async () => {
    monitoring.startClientMonitoring();
    const errors = Array.from({ length: 25 }, (_, index) => new Error(String(index)));
    for (const error of errors) {
      errorEvent(error);
      monitoring.captureClientException(error);
    }
    await finishImport();
    expect(runtime.captureBrowserException.mock.calls).toEqual(errors.slice(0, 20).map((error) => [error]));
    expectClean();
    const later = new Error("after startup");
    monitoring.captureClientException(later);
    expect(runtime.captureBrowserException).toHaveBeenLastCalledWith(later);
    expect(runtime.captureBrowserException).toHaveBeenCalledTimes(21);
  });

  it.each(["frame", "idle"])("explicit capture bypasses and cleans up the pending %s schedule", async (stage: string) => {
    monitoring.startClientMonitoring();
    window.dispatchEvent(new Event("load"));
    if (stage === "idle") { paint(); paint(); }
    const error = new Error("boundary failure");
    monitoring.captureClientException(error);
    await finishImport();
    expect(runtime.captureBrowserException).toHaveBeenCalledExactlyOnceWith(error);
    expectClean();
  });

  it("keeps explicit capture immediate even before startup is requested", async () => {
    const error = new Error("explicit");
    monitoring.captureClientException(error);
    monitoring.startClientMonitoring();
    await finishImport();
    expect(runtime.captureBrowserException).toHaveBeenCalledExactlyOnceWith(error);
    expectClean();
  });

  it("keeps navigation metrics immediate and initializes the runtime only once", async () => {
    monitoring.startClientMonitoring();
    const metric: NavigationMetric = {
      durationMs: 20, fromRoute: "/", targetRoute: "/werewolf", navigationType: "push",
      prefetchIntent: "auto", transitionId: "test-transition",
    };
    monitoring.captureNavigationMetric(metric);
    await finishImport();
    expect(runtime.captureBrowserNavigationMetric).toHaveBeenCalledExactlyOnceWith(metric);
    expect(importRuntime).toHaveBeenCalledTimes(1);
    expectClean();
  });

  it.each(["import", "initialization"])("cleans up after %s failure with only a generic diagnostic and no retry", async (failure: string) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failureError = new Error("token=synthetic-private-value");
    monitoring.startClientMonitoring();
    window.dispatchEvent(new Event("load"));
    monitoring.captureClientException(new Error("early"));
    if (failure === "import") rejectImport(failureError);
    else {
      runtime.initBrowserMonitoring.mockImplementationOnce(() => { throw failureError; });
      resolveImport();
    }
    await vi.dynamicImportSettled();
    expectClean();
    monitoring.startClientMonitoring();
    monitoring.captureClientException(new Error("later"));
    await vi.dynamicImportSettled();
    expect(importRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.captureBrowserException).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith("Failed to initialize browser error monitoring.");
  });
});
