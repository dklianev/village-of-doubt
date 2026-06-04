import type { Metadata } from "next";
import { ACHIEVEMENTS } from "@werewolf/shared";
import Link from "next/link";
import { AchievementsClient, type OwnedAchievement } from "@/components/achievements-client";
import { JsonLd } from "@/components/JsonLd";
import { requireSession } from "@/lib/require-session";
import { absoluteUrl, routeMetadata } from "@/lib/seo";
import "@/components/achievements/LegacyAchievements.module.css";

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
      <section className="achievement-hero-card utility-hero achievement-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">легенди</p>
        <h1 className="mt-3 text-5xl font-black">Малките легенди след всяка игра</h1>
        <p className="achievement-hero-lede mt-4 max-w-3xl">
          Гравираните плочи разказват какво се е случило на масата: спасение, предателство, точен изстрел или
          самостоятелна победа.
        </p>
      </section>

      <AchievementsClient initialOwned={initialOwned} />

      <Link className="btn btn-secondary mt-6" href="/history">
        Виж записаните игри
      </Link>
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
