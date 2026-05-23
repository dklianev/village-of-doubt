export interface ArtifactProps {
  size?: number;
}

export function ClosedBook({ size = 144 }: ArtifactProps) {
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
      <path d="M38 28h56c7 0 12 5 12 12v72c0 4-3 7-7 7H43c-6 0-11-5-11-11V34c0-3 3-6 6-6Z" fill="var(--ds-surface-paper-deep)" />
      <path d="M43 36h53c4 0 7 3 7 7v66" />
      <path d="M43 119c-6 0-11-5-11-11s5-11 11-11h56" />
      <path d="M43 103h56M43 110h51" opacity="0.55" />
      <path d="M54 28v69" />
      <rect x="69" y="58" width="23" height="18" rx="3" fill="var(--ds-accent-blood)" stroke="var(--ds-accent-blood-deep)" />
      <path d="M74 67h13" stroke="oklch(0.94 0.022 78)" />
    </svg>
  );
}
