import { useState, type ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateChatPanel, type PrivateChatScrollPosition } from "@/components/play/PrivateChatPanel";
import type { PrivateChatMessage } from "@/lib/play/types";

function messages(count: number, channel: PrivateChatMessage["channel"] = "mafia"): PrivateChatMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${channel}-${index + 1}`, channel, senderUserId: "other", senderName: "Player",
    message: `Message ${index + 1}`, createdAt: index,
  }));
}

// JSDOM has no layout: model a 240px log with 60px messages and real scroll clamping.
function mockLogLayout() {
  let logTop = 100;
  const offsets = new WeakMap<Element, number>();
  const isLog = (element: Element) => element.getAttribute("role") === "log";
  vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(function (this: Element) {
    return isLog(this) ? Math.min(240, this.children.length * 60) : 0;
  });
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
    return isLog(this) ? this.children.length * 60 : 0;
  });
  vi.spyOn(Element.prototype, "scrollTop", "get").mockImplementation(function (this: Element) {
    return offsets.get(this) ?? 0;
  });
  vi.spyOn(Element.prototype, "scrollTop", "set").mockImplementation(function (this: Element, value: number) {
    offsets.set(this, Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)));
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (isLog(this)) return new DOMRect(100, logTop, 400, this.clientHeight);
    const log = this.parentElement;
    if (log && isLog(log)) {
      const index = Array.from(log.children).indexOf(this);
      return new DOMRect(100, logTop + index * 60 - log.scrollTop, 400, 60);
    }
    return new DOMRect();
  });
  return { moveLog: (top: number) => { logTop = top; fireEvent.scroll(document); } };
}

describe("PrivateChatPanel reading", () => {
  let layout: ReturnType<typeof mockLogLayout>;
  beforeEach(() => { layout = mockLogLayout(); });

  function mount(overrides: Partial<ComponentProps<typeof PrivateChatPanel>> = {}) {
    const props = {
      channel: "mafia" as const, messages: messages(8), typingNotices: [],
      onSend: vi.fn().mockResolvedValue(true), onTyping: vi.fn(), onRead: vi.fn(),
      ...overrides,
    };
    const result = render(<PrivateChatPanel {...props} />);
    return {
      ...result, onRead: props.onRead!, log: screen.getByRole("log"),
      update: (next: Partial<ComponentProps<typeof PrivateChatPanel>>) => {
        Object.assign(props, next);
        result.rerender(<PrivateChatPanel {...props} />);
      },
    };
  }

  it("opens at the latest messages and follows arrivals when already near the bottom", () => {
    const chat = mount();
    expect(chat.log.scrollTop).toBe(240);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-8");
    chat.log.scrollTop = 220;
    fireEvent.scroll(chat.log);
    expect(chat.log.scrollTop).toBe(220);
    chat.update({ messages: messages(9) });
    expect(chat.log.scrollTop).toBe(300);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-9");
  });

  it("settles when read reports update parent state, including repeated reports of the same message", () => {
    const reports = vi.fn();
    const onSend = vi.fn().mockResolvedValue(true);
    const onTyping = vi.fn();
    function Reader({ items }: { items: PrivateChatMessage[] }) {
      const [read, setRead] = useState<string | null>(null);
      return <>
        <output aria-label="Last read">{read}</output>
        <PrivateChatPanel
          channel="mafia" messages={items} typingNotices={[]} onSend={onSend} onTyping={onTyping}
          onRead={(id) => { reports(id); setRead(id); }}
        />
      </>;
    }
    const { rerender } = render(<Reader items={messages(8)} />);
    expect(screen.getByLabelText("Last read")).toHaveTextContent("mafia-8");
    expect(reports).toHaveBeenCalledTimes(1);
    fireEvent.scroll(screen.getByRole("log"));
    fireEvent(window, new Event("resize"));
    expect(reports).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText("Last read")).toHaveTextContent("mafia-8");
    rerender(<Reader items={messages(9)} />);
    expect(reports).toHaveBeenCalledTimes(4);
    expect(screen.getByLabelText("Last read")).toHaveTextContent("mafia-9");
  });

  it("reports only visible messages and keeps the reading position when more messages arrive", () => {
    const chat = mount({ initialScrollPosition: { scrollTop: 0, followLatest: false } });
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-4");
    chat.update({ messages: messages(10) });
    expect(chat.log.scrollTop).toBe(0);
    expect(chat.onRead).not.toHaveBeenCalledWith("mafia-10");
    chat.log.scrollTop = 120;
    fireEvent.scroll(chat.log);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-6");
    chat.log.scrollTop = 360;
    fireEvent.scroll(chat.log);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-10");
  });

  it.each([false, true])("does not read or scroll a hidden document (following: %s)", (followLatest) => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const chat = mount({ initialScrollPosition: { scrollTop: 0, followLatest } });
    chat.update({ messages: messages(10) });
    fireEvent.scroll(chat.log);
    expect(chat.log.scrollTop).toBe(0);
    expect(chat.onRead).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(chat.log.scrollTop).toBe(followLatest ? 360 : 0);
    expect(chat.onRead).toHaveBeenLastCalledWith(followLatest ? "mafia-10" : "mafia-4");
  });

  it("retains older reading across a background-tab arrival and return", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const chat = mount();
    chat.log.scrollTop = 60;
    fireEvent.scroll(chat.log);
    vi.mocked(chat.onRead).mockClear();
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    chat.update({ messages: messages(10) });
    expect(chat.onRead).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(chat.log.scrollTop).toBe(60);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-5");
  });

  it("does not treat an offscreen or partially clipped log as fully read", () => {
    layout.moveLog(window.innerHeight + 10);
    const chat = mount();
    expect(chat.onRead).not.toHaveBeenCalled();
    layout.moveLog(window.innerHeight - 100);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-5");
    expect(chat.onRead).not.toHaveBeenCalledWith("mafia-8");
    layout.moveLog(100);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-8");
  });

  it("preserves older reading while closed or in another mobile pane, including remount", () => {
    let saved: PrivateChatScrollPosition | undefined;
    const chat = mount({ onScrollPositionChange: (position) => { saved = position; } });
    chat.log.scrollTop = 60;
    fireEvent.scroll(chat.log);
    chat.update({ active: false });
    vi.mocked(chat.onRead).mockClear();
    chat.update({ messages: messages(10) });
    chat.log.scrollTop = 0;
    fireEvent.scroll(chat.log);
    expect(chat.onRead).not.toHaveBeenCalled();
    chat.update({ active: true });
    expect(chat.log.scrollTop).toBe(60);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-5");
    chat.unmount();
    const reopened = mount({ messages: messages(11), initialScrollPosition: saved });
    expect(reopened.log.scrollTop).toBe(60);
    expect(reopened.onRead).toHaveBeenLastCalledWith("mafia-5");
  });

  it("restores the selected channel without carrying another channel's position or read ID", () => {
    const chat = mount();
    chat.log.scrollTop = 60;
    fireEvent.scroll(chat.log);
    chat.update({ channel: "werewolves", messages: messages(10, "werewolves") });
    expect(chat.log.scrollTop).toBe(360);
    expect(chat.onRead).toHaveBeenLastCalledWith("werewolves-10");
    chat.update({ channel: "mafia", messages: messages(9), initialScrollPosition: { scrollTop: 60, followLatest: false } });
    expect(chat.log.scrollTop).toBe(60);
    expect(chat.onRead).toHaveBeenLastCalledWith("mafia-5");
  });
});
