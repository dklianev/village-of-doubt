import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReconnectModal } from "@/components/play/ReconnectModal";

describe("ReconnectModal", () => {
  afterEach(() => vi.useRealTimers());
  it("offers name correction without navigating away from the failed join", async () => {
    const onRetry = vi.fn();
    render(<ReconnectModal status="error" message="Това име вече се използва в стаята." onRetry={onRetry} />);

    const profile = screen.getByRole("link", { name: /Промени името/ });
    expect(profile).toHaveAttribute("href", "/account");
    expect(profile).toHaveAttribute("target", "_blank");
    expect(profile).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("button", { name: "Презареди" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Свържи отново" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the retry action disabled while reconnecting", async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();

    render(
      <ReconnectModal
        status="reconnecting"
        message="Връзката се връща автоматично."
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    vi.useRealTimers();
    const retry = screen.getByRole("button", { name: "Опитваме..." });
    expect(screen.getByRole("dialog", { name: "Свързваме се отново" })).toBeInTheDocument();
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute("aria-busy", "true");

    await userEvent.click(retry);

    expect(onRetry).not.toHaveBeenCalled();
  });

  it("routes manual retry from the lost state", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ReconnectModal
        status="lost"
        message="Не успяхме да възстановим връзката."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Връзката е прекъсната" })).toHaveTextContent(
      "Не успяхме да възстановим връзката.",
    );

    await user.click(screen.getByRole("button", { name: "Опитай пак" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers a page reload escape hatch", () => {
    render(
      <ReconnectModal
        status="lost"
        message="Не успяхме да възстановим връзката."
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Презареди" })).toBeInTheDocument();
  });

  it("offers a fresh retry after a room error", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ReconnectModal
        status="error"
        message="Стаята прекъсна връзката."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Връзката със стаята прекъсна" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Свържи отново" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("cancels the delayed dialog when a short interruption ends", () => {
    vi.useFakeTimers();
    const { unmount } = render(<ReconnectModal status="reconnecting" message="Проверяваме връзката." onRetry={vi.fn()} />);
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("opens a native modal and restores focus after recovery", async () => {
    const view = (lost: boolean) => <>
      <button>Към текущата фаза</button>
      {lost ? <ReconnectModal status="lost" message="Връзката прекъсна." onRetry={vi.fn()} /> : null}
    </>;
    const { rerender } = render(view(false));
    const sheetButton = screen.getByRole("button", { name: "Към текущата фаза" });
    sheetButton.focus();
    rerender(view(true));
    const retry = screen.getByRole("button", { name: "Опитай пак" });
    await waitFor(() => expect(retry).toHaveFocus());
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Връзката е прекъсната" })).toBeInTheDocument();
    rerender(view(false));
    await waitFor(() => expect(sheetButton).toHaveFocus());
  });
});
