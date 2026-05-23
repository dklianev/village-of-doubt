export interface ArtifactProps {
  size?: number;
}

export function DustyShelf({ size = 144 }: ArtifactProps) {
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
      <path d="M26 42h92v70H26V42Z" fill="var(--ds-surface-paper-deep)" />
      <path d="M26 66h92M26 90h92" />
      <path d="M42 42v70M72 42v70M102 42v70" opacity="0.7" />
      <path d="M22 112h100" strokeWidth="2" />
      <path d="M35 55h17M81 79h12M50 103h29" opacity="0.5" />
      <circle cx="55" cy="31" r="3" fill="var(--ds-accent-gold-soft)" stroke="var(--ds-accent-gold-deep)" />
      <circle cx="94" cy="32" r="2" fill="var(--ds-accent-gold-soft)" stroke="var(--ds-accent-gold-deep)" />
    </svg>
  );
}
