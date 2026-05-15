import type { GameFamily } from "@werewolf/shared";
import { ResourceHints } from "@/components/resource-hints";
import { ModeChoiceCards, type ModeChoiceGame } from "@/components/landing/ModeChoiceCards";
import { QuickStartSection, type LandingQuickStartLastWinner } from "@/components/landing/QuickStartSection";

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

export async function LandingExperience() {
  const stats = await loadGameStats();
  const liveStats = stats
    ? {
        activeRooms: stats.activeRooms ?? 0,
        connectedPlayers: stats.connectedPlayers ?? 0,
        ...(stats.byFamily ? { byFamily: stats.byFamily } : {}),
      }
    : null;

  return (
    <main className="shell landing-shell">
      <ResourceHints images={["/game-art/mobile/bg-landing-ambient.webp", "/game-art/mobile/bg-landing-dual-world-v2.webp", "/game-art/mobile/bg-lobby-tavern.webp"]} />
      <section className="card landing-hero-card rounded-[2rem] p-7">
        <div className="landing-logo-mark" aria-hidden="true" />
        <p className="section-kicker">избери игра</p>
        <h1 className="mt-5 text-5xl font-black leading-none text-[#f4e8d1] md:text-7xl">
          Върколак или Мафия
        </h1>
        <p className="landing-hero-copy mt-6 max-w-3xl text-lg leading-8 text-[#ead9ba]">
          Две отделни игри, два отделни речника и два отделни набора роли. Влизаш с име, създаваш стая
          или въвеждаш код и започваш веднага.
        </p>

        <ModeChoiceCards games={GAMES} />

        <QuickStartSection liveStats={liveStats} lastWinner={stats?.lastWinner ?? null} />
      </section>
    </main>
  );
}

async function loadGameStats() {
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/^ws/, "http") ?? "http://localhost:2567";
  try {
    const response = await fetch(`${gameServerUrl}/stats`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as {
      activeRooms?: number;
      connectedPlayers?: number;
      byFamily?: Partial<Record<GameFamily, number>>;
      lastWinner?: LandingQuickStartLastWinner | null;
    };
  } catch {
    return null;
  }
}
