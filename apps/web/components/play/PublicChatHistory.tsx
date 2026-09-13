import { useId, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import type { PublicChatMessage } from "@/lib/play/types";

export function PublicChatHistory({ messages }: { messages: readonly PublicChatMessage[] }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const logId = useId();
  const visibleMessages = expanded ? messages : messages.slice(-5);

  return <>
    <h3 className="play-panel-subhead" id={headingId}>
      <MessageSquare className="play-section-icon" aria-hidden strokeWidth={1.8} />
      <span>Архив на разговора</span>
    </h3>
    {messages.length > 5 ? (
      <button
        type="button"
        className="btn btn-secondary play-chat-history-toggle"
        aria-expanded={expanded}
        aria-controls={logId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <ChevronUp className="play-button-icon" aria-hidden /> : <ChevronDown className="play-button-icon" aria-hidden />}
        {expanded ? "Само последните 5" : `Виж разговора (${messages.length})`}
      </button>
    ) : null}
    <div
      id={logId}
      className="play-chat-history mt-3 grid gap-2 text-sm"
      role="log"
      aria-labelledby={headingId}
      aria-live="polite"
      aria-relevant="additions"
      tabIndex={expanded && messages.length > 5 ? 0 : undefined}
      data-expanded={expanded ? "true" : undefined}
    >
      {messages.length === 0 ? <p className="chat-line rounded-xl px-3 py-2">Още няма публични реплики.</p> : null}
      {visibleMessages.map((message) => (
        <p key={message.id} className="chat-line rounded-xl px-3 py-2">
          <strong>{message.senderName}:</strong> <span>{message.message}</span>
        </p>
      ))}
    </div>
  </>;
}
