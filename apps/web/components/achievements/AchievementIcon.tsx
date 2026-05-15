type IconProps = {
  id: string;
  className?: string;
};

export function AchievementIcon({ id, className }: IconProps) {
  const common = {
    className: className ?? "achievement-icon",
    viewBox: "0 0 48 48",
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case "first_blood":
      return (
        <svg {...common}>
          <path d="M24 6 C16 18 12 26 12 32 a12 12 0 0 0 24 0 c0-6-4-14-12-26z" />
          <path d="M18 32 a6 6 0 0 0 8 4" />
        </svg>
      );
    case "jester_win":
      return (
        <svg {...common}>
          <path d="M14 14 L10 6 M34 14 L38 6" />
          <circle cx="10" cy="6" r="2" />
          <circle cx="38" cy="6" r="2" />
          <path d="M10 18 Q24 10 38 18 Q36 36 24 40 Q12 36 10 18z" />
          <circle cx="19" cy="22" r="1.2" />
          <circle cx="29" cy="22" r="1.2" />
          <path d="M19 30 Q24 33 29 30" />
        </svg>
      );
    case "guardian_save":
      return (
        <svg {...common}>
          <path d="M24 6 L38 12 L38 24 Q38 38 24 42 Q10 38 10 24 L10 12z" />
          <path d="M24 18 L24 32 M18 25 L30 25" />
        </svg>
      );
    case "hunter_revenge":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="14" />
          <path d="M24 6 L24 16 M24 32 L24 42 M6 24 L16 24 M32 24 L42 24" />
          <circle cx="24" cy="24" r="2" fill="currentColor" />
        </svg>
      );
    case "silent_civilian":
      return (
        <svg {...common}>
          <path d="M24 8 Q28 16 26 22 Q22 22 22 16 Q24 12 24 8z" />
          <rect x="20" y="24" width="8" height="14" rx="1" />
          <path d="M16 38 L32 38" />
          <path d="M18 41 L30 41" />
        </svg>
      );
    case "perfect_record":
      return (
        <svg {...common}>
          <path d="M10 12 Q10 8 14 8 L34 8 Q38 8 38 12 L38 36 Q38 40 34 40 L14 40 Q10 40 10 36z" />
          <path d="M14 16 L32 16 M14 22 L32 22 M14 28 L26 28" />
          <circle cx="32" cy="33" r="3" />
        </svg>
      );
    case "maniac_endgame":
      return (
        <svg {...common}>
          <path d="M24 6 L28 28 L24 32 L20 28z" />
          <path d="M16 32 L32 32 L32 36 L16 36z" />
          <path d="M24 36 L24 42" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M24 6 L28 18 L42 18 L31 26 L35 40 L24 32 L13 40 L17 26 L6 18 L20 18z" />
        </svg>
      );
  }
}
