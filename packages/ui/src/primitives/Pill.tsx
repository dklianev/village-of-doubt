import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type PillIntent = "primary" | "secondary" | "danger" | "ghost";
export type PillSize = "sm" | "md" | "lg";

type PillBaseProps = {
  intent?: PillIntent;
  size?: PillSize;
  children: ReactNode;
};

type PillButtonProps = PillBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: "button";
  };

type PillAnchorProps = PillBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: "a";
  };

export type PillProps = PillButtonProps | PillAnchorProps;

const INTENT_STYLES: Record<PillIntent, CSSProperties> = {
  primary: {
    background: "var(--ds-accent-blood)",
    color: "oklch(0.97 0.01 80)",
    border: "1px solid var(--ds-accent-blood-deep)",
  },
  secondary: {
    background: "var(--ds-surface-paper-deep)",
    color: "var(--ds-ink-primary)",
    border: "1px solid var(--ds-surface-paper-edge)",
  },
  danger: {
    background: "transparent",
    color: "var(--ds-accent-blood-deep)",
    border: "1px solid var(--ds-accent-blood)",
  },
  ghost: {
    background: "transparent",
    color: "var(--ds-ink-soft)",
    border: "1px solid transparent",
  },
};

const SIZE_STYLES: Record<PillSize, CSSProperties> = {
  sm: { padding: "6px 14px", fontSize: "0.86rem" },
  md: { padding: "10px 22px", fontSize: "1rem" },
  lg: { padding: "14px 28px", fontSize: "1.06rem" },
};

const BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  borderRadius: "var(--ds-radius-chip)",
  fontFamily: '"Noto Serif", "Iowan Old Style", Georgia, serif',
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  transition:
    "transform var(--ds-duration-quick) var(--ds-ease-candle), filter var(--ds-duration-quick) var(--ds-ease-candle), background var(--ds-duration-quick) var(--ds-ease-candle)",
};

export function Pill(props: PillProps) {
  const { intent = "primary", size = "md", children, style, ...rest } = props;
  const composed = {
    ...BASE_STYLE,
    ...SIZE_STYLES[size],
    ...INTENT_STYLES[intent],
    ...style,
  };

  if (props.as === "a") {
    const { as: _as, ...anchorProps } = rest as PillAnchorProps;
    return (
      <a className={`ds-pill ds-pill--${intent}`} data-ds-pill={intent} style={composed} {...anchorProps}>
        {children}
      </a>
    );
  }

  const { as: _as, type = "button", ...buttonProps } = rest as PillButtonProps;
  return (
    <button className={`ds-pill ds-pill--${intent}`} data-ds-pill={intent} type={type} style={composed} {...buttonProps}>
      {children}
    </button>
  );
}
