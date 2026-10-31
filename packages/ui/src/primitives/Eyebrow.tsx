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
        fontFamily: "var(--ds-font-body)",
        fontSize: "var(--ds-type-eyebrow)",
        lineHeight: "var(--ds-leading-label)",
        letterSpacing: "var(--ds-tracking-label)",
        color: TONE_COLOR[tone],
        fontWeight: "var(--ds-weight-label)",
      }}
    >
      {children}
    </span>
  );
}
