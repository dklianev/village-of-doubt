import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MafiaJoinPage from "@/app/mafia/join/[[...roomCode]]/page";
import WerewolfJoinPage from "@/app/werewolf/join/[[...roomCode]]/page";

const { entry, requireSession } = vi.hoisted(() => ({
  entry: vi.fn((_props: Record<string, unknown>) => null),
  requireSession: vi.fn(),
}));
vi.mock("@/components/games/auth-gated-entry-client", () => ({ AuthGatedEntryClient: entry }));
vi.mock("@/lib/require-session", () => ({ requireSession }));

describe.each([
  { Page: WerewolfJoinPage, root: "/werewolf", family: "werewolves", mode: "werewolves_classic" },
  { Page: MafiaJoinPage, root: "/mafia", family: "mafia", mode: "mafia_free" },
])("$family Join fixture", ({ Page, root, family, mode }) => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    entry.mockClear();
    requireSession.mockReset();
    requireSession.mockResolvedValue({ user: { id: "player-1", name: "Рада", email: "synthetic@example.test" } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["1", ["1"], ["1", "0"]])("never bypasses production auth for %j", async (visualAuth) => {
    render(await Page({ params: Promise.resolve({ roomCode: ["ABC234"] }), searchParams: Promise.resolve({ visualAuth }) }));
    expect(requireSession).toHaveBeenCalledWith(`${root}/join/ABC234`);
    expect(entry.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      family, mode, initialCode: "ABC234", initialSession: { user: { id: "player-1", name: "Рада" } },
    }));
  });

  it("does not render the fixture when production authentication redirects", async () => {
    requireSession.mockRejectedValue(new Error("auth-redirect"));
    await expect(Page({ params: Promise.resolve({}), searchParams: Promise.resolve({ visualAuth: "1" }) })).rejects.toThrow("auth-redirect");
    expect(entry).not.toHaveBeenCalled();
  });

  it.each(["1", ["1"], ["1", "0"]])("supplies only a synthetic session in development for %j", async (visualAuth) => {
    vi.stubEnv("NODE_ENV", "development");
    render(await Page({ params: Promise.resolve({ roomCode: ["ABC234"] }), searchParams: Promise.resolve({ visualAuth }) }));
    expect(requireSession).not.toHaveBeenCalled();
    expect(entry.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      family, mode, initialCode: "ABC234", initialSession: { user: { id: "visual-join-player", name: "Рада" } },
    }));
  });

  it.each([undefined, "0", "true", [], ["0", "1"]])("still requires development auth for %j", async (visualAuth) => {
    vi.stubEnv("NODE_ENV", "development");
    render(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve(visualAuth === undefined ? {} : { visualAuth }) }));
    expect(requireSession).toHaveBeenCalledWith(`${root}/join`);
  });
});
