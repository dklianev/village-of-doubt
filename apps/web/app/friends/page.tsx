import type { Metadata } from "next";
import Image from "next/image";
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
            <p className="friends-kicker">познати на масата</p>
            <h1>Покани групата за следваща маса.</h1>
            <p>
              Локален списък за имена, бележки и бърза покана. Данните остават само в твоя браузър.
            </p>
          </div>
        </header>
        <FriendsClient />
      </div>
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
