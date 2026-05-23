export interface ArtifactProps {
  size?: number;
}

export function EmptyChair({ size = 144 }: ArtifactProps) {
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
      <path d="M44 52h56l-5 38H49L44 52Z" fill="var(--ds-surface-paper-deep)" />
      <path d="M49 52V34c0-9 7-16 16-16h14c9 0 16 7 16 16v18" />
      <path d="M56 52V36c0-5 4-9 9-9h14c5 0 9 4 9 9v16" />
      <path d="M52 90l-8 34M92 90l8 34M44 112h56" />
      <path d="M58 72h28" />
      <circle cx="72" cy="72" r="8" fill="var(--ds-accent-gold-soft)" stroke="var(--ds-accent-gold-deep)" />
      <path d="M34 124h76" opacity="0.55" />
    </svg>
  );
}
