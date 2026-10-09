import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { TutorialFlipbook } from "@/components/tutorial/TutorialFlipbook";
import { SlideSetup } from "@/components/tutorial/SlideSetup";
import "@/components/tutorial/Tutorial.module.css";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Първа игра — наръчник в шест сцени",
  description: "Първи стъпки във Върколак и Мафия: тайни роли, нощни действия, обсъждане и победа. Опитай примерното гласуване, преди да събереш компанията.",
  path: "/tutorial",
  image: "/game-art/og/og-tutorial.png",
  imageAlt: "Маса с книга, свещ и карти",
  ogDescription: "Шест сцени за първата ти вечер: разбери целта, опитай гласуването и избери игра.",
});

const tutorialJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Как започва добра игра на Върколак или Мафия",
  description: "Шест сцени, които те водят през една вечер на масата.",
  inLanguage: "bg-BG",
  step: [
    { "@type": "HowToStep", name: "Преди нощта", text: "Домакинът създава стая и споделя кода. Всеки получава тайна роля и цел за победа.", position: 1 },
    { "@type": "HowToStep", name: "Нощта", text: "Активните роли избират цел и получават личните си резултати. Останалите изчакват утрото.", position: 2 },
    { "@type": "HowToStep", name: "Денят", text: "Живите играчи обсъждат следите и сравняват версиите си.", position: 3 },
    { "@type": "HowToStep", name: "Гласът", text: "Избери примерен играч и потвърди гласа си. Изборът и потвърждението са отделни действия.", position: 4 },
    { "@type": "HowToStep", name: "Развръзката", text: "Правилата на стаята определят елиминацията и разкриването на ролята. Ако няма победител, започва нова нощ.", position: 5 },
    { "@type": "HowToStep", name: "Избери игра", text: "Започни Върколак или Мафия, или продължи към получената покана.", position: 6 },
  ],
};

type TutorialPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function TutorialContent({ searchParams }: TutorialPageProps) {
  // Resolve URL data on the server so the scene and its preload precede hydration.
  await searchParams;
  return <TutorialFlipbook setupScenes={{
    werewolves_classic: <SlideSetup mode="werewolves_classic" />,
    mafia_free: <SlideSetup mode="mafia_free" />,
    mafia_sport: <SlideSetup mode="mafia_sport" />,
  }} />;
}

export default function TutorialPage(props: TutorialPageProps) {
  return (
    <main className="shell tutorial-shell">
      <JsonLd data={tutorialJsonLd} />
      <Suspense fallback={null}>
        <TutorialContent {...props} />
      </Suspense>
    </main>
  );
}
