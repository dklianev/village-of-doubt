import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NarrationPreview } from "./NarrationPreview";
import { setSoundEnabled } from "@/lib/sound";

const mocks = vi.hoisted(() => ({ load: vi.fn(), createPlayer: vi.fn() }));
vi.mock("@/lib/play/narration-assets", () => ({ loadNarrationClip: mocks.load }));
vi.mock("@/lib/play/narration-player", () => ({ createNarrationPlayer: mocks.createPlayer }));

describe("preview gesture ownership through the real component", () => {
  beforeEach(() => {
    localStorage.clear();
    setSoundEnabled(true);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    mocks.load.mockReset().mockResolvedValue({
      src: "/audio/narration/v1/classic/preview-night.mp3", durationMs: 4000, sha256: "a".repeat(64),
    });
    mocks.createPlayer.mockReset().mockImplementation(({ onSpeakingChange }) => ({
      play: async () => { onSpeakingChange(true); return "started"; },
      stop: vi.fn(), dispose: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("constructs and resumes on the first click stack before lazy player or asset loading", async () => {
    const construct = vi.fn();
    const resume = vi.fn();
    const close = vi.fn();
    let dispatchingClick = false;
    vi.stubGlobal("AudioContext", class {
      state = "suspended";
      destination = {} as AudioNode;
      constructor() { construct(dispatchingClick); }
      resume() { resume(dispatchingClick); this.state = "running"; return Promise.resolve(); }
      close() { close(); this.state = "closed"; return Promise.resolve(); }
    });
    const { unmount } = render(<NarrationPreview voice="classic" />);
    const button = screen.getByRole("button", { name: /Прослушай гласа/ });
    button.focus();
    expect(construct).not.toHaveBeenCalled();
    expect(mocks.createPlayer).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();

    // Any await/import inserted before play() in the actual caller loses this stack.
    dispatchingClick = true;
    fireEvent.click(button);
    dispatchingClick = false;
    expect(construct).toHaveBeenCalledExactlyOnceWith(true);
    expect(resume).toHaveBeenCalledExactlyOnceWith(true);
    expect(mocks.createPlayer).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Възпроизвеждане")).toBeInTheDocument());
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith("classic", "preview.night", expect.any(AbortSignal));
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });
});
