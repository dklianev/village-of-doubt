import { createDatabase, getGameTimeline, getRecentGameHistory } from "@werewolf/database";
import { phaseLabelBg, type GameMode, type GamePhase } from "@werewolf/shared";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const games = await loadHistory();

  return (
    <main className="shell history-shell">
      <section className="paper-card history-ledger rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">история</p>
        <h1 className="mt-3 text-4xl font-black">Завършени игри</h1>
        {games.length === 0 ? (
          <div className="history-empty mt-7 rounded-[2rem] p-6">
            <div className="history-empty-mark" aria-hidden="true" />
            <div>
              <h2 className="text-3xl font-black">Архивът още е запечатан</h2>
              <p className="mt-3 max-w-2xl text-[#4f3829]">
                Няма записани игри или `DATABASE_URL` не е настроен. Когато production DB е активна,
                тук ще се виждат победител, смърти, гласове и фазов timeline.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-7 grid gap-4">
            {games.map((game) => (
              <article key={game.id} className="history-game-card rounded-3xl p-5" data-theme={modeFamily(game.mode)}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.25em] text-[#842f2b]">
                      стая {game.code} · {modeBg(game.mode)}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{winnerBg(game.winnerTeam)}</h2>
                  </div>
                  <span className="rounded-full bg-[#221611]/10 px-4 py-2 text-sm font-bold">
                    {game.eventCount} събития
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#4f3829]">
                  Статус: {game.status} · Старт: {formatDate(game.startedAt)} · Край: {formatDate(game.endedAt)}
                </p>
                {game.timeline.length > 0 ? (
                  <div className="mt-5 grid gap-3">
                    {[...game.timeline].reverse().map((event) => (
                      <div key={event.id} className="timeline-event rounded-2xl px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>{eventTypeBg(event.type)}</strong>
                          <span className="rounded-full bg-white/45 px-3 py-1 text-xs font-bold">
                            рунд {event.round} · {phaseBg(event.phase, game.mode)} · {visibilityBg(event.visibility)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#4f3829]">{formatPayload(event.payload)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-[#221611]/8 px-4 py-3 text-sm text-[#4f3829]">
                    Все още няма записан timeline за тази игра.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

async function loadHistory() {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const games = await getRecentGameHistory(db);
    const timelines = await Promise.all(games.map((game) => getGameTimeline(db, game.id, 6)));
    return games.map((game, index) => ({ ...game, mode: modeFromConfig(game.config), timeline: timelines[index] ?? [] }));
  } catch (error) {
    console.error("[history]", error);
    return [];
  }
}

function winnerBg(winner: string | null) {
  const labels: Record<string, string> = {
    village: "Селото печели",
    werewolves: "Върколаците печелят",
    vampires: "Вампирите печелят",
    mafia: "Мафията печели",
    lovers: "Влюбените печелят",
    draw: "Равенство",
  };

  return winner ? labels[winner] ?? winner : "Играта още няма победител";
}

function phaseBg(phase: string, mode: GameMode) {
  return isKnownPhase(phase) ? phaseLabelBg(phase, mode) : phase;
}

function modeBg(mode: GameMode) {
  const labels: Record<GameMode, string> = {
    werewolves_classic: "Класически Върколаци",
    mafia_sport: "Спортна Мафия",
    mafia_free: "Свободна Мафия",
  };

  return labels[mode];
}

function modeFamily(mode: GameMode) {
  return mode === "werewolves_classic" ? "werewolves" : "mafia";
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
    reconnect: "Възстановена връзка",
    ready: "Готовност",
    phase_change: "Смяна на фаза",
    role_assignment: "Раздадени роли",
    night_action: "Нощно действие",
    vote: "Глас",
    death: "Смърт",
    reveal: "Разкриване",
    chat: "Чат",
    narrator_action: "Разказвач",
    game_over: "Край на играта",
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
    .slice(0, 4)
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
  };

  return labels[key] ?? key;
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(value) : "n/a";
}
