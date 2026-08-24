"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CHAT_MESSAGE_LENGTH, type ChatChannel } from "@werewolf/shared";
import { TypingIndicator } from "@/components/play/TypingIndicator";
import { privateChannelBg } from "@/lib/play/copy";
import type { PrivateChatMessage, TypingNotice } from "@/lib/play/types";

export function PrivateChatPanel({
  channel,
  messages,
  onSend,
  onTyping,
  typingNotices,
}: {
  channel: ChatChannel;
  messages: PrivateChatMessage[];
  onSend: (channel: ChatChannel, message: string) => void;
  onTyping: (channel: ChatChannel, active: boolean) => void;
  typingNotices: TypingNotice[];
}) {
  const [value, setValue] = useState("");
  const typingActiveRef = useRef(false);
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;

  useEffect(() => {
    const activeChannel = channel;
    return () => {
      if (typingActiveRef.current) {
        onTypingRef.current(activeChannel, false);
        typingActiveRef.current = false;
      }
    };
  }, [channel]);

  const submit = () => {
    const message = value.trim();
    if (!message) {
      return;
    }
    onSend(channel, message);
    typingActiveRef.current = false;
    onTyping(channel, false);
    setValue("");
  };

  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">{privateChannelBg(channel)}</p>
      <h2 className="mt-2 text-3xl font-black">Таен канал</h2>
      <div className="mt-4 grid gap-2 text-sm">
        {messages.slice(-6).map((message) => (
          <p key={message.id} className="rounded-xl bg-[#f4e8d1]/10 px-3 py-2">
            <strong>{message.senderName}:</strong> {message.message}
          </p>
        ))}
        <TypingIndicator notices={typingNotices} compact />
      </div>
      <div className="mt-4 flex gap-2">
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
        <button className="btn btn-primary" type="button" onClick={submit} disabled={value.trim().length === 0}>
          Изпрати
        </button>
      </div>
    </section>
  );
}
