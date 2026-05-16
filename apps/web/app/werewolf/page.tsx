import type { Metadata } from "next";
import { GameHomePage } from "@/components/games/game-home-page";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Върколак — фолклорна нощ на масата",
  description:
    "Български фолклорен Върколак с тайни роли, нощно гласуване, разказвач или автоматичен сървър. Играй частни стаи с приятели.",
  path: "/werewolf",
  image: "/game-art/og/og-werewolf.png",
  imageAlt: "Лунна нощ над българско село",
  ogDescription: "Тайни роли, лунна нощ, селото срещу върколаците.",
});

export default function WerewolfPage() {
  return <GameHomePage family="werewolves" />;
}
