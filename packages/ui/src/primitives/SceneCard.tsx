import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { Surface } from "./Surface";

export interface SceneCardBackground {
  image: string;
  overlay?: "scrim" | "veil" | "none";
  focalX?: number;
  focalY?: number;
}

export type SceneCardAccent = "neutral" | "win" | "loss" | "warning" | "info";

export interface SceneCardProps {
  eyebrow?: string;
  density?: "sm" | "md" | "lg";
  meta?: ReactNode;
  background?: SceneCardBackground;
  interactive?: boolean;
  accent?: SceneCardAccent;
  children: ReactNode;
}

const DENSITY_PAD = {
  sm: "16px",
  md: "28px",
  lg: "48px",
} as const;

const OVERLAY_GRADIENT = {
  scrim:
    "linear-gradient(115deg, oklch(0.13 0.014 50 / 0.92) 0%, oklch(0.18 0.012 60 / 0.7) 44%, oklch(0.13 0.014 50 / 0.95) 100%)",
  veil:
    "linear-gradient(180deg, oklch(0.13 0.014 50 / 0.78) 0%, oklch(0.18 0.012 60 / 0.5) 100%)",
  none:
    "linear-gradient(180deg, oklch(0.13 0.014 50 / 0.3) 0%, oklch(0.18 0.012 60 / 0.2) 100%)",
} as const;

export function SceneCard({
  eyebrow,
  density = "md",
  meta,
  background,
  interactive,
  accent,
  children,
}: SceneCardProps) {
  const hasBackground = Boolean(background?.image);
  const overlay = background?.overlay ?? "scrim";
  const focalX = background?.focalX ?? 50;
  const focalY = background?.focalY ?? 50;

  return (
    <Surface
      variant="scene"
      radius="card"
      elevation="scene"
      data-ds-scene-card={density}
      data-interactive={interactive ? "true" : undefined}
      data-accent={accent}
      style={hasBackground ? { position: "relative", overflow: "hidden" } : undefined}
    >
      {hasBackground ? (
        <div
          aria-hidden
          data-ds-scene-card-background
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `${OVERLAY_GRADIENT[overlay]}, ${background?.image}`,
            backgroundSize: "cover, cover",
            backgroundPosition: `${focalX}% ${focalY}%, ${focalX}% ${focalY}%`,
            backgroundRepeat: "no-repeat, no-repeat",
          }}
        />
      ) : null}
      <div
        style={{
          padding: DENSITY_PAD[density],
          display: "grid",
          gap: "16px",
          color: "var(--ds-ink-scene)",
          position: hasBackground ? "relative" : undefined,
          zIndex: hasBackground ? 1 : undefined,
        }}
      >
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
