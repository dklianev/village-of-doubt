import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export type SurfaceVariant = "paper" | "paper-deep" | "scene" | "scene-deep";
export type SurfaceRadius = "card" | "tile" | "none";
export type SurfaceElevation = "none" | "card" | "scene";
export type SurfaceAs = "div" | "section" | "article" | "aside";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  variant?: SurfaceVariant;
  radius?: SurfaceRadius;
  elevation?: SurfaceElevation;
  as?: SurfaceAs;
  children: ReactNode;
}

const VARIANT_BG: Record<SurfaceVariant, string> = {
  paper: "var(--ds-surface-paper)",
  "paper-deep": "var(--ds-surface-paper-deep)",
  scene: "var(--ds-surface-scene)",
  "scene-deep": "var(--ds-surface-scene-deep)",
};

const RADIUS_VALUE: Record<SurfaceRadius, string> = {
  card: "var(--ds-radius-card)",
  tile: "var(--ds-radius-tile)",
  none: "0",
};

const ELEVATION_VALUE: Record<SurfaceElevation, string> = {
  none: "none",
  card: "var(--ds-shadow-card)",
  scene: "var(--ds-shadow-scene)",
};

const VARIANT_COLOR: Record<SurfaceVariant, string> = {
  paper: "var(--ds-ink-primary)",
  "paper-deep": "var(--ds-ink-primary)",
  scene: "var(--ds-ink-scene)",
  "scene-deep": "var(--ds-ink-scene)",
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  {
    variant = "paper",
    radius = "tile",
    elevation = "card",
    as = "div",
    children,
    style,
    ...rest
  },
  ref,
) {
  const composed: CSSProperties = {
    background: VARIANT_BG[variant],
    borderRadius: RADIUS_VALUE[radius],
    boxShadow: ELEVATION_VALUE[elevation],
    color: VARIANT_COLOR[variant],
    ...(variant === "scene" || variant === "scene-deep"
      ? ({
          "--ds-eyebrow-blood": "oklch(0.72 0.12 25)",
          "--ds-eyebrow-gold": "var(--ds-accent-gold)",
          "--ds-pill-danger-color": "oklch(0.72 0.12 25)",
        } as CSSProperties)
      : {}),
    ...style,
  };
  const Tag = as as "div";

  return (
    <Tag ref={ref as never} data-ds-surface={variant} style={composed} {...rest}>
      {children}
    </Tag>
  );
});

Surface.displayName = "Surface";
