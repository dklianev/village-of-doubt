import type { Metadata } from "next";
import { GameRulesPage } from "@/components/games/game-rules-page";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Правила за Мафия — алибита и присъди",
  description: "Научи правилата за Мафия: роли, нощни договорки, дневни обвинения, гласуване, градски отбор и финална развръзка.",
  path: "/mafia/rules",
  image: "/game-art/og/og-mafia.png",
  imageAlt: "Дъждовна градска улица под фенер",
  ogDescription: "Нощни договорки, дневни обвинения и градска развръзка.",
});

export default function MafiaRulesPage() {
  return <GameRulesPage family="mafia" />;
}
