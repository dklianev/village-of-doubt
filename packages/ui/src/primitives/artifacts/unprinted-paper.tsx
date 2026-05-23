export interface ArtifactProps {
  size?: number;
}

export function UnprintedPaper({ size = 144 }: ArtifactProps) {
  return (
    <svg
      viewBox="0 0 144 144"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M42 24h54l18 18v72c0 4-3 7-7 7H42c-4 0-7-3-7-7V31c0-4 3-7 7-7Z" fill="var(--ds-surface-paper-deep)" />
      <path d="M96 24v18h18" />
      <path d="M50 58h47M50 72h47M50 86h34" opacity="0.5" />
      <path d="M28 104l16 22h67" />
      <path d="M58 108h38" opacity="0.45" />
      <circle cx="99" cy="91" r="9" fill="var(--ds-accent-gold-soft)" stroke="var(--ds-accent-gold-deep)" />
      <path d="M95 91h8" stroke="var(--ds-accent-gold-deep)" />
    </svg>
  );
}
