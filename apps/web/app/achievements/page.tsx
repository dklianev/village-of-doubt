import type { Metadata } from "next";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { Display, Pill, SceneCard } from "@werewolf/ui/server";
import { AchievementsClient, type OwnedAchievement } from "@/components/achievements-client";
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
  searchParams?: Promise<{ visualAuth?: string | string[]; visualAchievements?: string | string[] }>;
};

export default async function AchievementsPage({ searchParams }: AchievementsPageProps) {
  const resolvedSearchParams = await searchParams;
  const visualAuth = firstSearchValue(resolvedSearchParams?.visualAuth);
  const visualAchievements = firstSearchValue(resolvedSearchParams?.visualAchievements);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession("/achievements");
  }

  const initialOwned =
    process.env.NODE_ENV !== "production" && visualAuth === "1" && visualAchievements === "fixture"
      ? visualAchievementFixture()
      : undefined;

  return (
    <main className="shell utility-shell achievement-shell">
      <JsonLd data={achievementsJsonLd} />
      <section className="achievement-hero-frame" aria-label="Легенди">
        <SceneCard
          eyebrow="ЛЕГЕНДИ"
          density="lg"
          background={{
            image: "var(--art-achievements)",
            overlay: "veil",
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

      <AchievementsClient initialOwned={initialOwned} />

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

function visualAchievementFixture(): OwnedAchievement[] {
  const unlockedIds = new Set(["first_blood", "jester_win", "hunter_revenge", "maniac_endgame"]);
  return ACHIEVEMENTS.filter((achievement) => unlockedIds.has(achievement.id)).map((achievement, index) => ({
    achievementId: achievement.id,
    gameId: `visual-game-${index + 1}`,
    unlockedAt: new Date(Date.UTC(2026, 4, 20 + index, 18, 30)).toISOString(),
  }));
}
