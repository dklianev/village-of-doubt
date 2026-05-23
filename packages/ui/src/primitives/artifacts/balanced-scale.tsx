export interface ArtifactProps {
  size?: number;
}

export function BalancedScale({ size = 144 }: ArtifactProps) {
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
      <path d="M72 28v82" />
      <path d="M48 116h48M58 110h28" strokeWidth="2" />
      <path d="M38 44h68" />
      <path d="M38 44l-18 36h36L38 44ZM106 44 88 80h36l-18-36Z" />
      <path d="M24 80h28M92 80h28" />
      <circle cx="72" cy="28" r="8" fill="var(--ds-accent-gold-soft)" stroke="var(--ds-accent-gold-deep)" />
      <path d="M66 44h12" stroke="var(--ds-accent-gold-deep)" />
      <path d="M72 36v8" stroke="var(--ds-accent-gold-deep)" />
    </svg>
  );
}
