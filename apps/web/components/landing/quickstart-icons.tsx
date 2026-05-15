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
      <path d="M18.5 12.5c3.8-4 8.3-6 13.5-6s9.7 2 13.5 6" opacity="0.58" />
      <path d="M21.5 29.5h21" />
      <path d="M25 16.5h14l-1.7 13H26.7l-1.7-13Z" />
      <path d="M25 16.5c-4.8.4-7.3 2-7.3 4.6 0 2.3 1.8 3.8 5.5 4.5M39 16.5c4.8.4 7.3 2 7.3 4.6 0 2.3-1.8 3.8-5.5 4.5" />
      <path d="M28.4 11.2 32 7.6l3.6 3.6M32 7.6v16.8" />
      <path d="M30 34.2h4" />
      <path d="M12.5 14.2l1.7 1.7 1.7-1.7M48.1 14.2l1.7 1.7 1.7-1.7" opacity="0.62" />
    </svg>
  );
}
