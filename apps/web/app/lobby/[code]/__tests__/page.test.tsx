import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LobbyCodePage from "../page";

vi.mock("@/lib/require-session", () => ({ requireSession: async () => ({ user: { name: "Guest" } }) }));
vi.mock("@/components/lobby-invite-client", () => ({
  LobbyInviteClient: (props: Record<string, unknown>) => <output>{JSON.stringify(props)}</output>,
}));

describe("invitation route", () => {
  it("passes only the normalized room code, not URL-derived game settings", async () => {
    render(await LobbyCodePage({
      params: Promise.resolve({ code: "abc234" }),
      searchParams: Promise.resolve({ mode: "werewolves_classic", players: "35", spectator: "1" }),
    }));
    expect(JSON.parse(screen.getByRole("status").textContent ?? "{}")).toEqual({ code: "ABC234" });
    expect(screen.getByRole("main")).not.toHaveAttribute("data-family");
  });
});
