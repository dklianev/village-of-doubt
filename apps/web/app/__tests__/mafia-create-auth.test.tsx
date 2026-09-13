import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MafiaCreatePage from "@/app/mafia/create/page";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(url); },
}));
vi.mock("@/components/lobby-create-client", () => ({
  LobbyCreateClient: () => null,
  LobbyCreateLoading: () => null,
}));

type SearchParams = Record<string, string | string[] | undefined>;

async function resolveCreatePage(searchParams?: SearchParams) {
  const shell = MafiaCreatePage(searchParams === undefined ? {} : {
    searchParams: Promise.resolve(searchParams),
  }) as ReactElement<{ children: ReactElement<{ children: ReactElement }> }>;
  const route = shell.props.children.props.children;
  return (route.type as (props: unknown) => Promise<ReactElement>)(route.props);
}

describe("Mafia create authentication", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    getSession.mockReset();
    getSession.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(["mafia_sport", "mafia_free"])("preserves only the validated %s mode through login", async (mode) => {
    const returnPath = `/mafia/create?mode=${mode}`;
    await expect(resolveCreatePage({
      mode,
      visualAuth: "1",
      redirect: "//outside.example",
      roomName: "Untrusted room",
      source: "invite",
    })).rejects.toMatchObject({ message: `/sign-in?redirect=${encodeURIComponent(returnPath)}` });

    getSession.mockResolvedValue({ user: { id: "player-1", name: "Player" } });
    const returnUrl = new URL(returnPath, "https://example.test");
    const content = await resolveCreatePage(Object.fromEntries(returnUrl.searchParams));
    expect(content.props).toEqual({ initialMode: mode, family: "mafia" });
  });

  it.each([
    undefined,
    {},
    { mode: "" },
    { mode: "werewolves_classic" },
    { mode: "unsupported" },
    { mode: "MAFIA_SPORT" },
    { mode: " mafia_sport " },
    { mode: "mafia_sport&redirect=//outside.example" },
    { mode: [] },
    { mode: ["mafia_sport"] },
    { mode: ["mafia_sport", "mafia_free"] },
    { mode: ["mafia_free", "mafia_sport"] },
    { mode: ["werewolves_classic", "mafia_sport"] },
  ] satisfies (SearchParams | undefined)[])("defaults safely for absent or invalid query %j", async (params) => {
    await expect(resolveCreatePage(params)).rejects.toMatchObject({ message: "/sign-in?redirect=%2Fmafia%2Fcreate" });

    getSession.mockResolvedValue({ user: { id: "player-1", name: "Player" } });
    const content = await resolveCreatePage(params);
    expect(content.props).toEqual({ initialMode: "mafia_free", family: "mafia" });
  });

  it.each([
    { visualAuth: "1" },
    { visualAuth: ["1"] },
    { visualAuth: ["1", "0"] },
  ])("does not bypass production authentication for $visualAuth", async ({ visualAuth }) => {
    await expect(resolveCreatePage({ visualAuth })).rejects.toMatchObject({ message: "/sign-in?redirect=%2Fmafia%2Fcreate" });
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("keeps the development visual fixture available with the selected mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const content = await resolveCreatePage({ mode: "mafia_sport", visualAuth: "1" });
    expect(content.props).toEqual({ initialMode: "mafia_sport", family: "mafia" });
    expect(getSession).not.toHaveBeenCalled();
  });

  it.each([undefined, "0", "true"])("requires authentication in development without visualAuth=1 (%j)", async (visualAuth) => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(resolveCreatePage({ visualAuth })).rejects.toMatchObject({ message: "/sign-in?redirect=%2Fmafia%2Fcreate" });
  });
});
