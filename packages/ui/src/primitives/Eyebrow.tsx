import type { ReactNode } from "react";

export type EyebrowTone = "default" | "muted" | "blood" | "gold";

export interface EyebrowProps {
  tone?: EyebrowTone;
  children: ReactNode;
}

const TONE_COLOR: Record<EyebrowTone, string> = {
  default: "var(--ds-ink-soft)",
  muted: "var(--ds-ink-soft)",
  blood: "var(--ds-eyebrow-blood)",
  gold: "var(--ds-eyebrow-gold)",
};

export function Eyebrow({ tone = "default", children }: EyebrowProps) {
  return (
    <span
      data-ds-eyebrow={tone}
      style={{
        fontFamily: "ui-monospace, 'Cascadia Mono', monospace",
        fontSize: "var(--ds-type-eyebrow)",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: TONE_COLOR[tone],
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
