import type { Metadata } from "next";
import "@/components/legal/LegalShell.module.css";
import "@/components/privacy/LegacyPrivacy.module.css";
import { headers } from "next/headers";
import { createDatabase, getAchievementsForUser, getPlayerGameStatistics } from "@werewolf/database";
import { ACHIEVEMENTS, safeMonitoringErrorMetadata } from "@werewolf/shared";
import { JsonLd } from "@/components/JsonLd";
import { PrivacyDashboard, type PrivacyUserSnapshot } from "@/components/privacy/PrivacyDashboard";
import { auth } from "@/lib/auth";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

const LAST_UPDATED = "17 май 2026";

export const metadata: Metadata = routeMetadata({
  title: "Поверителност",
  description: "Какви данни събираме, защо ги пазим и как можеш да упражниш правата си.",
  path: "/privacy",
  image: "/game-art/legal/privacy-banner.png",
  imageAlt: "Месингов сандък в светлина на свещ",
  robots: { index: true, follow: true },
});

export const instant = false;

interface PrivacyPageProps {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
}

export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const params = await searchParams;
  const useVisualAuthFixture =
    process.env.NODE_ENV !== "production" && firstSearchValue(params?.visualAuth) === "1";

  let snapshot: PrivacyUserSnapshot | null = useVisualAuthFixture ? fixtureSnapshot() : null;

  if (!useVisualAuthFixture) {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);

    if (session?.user?.id) {
      let totalGames: number | null = null;
      let totalAchievements: number | null = null;

      if (process.env.DATABASE_URL) {
        try {
          const db = createDatabase(process.env.DATABASE_URL);
          [totalGames, totalAchievements] = await Promise.all([
            getPlayerGameStatistics(db, session.user.id)
              .then((statistics) => statistics.totalGames)
              .catch(snapshotUnavailable),
            getAchievementsForUser(db, session.user.id)
              .then((achievements) => achievements.length)
              .catch(snapshotUnavailable),
          ]);
        } catch (error) {
          snapshotUnavailable(error);
        }
      }

      const accounts = await auth.api.listUserAccounts({ headers: requestHeaders }).catch(() => null);

      snapshot = {
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        emailVerified: session.user.emailVerified ?? false,
        memberSince: parseDate(session.user.createdAt),
        totalGames,
        totalAchievements,
        achievementTotal: ACHIEVEMENTS.length,
        providersUsed: accounts === null ? null : new Set(accounts.map((account) => account.providerId)).size,
      };
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Поверителност",
    inLanguage: "bg-BG",
    dateModified: "2026-05-17",
    url: absoluteUrl("/privacy"),
  };

  return (
    <main className="shell legal-page-shell privacy-shell">
      <JsonLd data={jsonLd} />
      <PrivacyDashboard lastUpdated={LAST_UPDATED} userSnapshot={snapshot} />
    </main>
  );
}

function fixtureSnapshot(): PrivacyUserSnapshot {
  return {
    name: "Визуален играч",
    email: "visual@example.com",
    emailVerified: true,
    memberSince: new Date("2026-03-10T10:00:00.000Z"),
    totalGames: 8,
    totalAchievements: 3,
    achievementTotal: ACHIEVEMENTS.length,
    providersUsed: 2,
  };
}

function snapshotUnavailable(error: unknown): null {
  console.error("[privacy-snapshot]", safeMonitoringErrorMetadata(error));
  return null;
}

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
