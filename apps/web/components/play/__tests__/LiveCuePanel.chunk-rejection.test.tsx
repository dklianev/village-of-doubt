import { useEffect, useMemo } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Room } from "@colyseus/sdk";
import { PlayRoomClientCore } from "@/components/play-room-client";
import { parseVisualGameFixture } from "@/hooks/play/visual-game-fixture";
import type { UseGameRoomResult } from "@/hooks/play/use-game-room";

const load = vi.hoisted(() => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => { resolve = done; });
  return { pending, reject: () => resolve() };
});

vi.mock("@/lib/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/hooks/play/use-cue-mode", () => ({ useCueMode: () => ({ cueMode: "visual", changeCueMode: vi.fn() }) }));
vi.mock("@/hooks/play/use-phase-transitions", () => ({ usePhaseTransitions: () => ({ phasePulse: 0, showPhaseTransition: false, startCountdown: null, requestStartGame: vi.fn() }) }));
vi.mock("../PlayToolSurface", async () => {
  await load.pending;
  throw new Error("Synthetic cue surface chunk rejection");
});

it("contains a rejected settings dependency without leaving the room, reopening a cancelled sheet, or trapping focus", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const user = userEvent.setup();
  const leave = vi.fn();
  function useFixture(): UseGameRoomResult {
    useEffect(() => leave, []);
    return useMemo(() => {
      const fixture = parseVisualGameFixture("visualGame=1&family=werewolves&phase=lobby&role=seer", "SYNTH", undefined, "development")!;
      return { ...fixture, room: { roomId: "synthetic-cue-instance", send: vi.fn(), onMessage: () => () => {} } as unknown as Room,
        privateFactionRoster: null, connectionMessage: "Свързан", unlockedAchievementIds: [],
        setUnlockedAchievementIds: vi.fn(), reconnectNow: vi.fn(), isPending: false };
    }, []);
  }
  const { unmount } = render(<PlayRoomClientCore code="SYNTH" useRoom={useFixture} />);
  const trigger = screen.getByRole("button", { name: /Сигнали/ });
  await user.click(trigger);
  await screen.findByText("Зареждаме сигналите...");
  await user.keyboard("{Escape}");
  await act(async () => load.reject());
  await waitFor(() => expect(console.error).toHaveBeenCalled());

  expect(screen.queryByText("Настройките за сигнали не се заредиха.")).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
  expect(leave).not.toHaveBeenCalled();

  await user.click(trigger);
  expect(await screen.findByText("Настройките за сигнали не се заредиха.")).toHaveAttribute("role", "status");
  const dismiss = screen.getByRole("button", { name: "Затвори" });
  expect(dismiss).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Настройките за сигнали не се заредиха.")).not.toBeInTheDocument();

  await user.click(trigger);
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Копирай покана" })).toBeEnabled();
  expect(document.querySelector(".play-waiting-invite")).toHaveTextContent("SYNTH");
  expect(leave).not.toHaveBeenCalled();
  unmount();
  expect(leave).toHaveBeenCalledTimes(1);
});
