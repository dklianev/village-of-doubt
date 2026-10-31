import { afterEach, describe, expect, it, vi } from "vitest";

const sentEnvelopes = vi.hoisted(() => [] as unknown[]);

vi.mock("@sentry/browser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/browser")>();
  return {
    ...actual,
    makeFetchTransport: () => ({
      send: async (envelope: unknown) => {
        sentEnvelopes.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
  };
});

describe("browser error monitoring privacy", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not send clicked controls that reveal a secret role or a player name", async () => {
    const { getCurrentScope } = await import("@sentry/browser");
    const { captureBrowserException, initBrowserMonitoring } = await import("../sentry-client-runtime");
    initBrowserMonitoring({ dsn: "https://public@example.invalid/1", environment: "test", release: undefined });

    const button = document.createElement("button");
    button.className = "action-btn ability-kill";
    button.setAttribute("aria-label", "Избери Иван: онлайн");
    document.body.append(button);
    button.click();

    captureBrowserException(new Error("synthetic failure"));
    await getCurrentScope().getClient()?.flush(1_000);

    const payload = JSON.stringify(sentEnvelopes);
    expect(payload).toContain("synthetic failure");
    expect(payload).not.toContain("ability-kill");
    expect(payload).not.toContain("Иван");
  });
});
