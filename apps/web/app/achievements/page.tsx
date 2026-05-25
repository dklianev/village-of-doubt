import type { Metadata } from "next";
import { Display, Pill, SceneCard } from "@werewolf/ui/server";
import { AchievementsClient } from "@/components/achievements-client";
import { JsonLd } from "@/components/JsonLd";
import { requireSession } from "@/lib/require-session";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Легенди — малките победи",
  description: "Колекция от моменти, отключени от записите: първа кръв, спасени нощи, лични победи и финални обрати.",
  path: "/achievements",
  image: "/game-art/og/og-achievements.png",
  imageAlt: "Стена с празни месингови плочи за легенди",
  ogDescription: "Плочи за спасения, предателства, точни изстрели и лични победи.",
});

const achievementsJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Легенди",
  description: "Колекция от игрови легенди, отключени от записите и победите.",
  url: absoluteUrl("/achievements"),
  inLanguage: "bg-BG",
};

type AchievementsPageProps = {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
};

export default async function AchievementsPage({ searchParams }: AchievementsPageProps) {
  const visualAuth = firstSearchValue((await searchParams)?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession("/achievements");
  }

  return (
    <main className="shell utility-shell achievement-shell">
      <JsonLd data={achievementsJsonLd} />
      <section className="achievement-hero-frame" aria-label="Легенди">
        <SceneCard
          eyebrow="ЛЕГЕНДИ"
          density="lg"
          background={{
            image: "var(--art-achievements)",
            overlay: "scrim",
            focalY: 40,
            minHeight: "var(--ds-scene-hero-min-cinematic)",
          }}
        >
          <div className="achievement-hero-copy">
            <Display size="hero">Малките легенди след всяка игра</Display>
            <p>
              Гравираните плочи разказват какво се е случило на масата: спасение, предателство, точен изстрел или
              самостоятелна победа.
            </p>
          </div>
        </SceneCard>
      </section>

      <AchievementsClient />

      <div className="achievement-return">
        <Pill as="a" href="/history" intent="secondary" tracked>
          Виж записаните игри
        </Pill>
      </div>
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
