import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { Surface } from "./Surface";

export type PaperCardAccent = "neutral" | "win" | "loss" | "warning" | "info";

export interface PaperCardProps {
  eyebrow?: string;
  density?: "sm" | "md" | "lg";
  meta?: ReactNode;
  interactive?: boolean;
  accent?: PaperCardAccent;
  children: ReactNode;
}

const DENSITY_PAD = {
  sm: "16px",
  md: "28px",
  lg: "48px",
} as const;

export function PaperCard({ eyebrow, density = "md", meta, interactive, accent, children }: PaperCardProps) {
  return (
    <Surface
      variant="paper"
      radius="card"
      elevation="card"
      style={{ minWidth: 0, maxWidth: "100%" }}
      data-ds-paper-card={density}
      data-interactive={interactive ? "true" : undefined}
      data-accent={accent}
    >
      <div
        style={{
          minWidth: 0,
          maxWidth: "100%",
          padding: `var(--ds-paper-card-padding, ${DENSITY_PAD[density]})`,
          display: "grid",
          gap: "16px",
        }}
      >
        {(eyebrow || meta) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
            {eyebrow ? <Eyebrow tone="muted">{eyebrow}</Eyebrow> : <span />}
            {meta}
          </div>
        )}
        {children}
      </div>
    </Surface>
  );
}
