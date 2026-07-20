"use client";

import { useState, type FormEvent } from "react";
import { MessageSquare } from "lucide-react";
import { TypingIndicator } from "@/components/play/TypingIndicator";
import type { TypingNotice } from "@/lib/play/types";

export function PublicChatComposer({
  inputId,
  typingNotices,
  onSend,
  onTyping,
}: {
  inputId: string;
  typingNotices: TypingNotice[];
  onSend: (message: string) => void;
  onTyping: (active: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const counterId = `${inputId}-counter`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = value.trim();
    if (!message) {
      return;
    }
    onSend(message);
    onTyping(false);
    setValue("");
  };

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <h3 className="play-panel-subhead">
        <MessageSquare className="play-section-icon" aria-hidden strokeWidth={1.8} />
        <span>Дневен чат</span>
      </h3>
      <div className="grid gap-1">
        <label className="sr-only" htmlFor={inputId}>Съобщение в дневния чат</label>
        <input
          id={inputId}
          className="input"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value.slice(0, 500);
            setValue(nextValue);
            onTyping(nextValue.trim().length > 0);
          }}
          placeholder="Напиши обвинение, защита или блъф..."
          maxLength={500}
          aria-describedby={counterId}
        />
        <span
          id={counterId}
          className={`text-right text-xs ${value.length >= 480 ? "text-[#c18a38]" : "text-[#ead9ba]/60"}`}
        >
          {value.length}/500
        </span>
      </div>
      <TypingIndicator notices={typingNotices} />
      <button className="btn btn-primary" type="submit" disabled={value.trim().length === 0}>
        <MessageSquare className="play-button-icon" aria-hidden strokeWidth={1.8} />
        <span>Изпрати</span>
      </button>
    </form>
  );
}
