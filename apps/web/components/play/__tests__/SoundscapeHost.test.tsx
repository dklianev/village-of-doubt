import { render } from "@testing-library/react";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicEvent, PublicPlayer } from "@/lib/play/types";
import { playSoundStinger, setSoundScene } from "@/lib/play/soundscape-bridge";
import { SoundscapeHost } from "../SoundscapeHost";

vi.mock("@/lib/play/soundscape-bridge", () => ({ setSoundScene: vi.fn(), playSoundStinger: vi.fn() }));

const death = (id: string): PublicEvent => ({ id, type: "death", messageBg: "Някой е извън играта." });
const snapshot = { mode: "werewolves_classic", phase: "night", narratorVoice: "classic", round: 2, votingCycle: 1, winnerTeam: "", players: [{ userId: "a", playing: true }, { userId: "observer", playing: false }] as PublicPlayer[], publicEvents: [] as PublicEvent[] } as const;
const base = { snapshot, room: { roomId: "instance-a", state: {} }, connected: true, liveMode: false, cueMode: "audio_vibration" } as const;
const withEvents = (...events: PublicEvent[]) => ({ ...snapshot, publicEvents: events });

describe("SoundscapeHost", () => {
  beforeEach(() => { vi.mocked(setSoundScene).mockClear(); vi.mocked(playSoundStinger).mockClear(); });

  it("forwards actual room identity and public occurrence data, excluding observers", () => {
    const { unmount } = render(<SoundscapeHost {...base} />);
    expect(setSoundScene).toHaveBeenLastCalledWith({ mode: "werewolves_classic", phase: "night", narratorVoice: "classic", narration: { gameId: "instance-a", round: 2, votingCycle: 1, winnerTeam: "", participantIds: ["a"] } });
    unmount();
    expect(setSoundScene).toHaveBeenLastCalledWith(null);
  });

  it("never gives live tables a soundscape or a death stinger", () => {
    const { rerender } = render(<SoundscapeHost {...base} liveMode />);
    rerender(<SoundscapeHost {...base} liveMode snapshot={withEvents(death("d1"))} />);
    expect(vi.mocked(setSoundScene).mock.calls.every(([scene]) => scene === null)).toBe(true);
    expect(playSoundStinger).not.toHaveBeenCalled();
  });

  it("follows the table signal setting: quiet and visual modes get no soundscape", () => {
    for (const cueMode of ["silent", "visual"] as const) {
      vi.mocked(setSoundScene).mockClear();
      const { rerender, unmount } = render(<SoundscapeHost {...base} cueMode={cueMode} />);
      rerender(<SoundscapeHost {...base} cueMode={cueMode} snapshot={withEvents(death(cueMode + "-d"))} />);
      expect(vi.mocked(setSoundScene).mock.calls.every(([scene]) => scene === null)).toBe(true);
      unmount();
    }
    expect(playSoundStinger).not.toHaveBeenCalled();
  });

  it("stings only for deaths that happen after the table mounts", () => {
    const { rerender } = render(<SoundscapeHost {...base} snapshot={withEvents(death("old"))} />);
    expect(playSoundStinger).not.toHaveBeenCalled();
    rerender(<SoundscapeHost {...base} snapshot={withEvents(death("old"), death("new"))} />);
    expect(playSoundStinger).toHaveBeenCalledExactlyOnceWith("death");
  });

  it("cancels on disconnect and does not replay deaths on reconnect", () => {
    const { rerender } = render(<SoundscapeHost {...base} />);
    rerender(<SoundscapeHost {...base} connected={false} snapshot={withEvents(death("offline"))} />);
    expect(setSoundScene).toHaveBeenLastCalledWith(null);
    rerender(<SoundscapeHost {...base} snapshot={withEvents(death("offline"), death("history"))} />);
    expect(playSoundStinger).not.toHaveBeenCalled();
    expect(setSoundScene).toHaveBeenLastCalledWith(expect.objectContaining({ narration: expect.objectContaining({ gameId: "instance-a" }) }));
  });

  it("baselines deaths accumulated while Activity was hidden, then plays only fresh events", () => {
    const table = (mode: "visible" | "hidden", events: PublicEvent[]) => (
      <Activity mode={mode}><SoundscapeHost {...base} snapshot={withEvents(...events)} /></Activity>
    );
    const { rerender } = render(table("visible", []));
    rerender(table("hidden", []));
    expect(setSoundScene).toHaveBeenLastCalledWith(null);
    rerender(table("hidden", [death("history")]));
    rerender(table("visible", [death("history")]));
    expect(playSoundStinger).not.toHaveBeenCalled();
    rerender(table("visible", [death("history"), death("fresh")]));
    expect(playSoundStinger).toHaveBeenCalledExactlyOnceWith("death");
  });

  it("does not confuse another room's history with fresh deaths", () => {
    const { rerender } = render(<SoundscapeHost {...base} />);
    rerender(<SoundscapeHost {...base} room={{ roomId: "instance-b", state: {} }} snapshot={withEvents(death("other-room"))} />);
    expect(playSoundStinger).not.toHaveBeenCalled();
  });

  it("requires a connected actual room, not the invitation code", () => {
    render(<SoundscapeHost {...base} room={null} />);
    expect(setSoundScene).toHaveBeenLastCalledWith(null);
  });

  it("resets a replacement connection to the same room even if status updates were batched", () => {
    const { rerender } = render(<SoundscapeHost {...base} />);
    vi.mocked(setSoundScene).mockClear();
    rerender(<SoundscapeHost {...base} room={{ ...base.room }} snapshot={withEvents(death("reconnected-history"))} />);
    expect(setSoundScene).toHaveBeenNthCalledWith(1, null);
    expect(playSoundStinger).not.toHaveBeenCalled();
  });

  it("forwards changes in round, voting cycle and selected narrator", () => {
    const { rerender } = render(<SoundscapeHost {...base} />);
    rerender(<SoundscapeHost {...base} snapshot={{ ...snapshot, phase: "voting", round: 3, votingCycle: 2, narratorVoice: "witch_moonglow" }} />);
    expect(setSoundScene).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "voting", narratorVoice: "witch_moonglow", narration: expect.objectContaining({ round: 3, votingCycle: 2 }) }));
  });

  it("binds only a current room's final result and drops an earlier round", () => {
    const result = { winnerTeam: "village", winnerPlayerIds: ["a"], personalWinnerPlayerIds: [], finalRoles: [{ userId: "a", role: "ordinary_villager" }] };
    const state = { phase: "game_over", round: 2, winnerTeam: "village", terminalResultJson: JSON.stringify(result) };
    const final = { ...snapshot, phase: "game_over" as const, winnerTeam: "village" };
    const { rerender } = render(<SoundscapeHost {...base} snapshot={final} room={{ roomId: "instance-a", state }} />);
    expect(setSoundScene).toHaveBeenLastCalledWith(expect.objectContaining({ narration: expect.objectContaining({ terminalResult: result, terminalResultGameId: "instance-a", terminalResultRound: 2 }) }));
    rerender(<SoundscapeHost {...base} snapshot={{ ...final, round: 3 }} room={{ roomId: "instance-a", state }} />);
    expect(vi.mocked(setSoundScene).mock.lastCall?.[0]?.narration?.terminalResult).toBeUndefined();
  });
});
