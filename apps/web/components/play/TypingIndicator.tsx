import type { TypingNotice } from "@/lib/play/types";

export function TypingIndicator({ notices, compact = false }: { notices: TypingNotice[]; compact?: boolean }) {
  const names = [...new Set(notices.map((notice) => notice.senderName))].slice(0, 3);
  if (names.length === 0) {
    return null;
  }

  const label =
    names.length === 1
      ? `${names[0]} пише...`
      : names.length === 2
        ? `${names[0]} и ${names[1]} пишат...`
        : `${names[0]}, ${names[1]} и още ${notices.length - 2} пишат...`;

  return (
    <p className={`typing-indicator ${compact ? "typing-indicator-compact" : ""}`} aria-live="polite">
      <span aria-hidden="true" />
      {label}
    </p>
  );
}
