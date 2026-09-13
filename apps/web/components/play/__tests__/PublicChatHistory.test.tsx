import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PublicChatHistory } from "@/components/play/PublicChatHistory";

const messages = Array.from({ length: 7 }, (_, index) => ({
  id: String(index), channel: "public", senderName: "Рада", message: `Реплика ${index + 1}`,
}));

describe("PublicChatHistory", () => {
  it("expands the five-message preview and collapses it with keyboard focus retained", async () => {
    const user = userEvent.setup();
    render(<PublicChatHistory messages={messages} />);
    expect(screen.queryByText("Реплика 1")).not.toBeInTheDocument();
    expect(screen.getByText("Реплика 7")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Виж разговора/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("log")).getByText("Реплика 1")).toBeInTheDocument();
    expect(toggle).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.queryByText("Реплика 1")).not.toBeInTheDocument();
  });

  it("shows only the current server buffer after it is capped or replaced", async () => {
    const { rerender } = render(<PublicChatHistory messages={messages} />);
    await userEvent.click(screen.getByRole("button", { name: /Виж разговора/ }));
    rerender(<PublicChatHistory messages={messages.slice(2)} />);
    expect(screen.queryByText("Реплика 1")).not.toBeInTheDocument();
    expect(screen.getByText("Реплика 3")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps empty and short conversations free of a redundant expansion action", () => {
    render(<PublicChatHistory messages={[]} />);
    expect(screen.getByRole("log")).toHaveTextContent("Още няма публични реплики.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
