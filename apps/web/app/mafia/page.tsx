import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { GameHomePage } from "@/components/games/game-home-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Мафия — криминална нощ в града",
  description: "Криминална Мафия с алибита, Дон, Шериф и оцеляване в подозрителен град. Частни стаи без реклами.",
  path: "/mafia",
  image: "/game-art/og/og-mafia.png",
  imageAlt: "Дъждовна градска улица под фенер",
  ogDescription: "Алибита, Шериф, Дон. Кой говори истината?",
});

const mafiaJsonLd = {
  "@context": "https://schema.org",
  "@type": "Game",
  name: "Мафия",
  description: "Криминална Мафия с тайни роли, алибита и нощни действия. Поддържа 5-30 играчи.",
  url: absoluteUrl("/mafia"),
  genre: "Социална дедукция",
  inLanguage: "bg-BG",
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 5, maxValue: 30 },
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
