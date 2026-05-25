import type { Metadata } from "next";
import { Display, SceneCard } from "@werewolf/ui/server";
import { FriendsClient } from "@/components/friends-client";
import { requireSession } from "@/lib/require-session";
import "@/components/friends/FriendsBoard.module.css";

export const metadata: Metadata = {
  title: "Познати на масата | Върколак и Мафия",
  description: "Локален списък с хора за следващата стая и бърза покана за следваща игра.",
};

export default async function FriendsPage() {
  await requireSession("/friends");

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
            }}
          >
            <div className="friends-hero-copy">
              <Display size="h1">Покани групата за следваща маса.</Display>
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
