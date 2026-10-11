import type { Metadata } from "next";
import { createDatabase, getAchievementsForUser, getReplayEligibleGameIds } from "@werewolf/database";
import { ACHIEVEMENTS, safeMonitoringErrorMetadata } from "@werewolf/shared";
import { AchievementsClient, type OwnedAchievement } from "@/components/achievements-client";
import { JsonLd } from "@/components/JsonLd";
import { requireSession } from "@/lib/require-session";
import { isUuid } from "@/lib/identifiers";
import { absoluteUrl, routeMetadata } from "@/lib/seo";
import "@/components/achievements/LegacyAchievements.module.css";

export const metadata: Metadata = routeMetadata({
  title: "Легенди — малките победи",
  description: "Колекция от моменти, отключени от записите: първа кръв, спасени нощи, лични победи и финални обрати.",
  path: "/achievements",
  image: "/game-art/og/og-achievements.jpg",
  imageAlt: "Колекция от отличия за изиграните вечери в Сенките",
  ogDescription: "Твоите отличия за спасения, точни изстрели и лични победи.",
  robots: { index: false, follow: false },
});

export const instant = false;

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
  let userId: string | null = null;
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    userId = (await requireSession("/achievements")).user.id;
  }

  const fixtureEnabled = process.env.NODE_ENV !== "production" && visualAuth === "1";
  const { owned, status } = fixtureEnabled && visualAchievements === "fixture"
    ? { owned: visualAchievementFixture(), status: "ready" as const }
    : fixtureEnabled && visualAchievements === "empty"
    ? { owned: [], status: "ready" as const }
    : fixtureEnabled && visualAchievements === "unavailable"
    ? { owned: [], status: "unavailable" as const }
    : await loadOwnedAchievements(userId);

  return (
    <main className="shell utility-shell achievement-shell">
      <JsonLd data={achievementsJsonLd} />
      <AchievementsClient owned={owned} status={status} visualReplay={fixtureEnabled && visualAchievements === "fixture"} />
    </main>
  );
}

async function loadOwnedAchievements(
  userId: string | null,
): Promise<{ owned: OwnedAchievement[]; status: "ready" | "unavailable" }> {
  if (!userId || !process.env.DATABASE_URL) {
    return { owned: [], status: "unavailable" };
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const achievements = await getAchievementsForUser(db, userId);
    const catalogIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
    const gameIds = [...new Set(achievements
      .filter((achievement) => catalogIds.has(achievement.achievementId))
      .map((achievement) => achievement.gameId)
      .filter((gameId): gameId is string => gameId !== null && isUuid(gameId)))];
    let replayGameIds = new Set<string>();
    if (gameIds.length > 0) {
      try {
        // Only completed participant games qualify; the route rechecks access on navigation.
        replayGameIds = await getReplayEligibleGameIds(db, userId, gameIds);
      } catch (error) {
        console.error("[achievement-replay-links]", safeMonitoringErrorMetadata(error));
      }
    }
    return {
      owned: achievements.map((achievement) => ({
        achievementId: achievement.achievementId,
        gameId: achievement.gameId && replayGameIds.has(achievement.gameId) ? achievement.gameId : null,
        unlockedAt: achievement.unlockedAt.toISOString(),
      })),
      status: "ready",
    };
  } catch (error) {
    console.error("[achievements-page]", safeMonitoringErrorMetadata(error));
    return { owned: [], status: "unavailable" };
  }
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function visualAchievementFixture(): OwnedAchievement[] {
  const unlockedIds = new Set(["first_blood", "jester_win", "hunter_revenge", "maniac_endgame"]);
  return ACHIEVEMENTS.filter((achievement) => unlockedIds.has(achievement.id)).map((achievement, index) => ({
    achievementId: achievement.id,
    gameId: index === 0 ? null : `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    unlockedAt: new Date(Date.UTC(2026, 4, 20 + index, 18, 30)).toISOString(),
  }));
}
