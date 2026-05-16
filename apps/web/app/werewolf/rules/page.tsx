import type { Metadata } from "next";
import { GameRulesPage } from "@/components/games/game-rules-page";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Правила за Върколак — нощ, ден и паритет",
  description: "Научи правилата за Върколак: лоби, тайни роли, нощни действия, дневен спор, гласуване, паритет и победа.",
  path: "/werewolf/rules",
  image: "/game-art/og/og-werewolf.png",
  imageAlt: "Лунна нощ над българско село",
  ogDescription: "От първата нощ до последния глас на селото.",
});

export default function WerewolfRulesPage() {
  return <GameRulesPage family="werewolves" />;
}
