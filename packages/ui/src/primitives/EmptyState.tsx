import type { ReactNode } from "react";
import { Display } from "./Display";
import { PaperCard } from "./PaperCard";

export interface EmptyStateProps {
  artifact?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

export function EmptyState({ artifact, title, body, action }: EmptyStateProps) {
  return (
    <PaperCard density="lg">
      <div
        data-ds-empty-state
        style={{
          display: "grid",
          gap: "20px",
          justifyItems: "center",
          textAlign: "center",
          maxWidth: "32rem",
          margin: "0 auto",
          padding: "8px 0",
        }}
      >
        {artifact && <div style={{ width: "144px", height: "144px", color: "var(--ds-ink-soft)" }}>{artifact}</div>}
        <Display size="h3">{title}</Display>
        <p
          style={{
            color: "var(--ds-ink-soft)",
            fontSize: "var(--ds-type-body)",
            lineHeight: 1.6,
            margin: 0,
            maxWidth: "28rem",
          }}
        >
          {body}
        </p>
        {action}
      </div>
    </PaperCard>
  );
}
