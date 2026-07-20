import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivateChatPanel } from "@/components/play/PrivateChatPanel";
import type { PrivateChatMessage, TypingNotice } from "@/lib/play/types";

function message(index: number): PrivateChatMessage {
  return {
    channel: "mafia",
    senderUserId: `u${index}`,
    senderName: `Играч ${index}`,
    message: `тайно съобщение ${index}`,
    createdAt: index,
  };
}

const typingNotices: TypingNotice[] = [
  {
    channel: "mafia",
    senderUserId: "u2",
    senderName: "Борис",
    active: true,
    createdAt: 10,
  },
];

describe("PrivateChatPanel", () => {
  it("shows only the latest six private messages and typing state", () => {
    render(
      <PrivateChatPanel
        channel="mafia"
        messages={[1, 2, 3, 4, 5, 6, 7].map(message)}
        onSend={vi.fn()}
        onTyping={vi.fn()}
        typingNotices={typingNotices}
      />,
    );

    expect(screen.getByText("чат на Мафията")).toBeInTheDocument();
    expect(screen.queryByText(/тайно съобщение 1/)).not.toBeInTheDocument();
    expect(screen.getByText(/тайно съобщение 7/)).toBeInTheDocument();
    expect(screen.getByText("Борис пише...")).toBeInTheDocument();
  });

  it("updates input value and submits the selected private channel", async () => {
    const user = userEvent.setup();
    const onTyping = vi.fn();
    const onSend = vi.fn();

    render(
      <PrivateChatPanel
        channel="mafia"
        messages={[]}
        onSend={onSend}
        onTyping={onTyping}
        typingNotices={[]}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Съобщение за таен канал" }), "тук сме");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(onTyping).toHaveBeenCalledWith("mafia", true);
    expect(onTyping).toHaveBeenLastCalledWith("mafia", false);
    expect(onSend).toHaveBeenCalledWith("mafia", "тук сме");
  });
});
