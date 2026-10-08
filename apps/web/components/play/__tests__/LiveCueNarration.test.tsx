import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NARRATOR_VOICES, NARRATOR_VOICE_LABELS_BG } from "@werewolf/shared";
import { setSoundEnabled } from "@/lib/sound";
import { LiveCuePanel } from "../LiveCuePanel";

const audio = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn(), dispose: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/play/narration-preview", () => ({ createNarrationPreview: audio.create }));

describe("phase signal narrator preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setSoundEnabled(true);
    audio.create.mockImplementation((status) => ({ play: audio.play.mockImplementation(async () => status("playing")), stop: audio.stop, dispose: audio.dispose }));
  });
  const props = { liveMode: false, cueMode: "audio_vibration" as const, phase: "night", pulseKey: 1, onChange: vi.fn() };

  it.each(NARRATOR_VOICES)("shows the room's %s voice without autoplay", async (narratorVoice) => {
    render(<LiveCuePanel {...props} narratorVoice={narratorVoice} />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("heading", { name: NARRATOR_VOICE_LABELS_BG[narratorVoice] });
    expect(audio.create).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Финал/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Прослушай гласа/ }));
    expect(audio.play).toHaveBeenCalledWith(narratorVoice, "preview.night");
  });

  it("stops previews when the sheet closes or phase changes", async () => {
    const { rerender } = render(<LiveCuePanel {...props} narratorVoice="inspector" />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Прослушай гласа/ }));
    rerender(<LiveCuePanel {...props} narratorVoice="inspector" phase="voting" />);
    expect(audio.dispose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Прослушай гласа/ }));
    fireEvent.click(screen.getByRole("button", { name: "Затвори" }));
    await waitFor(() => expect(audio.dispose).toHaveBeenCalledTimes(2));
  });

  it("blocks narration in visual, silent and live settings", async () => {
    const { rerender } = render(<LiveCuePanel {...props} narratorVoice="classic" cueMode="visual" />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    expect(await screen.findByRole("button", { name: /Прослушай гласа/ })).toBeDisabled();
    rerender(<LiveCuePanel {...props} narratorVoice="classic" cueMode="silent" />);
    expect(screen.getByRole("button", { name: /Прослушай гласа/ })).toBeDisabled();
    rerender(<LiveCuePanel {...props} narratorVoice="classic" liveMode />);
    expect(screen.getByRole("button", { name: /Прослушай гласа/ })).toBeDisabled();
    expect(audio.create).not.toHaveBeenCalled();
  });
});
