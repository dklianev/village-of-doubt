import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MafiaJoinPage from "@/app/mafia/join/[[...roomCode]]/page";
import PlayPage from "@/app/play/[code]/page";
import WerewolfJoinPage from "@/app/werewolf/join/[[...roomCode]]/page";

const mocks = vi.hoisted(() => ({
  authGatedEntryClient: vi.fn((_props: Record<string, unknown>) => null),
  playRoomClient: vi.fn((_props: Record<string, unknown>) => null),
  requireSession: vi.fn(),
}));

vi.mock("@/components/games/auth-gated-entry-client", () => ({
  AuthGatedEntryClient: mocks.authGatedEntryClient,
}));

vi.mock("@/components/play-room-client", () => ({
  PlayRoomClient: mocks.playRoomClient,
}));

vi.mock("@/lib/require-session", () => ({ requireSession: mocks.requireSession }));

const privateServerSession = {
  user: {
    id: "user-1",
    name: "Рада",
    email: "rada@example.test",
    image: "https://example.test/private-avatar.png",
    avatarId: "private-avatar",
    admin: true,
  },
  session: {
    id: "session-1",
    token: "server-session-secret",
    ipAddress: "192.0.2.1",
  },
};

describe("authenticated entry server sessions", () => {
  beforeEach(() => {
    mocks.authGatedEntryClient.mockClear();
    mocks.playRoomClient.mockClear();
    mocks.requireSession.mockReset();
    mocks.requireSession.mockResolvedValue(privateServerSession);
  });

  it("passes only the player id and display name into the werewolf join client", async () => {
    render(await WerewolfJoinPage({ params: Promise.resolve({ roomCode: ["ABC234"] }) }));

    expect(mocks.requireSession).toHaveBeenCalledWith("/werewolf/join/ABC234");
    expect(mocks.authGatedEntryClient.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      initialSession: { user: { id: "user-1", name: "Рада" } },
    }));
  });

  it("passes only the player id and display name into the Mafia join client", async () => {
    render(await MafiaJoinPage({ params: Promise.resolve({ roomCode: ["ABC234"] }) }));

    expect(mocks.requireSession).toHaveBeenCalledWith("/mafia/join/ABC234");
    expect(mocks.authGatedEntryClient.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      family: "mafia",
      mode: "mafia_free",
      initialSession: { user: { id: "user-1", name: "Рада" } },
    }));
  });

  it("passes only the player id into the play client", async () => {
    const shell = PlayPage({
      params: Promise.resolve({ code: "ABC234" }),
      searchParams: Promise.resolve({}),
    }) as ReactElement<{ children: ReactElement }>;
    const route = shell.props.children;
    const content = await (route.type as (props: unknown) => Promise<ReactElement>)(route.props);

    expect(mocks.requireSession).toHaveBeenCalledWith("/play/ABC234");
    expect(content.props).toEqual(expect.objectContaining({
      initialSession: { user: { id: "user-1" } },
    }));
  });
});
