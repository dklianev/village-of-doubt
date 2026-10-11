import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JoinPage from "@/app/join/page";

const { entry, requireSession } = vi.hoisted(() => ({
  entry: vi.fn((_props: Record<string, unknown>) => null),
  requireSession: vi.fn(),
}));
vi.mock("@/components/games/auth-gated-entry-client", () => ({ AuthGatedEntryClient: entry }));
vi.mock("@/lib/require-session", () => ({ requireSession }));

describe("generic code entry", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    entry.mockClear();
    requireSession.mockReset().mockResolvedValue({ user: { id: "player-1", name: "Рада", email: "synthetic@example.test" } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["1", ["1"]])("requires production authentication despite visualAuth=%j", async (visualAuth) => {
    render(await JoinPage({ searchParams: Promise.resolve({ visualAuth, code: "abc234" }) }));
    expect(requireSession).toHaveBeenCalledWith("/join?code=ABC234");
    expect(entry.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      initialCode: "ABC234", initialSession: { user: { id: "player-1", name: "Рада" } },
    }));
    expect(entry.mock.calls[0]?.[0]).not.toHaveProperty("family");
  });

  it("stops when authentication redirects", async () => {
    requireSession.mockRejectedValue(new Error("auth-redirect"));
    await expect(JoinPage({})).rejects.toThrow("auth-redirect");
    expect(entry).not.toHaveBeenCalled();
  });

  it("ignores malformed codes and does not add them to the return URL", async () => {
    render(await JoinPage({ searchParams: Promise.resolve({ code: "abc" }) }));
    expect(requireSession).toHaveBeenCalledWith("/join");
    expect(entry.mock.calls[0]?.[0]).toHaveProperty("initialCode", "");
  });

  it("supports a development-only synthetic session", async () => {
    vi.stubEnv("NODE_ENV", "development");
    render(await JoinPage({ searchParams: Promise.resolve({ visualAuth: "1" }) }));
    expect(requireSession).not.toHaveBeenCalled();
    expect(entry.mock.calls[0]?.[0]).toHaveProperty("initialSession", { user: { id: "visual-join-player", name: "Рада" } });
  });

  it("requires real auth in development without the explicit fixture", async () => {
    vi.stubEnv("NODE_ENV", "development");
    render(await JoinPage({}));
    expect(requireSession).toHaveBeenCalledWith("/join");
  });
});
