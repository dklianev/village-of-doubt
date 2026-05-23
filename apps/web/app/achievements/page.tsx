import type { Metadata } from "next";
import { Display, Pill, SceneCard } from "@werewolf/ui/server";
import { AchievementsClient } from "@/components/achievements-client";
import { JsonLd } from "@/components/JsonLd";
import { requireSession } from "@/lib/require-session";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Постижения — малките легенди",
  description: "Колекция от моменти, отключени от записите: първа кръв, спасени нощи, лични победи и финални обрати.",
  path: "/achievements",
  image: "/game-art/og/og-achievements.png",
  imageAlt: "Стена с празни месингови плочи за постижения",
  ogDescription: "Плочи за спасения, предателства, точни изстрели и лични победи.",
});

const achievementsJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Постижения",
  description: "Колекция от игрови постижения, отключени от записите и победите.",
  url: absoluteUrl("/achievements"),
  inLanguage: "bg-BG",
};

export default async function AchievementsPage() {
  await requireSession("/achievements");

  return (
    <main className="shell utility-shell achievement-shell">
      <JsonLd data={achievementsJsonLd} />
      <section className="achievement-hero-frame" aria-label="Легенди">
        <SceneCard eyebrow="ЛЕГЕНДИ" density="lg">
          <div className="achievement-hero-copy">
            <Display size="h1">Малките легенди след всяка игра</Display>
            <p>
              Гравираните плочи разказват какво се е случило на масата: спасение, предателство, точен изстрел или
              самостоятелна победа.
            </p>
          </div>
        </SceneCard>
      </section>

      <AchievementsClient />

      <div className="achievement-return">
        <Pill as="a" href="/history" intent="secondary">
          Виж записаните игри
        </Pill>
      </div>
    </main>
  );
}
