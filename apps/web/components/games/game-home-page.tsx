import Link from "next/link";
import { type GameFamily } from "@werewolf/shared";
import { ResourceHints } from "@/components/resource-hints";
import { QuickStartSection, type QuickStartLastWinner, type QuickStartLiveStats } from "@/components/games/QuickStartSection";

export async function GameHomePage({ family }: { family: GameFamily }) {
  const isMafia = family === "mafia";
  const root = isMafia ? "/mafia" : "/werewolf";
  const title = isMafia ? "Мафия" : "Върколак";
  const eyebrow = isMafia ? "град под напрежение" : "нощ над селото";
  const subtitle = isMafia
    ? "Криминален ноар за град, който трябва да различи алиби от лъжа."
    : "Фолклорен хорър за село, което заспива заедно, но не всички се будят невинни.";
  const stats = await loadGameStats();
  const heroImages = isMafia
    ? ["/game-art/mafia/bg-hero-v2.webp", "/game-art/mobile/mafia/bg-hero-v2.webp"]
    : ["/game-art/werewolf/bg-hero-v2.webp", "/game-art/mobile/werewolf/bg-hero-v2.webp"];

  return (
    <main className="shell game-home-shell" data-theme={family} data-family={family}>
      <ResourceHints images={heroImages} />
      <GameHero family={family} root={root} eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <QuickStartSection family={family} liveStats={stats?.liveStats ?? null} lastWinner={stats?.lastWinner ?? null} />
    </main>
  );
}

function GameHero({
  family,
  root,
  eyebrow,
  title,
  subtitle,
}: {
  family: GameFamily;
  root: "/werewolf" | "/mafia";
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const isMafia = family === "mafia";

  return (
    <section className={isMafia ? "card game-home-hero is-mafia" : "card game-home-hero is-werewolf"}>
      <div className="game-home-hero__art" aria-hidden="true" />
      <div className="game-home-hero__scrim" aria-hidden="true" />
      <div className="game-home-hero__vignette" aria-hidden="true" />
      <div className={isMafia ? "game-home-hero__rain" : "game-home-hero__fog"} aria-hidden="true" />
      <div className="game-home-hero__grain" aria-hidden="true" />
      <div className="game-home-hero__content">
        <p className="section-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <span className="game-home-title-accent" aria-hidden="true" />
        <p className="game-home-hero__lede">{subtitle}</p>
        <div className="game-home-hero__actions">
          <Link href={`${root}/create`} className="game-home-hero__primary">
            Играй
          </Link>
          <div className="game-home-hero__secondary-links" aria-label="Още действия">
            <Link href={`${root}/roles`} prefetch={false}>
              Роли
            </Link>
            <Link href={`${root}/rules`} prefetch={false}>
              Правила
            </Link>
            <Link href={`${root}/join`} prefetch={false}>
              Влез с код
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

async function loadGameStats(): Promise<{ liveStats: QuickStartLiveStats; lastWinner: QuickStartLastWinner | null } | null> {
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/^ws/, "http") ?? "http://localhost:2567";
  try {
    const response = await fetch(`${gameServerUrl}/stats`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      return null;
    }
    const stats = (await response.json()) as {
      activeRooms?: number;
      connectedPlayers?: number;
      lastWinner?: QuickStartLastWinner | null;
    };

    return {
      liveStats: {
        activeRooms: stats.activeRooms ?? 0,
        connectedPlayers: stats.connectedPlayers ?? 0,
      },
      lastWinner: stats.lastWinner ?? null,
    };
  } catch {
    return null;
  }
}
