import { Suspense } from "react";
import Image from "next/image";
import { Display, Pill, SceneCard } from "@werewolf/ui/server";
import type { GameFamily } from "@werewolf/shared";
import { ResourceHints } from "@/components/resource-hints";
import { ModeChoiceCards, type ModeChoiceGame } from "@/components/landing/ModeChoiceCards";
import { UniversalHowToPlay } from "@/components/landing/UniversalHowToPlay";
import { LiveTickerCard, type LiveStats } from "@/components/landing/LiveTickerCard";
import { RecentEndingsCard, type Ending } from "@/components/landing/RecentEndingsCard";
import "@/components/landing/LandingSurface.module.css";

export type LandingSession = { user: { id: string; name?: string | null } } | null;

const GAMES = [
  {
    id: "werewolf",
    family: "werewolves",
    title: "Върколак",
    eyebrow: "фолклорен хорър",
    description:
      "Класическо село с тайни роли, нощни събуждания, Върколаци, Вампири и Разказвач.",
    line: "Първо пада мъглата. После някой лъже прекалено спокойно.",
    href: "/werewolf",
  },
  {
    id: "mafia",
    family: "mafia",
    title: "Мафия",
    eyebrow: "градска мистерия",
    description:
      "Криминална маса с Град, Мафия, Комисар, Доктор, Кръстник и роли за по-опитни групи.",
    line: "Дъждът измива улицата, но не и алибитата.",
    href: "/mafia",
  },
] as const satisfies readonly ModeChoiceGame[];

export function LandingExperience({ initialSession }: { initialSession: LandingSession }) {
  return (
    <main className="shell landing-shell">
      <ResourceHints
        images={[
          { href: "/game-art/bg-landing-hero-composited.webp?v=2", media: "(min-width: 721px)" },
          { href: "/game-art/bg-landing-ambient-composited.webp", media: "(min-width: 721px)" },
          { href: "/game-art/mobile/bg-landing-hero-composited.webp?v=2", media: "(max-width: 720px)" },
          { href: "/game-art/mobile/bg-landing-ambient-composited.webp", media: "(max-width: 720px)" },
          { href: "/game-art/logo-landing-mark.webp" },
        ]}
      />
      <section className="card landing-hero-card rounded-[2rem] p-7">
        <LandingLogoMark />
        <p className="section-kicker">избери игра</p>
        <h1 className="mt-5 text-5xl font-black leading-none text-[#f4e8d1] md:text-7xl">
          Върколак или Мафия
        </h1>
        <p className="landing-hero-copy mt-6 max-w-3xl text-lg leading-8 text-[#ead9ba]">
          Две отделни игри, два отделни речника и два отделни набора роли. Влизаш с име, създаваш стая
          или въвеждаш код и започваш веднага.
        </p>

        <ModeChoiceCards games={GAMES} initialSession={initialSession} />
      </section>
      <UniversalHowToPlay />
      <Suspense fallback={<LandingStatsSkeleton />}>
        <LandingStatsRow />
      </Suspense>
      <FinalLandingCta />
    </main>
  );
}

async function LandingStatsRow() {
  const stats = await loadGameStats();

  return (
    <div className="landing-stats-row quickstart-row">
      <LiveTickerCard family={null} liveStats={stats?.liveStats ?? null} />
      <RecentEndingsCard family={null} endings={stats?.recentEndings ?? []} />
    </div>
  );
}

function LandingStatsSkeleton() {
  return (
    <div className="landing-stats-row quickstart-row" aria-hidden="true">
      <div className="quickstart-mini-card quickstart-skeleton" />
      <div className="quickstart-mini-card quickstart-skeleton" />
    </div>
  );
}

function FinalLandingCta() {
  return (
    <section className="landing-final-cta" aria-label="Готов ли си да седнеш на масата">
      <SceneCard
        eyebrow="ГОТОВ ЛИ СИ?"
        density="md"
        background={{
          image: "var(--landing-final-art)",
          overlay: "scrim",
          minHeight: "clamp(260px, 30vh, 360px)",
        }}
      >
        <div className="landing-final-copy">
          <Display size="h2">Сядаме на масата.</Display>
          <p>Избери коя игра започва вечерта ти.</p>
        </div>
        <div className="landing-final-actions">
          <Pill as="a" href="/werewolf" intent="faction" shimmer tracked data-faction="werewolves">
            Към върколаците
          </Pill>
          <Pill as="a" href="/mafia" intent="faction" shimmer tracked data-faction="mafia">
            Към мафията
          </Pill>
        </div>
      </SceneCard>
    </section>
  );
}

function LandingLogoMark() {
  return (
    <span className="landing-logo-mark" aria-hidden="true">
      <Image src="/game-art/logo-landing-mark.webp" alt="" width={118} height={118} priority fetchPriority="high" sizes="118px" />
    </span>
  );
}

async function loadGameStats(): Promise<{ liveStats: LiveStats; recentEndings: Ending[] } | null> {
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
