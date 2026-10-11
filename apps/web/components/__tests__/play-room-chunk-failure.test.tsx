import { useEffect, useMemo } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "@colyseus/sdk";
import { PlayRoomClientCore } from "../play-room-client";
import { parseVisualGameFixture } from "@/hooks/play/visual-game-fixture";
import type { UseGameRoomResult } from "@/hooks/play/use-game-room";

vi.mock("@/lib/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/hooks/play/use-cue-mode", () => ({ useCueMode: () => ({ cueMode: "visual", changeCueMode: vi.fn() }) }));
vi.mock("@/hooks/play/use-phase-transitions", () => ({ usePhaseTransitions: () => ({ phasePulse: 0, showPhaseTransition: false, startCountdown: null, requestStartGame: vi.fn() }) }));
vi.mock("@/components/play/RoleCard", () => { throw new Error("Synthetic RoleCard chunk failure"); });
vi.mock("@/components/play/RoleRevealRitual", () => { throw new Error("Synthetic ritual chunk failure"); });
vi.mock("@/components/play/SoundscapeHost", () => { throw new Error("Synthetic sound chunk failure"); });
vi.mock("@/components/play/InviteTools", () => { throw new Error("Synthetic invite chunk failure"); });
vi.mock("@/components/play/AchievementUnlockModal", () => { throw new Error("Synthetic achievement chunk failure"); });

describe("play room chunk failures", () => {
  const leave = vi.fn();
  beforeEach(() => {
    leave.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  function useFixture(phase: string): UseGameRoomResult {
    useEffect(() => leave, []);
    return useMemo(() => {
      const fixture = parseVisualGameFixture(`visualGame=1&family=werewolves&phase=${phase}&role=seer`, "SYNTH", undefined, "development")!;
      return { ...fixture, room: { roomId: "synthetic-instance", send: vi.fn(), onMessage: () => () => {} } as unknown as Room,
        privateFactionRoster: null, connectionMessage: "Свързан", unlockedAchievementIds: ["first_win"],
        setUnlockedAchievementIds: vi.fn(), reconnectNow: vi.fn(), isPending: false };
    }, [phase]);
  }

  it("preserves private role and result when the role card and optional sound/achievement chunks fail", async () => {
    render(<PlayRoomClientCore code="SYNTH" useRoom={() => useFixture("night")} />);
    const role = await screen.findByRole("article", { name: "Тайна роля: Гадателка" });
    expect(role).toHaveTextContent("Всяка нощ");
    expect(screen.getByRole("status", { name: "Личен резултат" })).toBeInTheDocument();
    expect(document.querySelector(".play-stage")).toBeInTheDocument();
    expect(leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Скрий ролята" }));
    expect(screen.queryByRole("article", { name: "Тайна роля: Гадателка" })).not.toBeInTheDocument();
  });

  it("keeps the role concealed when the reveal ceremony fails, until explicitly opened", async () => {
    render(<PlayRoomClientCore code="SYNTH" useRoom={() => useFixture("role_reveal")} />);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.queryByRole("article", { name: "Тайна роля: Гадателка" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(await screen.findByRole("article", { name: "Тайна роля: Гадателка" })).toBeInTheDocument();
    expect(leave).not.toHaveBeenCalled();
  });

  it("keeps the code and ordinary invitation available when invite extras fail", async () => {
    render(<PlayRoomClientCore code="SYNTH" useRoom={() => useFixture("lobby")} />);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Копирай покана" })).toBeEnabled();
    expect(document.querySelector(".play-waiting-invite")).toHaveTextContent("SYNTH");
    expect(leave).not.toHaveBeenCalled();
  });
});
