import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseVisualGameFixture } from "@/hooks/play/visual-game-fixture";
import { PlayReference } from "../PlayReference";

vi.mock("@/components/play-room-client", () => ({ PlayRoomClientCore: () => null }));

function fixture() {
  return parseVisualGameFixture("?visualGame=1&family=werewolves&phase=night&players=12", "VISUAL", undefined, "test")!;
}

describe("PlayReference", () => {
  it.each([
    [{ playing: false }, /Ти наблюдаваш играта/u],
    [{ playing: false, narrator: true }, /Ти си Разказвачът/u],
    [{ alive: false }, /Ти си елиминиран/u],
    [{ playing: true }, /Ролята ти още/u],
  ])("gives the viewer appropriate guidance: %s", async (viewer, hint) => {
    const { snapshot } = fixture();
    render(<PlayReference snapshot={snapshot} privateRole={undefined} ownPlayer={{ ...snapshot.players[0]!, ...viewer }} />);
    fireEvent.click(screen.getByRole("button", { name: "Правила" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(hint)).toBeInTheDocument();
  });

  it("updates the current phase without closing the reference", async () => {
    const { snapshot } = fixture();
    const props = { privateRole: undefined, ownPlayer: snapshot.players[0] };
    const { rerender } = render(<PlayReference {...props} snapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: "Правила" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Нощ" })).toBeInTheDocument();
    rerender(<PlayReference {...props} snapshot={{ ...snapshot, phase: "voting" }} />);
    expect(within(dialog).getByRole("heading", { name: "Гласуване" })).toBeInTheDocument();
  });

  it("lists only aggregate roles, without assigning them to players", async () => {
    const { snapshot } = fixture();
    render(<PlayReference snapshot={snapshot} privateRole={undefined} ownPlayer={snapshot.players[0]} />);
    fireEvent.click(screen.getByRole("button", { name: "Правила" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Състав" }));
    const panel = within(dialog).getByRole("tabpanel");
    expect(within(panel).getAllByRole("listitem")).toHaveLength(snapshot.roleCounts.length);
    for (const player of snapshot.players) expect(panel).not.toHaveTextContent(player.displayName);
  });
});
