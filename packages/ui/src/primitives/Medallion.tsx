export interface MedallionProps {
  label: string | number;
  size?: number;
}

export function Medallion({ label, size = 56 }: MedallionProps) {
  return (
    <span
      data-ds-medallion
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "var(--ds-radius-chip)",
        border: "1px solid oklch(0.58 0.110 65 / 0.95)",
        background:
          "radial-gradient(circle at 50% 38%, oklch(0.97 0.01 80) 0 34%, var(--ds-accent-gold) 68%, oklch(0.48 0.06 60) 100%)",
        boxShadow: "inset 0 0 0 3px oklch(0.97 0.01 80 / 0.78), 0 10px 22px oklch(0.18 0.012 60 / 0.22)",
        color: "var(--ds-ink-primary)",
        fontFamily: '"Noto Serif", "Iowan Old Style", Georgia, serif',
        fontWeight: 800,
        fontSize: `${Math.round(size * 0.36)}px`,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}
