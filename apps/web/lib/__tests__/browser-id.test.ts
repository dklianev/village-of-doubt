import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserId } from "@/lib/browser-id";

describe("createBrowserId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the browser UUID generator when available", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");

    expect(createBrowserId()).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("falls back to browser random values when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues(array: Uint32Array) {
        array.set([1, 2, 3, 4]);
        return array;
      },
    });

    expect(createBrowserId("toast")).toBe("toast-00000001000000020000000300000004");
  });
});
