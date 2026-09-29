import type { ComponentProps } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayStage } from "@/components/play/PlayStage";
import type { PublicPlayer } from "@/lib/play/types";

function props(count = 8): ComponentProps<typeof PlayStage> {
  const players: PublicPlayer[] = Array.from({ length: count }, (_, i) => ({
    userId: `public-${i}`, displayName: `Играч ${i + 1}`, avatarId: "portrait-f01",
    connected: true, ready: true, playing: true, alive: i !== count - 1,
    host: i === 0, narrator: false, acceptedFullNarrator: false, mayor: false,
    hasVoted: false, actedThisPhase: false, revealedRole: "",
  }));
  return {
    code: "DEMO42", phase: "voting", mode: "werewolves_classic", family: "werewolves",
    round: 2, phaseEndsAt: 0, isPending: false, hasSnapshot: true, players,
    ownPlayer: players[0], narratorMode: "automatic", communicationMode: "built_in_chat",
    targetableIds: new Set(players.slice(1, -1).map(p => p.userId)), shortcutNumbers: new Map(),
    selectedTargetId: "", secondTargetId: "", voteCounts: new Map(),
    currentSpeakerUserId: "", currentDefenseUserId: "", nomineeIds: new Set(),
    onSelectSeat: vi.fn(), onMakeNarrator: vi.fn(), onMakeMayor: vi.fn(),
  };
}

