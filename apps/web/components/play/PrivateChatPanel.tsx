import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { MAX_CHAT_MESSAGE_LENGTH, type ChatChannel } from "@werewolf/shared";
import { TypingIndicator } from "@/components/play/TypingIndicator";
import { privateChannelBg } from "@/lib/play/copy";
import type { PrivateChatMessage, TypingNotice } from "@/lib/play/types";

export interface PrivateChatScrollPosition {
  scrollTop: number;
  followLatest: boolean;
}

export function PrivateChatPanel({
  channel,
  messages,
  onSend,
  onTyping,
  typingNotices,
  value: controlledValue,
  onValueChange,
  onAccepted,
  sending = false,
  active = true,
  initialScrollPosition,
  onScrollPositionChange,
  onRead,
}: {
  channel: ChatChannel;
  messages: PrivateChatMessage[];
  onSend: (channel: ChatChannel, message: string) => Promise<boolean>;
  onTyping: (channel: ChatChannel, active: boolean) => void;
  typingNotices: TypingNotice[];
  value?: string;
  onValueChange?: (value: string) => void;
  onAccepted?: (submittedValue: string) => void;
  sending?: boolean;
  active?: boolean;
  initialScrollPosition?: PrivateChatScrollPosition | undefined;
  onScrollPositionChange?: (position: PrivateChatScrollPosition) => void;
  onRead?: (messageId: string) => void;
}) {
  const [localValue, setLocalValue] = useState("");
  const value = controlledValue ?? localValue;
  const [isSending, setIsSending] = useState(false);
  const sendPending = sending || isSending;
  const draftRevisionRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const channelLabelId = useId();
  const typingActiveRef = useRef(false);
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;
  const logRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef({
    channel,
    restored: false,
    position: initialScrollPosition ?? { scrollTop: 0, followLatest: true },
  });
  const readingCallbacksRef = useRef({ onRead, onScrollPositionChange, initialScrollPosition });
  readingCallbacksRef.current = { onRead, onScrollPositionChange, initialScrollPosition };

  useLayoutEffect(() => {
    if (scrollPositionRef.current.channel !== channel) {
      scrollPositionRef.current = {
        channel,
        restored: false,
        position: readingCallbacksRef.current.initialScrollPosition ?? { scrollTop: 0, followLatest: true },
      };
    }
    const log = logRef.current;
    if (!active || !log) {
      scrollPositionRef.current.restored = false;
      return;
    }
    const scroll = scrollPositionRef.current;
    const savePosition = () => {
      scroll.position = { ...scroll.position, scrollTop: log.scrollTop };
      readingCallbacksRef.current.onScrollPositionChange?.(scroll.position);
    };
    const isVisible = () => document.visibilityState === "visible"
      && !log.closest("details:not([open])") && log.clientHeight > 0;
    const syncReading = (follow = true) => {
      if (!isVisible()) return;
      const bounds = log.getBoundingClientRect();
      const top = Math.max(0, bounds.top + log.clientTop);
      const bottom = Math.min(window.innerHeight, bounds.top + log.clientTop + log.clientHeight);
      if (bottom <= top || bounds.right <= 0 || bounds.left >= window.innerWidth) return;

      if (!scroll.restored) {
        log.scrollTop = scroll.position.scrollTop;
        scroll.restored = true;
      }
      if (follow && scroll.position.followLatest) log.scrollTop = log.scrollHeight;
      savePosition();

      // The viewport can clip the log even when its internal scrollbar is at the end.
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = log.children[index];
        if (!message) continue;
        const rect = message.getBoundingClientRect();
        const startVisible = rect.top >= top - 1 || rect.height > log.clientHeight;
        if (rect.height > 0 && startVisible && rect.bottom > top && rect.bottom <= bottom + 1) {
          readingCallbacksRef.current.onRead?.(messages[index]!.id);
          break;
        }
      }
    };
    const onScroll = (event: Event) => {
      if (event.target === log && isVisible() && scroll.restored) {
        scroll.position = {
          scrollTop: log.scrollTop,
          followLatest: log.scrollHeight - log.clientHeight - log.scrollTop <= 32,
        };
        syncReading(false);
      } else {
        syncReading();
      }
    };
    const onVisibilityChange = () => syncReading();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onVisibilityChange);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onVisibilityChange);
    resizeObserver?.observe(log);
    const intersectionObserver = typeof IntersectionObserver === "undefined"
      ? null : new IntersectionObserver(onVisibilityChange, { threshold: [0, 1] });
    intersectionObserver?.observe(log);
    syncReading();
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onVisibilityChange);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [active, channel, messages]);

  const setValue = (nextValue: string) => {
    draftRevisionRef.current += 1;
    valueRef.current = nextValue;
    if (controlledValue === undefined) {
      setLocalValue(nextValue);
    }
    onValueChange?.(nextValue);
  };

  useEffect(() => {
    const activeChannel = channel;
    return () => {
      draftRevisionRef.current += 1;
      if (typingActiveRef.current) {
        onTypingRef.current(activeChannel, false);
        typingActiveRef.current = false;
      }
    };
  }, [channel]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = value.trim();
    if (!message || sendPending) {
      return;
    }
    const submittedRevision = draftRevisionRef.current;
    setIsSending(true);
    let accepted: boolean;
    try {
      accepted = await onSend(channel, message);
    } catch {
      return;
    } finally {
      setIsSending(false);
    }
    if (!accepted) {
      return;
    }
    if (onAccepted) {
      onAccepted(value);
      return;
    }
    if (draftRevisionRef.current !== submittedRevision || valueRef.current !== value) {
      return;
    }
    typingActiveRef.current = false;
    onTyping(channel, false);
    setValue("");
  };

  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <h2 className="font-black" id={channelLabelId}>{privateChannelBg(channel)}</h2>
      <div className="mt-4 grid gap-2 text-sm">
        <div
          ref={logRef}
          className="grid gap-2"
          role="log"
          tabIndex={0}
          aria-labelledby={channelLabelId}
          aria-live="polite"
          aria-relevant="additions"
          aria-atomic="false"
        >
          {messages.map((message) => (
            <p key={message.id} className="rounded-xl bg-[#f4e8d1]/10 px-3 py-2">
              <strong>{message.senderName}:</strong> {message.message}
            </p>
          ))}
        </div>
        <TypingIndicator notices={typingNotices} compact />
      </div>
      <form className="mt-4 flex gap-2" onSubmit={submit} aria-busy={sendPending}>
        <input
          className="input w-full"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH);
            const active = nextValue.trim().length > 0;
            setValue(nextValue);
            typingActiveRef.current = active;
            onTyping(channel, active);
          }}
          aria-label="Съобщение за таен канал"
          placeholder="Съобщение само за този канал..."
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
        />
        <button className="btn btn-primary" type="submit" disabled={value.trim().length === 0 || sendPending}>
          {sendPending ? "Изпращаме..." : "Изпрати"}
        </button>
      </form>
    </section>
  );
}
