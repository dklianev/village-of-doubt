import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, KeyRound, Users, Radio } from "lucide-react";
import { type GameFamily } from "@werewolf/shared";
import { playerRange } from "@/lib/lobby-form/selectors";
import { NextLinkPill } from "@/components/next-link-pill";
import { MafiaMechanicsCallouts } from "@/components/games/MafiaMechanicsCallouts";
import { MafiaNightTimeline } from "@/components/games/MafiaNightTimeline";
import { RoleSpotlight } from "@/components/games/RoleSpotlight";
import { SportMafiaCallout } from "@/components/games/SportMafiaCallout";
import { VariantsChips } from "@/components/games/VariantsChips";
import { WerewolfNightTimeline } from "@/components/games/WerewolfNightTimeline";
import { LiveTickerCard, type LiveStats } from "@/components/landing/LiveTickerCard";
import { RecentEndingsCard, type Ending } from "@/components/landing/RecentEndingsCard";
import "@/components/landing/LandingSurface.module.css";
import "@/components/games/GameHomePage.module.css";

export function GameHomePage({ family }: { family: GameFamily }) {
  return (
    <main className="shell game-home-shell" data-faction={family} data-family={family}>
      <GameHero family={family} />

      {family === "werewolves" ? <WerewolfNightTimeline /> : <MafiaNightTimeline />}
      <RoleSpotlight family={family} />
      {family === "werewolves" ? (
        <VariantsChips family="werewolves" />
      ) : (
        <>
          <MafiaMechanicsCallouts />
          <SportMafiaCallout />
        </>
      )}

      <Suspense fallback={<GameStatsFallback />}>
        <GameStatsRow family={family} />
      </Suspense>
      <GameHomeClosing family={family} />
    </main>
  );
}

async function GameStatsRow({ family }: { family: GameFamily }) {
  const stats = await loadGameStats();
  return <GameStatsContent family={family} stats={stats} />;
}

type GameHomeStats = { liveStats: LiveStats; recentEndings: Ending[] };

export function GameStatsContent({ family, stats }: { family: GameFamily; stats: GameHomeStats | null }) {
  if (!stats) {
    return (
      <aside className="family-stats-unavailable" aria-label="Данни за игрите">
        <Radio size={18} aria-hidden="true" />
        <p>Временно няма връзка с данните за игрите.</p>
        <Link href="/status" className="family-text-link">Състояние<ArrowRight size={15} aria-hidden="true" /></Link>
      </aside>
    );
  }

  return (
    <div className="landing-stats-row quickstart-row">
      <LiveTickerCard family={family} liveStats={stats.liveStats} />
      <RecentEndingsCard family={family} endings={stats.recentEndings} />
    </div>
  );
}

function GameStatsFallback() {
  return (
    <div className="family-stats-loading" aria-hidden="true" />
  );
}

export function GameHero({ family }: { family: GameFamily }) {
  const isMafia = family === "mafia";
  const root = isMafia ? "/mafia" : "/werewolf";
  const range = playerRange(isMafia ? "mafia_free" : "werewolves_classic");

  return (
    <section className={isMafia ? "game-home-hero is-mafia" : "game-home-hero is-werewolf"}>
      <div className="game-home-hero__scene" aria-hidden="true">
        <div className="game-home-hero__art" />
        <div className="game-home-hero__scrim" />
      </div>
      <div className="game-home-hero__content">
        <p className="section-kicker">{isMafia ? "град под напрежение" : "нощ над селото"}</p>
        <h1>{isMafia ? "Мафия" : "Върколак"}</h1>
        <span className="game-home-title-accent" aria-hidden="true" />
        <p className="game-home-hero__lede">
          {isMafia ? "Всеки има алиби. Някой на масата има и причина да лъже." : "Денем сте съседи. Нощем не всички сте хора."}
        </p>
        <ul className="game-home-hero__facts" aria-label="За играта">
          <li><Users size={16} aria-hidden="true" />{range.min}–{range.max} играчи</li>
          <li>{isMafia ? "Свободен или спортен формат" : "Най-добре с 8–18 приятели"}</li>
        </ul>
        <div className="game-home-hero__actions">
          <NextLinkPill
            href={`${root}/create`}
            className="game-home-hero__primary"
            intent="primary"
            size="lg"
            shimmer
            tracked
          >
            Създай стая
          </NextLinkPill>
          <NextLinkPill href={`${root}/join`} intent="secondary" size="lg" className="game-home-hero__join">
            <KeyRound size={17} aria-hidden="true" />Имам код
          </NextLinkPill>
        </div>
        <nav className="game-home-hero__secondary-links" aria-label="За ролите и правилата">
          <Link href={`${root}/roles`} prefetch={false}>
            Роли
          </Link>
          <Link href={`${root}/rules`} prefetch={false}>
            Правила
          </Link>
        </nav>
      </div>
    </section>
  );
}

export function GameHomeClosing({ family }: { family: GameFamily }) {
  const root = family === "mafia" ? "/mafia" : "/werewolf";
  return (
    <section className="game-home-closing" aria-labelledby={`${family}-invitation-title`}>
      <div>
        <p className="section-kicker">следващата вечер</p>
        <h2 id={`${family}-invitation-title`}>{family === "mafia" ? "Събери масата." : "Събери селото."}</h2>
        <p>Приятелите са същите. Ролите остават тайна.</p>
      </div>
      <div className="game-home-closing__actions">
        <NextLinkPill href={`${root}/create`} size="lg">Създай стая<ArrowRight size={17} aria-hidden="true" /></NextLinkPill>
        <NextLinkPill href={`${root}/join`} intent="secondary" size="lg">Имам код</NextLinkPill>
      </div>
    </section>
  );
}

async function loadGameStats(): Promise<GameHomeStats | null> {
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/^ws/, "http") ?? "http://localhost:2567";
  try {
    const response = await fetch(`${gameServerUrl}/stats`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) {
      return null;
    }
    const stats = (await response.json()) as {
      activeRooms?: number;
      connectedPlayers?: number;
      byFamily?: Partial<Record<GameFamily, number>>;
      recentEndings?: Ending[];
      lastWinner?: Ending | null;
    };

    return {
      liveStats: {
        activeRooms: stats.activeRooms ?? 0,
        connectedPlayers: stats.connectedPlayers ?? 0,
        ...(stats.byFamily ? { byFamily: stats.byFamily } : {}),
      },
      recentEndings: stats.recentEndings ?? (stats.lastWinner ? [stats.lastWinner] : []),
    };
  } catch {
    return null;
  }
}
