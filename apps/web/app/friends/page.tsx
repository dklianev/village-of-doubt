import type { Metadata } from "next";
import { SceneCard } from "@werewolf/ui/server";
import { FriendsClient } from "@/components/friends-client";
import { requireSession } from "@/lib/require-session";
import "@/components/friends/LegacyFriends.module.css";

export const metadata: Metadata = {
  title: "Познати на масата",
  description: "Локален списък с хора за следващата стая и бърза покана за следваща игра.",
};

type FriendsPageProps = {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const visualAuth = firstSearchValue((await searchParams)?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession("/friends");
  }

  return (
    <main className="shell utility-shell friends-shell framed-shell">
      <div className="framed-shell-inner">
        <header className="friends-hero" aria-label="Познати на масата">
          <SceneCard
            density="sm"
            background={{
              image: "var(--art-friends-social-hall)",
              overlay: "none",
              focalX: 52,
              focalY: 44,
              minHeight: "var(--friends-hero-height)",
            }}
          >
            <div className="friends-hero-copy">
              <p className="friends-kicker">познати на масата</p>
              <h1>Покани групата за следваща маса.</h1>
              <p>
                Локален списък за имена, бележки и бърза покана. Данните остават само в твоя браузър.
              </p>
            </div>
          </SceneCard>
        </header>
        <FriendsClient />
      </div>
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
