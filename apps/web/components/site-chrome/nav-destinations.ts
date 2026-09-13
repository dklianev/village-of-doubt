export type SecondaryLinkGroup = "game" | "social" | "help";

// Shared with the eager native fallback; keep icon components in the lazy entry.
export const SECONDARY_DESTINATIONS = [
  { href: "/history", label: "История", group: "game" },
  { href: "/achievements", label: "Постижения", group: "game" },
  { href: "/leaderboard", label: "Класация", group: "game" },
  { href: "/friends", label: "Приятели", group: "social" },
  { href: "/tutorial", label: "Първа игра", group: "help" },
  { href: "/faq", label: "Въпроси", group: "help" },
  { href: "/status", label: "Състояние", group: "help" },
] as const;

export const DRAWER_DESTINATIONS = [
  { href: "/", label: "Начало" },
  { href: "/werewolf", label: "Върколак" },
  { href: "/mafia", label: "Мафия" },
] as const;
