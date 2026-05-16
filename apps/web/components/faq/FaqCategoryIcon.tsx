interface IconProps {
  className?: string;
}

const COMMON = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case "pre-game":
      return (
        <svg className={className} {...COMMON}>
          <circle cx="14" cy="24" r="7" />
          <path d="M21 24 L38 24 M34 24 L34 30 M38 24 L38 28" />
          <path d="M14 17 Q14 13 18 12 M14 31 Q14 35 18 36" strokeDasharray="2 3" />
        </svg>
      );
    case "gameplay":
      return (
        <svg className={className} {...COMMON}>
          <path d="M14 14 L14 38 L22 38 L22 14 Z" />
          <path d="M22 12 L30 12 L30 36 L22 36 Z" transform="rotate(8 22 24)" />
          <path d="M28 10 L36 10 L36 34 L28 34 Z" transform="rotate(16 30 22)" />
        </svg>
      );
    case "account":
      return (
        <svg className={className} {...COMMON}>
          <path d="M8 14 L16 14 L20 18 L40 18 L40 38 L8 38 Z" />
          <path d="M8 22 L40 22" />
          <circle cx="24" cy="30" r="3.5" />
          <path d="M19 36 Q24 32 29 36" />
        </svg>
      );
    case "tech":
      return (
        <svg className={className} {...COMMON}>
          <circle cx="24" cy="24" r="6" />
          <path d="M24 10 L24 14 M24 34 L24 38 M10 24 L14 24 M34 24 L38 24" />
          <path d="M14 14 L17 17 M31 31 L34 34 M14 34 L17 31 M31 17 L34 14" />
          <circle cx="24" cy="24" r="2" fill="currentColor" />
        </svg>
      );
    case "privacy":
      return (
        <svg className={className} {...COMMON}>
          <rect x="12" y="22" width="24" height="18" rx="2" />
          <path d="M16 22 L16 16 Q16 10 24 10 Q32 10 32 16 L32 22" />
          <circle cx="24" cy="30" r="2" fill="currentColor" />
          <path d="M24 31 L24 35" />
        </svg>
      );
    default:
      return (
        <svg className={className} {...COMMON}>
          <circle cx="24" cy="24" r="14" />
        </svg>
      );
  }
}

export type { IconProps };
