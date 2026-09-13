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

import { DRAWER_DESTINATIONS, SECONDARY_DESTINATIONS, type SecondaryLinkGroup } from "./nav-destinations";
export type { SecondaryLinkGroup } from "./nav-destinations";

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

const icons: Record<(typeof SECONDARY_DESTINATIONS)[number]["href"], LucideIcon> = {
  "/history": Clock,
  "/achievements": Trophy,
  "/leaderboard": ListOrdered,
  "/friends": Users,
  "/tutorial": Sparkles,
  "/faq": HelpCircle,
  "/status": Activity,
};
export const SECONDARY_LINKS: ReadonlyArray<SecondaryLink> = SECONDARY_DESTINATIONS.map((item) => ({ ...item, icon: icons[item.href] }));

export const GROUP_LABELS: Record<SecondaryLinkGroup, string> = {
  game: "Игра",
  social: "Компания",
  help: "Помощ",
};

export const GROUP_ORDER: ReadonlyArray<SecondaryLinkGroup> = ["game", "social", "help"];

export const DRAWER_LINKS: ReadonlyArray<DrawerLink> = [
  ...DRAWER_DESTINATIONS,
  ...SECONDARY_LINKS,
];
