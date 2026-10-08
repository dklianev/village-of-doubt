import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NarrationPreview } from "./NarrationPreview";
import { setSoundEnabled } from "@/lib/sound";

const mocks = vi.hoisted(() => ({ create: vi.fn(), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() }));
vi.mock("@/lib/play/narration-preview", () => ({ createNarrationPreview: mocks.create }));

describe("narration preview controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockImplementation((status) => ({
      play: mocks.play.mockImplementation(async () => status("playing")),
      stop: mocks.stop.mockImplementation(() => status("idle")),
      dispose: mocks.dispose,
    }));
    localStorage.clear();
    setSoundEnabled(true);
  });
  afterEach(() => { localStorage.clear(); });

  it("does not create or play audio on render or keyboard focus", () => {
    render(<NarrationPreview voice="classic_nikolay" />);
    screen.getByRole("button", { name: /Прослушай гласа/ }).focus();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Финал/ })).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.play).not.toHaveBeenCalled();
  });
  it("plays only the approved night sample on explicit activation and exposes its transcript", () => {
    render(<NarrationPreview voice="witch_moonglow" />);
    fireEvent.click(screen.getByRole("button", { name: /Прослушай гласа/ }));
    expect(mocks.play).toHaveBeenCalledWith("witch_moonglow", "preview.night");
    expect(screen.getByText(/Добре дошли/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Спри прослушването/ }));
    expect(mocks.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Прослушай гласа/ })).toHaveAttribute("aria-pressed", "false");
  });
  it("blocks mute and live/silent modes without changing global preferences", () => {
    const { rerender } = render(<NarrationPreview voice="classic" />);
    act(() => setSoundEnabled(false));
    expect(screen.getByText("Звукът е изключен.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Прослушай гласа/ }));
    expect(mocks.play).not.toHaveBeenCalled();
    expect(localStorage.getItem("werewolf-sound")).toBe("off");
    act(() => setSoundEnabled(true));
    rerender(<NarrationPreview voice="classic" disabled />);
    expect(screen.getByRole("button", { name: /Прослушай гласа/ })).toBeDisabled();
  });
  it("stops for voice or availability changes and disposes on unmount", () => {
    const { rerender, unmount } = render(<NarrationPreview voice="classic" />);
    fireEvent.click(screen.getByRole("button", { name: /Прослушай гласа/ }));
    rerender(<NarrationPreview voice="witch" />);
    expect(mocks.stop).toHaveBeenCalled();
    expect(screen.queryByText(/Добре дошли/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Прослушай гласа/ }));
    rerender(<NarrationPreview voice="witch" disabled />);
    expect(mocks.stop).toHaveBeenCalledTimes(2);
    unmount();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
  it("shows a clear absent-recording status without pretending playback succeeded", () => {
    mocks.create.mockImplementation((status) => ({ play: async () => status("unavailable"), stop: mocks.stop, dispose: mocks.dispose }));
    render(<NarrationPreview voice="old_villager" />);
    fireEvent.click(screen.getByRole("button", { name: /Прослушай гласа/ }));
    expect(screen.getByText("Записът още не е достъпен.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Прослушай гласа/ })).toHaveAttribute("aria-pressed", "false");
  });
});
