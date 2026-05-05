import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDatabase, getGameHistoryById, getGameTimeline } from "@werewolf/database";
import { deriveAchievementsFromEvents, phaseLabelBg, type GameMode, type GamePhase } from "@werewolf/shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Replay | Върколак и Мафия",
  description: "Timeline преглед на завършена игра: фази, гласове, смърти и победител.",
};

export default async function ReplayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const replay = await loadReplay(gameId);
  if (!replay) {
    notFound();
  }

  const mode = modeFromConfig(replay.game.config);

  return (
    <main className="shell history-shell replay-shell" data-theme={mode === "werewolves_classic" ? "werewolves" : "mafia"}>
      <section className="paper-card replay-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">преглед след игра</p>
        <h1 className="mt-3 text-5xl font-black">Replay на стая {replay.game.code}</h1>
        <p className="mt-4 max-w-3xl text-[#4f3829]">
          Timeline от записаните събития. Тук няма live spectator state и няма чужди тайни роли извън това,
          което играта е записала като публично или модераторско събитие.
        </p>
        <div className="replay-summary mt-6">
          <Summary label="Режим" value={modeBg(mode)} />
          <Summary label="Победител" value={winnerBg(replay.game.winnerTeam)} />
          <Summary label="Събития" value={String(replay.game.eventCount)} />
          <Summary label="Край" value={formatDate(replay.game.endedAt)} />
        </div>
      </section>

      <section className="replay-timeline mt-6">
        {replay.achievements.length > 0 ? (
          <article className="paper-card achievement-unlocks rounded-[2rem] p-7">
            <p className="section-kicker text-[#842f2b]">отключени моменти</p>
            <h2 className="mt-2 text-3xl font-black">Постижения от тази игра</h2>
            <div className="achievement-grid mt-5">
              {replay.achievements.map((achievement) => (
                <div key={achievement.id} className="achievement-card">
                  <span>{achievement.iconBg}</span>
                  <strong>{achievement.titleBg}</strong>
                  <p>{achievement.descriptionBg}</p>
                </div>
              ))}
            </div>
          </article>
        ) : null}
        {replay.timeline.map((event, index) => (
          <article key={event.id} className={`replay-event event-${event.type}`}>
            <span className="replay-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2>{eventTypeBg(event.type)}</h2>
                <span className="replay-phase">
                  рунд {event.round} · {phaseBg(event.phase, mode)} · {visibilityBg(event.visibility)}
                </span>
              </div>
              <p>{formatPayload(event.payload)}</p>
              <small>{formatDate(event.createdAt)}</small>
            </div>
          </article>
        ))}
        {replay.timeline.length === 0 ? (
          <article className="paper-card rounded-[2rem] p-7">
            <h2 className="text-3xl font-black">Няма записани събития</h2>
            <p className="mt-3 text-[#4f3829]">Играта съществува, но replay timeline-ът е празен.</p>
          </article>
        ) : null}
      </section>

      <Link className="btn btn-secondary mt-6" href="/history">
        Назад към историята
      </Link>
    </main>
  );
}

async function loadReplay(gameId: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const game = await getGameHistoryById(db, gameId);
    if (!game) {
      return null;
    }
    const timeline = await getGameTimeline(db, game.id, 300);
    const orderedTimeline = [...timeline].reverse();
    return { game, timeline: orderedTimeline, achievements: deriveAchievementsFromEvents(orderedTimeline) };
  } catch (error) {
    console.error("[replay]", error);
    return null;
  }
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function winnerBg(winner: string | null) {
  const labels: Record<string, string> = {
    village: "Селото печели",
    werewolves: "Върколаците печелят",
    vampires: "Вампирите печелят",
    mafia: "Мафията печели",
    maniac: "Маниакът печели",
    lovers: "Влюбените печелят",
    draw: "Равенство",
  };

  return winner ? labels[winner] ?? winner : "Няма победител";
}

function phaseBg(phase: string, mode: GameMode) {
  return isKnownPhase(phase) ? phaseLabelBg(phase, mode) : phase;
}

function modeBg(mode: GameMode) {
  const labels: Record<GameMode, string> = {
    werewolves_classic: "Върколак",
    mafia_sport: "Спортна Мафия",
    mafia_free: "Мафия",
  };

  return labels[mode];
}

function modeFromConfig(config: unknown): GameMode {
  if (config && typeof config === "object" && "mode" in config) {
    const mode = (config as { mode?: unknown }).mode;
    if (mode === "werewolves_classic" || mode === "mafia_sport" || mode === "mafia_free") {
      return mode;
    }
  }

  return "werewolves_classic";
}

function isKnownPhase(phase: string): phase is GamePhase {
  return [
    "lobby",
    "role_reveal",
    "first_night",
    "night",
    "day_announcement",
    "day_discussion",
    "nomination",
    "defense",
    "voting",
    "resolution",
    "hunter_revenge",
    "mayor_successor",
    "paused",
    "game_over",
  ].includes(phase);
}

function eventTypeBg(type: string) {
  const labels: Record<string, string> = {
    room_created: "Създадена стая",
    player_joined: "Играч влезе",
    player_left: "Играч излезе",
    phase_change: "Смяна на фаза",
    role_assignment: "Раздадени роли",
    night_action_submitted: "Нощно действие",
    vote_submitted: "Глас",
    vote_tally: "Броене",
    death: "Смърт",
    reveal: "Разкриване",
    narrator_action: "Разказвач",
    game_over: "Край",
    personal_win: "Лична победа",
  };

  return labels[type] ?? type;
}

function visibilityBg(visibility: string) {
  const labels: Record<string, string> = {
    public: "публично",
    private: "лично",
    faction: "фракция",
    moderator: "модератор",
  };

  return labels[visibility] ?? visibility;
}

function formatPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Събитието няма допълнителни данни.";
  }

  const entries = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 5)
    .map(([key, value]) => `${payloadKeyBg(key)}: ${String(value)}`);

  return entries.length > 0 ? entries.join(" · ") : "Събитието е записано без публични детайли.";
}

function payloadKeyBg(key: string) {
  const labels: Record<string, string> = {
    messageBg: "съобщение",
    winnerTeam: "победител",
    reasonBg: "причина",
    role: "роля",
    phase: "фаза",
    targetUserId: "цел",
    actorUserId: "действащ",
    action: "действие",
    tally: "гласове",
  };

  return labels[key] ?? key;
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(value) : "няма данни";
}
