import type { ReactNode } from "react";

export type DisplaySize = "hero" | "h1" | "h2" | "h3" | "h4";

export interface DisplayProps {
  size?: DisplaySize;
  as?: keyof React.JSX.IntrinsicElements;
  children: ReactNode;
}

const SIZE_FONT: Record<DisplaySize, string> = {
  hero: "var(--ds-type-display)",
  h1: "var(--ds-type-h1)",
  h2: "var(--ds-type-h2)",
  h3: "var(--ds-type-h3)",
  h4: "var(--ds-type-h4)",
};

const SIZE_TAG: Record<DisplaySize, "h1" | "h2" | "h3" | "h4"> = {
  hero: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
};

export function Display({ size = "h1", as, children }: DisplayProps) {
  const Tag = (as ?? SIZE_TAG[size]) as "h1";

  return (
    <Tag
      data-ds-display={size}
      style={{
        fontFamily: '"Noto Serif Display", "Noto Serif", "Iowan Old Style", serif',
        fontSize: SIZE_FONT[size],
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: 0,
        margin: 0,
        textWrap: "balance",
      }}
    >
      {children}
    </Tag>
  );
}
