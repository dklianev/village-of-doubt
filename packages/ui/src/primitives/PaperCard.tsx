import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { Surface } from "./Surface";

export interface PaperCardProps {
  eyebrow?: string;
  density?: "sm" | "md" | "lg";
  meta?: ReactNode;
  children: ReactNode;
}

const DENSITY_PAD = {
  sm: "16px",
  md: "28px",
  lg: "48px",
} as const;

export function PaperCard({ eyebrow, density = "md", meta, children }: PaperCardProps) {
  return (
    <Surface variant="paper" radius="card" elevation="card" data-ds-paper-card={density}>
      <div style={{ padding: DENSITY_PAD[density], display: "grid", gap: "16px" }}>
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
