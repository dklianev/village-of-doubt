import type { Metadata } from "next";
import { headers } from "next/headers";
import { createDatabase, getAchievementsForUser, getGameHistoryForUser } from "@werewolf/database";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { JsonLd } from "@/components/JsonLd";
import { PrivacyDashboard, type PrivacyUserSnapshot } from "@/components/privacy/PrivacyDashboard";
import { ResourceHints } from "@/components/resource-hints";
import { auth } from "@/lib/auth";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

const LAST_UPDATED = "17 май 2026";

export const metadata: Metadata = routeMetadata({
  title: "Поверителност | Върколак и Мафия",
  description: "Какви данни събираме, защо ги пазим и как можеш да упражниш правата си.",
  path: "/privacy",
  image: "/game-art/legal/privacy-banner.png",
  imageAlt: "Месингов сандък в светлина на свещ",
  robots: { index: true, follow: true },
  absoluteTitle: true,
});

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
      let totalGames = 0;
      let totalAchievements = 0;

      if (process.env.DATABASE_URL) {
        try {
          const db = createDatabase(process.env.DATABASE_URL);
          const [games, achievements] = await Promise.all([
            getGameHistoryForUser(db, session.user.id, 200),
            getAchievementsForUser(db, session.user.id),
          ]);
          totalGames = games.length;
          totalAchievements = achievements.length;
        } catch (error) {
          console.error("[privacy-snapshot]", error);
        }
      }

      const accounts = await auth.api.listUserAccounts({ headers: requestHeaders }).catch(() => []);
      const providers = new Set(accounts.map((account) => account.providerId));
      if (session.user.email) {
        providers.add("credential");
      }

      snapshot = {
        userId: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        emailVerified: session.user.emailVerified ?? false,
        memberSince: parseDate(session.user.createdAt),
        totalGames,
        totalAchievements,
        achievementTotal: ACHIEVEMENTS.length,
        providersUsed: providers.size,
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
    <main className="shell privacy-shell">
      <ResourceHints
        images={["/game-art/legal/privacy-banner.webp", "/game-art/legal/trust-flow-diagram.webp"]}
      />
      <JsonLd data={jsonLd} />
      <PrivacyDashboard lastUpdated={LAST_UPDATED} userSnapshot={snapshot} />
    </main>
  );
}

function fixtureSnapshot(): PrivacyUserSnapshot {
  return {
    userId: "privacy-visual-user",
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
