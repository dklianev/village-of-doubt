import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicChatComposer } from "@/components/play/PublicChatComposer";

describe("PublicChatComposer", () => {
  it("keeps draft state locally and submits trimmed Bulgarian chat copy", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onTyping = vi.fn();
    render(
      <PublicChatComposer
        inputId="public-chat"
        typingNotices={[]}
        onSend={onSend}
        onTyping={onTyping}
      />,
    );

    const input = screen.getByLabelText("Съобщение в дневния чат");
    await user.type(input, "  Имам подозрение.  ");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(onTyping).toHaveBeenCalledWith(true);
    expect(onTyping).toHaveBeenLastCalledWith(false);
    expect(onSend).toHaveBeenCalledWith("Имам подозрение.");
    expect(input).toHaveValue("");
  });

  it("clears a live typing signal when the composer unmounts", async () => {
    const user = userEvent.setup();
    const onTyping = vi.fn();
    const { unmount } = render(
      <PublicChatComposer
        inputId="public-chat"
        typingNotices={[]}
        onSend={vi.fn()}
        onTyping={onTyping}
      />,
    );

    await user.type(screen.getByLabelText("Съобщение в дневния чат"), "Пиша");
    unmount();

    expect(onTyping).toHaveBeenLastCalledWith(false);
  });
});
