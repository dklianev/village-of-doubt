import { useState, type ComponentProps } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivateChatPanel } from "@/components/play/PrivateChatPanel";
import type { PrivateChatMessage, TypingNotice } from "@/lib/play/types";

function message(index: number): PrivateChatMessage {
  return {
    id: `message-${index}`,
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

function ControlledPrivateChat({
  onSend,
  onTyping = vi.fn(),
  sending = false,
}: Pick<ComponentProps<typeof PrivateChatPanel>, "onSend"> & Partial<Pick<ComponentProps<typeof PrivateChatPanel>, "onTyping" | "sending">>) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen((current) => !current)}>Toggle panel</button>
      {open ? (
        <PrivateChatPanel
          channel="mafia"
          messages={[]}
          typingNotices={[]}
          onSend={onSend}
          onTyping={onTyping}
          sending={sending}
          value={draft}
          onValueChange={setDraft}
        />
      ) : null}
    </>
  );
}

describe("PrivateChatPanel", () => {
  it("shows all supplied private messages, including more than six, and typing state", () => {
    render(
      <PrivateChatPanel
        channel="mafia"
        messages={[1, 2, 3, 4, 5, 6, 7].map(message)}
        onSend={vi.fn()}
        onTyping={vi.fn()}
        typingNotices={typingNotices}
      />,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "разговор на Мафията" });
    expect(screen.getByRole("log", { name: "разговор на Мафията" })).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.queryByRole("heading", { name: "Таен канал" })).not.toBeInTheDocument();
    expect(screen.getByText(/тайно съобщение 1/)).toBeInTheDocument();
    expect(screen.getByText(/тайно съобщение 7/)).toBeInTheDocument();
    expect(within(screen.getByRole("log")).getAllByText(/тайно съобщение/)).toHaveLength(7);
    expect(screen.getByText("Борис пише...")).toBeInTheDocument();
  });

  it.each([false, true])("delegates accepted sends to the parent with the original draft (unmounted: %s)", async (unmounted) => {
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    const onAccepted = vi.fn();
    const onValueChange = vi.fn();
    const onTyping = vi.fn();
    const onSend = vi.fn(() => response);
    const { unmount } = render(
      <PrivateChatPanel
        channel="mafia"
        messages={[]}
        typingNotices={[]}
        value="  pending message  "
        onValueChange={onValueChange}
        onSend={onSend}
        onTyping={onTyping}
        onAccepted={onAccepted}
      />,
    );

    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(onSend).toHaveBeenCalledExactlyOnceWith("mafia", "pending message");
    expect(onAccepted).not.toHaveBeenCalled();
    if (unmounted) unmount();
    await act(async () => { accept(true); await response; });

    expect(onAccepted).toHaveBeenCalledExactlyOnceWith("  pending message  ");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onTyping).not.toHaveBeenCalled();
    if (!unmounted) expect(screen.getByRole("textbox")).toHaveValue("  pending message  ");
  });

  it("delivers acceptance to the submission's callback after the draft and channel change", async () => {
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    const originalOwner = vi.fn();
    const nextOwner = vi.fn();
    const props = {
      messages: [],
      typingNotices: [],
      onSend: () => response,
      onTyping: vi.fn(),
      onValueChange: vi.fn(),
    };
    const { rerender } = render(<PrivateChatPanel {...props} channel="mafia" value="message A" onAccepted={originalOwner} />);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    rerender(<PrivateChatPanel {...props} channel="werewolves" value="message B" onAccepted={nextOwner} />);
    await act(async () => { accept(true); await response; });

    expect(originalOwner).toHaveBeenCalledExactlyOnceWith("message A");
    expect(nextOwner).not.toHaveBeenCalled();
    expect(props.onValueChange).not.toHaveBeenCalled();
    expect(props.onTyping).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("message B");
  });

  it.each(["declined", "rejected"] as const)("does not notify acceptance for a %s send", async (outcome) => {
    const onAccepted = vi.fn();
    const onValueChange = vi.fn();
    const onTyping = vi.fn();
    const onSend = outcome === "declined"
      ? vi.fn().mockResolvedValue(false)
      : vi.fn().mockRejectedValue(new Error("offline"));
    render(
      <PrivateChatPanel
        channel="mafia"
        messages={[]}
        typingNotices={[]}
        value="keep this draft"
        onValueChange={onValueChange}
        onSend={onSend}
        onTyping={onTyping}
        onAccepted={onAccepted}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(onAccepted).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onTyping).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("keep this draft");
    expect(screen.getByRole("button", { name: "Изпрати" })).toBeEnabled();
  });

  it("updates input value and submits the selected private channel", async () => {
    const user = userEvent.setup();
    const onTyping = vi.fn();
    const onSend = vi.fn().mockResolvedValue(true);

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
    expect(screen.getByRole("textbox", { name: "Съобщение за таен канал" })).toHaveValue("");
  });

  it("keeps a private draft until the server accepts it", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(false);
    render(
      <PrivateChatPanel
        channel="mafia"
        messages={[]}
        onSend={onSend}
        onTyping={vi.fn()}
        typingNotices={[]}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Съобщение за таен канал" });
    await user.type(input, "Пази плана");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(input).toHaveValue("Пази плана");
  });

  it("clears a live private typing signal when the panel unmounts", async () => {
    const user = userEvent.setup();
    const onTyping = vi.fn();
    const { unmount } = render(
      <PrivateChatPanel
        channel="mafia"
        messages={[]}
        onSend={vi.fn()}
        onTyping={onTyping}
        typingNotices={[]}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Съобщение за таен канал" }), "Пиша");
    unmount();

    expect(onTyping).toHaveBeenLastCalledWith("mafia", false);
  });

  it.each([false, true])("preserves edits while a previous private message is pending (controlled: %s)", async (controlled) => {
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    const onSend = vi.fn(() => response);
    const onTyping = vi.fn();
    render(controlled ? (
      <ControlledPrivateChat onSend={onSend} onTyping={onTyping} />
    ) : (
      <PrivateChatPanel channel="mafia" messages={[]} typingNotices={[]} onSend={onSend} onTyping={onTyping} />
    ));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "message A" } });
    fireEvent.click(screen.getByRole("button", { name: "Изпрати" }));
    fireEvent.change(input, { target: { value: "message B" } });
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    expect(onSend).toHaveBeenCalledTimes(1);

    await act(async () => { accept(true); await response; });

    expect(input).toHaveValue("message B");
    expect(onTyping).toHaveBeenLastCalledWith("mafia", true);
    expect(screen.getByRole("button", { name: "Изпрати" })).toBeEnabled();
  });

  it("preserves a retyped identical draft when the earlier copy is acknowledged", async () => {
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    render(
      <PrivateChatPanel channel="mafia" messages={[]} typingNotices={[]} onSend={() => response} onTyping={vi.fn()} />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "message A" } });
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "message A" } });
    await act(async () => { accept(true); await response; });

    expect(input).toHaveValue("message A");
  });

  it("preserves a controlled draft changed by the parent while an acknowledgement is pending", async () => {
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    const onValueChange = vi.fn();
    const props = {
      channel: "mafia" as const,
      messages: [],
      typingNotices: [],
      onSend: () => response,
      onTyping: vi.fn(),
      onValueChange,
    };
    const { rerender } = render(<PrivateChatPanel {...props} value="message A" />);

    fireEvent.click(screen.getByRole("button"));
    rerender(<PrivateChatPanel {...props} value="message B" />);
    await act(async () => { accept(true); await response; });

    expect(screen.getByRole("textbox")).toHaveValue("message B");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(props.onTyping).not.toHaveBeenCalled();
  });

  it("does not clear another channel's controlled draft after a pending acknowledgement", async () => {
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    const onValueChange = vi.fn();
    const props = {
      messages: [],
      typingNotices: [],
      value: "same draft text",
      onSend: vi.fn(() => response),
      onTyping: vi.fn(),
      onValueChange,
    };
    const { rerender } = render(<PrivateChatPanel {...props} channel="mafia" />);

    fireEvent.click(screen.getByRole("button"));
    rerender(<PrivateChatPanel {...props} channel="werewolves" />);
    await act(async () => { accept(true); await response; });

    expect(props.onSend).toHaveBeenCalledExactlyOnceWith("mafia", "same draft text");
    expect(screen.getByRole("textbox")).toHaveValue("same draft text");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(props.onTyping).not.toHaveBeenCalled();
  });

  it("submits a trimmed private message with Enter through its form", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(true);
    render(
      <PrivateChatPanel channel="mafia" messages={[]} typingNotices={[]} onSend={onSend} onTyping={vi.fn()} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "  private message  {Enter}");

    expect(onSend).toHaveBeenCalledExactlyOnceWith("mafia", "private message");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("keeps a controlled draft when the panel is closed and reopened", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(true);
    render(<ControlledPrivateChat onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "keep this private draft");
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));

    expect(screen.getByRole("textbox")).toHaveValue("keep this private draft");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("blocks duplicate sends after remount until the parent's pending flag clears", async () => {
    let resolve!: (accepted: boolean) => void;
    const response = new Promise<boolean>((settle) => { resolve = settle; });
    const onSend = vi.fn(() => response);
    const { rerender } = render(<ControlledPrivateChat onSend={onSend} sending={false} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "pending message" } });
    fireEvent.click(screen.getByRole("button", { name: "Изпрати" }));
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    expect(onSend).toHaveBeenCalledExactlyOnceWith("mafia", "pending message");
    rerender(<ControlledPrivateChat onSend={onSend} sending />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle panel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle panel" }));

    const input = screen.getByRole("textbox");
    const form = input.closest("form")!;
    expect(input).toHaveValue("pending message");
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    expect(form).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(form);
    expect(onSend).toHaveBeenCalledTimes(1);

    await act(async () => { resolve(false); await response; });
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    rerender(<ControlledPrivateChat onSend={onSend} sending={false} />);
    expect(screen.getByRole("button", { name: "Изпрати" })).toBeEnabled();
    expect(form).toHaveAttribute("aria-busy", "false");
    await act(async () => { fireEvent.submit(form); });
    expect(onSend).toHaveBeenNthCalledWith(2, "mafia", "pending message");
  });

  it("does not let an unmounted panel's acknowledgement erase a reopened controlled draft", async () => {
    const user = userEvent.setup();
    let accept!: (accepted: boolean) => void;
    const response = new Promise<boolean>((resolve) => { accept = resolve; });
    render(<ControlledPrivateChat onSend={() => response} />);

    await user.type(screen.getByRole("textbox"), "message A");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));
    expect(screen.getByRole("textbox")).toHaveValue("message A");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "message B" } });
    await act(async () => { accept(true); await response; });

    expect(screen.getByRole("textbox")).toHaveValue("message B");
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));
    await user.click(screen.getByRole("button", { name: "Toggle panel" }));
    expect(screen.getByRole("textbox")).toHaveValue("message B");
  });

  it("preserves a private draft and permits retry after a rejected send promise", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    render(<ControlledPrivateChat onSend={onSend} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "  private retry  ");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    expect(input).toHaveValue("  private retry  ");
    expect(screen.getByRole("button", { name: "Изпрати" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Изпрати" }));
    expect(onSend).toHaveBeenNthCalledWith(2, "mafia", "private retry");
    expect(input).toHaveValue("");
  });

  it("does not send whitespace-only private drafts or announce them as typing", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onTyping = vi.fn();
    render(
      <PrivateChatPanel channel="mafia" messages={[]} typingNotices={[]} onSend={onSend} onTyping={onTyping} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "   {Enter}");
    fireEvent.submit(input.closest("form")!);

    expect(input).toHaveValue("   ");
    expect(screen.getByRole("button")).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
    expect(onTyping).not.toHaveBeenCalledWith("mafia", true);
  });

  it("exposes new private messages as additions to a named non-atomic live log", () => {
    const props = { channel: "mafia" as const, onSend: vi.fn(), onTyping: vi.fn(), typingNotices };
    const { rerender } = render(<PrivateChatPanel {...props} messages={[message(1)]} />);

    const log = screen.getByRole("log", { name: /разговор на Мафията/ });
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-relevant", "additions");
    expect(log).toHaveAttribute("aria-atomic", "false");
    expect(within(log).queryByText("Борис пише...")).not.toBeInTheDocument();
    rerender(<PrivateChatPanel {...props} messages={[message(1), message(2)]} />);

    expect(within(log).getByText(/тайно съобщение 2/)).toBeInTheDocument();
    expect(within(log).queryByRole("textbox")).not.toBeInTheDocument();
  });
});
