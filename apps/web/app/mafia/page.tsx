import type { Metadata } from "next";
import { GameHomePage } from "@/components/games/game-home-page";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Мафия — криминална нощ в града",
  description: "Криминална Мафия с алибита, Дон, Шериф и оцеляване в подозрителен град. Частни стаи без реклами.",
  path: "/mafia",
  image: "/game-art/og/og-mafia.png",
  imageAlt: "Дъждовна градска улица под фенер",
  ogDescription: "Алибита, Шериф, Дон. Кой говори истината?",
});

export default function MafiaPage() {
  return <GameHomePage family="mafia" />;
}
