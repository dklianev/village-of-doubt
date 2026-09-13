import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicChatComposer } from "@/components/play/PublicChatComposer";

describe("PublicChatComposer", () => {
  it("keeps draft state locally and submits trimmed Bulgarian chat copy", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(true);
    const onTyping = vi.fn();
    render(
      <PublicChatComposer
        inputId="public-chat"
        typingNotices={[]}
        onSend={onSend}
        onTyping={onTyping}
      />,
    );

    const input = screen.getByLabelText("Съобщение в дневния разговор");
    await user.type(input, "  Имам подозрение.  ");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(onTyping).toHaveBeenCalledWith(true);
    expect(onTyping).toHaveBeenLastCalledWith(false);
    expect(onSend).toHaveBeenCalledWith("Имам подозрение.");
    expect(input).toHaveValue("");
  });

  it("keeps the draft when the room does not acknowledge the message", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(false);
    render(
      <PublicChatComposer
        inputId="public-chat"
        typingNotices={[]}
        onSend={onSend}
        onTyping={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Съобщение в дневния разговор");
    await user.type(input, "Не губи тази реплика");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(input).toHaveValue("Не губи тази реплика");
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

    await user.type(screen.getByLabelText("Съобщение в дневния разговор"), "Пиша");
    unmount();

    expect(onTyping).toHaveBeenLastCalledWith(false);
  });

  it.each(["message B", " message A ", "message A"])(
    "preserves a newly edited draft %j when the previous message is acknowledged",
    async (nextDraft) => {
      let accept!: (accepted: boolean) => void;
      const response = new Promise<boolean>((resolve) => { accept = resolve; });
      const onSend = vi.fn(() => response);
      const onTyping = vi.fn();
      render(
        <PublicChatComposer inputId="public-chat" typingNotices={[]} onSend={onSend} onTyping={onTyping} />,
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "message A" } });
      fireEvent.click(screen.getByRole("button"));
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.change(input, { target: { value: nextDraft } });
      expect(screen.getByRole("button")).toBeDisabled();
      fireEvent.submit(input.closest("form")!);
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith("message A");

      await act(async () => { accept(true); await response; });

      expect(input).toHaveValue(nextDraft);
      expect(onTyping).toHaveBeenLastCalledWith(true);
      expect(screen.getByRole("button")).toBeEnabled();
    },
  );

  it("preserves the draft and permits retry after a rejected send promise", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    render(
      <PublicChatComposer inputId="public-chat" typingNotices={[]} onSend={onSend} onTyping={vi.fn()} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "  retry this  ");
    await user.keyboard("{Enter}");

    expect(input).toHaveValue("  retry this  ");
    expect(screen.getByRole("button", { name: "Изпрати" })).toBeEnabled();
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenNthCalledWith(2, "retry this");
    expect(input).toHaveValue("");
  });

  it("does not send whitespace-only drafts or announce them as typing", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onTyping = vi.fn();
    render(
      <PublicChatComposer inputId="public-chat" typingNotices={[]} onSend={onSend} onTyping={onTyping} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "   {Enter}");
    fireEvent.submit(input.closest("form")!);

    expect(input).toHaveValue("   ");
    expect(screen.getByRole("button")).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
    expect(onTyping).not.toHaveBeenCalledWith(true);
  });

  it("does not send another typing update when an acknowledgement arrives after unmount", async () => {
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    const onTyping = vi.fn();
    const { unmount } = render(
      <PublicChatComposer inputId="public-chat" typingNotices={[]} onSend={() => response} onTyping={onTyping} />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "message A" } });
    fireEvent.click(screen.getByRole("button"));
    unmount();
    onTyping.mockClear();
    await act(async () => { accept(true); await response; });

    expect(onTyping).not.toHaveBeenCalled();
  });
});
