import { BookOpen, KeyRound, Settings, Shield, UserRound } from "lucide-react";
import type { FaqCategory } from "@/lib/faq-data";

const CATEGORY_ICONS = {
  "pre-game": KeyRound,
  gameplay: BookOpen,
  account: UserRound,
  tech: Settings,
  privacy: Shield,
};

export function CategoryIcon({ category, className }: { category: FaqCategory; className?: string }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon className={className} size={24} strokeWidth={1.5} aria-hidden="true" />;
}
