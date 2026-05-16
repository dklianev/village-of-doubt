import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { TutorialFlipbook } from "@/components/tutorial/TutorialFlipbook";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Първа игра — наръчник в шест сцени",
  description: "Кинематографичен наръчник за първа игра след вход. Шест сцени, един интерактивен момент, готов си за първата стая.",
  path: "/tutorial",
  image: "/game-art/og/og-tutorial.png",
  imageAlt: "Маса с книга, свещ и карти",
  ogDescription: "Една вечер, шест сцени. Научи масата преди първата нощ.",
});

const tutorialJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Как започва добра игра на Върколак или Мафия",
  description: "Шест сцени, които те водят през една вечер на масата.",
  totalTime: "PT15M",
  inLanguage: "bg-BG",
  step: [
    { "@type": "HowToStep", name: "Преди нощта", text: "Седем-осем приятели сядат на маса. Споделят код, влизат в стая.", position: 1 },
    { "@type": "HowToStep", name: "Нощта", text: "Активните роли действат тайно — Върколаци избират цел, Лечител пази един.", position: 2 },
    { "@type": "HowToStep", name: "Денят", text: "Денят се събужда. Един от вас вече го няма. Денят е за четене на масата.", position: 3 },
    { "@type": "HowToStep", name: "Гласът", text: "Гласът оставя следа. Записва се кой кого посочи и кога е сменил мнение.", position: 4 },
    { "@type": "HowToStep", name: "Развръзката", text: "Една роля се разкрива, една група научава дали играта продължава.", position: 5 },
    { "@type": "HowToStep", name: "Готов?", text: "Шест сцени, една вечер. Сега си готов да отвориш първа стая.", position: 6 },
  ],
};

export default function TutorialPage() {
  return (
    <main className="shell tutorial-shell">
      <JsonLd data={tutorialJsonLd} />
      <Suspense fallback={null}>
        <TutorialFlipbook />
      </Suspense>
    </main>
  );
}
