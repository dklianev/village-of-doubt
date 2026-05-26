import type { ReactNode } from "react";

type IconProps = {
  className?: string | undefined;
};

function IconShell({ children, className = "" }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 22 22"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function PersonIcon({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="11" cy="7" r="3.2" />
      <path d="M5.4 18.2c.9-3.4 2.8-5 5.6-5s4.7 1.6 5.6 5" />
    </IconShell>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="7.8" cy="11" r="3.4" />
      <path d="M11.2 11h8.6" />
      <path d="M16.5 11v3.5" />
      <path d="M19.8 11v2.6" />
    </IconShell>
  );
}

export function HouseIcon({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4.2 10.2 11 4.4l6.8 5.8" />
      <path d="M6.2 9.4v8.2h9.6V9.4" />
      <path d="M9.4 17.6v-4.8h3.2v4.8" />
    </IconShell>
  );
}

export function MaskIcon({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M5.2 7.1c2.8-1 5.2-.7 7.2.8.6 4.2-.7 6.9-3.9 8.2-2.9-1.1-4.2-3.8-3.3-9Z" />
      <path d="M10.6 6.9c2.1-1.6 4.2-1.9 6.3-.9.8 4.6-.4 7.3-3.5 8.2-.7-.2-1.3-.5-1.9-.9" />
      <path d="M7.4 10.1h.1M10.6 10.7h.1M13.7 9.6h.1" />
      <path d="M7.7 13.1c.7.5 1.5.5 2.4.1M13.2 12.2c.6.3 1.2.3 1.9-.1" />
    </IconShell>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M15.8 16.8A7.1 7.1 0 0 1 8.2 5.3a7.2 7.2 0 1 0 7.6 11.5Z" />
    </IconShell>
  );
}

export function BallotIcon({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M6.3 4.7h9.4v12.6H6.3z" />
      <path d="M8.4 8.3h5.2M8.4 11h5.2M8.4 13.7h3.6" />
      <path d="m14.1 4.7 1.6 1.8" />
    </IconShell>
  );
}

export function SealedInvitationGlyph({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 20.5h36v25H14z" />
      <path d="m15.5 22 16.3 13.2L48.5 22" opacity="0.74" />
      <path d="m15.8 44.2 12-10.2M48.2 44.2 36 34" opacity="0.46" />
      <path d="M22 16.8c5.7-2.6 13.2-2.6 20 0" opacity="0.42" />
      <circle cx="42.4" cy="42.2" r="6.4" fill="currentColor" stroke="none" opacity="0.26" />
      <circle cx="42.4" cy="42.2" r="4" />
      <path d="M39.8 42.2h5.2M42.4 39.6v5.2" opacity="0.72" />
    </svg>
  );
}

export function LastWinnerEmptyGlyph({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 40"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.5 13.8h15.2l3.2-4.2h22.6v21.2h-41z" />
      <path d="M17.6 9.7h10.6l2.9 3.6" opacity="0.5" />
      <path d="M18.2 18.6h27.6M18.2 23.5h20.4M18.2 28.3h14.6" opacity="0.62" />
      <path d="M47.6 20.1c2.2 1.4 3.5 3.3 3.5 5.4 0 4.8-8.4 8.7-18.8 8.7s-18.8-3.9-18.8-8.7c0-2.1 1.6-4.1 4.2-5.6" opacity="0.28" />
      <circle cx="45.8" cy="26.6" r="3.7" />
      <path d="m43.6 26.6 1.5 1.5 3.2-3.4" opacity="0.72" />
    </svg>
  );
}
