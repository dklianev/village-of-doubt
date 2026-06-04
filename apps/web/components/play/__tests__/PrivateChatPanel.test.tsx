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
        value=""
        setValue={vi.fn()}
        sendPrivateChat={vi.fn()}
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
    const setValue = vi.fn();
    const sendPrivateChat = vi.fn();

    render(
      <PrivateChatPanel
        channel="mafia"
        messages={[]}
        value=""
        setValue={setValue}
        sendPrivateChat={sendPrivateChat}
        typingNotices={[]}
      />,
    );

    await user.type(screen.getByPlaceholderText("Съобщение само за този канал..."), "тук сме");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(setValue).toHaveBeenCalled();
    expect(sendPrivateChat).toHaveBeenCalledWith("mafia");
  });
});
