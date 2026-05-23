import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { Surface } from "./Surface";

export interface SceneCardProps {
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

export function SceneCard({ eyebrow, density = "md", meta, children }: SceneCardProps) {
  return (
    <Surface variant="scene" radius="card" elevation="scene" data-ds-scene-card={density}>
      <div style={{ padding: DENSITY_PAD[density], display: "grid", gap: "16px", color: "var(--ds-ink-scene)" }}>
        {(eyebrow || meta) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
            {eyebrow ? <Eyebrow tone="gold">{eyebrow}</Eyebrow> : <span />}
            {meta}
          </div>
        )}
        {children}
      </div>
    </Surface>
  );
}
