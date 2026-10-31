import { useId, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/button";
import type { PublicChatMessage } from "@/lib/play/types";

const PREVIEW_SIZE = 5;

export function PublicChatHistory({ messages }: { messages: readonly PublicChatMessage[] }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const logId = useId();
  const scrollable = expanded && messages.length > PREVIEW_SIZE;
  // Expanding the archive must not read old replies aloud, so they stay outside the live log.
  const archived = scrollable ? messages.slice(0, -PREVIEW_SIZE) : [];
  const latest = messages.slice(-PREVIEW_SIZE);

  return <>
    <h3 className="play-panel-subhead" id={headingId}>
      <MessageSquare className="play-section-icon" aria-hidden strokeWidth={1.8} />
      <span>Архив на разговора</span>
    </h3>
    {messages.length > PREVIEW_SIZE ? (
      <Button
        variant="secondary"
        className="play-chat-history-toggle"
        aria-expanded={expanded}
        aria-controls={logId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <ChevronUp className="play-button-icon" aria-hidden /> : <ChevronDown className="play-button-icon" aria-hidden />}
        {expanded ? "Само последните 5" : `Виж разговора (${messages.length})`}
      </Button>
    ) : null}
    <div
      id={logId}
      className="play-chat-history mt-3 grid gap-2 text-sm"
      role={scrollable ? "group" : undefined}
      aria-labelledby={scrollable ? headingId : undefined}
      tabIndex={scrollable ? 0 : undefined}
      data-expanded={expanded ? "true" : undefined}
    >
      {archived.map((message) => <ChatLine key={message.id} message={message} />)}
      <div className="grid gap-2" role="log" aria-labelledby={headingId} aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? <p className="chat-line rounded-xl px-3 py-2">Още няма публични реплики.</p> : null}
        {latest.map((message) => <ChatLine key={message.id} message={message} />)}
      </div>
    </div>
  </>;
}

function ChatLine({ message }: { message: PublicChatMessage }) {
  return <p className="chat-line rounded-xl px-3 py-2">
    <strong>{message.senderName}:</strong> <span>{message.message}</span>
  </p>;
}
