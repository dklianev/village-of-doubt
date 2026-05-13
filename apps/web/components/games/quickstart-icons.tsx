import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function PersonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.9-4 3.2-6 6.5-6s5.6 2 6.5 6" />
    </svg>
  );
}

export function DoorIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M5 20V7.5L12 4l7 3.5V20" />
      <path d="M9 20V9h6v11" />
      <path d="M13 14h.01" />
    </svg>
  );
}

export function MaskIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M4.5 9.5c2.8-2.2 5.3-2.2 7.5 0 2.2-2.2 4.7-2.2 7.5 0-.2 5.2-2.6 8.5-7.5 9-4.9-.5-7.3-3.8-7.5-9Z" />
      <path d="M8.2 12.2h2.2" />
      <path d="M13.6 12.2h2.2" />
      <path d="M9.5 16c1.5.8 3.5.8 5 0" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M17.5 16.5A7 7 0 0 1 9 7.9 7.5 7.5 0 1 0 17.5 16.5Z" />
      <path d="M17 5.5h.01" />
      <path d="M20 9h.01" />
    </svg>
  );
}

export function BallotIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M7 4h10v16l-2.5-1.4L12 20l-2.5-1.4L7 20V4Z" />
      <path d="m10 9 1.5 1.5L15 7" />
      <path d="M10 14h4" />
    </svg>
  );
}
