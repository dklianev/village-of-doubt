import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { GameRulesPage } from "@/components/games/game-rules-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Правила за Върколак — нощ, ден и паритет",
  description: "Научи правилата за Върколак: лоби, тайни роли, нощни действия, дневен спор, гласуване, паритет и победа.",
  path: "/werewolf/rules",
  image: "/game-art/og/og-werewolf.png",
  imageAlt: "Лунна нощ над българско село",
  ogDescription: "От първата нощ до последния глас на селото.",
});

const werewolfRulesJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Как се играе Върколак",
  description: "Фазите на една игра на Върколак: лоби, роли, нощ, ден, гласуване и развръзка.",
  url: absoluteUrl("/werewolf/rules"),
  inLanguage: "bg-BG",
  step: [
    { "@type": "HowToStep", name: "Лоби", text: "Домакинът избира роли, таймери и начин на разговор.", position: 1 },
    { "@type": "HowToStep", name: "Разкриване на роли", text: "Всеки вижда само своята тайна карта.", position: 2 },
    { "@type": "HowToStep", name: "Нощ", text: "Активните роли действат в скрит ред.", position: 3 },
    { "@type": "HowToStep", name: "Ден", text: "Живите играчи обсъждат кой лъже.", position: 4 },
    { "@type": "HowToStep", name: "Гласуване", text: "Масата избира кого да елиминира.", position: 5 },
    { "@type": "HowToStep", name: "Развръзка", text: "Сървърът прилага ефектите и проверява победата.", position: 6 },
  ],
};

export default function WerewolfRulesPage() {
  return (
    <>
      <JsonLd data={werewolfRulesJsonLd} />
      <GameRulesPage family="werewolves" />
    </>
  );
}
