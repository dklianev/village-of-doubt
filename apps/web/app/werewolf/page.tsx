import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { GameHomePage } from "@/components/games/game-home-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Върколак — фолклорна нощ на масата",
  description:
    "Български фолклорен Върколак за 6-30 играчи с тайни роли, нощни действия и дневно гласуване. Играй в частни стаи с приятели.",
  path: "/werewolf",
  image: "/game-art/og/og-werewolf.png",
  imageAlt: "Лунна нощ над българско село",
  ogDescription: "Върколак за 6-30 играчи: тайни роли, селото срещу върколаците.",
});

const werewolfJsonLd = {
  "@context": "https://schema.org",
  "@type": "Game",
  name: "Върколак",
  description: "Фолклорен Върколак с тайни роли, нощни действия и дневно гласуване. Поддържа 6-30 играчи.",
  url: absoluteUrl("/werewolf"),
  genre: "Социална дедукция",
  inLanguage: "bg-BG",
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 6, maxValue: 30 },
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
