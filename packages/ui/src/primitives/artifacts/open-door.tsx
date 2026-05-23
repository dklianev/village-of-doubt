export interface ArtifactProps {
  size?: number;
}

export function OpenDoor({ size = 144 }: ArtifactProps) {
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
      <path d="M43 22h58v100H43V22Z" />
      <path d="M58 34l40-10v98l-40-10V34Z" fill="var(--ds-surface-paper-deep)" />
      <path d="M78 68h7" />
      <path d="M101 54h17v68h-17" />
      <path d="M32 122h84" opacity="0.55" />
      <path d="M101 44c7 3 12 8 15 15" stroke="var(--ds-accent-gold-deep)" />
      <circle cx="112" cy="62" r="5" fill="var(--ds-accent-gold-soft)" stroke="var(--ds-accent-gold-deep)" />
    </svg>
  );
}
