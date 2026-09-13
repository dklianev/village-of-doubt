import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveCuePanel } from "@/components/play/LiveCuePanel";

const vibrate = vi.fn(() => true);

beforeEach(() => {
  vibrate.mockClear();
  vi.stubGlobal("navigator", { vibrate });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LiveCuePanel", async () => {
  it("tests visual cues without vibrating the device", async () => {
    render(<LiveCuePanel cueMode="visual" liveMode={false} phase="night" pulseKey={0} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("dialog", { name: "Сигнали за фазите" });

    fireEvent.click(screen.getByRole("button", { name: "Пробвай" }));

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("restarts the visual cue on every test and subsequent phase change", async () => {
    const props = { cueMode: "visual" as const, liveMode: false, phase: "night", pulseKey: 4, onChange: vi.fn() };
    const { rerender } = render(<LiveCuePanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("dialog", { name: "Сигнали за фазите" });
    const initialCue = document.querySelector("[data-cue] > svg");
    expect(initialCue).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Пробвай" }));
    const firstPreview = document.querySelector("[data-cue] > svg");
    expect(firstPreview).not.toBe(initialCue);

    fireEvent.click(screen.getByRole("button", { name: "Пробвай" }));
    const secondPreview = document.querySelector("[data-cue] > svg");
    expect(secondPreview).not.toBe(firstPreview);

    rerender(<LiveCuePanel {...props} phase="day_discussion" pulseKey={5} />);
    expect(document.querySelector("[data-cue] > svg")).not.toBe(secondPreview);
  });

  it.each([
    ["night", [130]],
    ["voting", [90, 50, 90]],
    ["day_discussion", [70]],
  ])("tests the current %s phase vibration only in audio vibration mode", async (phase, pattern) => {
    render(<LiveCuePanel cueMode="audio_vibration" liveMode={false} phase={phase} pulseKey={0} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("dialog", { name: "Сигнали за фазите" });

    fireEvent.click(screen.getByRole("button", { name: "Пробвай" }));

    expect(vibrate).toHaveBeenCalledExactlyOnceWith(pattern);
  });

  it("does not vibrate in a live room even while the audio preference is still present", async () => {
    render(<LiveCuePanel cueMode="audio_vibration" liveMode phase="night" pulseKey={0} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("dialog", { name: "Сигнали за фазите" });

    fireEvent.click(screen.getByRole("button", { name: "Пробвай" }));

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("disables testing in silent mode", async () => {
    render(<LiveCuePanel cueMode="silent" liveMode phase="night" pulseKey={0} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("dialog", { name: "Сигнали за фазите" });
    const initialCue = document.querySelector("[data-cue] > svg");
    const button = screen.getByRole("button", { name: "Пробвай" });

    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(vibrate).not.toHaveBeenCalled();
    expect(document.querySelector("[data-cue] > svg")).toBe(initialCue);
  });

  it("exposes only silent mode in live rooms and explains the enforced policy", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LiveCuePanel cueMode="audio_vibration" liveMode phase="night" pulseKey={0} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("dialog", { name: "Сигнали за фазите" });
    expect(screen.getByRole("radio", { name: "Тихо" })).toBeChecked();
    for (const name of ["Визуално", "Звук и вибрация", "Пробвай"]) {
      const button = screen.getByRole(name === "Пробвай" ? "button" : "radio", { name });
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
    expect(screen.getByText("При игра на живо е достъпен само тихият режим.")).toBeInTheDocument();
  });

  it("keeps every cue mode available outside live rooms", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = { liveMode: false, phase: "night", pulseKey: 0, onChange };
    const { rerender } = render(<LiveCuePanel {...props} cueMode="visual" />);
    fireEvent.click(screen.getByRole("button", { name: /Сигнали/ }));
    await screen.findByRole("dialog", { name: "Сигнали за фазите" });

    for (const [name, mode] of [["Тихо", "silent"], ["Визуално", "visual"], ["Звук и вибрация", "audio_vibration"]] as const) {
      const button = screen.getByRole("radio", { name });
      expect(button).toBeEnabled();
      await user.click(button);
      rerender(<LiveCuePanel {...props} cueMode={mode} />);
    }

    expect(onChange.mock.calls).toEqual([["silent"], ["visual"], ["audio_vibration"]]);
  });
});
