import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { LiveCuePanel } from "../LiveCuePanel";

const load = vi.hoisted(() => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => { resolve = done; });
  return { pending, resolve: () => resolve(), started: vi.fn(), finished: vi.fn() };
});

vi.mock("../LiveCueSettings", async (importOriginal) => {
  load.started();
  await load.pending;
  const module = await importOriginal();
  load.finished();
  return module;
});

it("loads only on open, supports pending cancellation, and never opens after a cancelled request resolves", async () => {
  const user = userEvent.setup();
  const props = { cueMode: "audio_vibration" as const, liveMode: false, phase: "night", pulseKey: 0, onChange: vi.fn() };
  const { rerender } = render(<LiveCuePanel {...props} />);
  const trigger = screen.getByRole("button", { name: /Сигнали/ });
  expect(load.started).not.toHaveBeenCalled();
  await user.click(trigger);
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Зареждаме сигналите...");
  expect(status).toHaveClass("sr-only");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Затвори" })).not.toBeInTheDocument();
  await waitFor(() => expect(load.started).toHaveBeenCalledTimes(1));

  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();

  await user.click(trigger);
  await user.keyboard("{Escape}");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  rerender(<LiveCuePanel {...props} liveMode phase="day_discussion" pulseKey={1} />);

  await act(async () => load.resolve());
  await waitFor(() => expect(load.finished).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();

  await user.click(trigger);
  await screen.findByRole("dialog", { name: "Сигнали за фазите" });
  expect(screen.getByRole("radio", { name: "Тихо" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Звук и вибрация" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Затвори" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(load.started).toHaveBeenCalledTimes(1);
});
