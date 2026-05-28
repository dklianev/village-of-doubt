import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NightActionPanel } from "@/components/play/NightActionPanel";
import type { PublicPlayer } from "@/lib/play/types";

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Анна",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: true,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<Parameters<typeof NightActionPanel>[0]> = {}) {
  const players = [
    player({ userId: "u1", displayName: "Анна" }),
    player({ userId: "u2", displayName: "Борис" }),
    player({ userId: "u3", displayName: "Вяра", alive: false, revealedRole: "villager" }),
  ];
  const livingPlayers = players.filter((item) => item.alive);

  const props: Parameters<typeof NightActionPanel>[0] = {
    players,
    livingPlayers,
    phase: "night",
    privateRole: "werewolf",
    selectedTargetId: "",
    secondTargetId: "",
    sendNightAction: vi.fn(),
    ...overrides,
  };

  render(<NightActionPanel {...props} />);
  return props;
}

describe("NightActionPanel", () => {
  it("submits the selected faction kill target for a werewolf", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ selectedTargetId: "u2" });

    await user.click(screen.getByRole("button", { name: "Потвърди жертва" }));

    expect(props.sendNightAction).toHaveBeenCalledWith({
      kind: "faction_kill",
      targetUserId: "u2",
    });
  });

  it("disables medium contact when there are no eliminated players", () => {
    renderPanel({
      privateRole: "medium",
      players: [
        player({ userId: "u1", displayName: "Анна" }),
        player({ userId: "u2", displayName: "Борис" }),
      ],
      livingPlayers: [
        player({ userId: "u1", displayName: "Анна" }),
        player({ userId: "u2", displayName: "Борис" }),
      ],
    });

    expect(screen.getByText("Медиумът няма елиминиран играч, с когото да се свърже тази нощ.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Свържи се с елиминиран" })).toBeDisabled();
  });

  it("allows any role to skip its night action", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ privateRole: "doctor" });

    await user.click(screen.getByRole("button", { name: "Пропусни" }));

    expect(props.sendNightAction).toHaveBeenCalledWith({ kind: "skip" });
  });
});
