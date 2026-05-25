import type { Metadata } from "next";
import { Display, SceneCard } from "@werewolf/ui/server";
import { FriendsClient } from "@/components/friends-client";
import { requireSession } from "@/lib/require-session";
import "@/components/friends/FriendsBoard.module.css";

export const metadata: Metadata = {
  title: "Познати на масата | Върколак и Мафия",
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
        <header className="friends-hero-frame" aria-label="Познати на масата">
          <SceneCard
            eyebrow="ПОЗНАТИ НА МАСАТА"
            density="lg"
            background={{
              image: "var(--art-friends)",
              overlay: "scrim",
              focalY: 42,
              minHeight: "var(--ds-scene-hero-min-standard)",
            }}
          >
            <div className="friends-hero-copy">
              <Display size="hero">Покани групата за следваща маса.</Display>
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
