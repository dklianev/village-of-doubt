import Link from "next/link";
import { type GameFamily } from "@werewolf/shared";
import { ResourceHints } from "@/components/resource-hints";
import { QuickStartSection, type QuickStartLastWinner, type QuickStartLiveStats } from "@/components/games/QuickStartSection";

export async function GameHomePage({ family }: { family: GameFamily }) {
  const isMafia = family === "mafia";
  const root = isMafia ? "/mafia" : "/werewolf";
  const title = isMafia ? "Мафия" : "Върколак";
  const subtitle = isMafia
    ? "Криминален ноар за град, който трябва да различи алиби от лъжа."
    : "Фолклорен хорър за село, което заспива заедно, но не всички се будят невинни.";
  const stats = await loadGameStats();

  return (
    <main className="shell game-home-shell" data-theme={family} data-family={family}>
      <ResourceHints images={[isMafia ? "/game-art/mobile/mafia/bg-landing-hero.webp" : "/game-art/mobile/bg-landing-hero.webp"]} />
      <section className="card game-home-hero rounded-[2rem] p-7">
        <p className="section-kicker">{isMafia ? "град под напрежение" : "нощ над селото"}</p>
        <h1 className="mt-3 text-6xl font-black leading-none md:text-8xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#ead9ba]">{subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`${root}/create`} className="btn btn-primary">
            Играй
          </Link>
          <Link href={`${root}/roles`} className="btn btn-secondary" prefetch={false}>
            Роли
          </Link>
          <Link href={`${root}/rules`} className="btn btn-secondary" prefetch={false}>
            Правила
          </Link>
          <Link href={`${root}/join`} className="btn btn-secondary" prefetch={false}>
            Влез с код
          </Link>
        </div>
      </section>

      <QuickStartSection family={family} liveStats={stats?.liveStats ?? null} lastWinner={stats?.lastWinner ?? null} />
    </main>
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
