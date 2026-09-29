import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicEvent } from "@/lib/play/types";
import { playSoundStinger, setSoundScene } from "@/lib/play/soundscape-bridge";
import { SoundscapeHost } from "../SoundscapeHost";

vi.mock("@/lib/play/soundscape-bridge", () => ({ setSoundScene: vi.fn(), playSoundStinger: vi.fn() }));

const death = (id: string): PublicEvent => ({ id, type: "death", messageBg: "Някой е извън играта.", createdAt: 1 } as PublicEvent);
const base = { mode: "werewolves_classic", phase: "night", narratorVoice: "classic", liveMode: false } as const;

describe("SoundscapeHost", () => {
  beforeEach(() => {
    vi.mocked(setSoundScene).mockClear();
    vi.mocked(playSoundStinger).mockClear();
  });

  it("hands the public phase to the soundscape online and silences it on leave", () => {
    const { unmount } = render(<SoundscapeHost {...base} publicEvents={[]} />);
    expect(setSoundScene).toHaveBeenLastCalledWith({ mode: "werewolves_classic", phase: "night", narratorVoice: "classic" });
    unmount();
    expect(setSoundScene).toHaveBeenLastCalledWith(null);
  });

  it("never gives live tables a soundscape or a death stinger", () => {
    const { rerender } = render(<SoundscapeHost {...base} liveMode publicEvents={[]} />);
    rerender(<SoundscapeHost {...base} liveMode publicEvents={[death("d1")]} />);
    expect(vi.mocked(setSoundScene).mock.calls.every(([scene]) => scene === null)).toBe(true);
    expect(playSoundStinger).not.toHaveBeenCalled();
  });

  it("stings only for deaths that happen after the table mounts", () => {
    const { rerender } = render(<SoundscapeHost {...base} publicEvents={[death("old")]} />);
    expect(playSoundStinger).not.toHaveBeenCalled();
    rerender(<SoundscapeHost {...base} publicEvents={[death("old"), death("new")]} />);
    expect(playSoundStinger).toHaveBeenCalledTimes(1);
    expect(playSoundStinger).toHaveBeenCalledWith("death");
  });
});
