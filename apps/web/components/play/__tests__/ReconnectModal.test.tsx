import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReconnectModal } from "@/components/play/ReconnectModal";

describe("ReconnectModal", () => {
  it("keeps the retry action disabled while reconnecting", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ReconnectModal
        status="reconnecting"
        message="Връзката се връща автоматично."
        onRetry={onRetry}
      />,
    );

    const retry = screen.getByRole("button", { name: "Опитваме..." });
    expect(screen.getByRole("dialog", { name: "Връщаме те обратно" })).toBeInTheDocument();
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute("aria-busy", "true");

    await user.click(retry);

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

    expect(screen.getByRole("dialog", { name: "Не успяхме да се върнем автоматично" })).toHaveTextContent(
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
});
