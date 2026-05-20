import type { Metadata } from "next";
import Image from "next/image";
import { FriendsClient } from "@/components/friends-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Приятели | Върколак и Мафия",
  description: "Локален списък с хора за следващата стая и бърза покана за следваща игра.",
};

export default async function FriendsPage() {
  await requireSession("/friends");

  return (
    <main className="shell utility-shell friends-shell framed-shell">
      <div className="framed-shell-inner">
        <header className="friends-hero">
          <Image
            src="/game-art/legal/friends-banner.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 1180px) 100vw, 1180px"
            className="friends-hero-img"
          />
          <div className="friends-hero-scrim" aria-hidden />
          <div className="friends-hero-copy">
            <p className="friends-kicker">приятели</p>
            <h1>Покани групата за следваща маса.</h1>
            <p>
              Локален списък за имена, бележки и бърза покана. Данните остават само в твоя
              браузър.
            </p>
          </div>
        </header>
        <FriendsClient />
      </div>
    </main>
  );
}
