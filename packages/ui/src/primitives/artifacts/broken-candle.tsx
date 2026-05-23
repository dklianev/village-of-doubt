export interface ArtifactProps {
  size?: number;
}

export function BrokenCandle({ size = 144 }: ArtifactProps) {
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
      <path d="M58 57h34v54H58V57Z" fill="var(--ds-surface-paper-deep)" />
      <path d="M58 70l10-7 10 7 14-8" />
      <path d="M52 111h46l10 12H42l10-12Z" />
      <path d="M75 57c1-10-7-12-2-22 8 8 17 15 7 22" fill="var(--ds-accent-gold-soft)" stroke="var(--ds-accent-gold-deep)" />
      <path d="M42 45l20 15M104 42 86 59" stroke="var(--ds-accent-blood-deep)" />
      <path d="M54 82h38M54 96h38" opacity="0.45" />
    </svg>
  );
}
