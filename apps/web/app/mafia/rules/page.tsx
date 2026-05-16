import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { GameRulesPage } from "@/components/games/game-rules-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Правила за Мафия — алибита и присъди",
  description: "Научи правилата за Мафия: роли, нощни договорки, дневни обвинения, гласуване, градски отбор и финална развръзка.",
  path: "/mafia/rules",
  image: "/game-art/og/og-mafia.png",
  imageAlt: "Дъждовна градска улица под фенер",
  ogDescription: "Нощни договорки, дневни обвинения и градска развръзка.",
});

const mafiaRulesJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Как се играе Мафия",
  description: "Фазите на една игра на Мафия: маса, досие, нощ, обвинения, гласуване и развръзка.",
  url: absoluteUrl("/mafia/rules"),
  inLanguage: "bg-BG",
  step: [
    { "@type": "HowToStep", name: "Маса", text: "Домакинът избира режим, роли, таймери и правила.", position: 1 },
    { "@type": "HowToStep", name: "Досие", text: "Всеки получава своята тайна карта.", position: 2 },
    { "@type": "HowToStep", name: "Нощ", text: "Мафията и активните роли действат скрито.", position: 3 },
    { "@type": "HowToStep", name: "Ден", text: "Градът обсъжда алибита и подозрения.", position: 4 },
    { "@type": "HowToStep", name: "Гласуване", text: "Живите играчи избират присъда.", position: 5 },
    { "@type": "HowToStep", name: "Развръзка", text: "Сървърът прилага резултата и проверява победата.", position: 6 },
  ],
};

export default function MafiaRulesPage() {
  return (
    <>
      <JsonLd data={mafiaRulesJsonLd} />
      <GameRulesPage family="mafia" />
    </>
  );
}
