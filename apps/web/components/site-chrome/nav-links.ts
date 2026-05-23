import {
  Activity,
  Clock,
  HelpCircle,
  ListOrdered,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SecondaryLinkGroup = "game" | "social" | "help";

export interface SecondaryLink {
  href: string;
  label: string;
  icon: LucideIcon;
  group: SecondaryLinkGroup;
}

export interface DrawerLink {
  href: string;
  label: string;
  icon?: LucideIcon;
}

export const SECONDARY_LINKS: ReadonlyArray<SecondaryLink> = [
  { href: "/history", label: "История", icon: Clock, group: "game" },
  { href: "/achievements", label: "Легенди", icon: Trophy, group: "game" },
  { href: "/leaderboard", label: "Класация", icon: ListOrdered, group: "game" },
  { href: "/friends", label: "Приятели", icon: Users, group: "social" },
  { href: "/tutorial", label: "Първа игра", icon: Sparkles, group: "help" },
  { href: "/faq", label: "Въпроси", icon: HelpCircle, group: "help" },
  { href: "/status", label: "Състояние", icon: Activity, group: "help" },
];

export const GROUP_LABELS: Record<SecondaryLinkGroup, string> = {
  game: "Игра",
  social: "Социал",
  help: "Помощ",
};

export const GROUP_ORDER: ReadonlyArray<SecondaryLinkGroup> = ["game", "social", "help"];

export const DRAWER_LINKS: ReadonlyArray<DrawerLink> = [
  { href: "/", label: "Начало" },
  { href: "/werewolf", label: "Върколак" },
  { href: "/mafia", label: "Мафия" },
  ...SECONDARY_LINKS,
];