function mockDimensions(viewportWidth = 1487, stageWidth = viewportWidth, hudHeight = 130, viewportHeight = 1058) {
  let callback: ResizeObserverCallback | undefined;
  vi.stubGlobal("ResizeObserver", class {
    constructor(cb: ResizeObserverCallback) { callback = cb; }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("960") ? viewportWidth >= 1366 && viewportHeight <= 960
      : query.includes("1366") ? viewportWidth >= 1366 : viewportWidth <= 1023,
  }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(stageWidth);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(stageWidth * 706 / 1487);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, stageWidth, this.hasAttribute("data-stage-hud") ? hudHeight : stageWidth * 706 / 1487);
  });
  return () => act(() => callback?.([], {} as ResizeObserver));
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("active physical table", () => {
  it.each([{ width: 1366, height: 768 }, { width: 1440, height: 900 }])("keeps the oval with smaller portraits at $width x $height", ({ width, height }) => {
    const measure = mockDimensions(width, width, 110, height);
    const { container } = render(<PlayStage {...props()} />);
    measure();
    expect(screen.getByRole("region")).toHaveAttribute("data-layout-mode", "active-table");
    expect(container.querySelectorAll("[data-seat-token]")).toHaveLength(8);
    for (const slot of container.querySelectorAll<HTMLElement>(".play-seat-slot")) expect(slot.style.getPropertyValue("--seat-visual-size")).toBe("66px");
  });
  it.each([3, 6, 8, 10, 12])("anchors %s public portraits on the full-width room plate", count => {
    const measure = mockDimensions();
    const { container } = render(<PlayStage {...props(count)} />);
    measure();
    expect(screen.getByRole("region")).toHaveAttribute("data-layout-mode", "active-table");
    const slots = [...container.querySelectorAll<HTMLElement>(".play-seat-slot")];
    expect(slots).toHaveLength(count);
    for (const slot of slots) {
      const x = parseFloat(slot.style.getPropertyValue("--seat-x"));
      const y = parseFloat(slot.style.getPropertyValue("--seat-y"));
      expect(x).toBeGreaterThan(150);
      expect(x).toBeLessThan(1337);
      expect(y).toBeGreaterThan(170);
      expect(y).toBeLessThan(650);
      expect(parseFloat(slot.style.getPropertyValue("--seat-visual-size"))).toBeGreaterThanOrEqual(82);
    }
    const core = container.querySelector("[data-table-core]")!;
    expect(core.children).toHaveLength(1);
    expect(within(core as HTMLElement).getByRole("timer")).toBeVisible();
    expect(core.querySelector("[data-stage-counts]")).toBeNull();
    expect(container.querySelector('[class*="tableSurface"]')).toBeNull();
  });

  it.each([
    { width: 1365, count: 8, hudHeight: 130, mode: "dense-table-grid" },
    { width: 390, count: 8, hudHeight: 130, mode: "mobile-table-grid" },
    { width: 1024, count: 30, hudHeight: 130, mode: "dense-table-grid" },
    { width: 1487, count: 30, hudHeight: 320, mode: "dense-table-grid" },
    { width: 1487, count: 8, hudHeight: 230, mode: "dense-table-grid" },
  ])("uses a safe grid at $width px with $count seats and a $hudHeight px header", ({ width, count, hudHeight, mode }) => {
    const measure = mockDimensions(width, width, hudHeight);
    const { container } = render(<PlayStage {...props(count)} />);
    measure();
    expect(screen.getByRole("region")).toHaveAttribute("data-layout-mode", mode);
    expect(container.querySelectorAll("[data-seat-token]")).toHaveLength(count);
    for (const slot of container.querySelectorAll<HTMLElement>(".play-seat-slot")) expect(slot.style.length).toBe(0);
  });

  it("keeps the room code and public counts in the header, with a parent-owned action slot", () => {
    render(<PlayStage {...props()} activeRoomAction={<button>Копирай кода</button>} />);
    expect(screen.getByText("DEMO42").closest("[data-stage-hud]")).not.toBeNull();
    expect(screen.getByText("7 живи · 1 елиминиран").closest("[data-stage-hud]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Копирай кода" }).closest("[data-stage-ledger]")).not.toBeNull();
    expect(screen.getByText("Кой ще напусне селото?")).toBeVisible();
  });

  it("keeps selection a callback, not a vote or an inferred acknowledgement", async () => {
    const input = props();
    const { rerender } = render(<PlayStage {...input} />);
    const target = screen.getByRole("button", { name: /Избери Играч 2/ });
    await userEvent.setup().click(target);
    expect(input.onSelectSeat).toHaveBeenCalledExactlyOnceWith("public-1");
    expect(target).toHaveAttribute("aria-pressed", "false");
    rerender(<PlayStage {...input} selectedTargetId="public-1" />);
    expect(target).toHaveAttribute("aria-pressed", "true");
    expect(within(target).getByText("Избран")).toBeVisible();
    expect(target).not.toHaveAttribute("data-voted");
    expect(screen.queryByRole("button", { name: /Избери Играч 8/ })).not.toBeInTheDocument();
  });

  it("returns to the unchanged lobby composition when the phase changes", () => {
    const measure = mockDimensions();
    const input = props();
    const { rerender } = render(<PlayStage {...input} />);
    measure();
    expect(screen.getByRole("region")).toHaveAttribute("data-layout-mode", "active-table");
    rerender(<PlayStage {...input} phase="lobby" targetableIds={new Set()} />);
    measure();
    expect(screen.getByRole("region")).toHaveAttribute("data-layout-mode", "lobby-table");
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByText("8 участници")).toBeVisible();
  });

  it.each([13, 16, 18, 24, 30])("keeps %s participants in clockwise order around an open center", count => {
    const measure = mockDimensions();
    const { container } = render(<PlayStage {...props(count)} phase="lobby" targetableIds={new Set()} />);
    measure();
    expect(screen.getByRole("region")).toHaveAttribute("data-layout-mode", "crowded-table");
    expect(container.querySelectorAll("[data-seat-token]")).toHaveLength(count);
    const slots = [...container.querySelectorAll<HTMLElement>(".play-seat-slot")];
    const upperCount = Math.ceil(count / 2);
    for (const [index, slot] of slots.entries()) {
      expect(parseFloat(slot.style.getPropertyValue("--seat-visual-size"))).toBeGreaterThanOrEqual(44);
      expect(slot).toHaveAttribute("data-menu-y", index < upperCount ? "down" : "up");
      if (index > 0 && index !== upperCount) {
        const previousX = parseFloat(slots[index - 1]!.style.getPropertyValue("--seat-x"));
        const x = parseFloat(slot.style.getPropertyValue("--seat-x"));
        expect(index < upperCount ? x > previousX : x < previousX).toBe(true);
      }
    }
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("preserves every crowded seat after elimination and target selection", () => {
    const measure = mockDimensions();
    const input = props(24);
    const { container, rerender } = render(<PlayStage {...input} />);
    measure();
    const positions = () => [...container.querySelectorAll<HTMLElement>(".play-seat-slot")].map(slot => slot.style.cssText);
    const before = positions();
    rerender(<PlayStage {...input} selectedTargetId="public-2" players={input.players.map((player, index) => index === 5 ? {...player, alive: false} : player)} />);
    expect(positions()).toEqual(before);
    expect(screen.getByRole("button", { name: /Избери Играч 3/ })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll("[data-seat-token]")).toHaveLength(24);
  });
});
