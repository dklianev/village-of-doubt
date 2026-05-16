import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { GameHomePage } from "@/components/games/game-home-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Върколак — фолклорна нощ на масата",
  description:
    "Български фолклорен Върколак с тайни роли, нощно гласуване, разказвач или автоматичен сървър. Играй частни стаи с приятели.",
  path: "/werewolf",
  image: "/game-art/og/og-werewolf.png",
  imageAlt: "Лунна нощ над българско село",
  ogDescription: "Тайни роли, лунна нощ, селото срещу върколаците.",
});

const werewolfJsonLd = {
  "@context": "https://schema.org",
  "@type": "Game",
  name: "Върколак",
  description: "Фолклорен Върколак с тайни роли и нощно гласуване. Поддържа 5-30 играчи.",
  url: absoluteUrl("/werewolf"),
  genre: "Социална дедукция",
  inLanguage: "bg-BG",
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 5, maxValue: 30 },
  playMode: "https://schema.org/MultiPlayer",
};

export default function WerewolfPage() {
  return (
    <>
      <JsonLd data={werewolfJsonLd} />
      <GameHomePage family="werewolves" />
    </>
  );
}
