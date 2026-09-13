import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { GameHomePage } from "@/components/games/game-home-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Мафия — криминална нощ в града",
  description: "Мафия за 4-24 играчи с тайни роли, алибита и нощни действия. Създай частна стая и играй с приятели.",
  path: "/mafia",
  image: "/game-art/og/og-mafia.png",
  imageAlt: "Дъждовна градска улица под фенер",
  ogDescription: "Мафия за 4-24 играчи. Алибита, тайни роли. Кой говори истината?",
});

const mafiaJsonLd = {
  "@context": "https://schema.org",
  "@type": "Game",
  name: "Мафия",
  description: "Криминална Мафия с тайни роли, алибита и нощни действия. Поддържа 4-24 играчи.",
  url: absoluteUrl("/mafia"),
  genre: "Социална дедукция",
  inLanguage: "bg-BG",
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 4, maxValue: 24 },
  playMode: "https://schema.org/MultiPlayer",
};

export default function MafiaPage() {
  return (
    <>
      <JsonLd data={mafiaJsonLd} />
      <GameHomePage family="mafia" />
    </>
  );
}
