export interface ArtifactProps {
  size?: number;
}

export function SealedLetter({ size = 144 }: ArtifactProps) {
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
      <rect x="24" y="36" width="96" height="68" rx="3" fill="var(--ds-surface-paper-deep)" />
      <path d="M24 38l48 40 48-40" />
      <path d="M24 104l37-34M120 104L83 70" opacity="0.62" />
      <circle cx="72" cy="92" r="12" fill="var(--ds-accent-blood)" stroke="var(--ds-accent-blood-deep)" strokeWidth="2" />
      <path d="M67 88l5 6 5-6M67 95h10" stroke="oklch(0.94 0.022 78)" strokeWidth="1.5" />
      <path d="M40 122h64" opacity="0.45" />
    </svg>
  );
}
