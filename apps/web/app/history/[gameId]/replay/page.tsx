import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createDatabase,
  getGameHistoryById,
  getGameReplayParticipants,
  getGameTimeline,
  getPlayerRolesInGames,
} from "@werewolf/database";
import {
  deriveAchievementsFromEvents,
  getRoleNameBg,
  phaseLabelBg,
  type GameMode,
  type GamePhase,
  type RoleCode,
} from "@werewolf/shared";
import { publicGameReference } from "@/lib/game-reference";
import { collectReplayParticipants } from "@/lib/play/replay-participants";
import { filterReplayTimelineByVisibility, resolveReplayTimelineVisibility } from "@/lib/replay-visibility";
import { requireSession } from "@/lib/require-session";
import "@/components/achievements/Achievements.module.css";
import "@/components/history/History.module.css";
import "@/components/history/LegacyReplay.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Запис",
  description: "Преглед на завършена игра: фази, гласове, смърти и победител.",
};

export default async function ReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams?: Promise<{ visualReplay?: string | string[] }>;
}) {
  const { gameId } = await params;
  const visualReplay = firstSearchValue((await searchParams)?.visualReplay);
  const replay =
    process.env.NODE_ENV !== "production" && visualReplay === "fixture"
      ? fixtureReplay(gameId)
      : await loadReplayForSession(gameId);
  if (!replay) {
    notFound();
  }

  const mode = modeFromConfig(replay.game.config);
  const groupedTimeline = groupTimeline(replay.timeline, mode);
  const participants = collectReplayParticipants(replay.participants, replay.timeline, replay.rolesVisible);
  const duration = formatDuration(replay.game.startedAt, replay.game.endedAt);

  return (
    <main
      className="shell history-shell replay-shell framed-shell"
      data-faction={mode === "werewolves_classic" ? "werewolves" : "mafia"}
    >
      <div className="framed-shell-inner">
        <header className="replay-hero-v2">
          <Image
            src="/game-art/legal/replay-banner.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 1180px) 100vw, 1180px"
            className="replay-hero-img"
          />
          <div className="replay-hero-scrim" aria-hidden />
          <div className="replay-hero-copy">
            <p className="replay-kicker">преглед след игра</p>
            <h1>Запис на дело {publicGameReference(replay.game.id)}.</h1>
            <p>
              Хронология от записаните събития. Тайните роли се показват само ако вече са част от
              записа.
            </p>
            <div className="replay-summary">
              <Summary label="Режим" value={modeBg(mode)} />
              <Summary label="Победител" value={winnerBg(replay.game.winnerTeam)} />
              <Summary label="Времетраене" value={duration} />
              <Summary label="Събития" value={String(replay.game.eventCount)} />
            </div>
          </div>
        </header>

        <section className="replay-verdict-card">
          <p className="replay-kicker">победата</p>
          <h2>{winnerBg(replay.game.winnerTeam)}</h2>
          <p>
            Финалът е записан на {formatDate(replay.game.endedAt)}. В хронологията има{" "}
            {replay.timeline.length} събития, групирани по фаза за по-лесен преглед.
          </p>
        </section>

        <section className="replay-participants" aria-label="Играчите в записа">
          <div className="replay-section-head">
            <p className="replay-kicker">играчи</p>
            <h2>Участници от записа</h2>
          </div>
          <div className="replay-player-grid">
            {participants.length > 0 ? (
              participants.map((participant) => (
                <span key={participant.id} className="replay-player-chip">
                  <strong>{participant.initial}</strong>
                  <span>{participant.label}</span>
                  <em>{participant.role ?? "роля в записа"}</em>
                </span>
              ))
            ) : (
              <p className="replay-empty-note">В събитията няма отделно записани имена на играчи.</p>
            )}
          </div>
        </section>

        <section className="replay-timeline-v2" aria-label="Хронология на играта">
          {replay.achievements.length > 0 ? (
            <article className="replay-achievements">
              <p className="replay-kicker">отключени моменти</p>
              <h2>Легенди от тази игра</h2>
              <div className="achievement-grid">
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
          {groupedTimeline.map((group) => (
            <article key={group.key} className="replay-phase-group">
              <header>
                <span>{group.events.length}</span>
                <div>
                  <p className="replay-kicker">рунд {group.round}</p>
                  <h2>{group.phaseLabel}</h2>
                </div>
              </header>
              <ol>
                {group.events.map((event, index) => (
                  <li key={event.id} className="replay-event-v2" data-tone={eventTone(event.type)}>
                    <span className="replay-index">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{eventTypeBg(event.type)}</h3>
                      <p>{formatPayload(event.type, event.payload)}</p>
                      <small>
                        {visibilityBg(event.visibility)} · {formatDate(event.createdAt)}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
          {replay.timeline.length === 0 ? (
            <article className="replay-empty-card">
              <h2>Няма записани събития</h2>
              <p>Играта съществува, но записът е празен.</p>
            </article>
          ) : null}
        </section>

        <nav className="replay-actions" aria-label="Действия със записа">
          <Link className="btn btn-secondary" href="/history">
            Назад към историята
          </Link>
        </nav>
      </div>
    </main>
  );
}

async function loadReplayForSession(gameId: string) {
  const session = await requireSession(`/history/${gameId}/replay`);
  return loadReplay(gameId, session.user.id);
}

async function loadReplay(gameId: string, viewerUserId: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const game = await getGameHistoryById(db, gameId);
    if (!game || game.status !== "ended" || !game.endedAt) {
      return null;
    }
    const participantGameIds = await getPlayerRolesInGames(db, viewerUserId, [game.id]);
    const visibility = resolveReplayTimelineVisibility({
      gameId: game.id,
      status: game.status,
      endedAt: game.endedAt,
      hostId: game.hostId,
      roomVisibility: game.roomVisibility,
      viewerUserId,
      participantGameIds,
    });
    if (visibility === "none") {
      return null;
    }
    const timeline = filterReplayTimelineByVisibility(
      await getGameTimeline(db, game.id, 1_000, { visibilityFilter: visibility, order: "asc" }),
      visibility,
    );
    const rolesVisible = visibility === "all";
    const participants = await getGameReplayParticipants(db, game.id, { includeRoles: rolesVisible });
    return {
      game,
      timeline,
      participants,
      rolesVisible,
      achievements: deriveAchievementsFromEvents(timeline),
    };
  } catch (error) {
    console.error("[replay]", error);
    return null;
  }
}

function fixtureReplay(gameId: string): NonNullable<Awaited<ReturnType<typeof loadReplay>>> {
  const startedAt = new Date("2026-05-14T20:30:00.000Z");
  const endedAt = new Date("2026-05-14T21:18:00.000Z");
  const timeline = [
    fixtureReplayEvent(gameId, 0, "role_reveal", 1, startedAt, {
      type: "role_assignment",
      payload: { actorNameBg: "Разказвачът", roleNameBg: "Селянин" },
    }),
    fixtureReplayEvent(gameId, 1, "first_night", 1, new Date("2026-05-14T20:42:00.000Z"), {
      type: "night_action_submitted",
      payload: { actorNameBg: "Гадателката", targetNameBg: "Борис", roleNameBg: "Върколак" },
    }),
    fixtureReplayEvent(gameId, 2, "day_discussion", 2, new Date("2026-05-14T20:58:00.000Z"), {
      type: "vote_tally",
      payload: { actorNameBg: "Масата", targetNameBg: "Борис" },
    }),
    fixtureReplayEvent(gameId, 3, "game_over", 3, endedAt, {
      type: "game_over",
      payload: { actorNameBg: "Селото", targetNameBg: "Върколака" },
    }),
  ];

  return {
    game: {
      id: gameId,
      code: "4821",
      config: { mode: "werewolves_classic" },
      winnerTeam: "village",
      startedAt,
      endedAt,
      eventCount: timeline.length,
      hostId: "visual-host",
    } as NonNullable<Awaited<ReturnType<typeof getGameHistoryById>>>,
    timeline: timeline as Awaited<ReturnType<typeof getGameTimeline>>,
    participants: [
      { userId: "fixture-actor-1", displayName: "Разказвачът", role: "ordinary_villager" },
      { userId: "fixture-actor-2", displayName: "Гадателката", role: "seer" },
      { userId: "fixture-target-2", displayName: "Борис", role: "werewolf" },
    ],
    rolesVisible: true,
    achievements: [],
  };
}

function fixtureReplayEvent(
  gameId: string,
  index: number,
  phase: GamePhase,
  round: number,
  createdAt: Date,
  event: { type: string; payload: Record<string, unknown> },
) {
  return {
    id: `fixture-replay-${index + 1}`,
    gameId,
    createdAt,
    type: event.type,
    phase,
    round,
    visibility: "public",
    actorId: index === 2 ? null : `fixture-actor-${index + 1}`,
    targetId: index === 0 ? null : `fixture-target-${index + 1}`,
    payload: event.payload,
  };
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type ReplayData = NonNullable<Awaited<ReturnType<typeof loadReplay>>>;
type TimelineEvent = ReplayData["timeline"][number];

function groupTimeline(events: TimelineEvent[], mode: GameMode) {
  const groups = new Map<
    string,
    {
      key: string;
      round: number;
      phaseLabel: string;
      events: TimelineEvent[];
    }
  >();

  for (const event of events) {
    const key = `${event.round}:${event.phase}`;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, {
        key,
        round: event.round,
        phaseLabel: phaseBg(event.phase, mode),
        events: [event],
      });
    }
  }

  return [...groups.values()];
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roleNameFromCode(role: string | undefined) {
  if (!role) {
    return undefined;
  }
  try {
    return getRoleNameBg(role as RoleCode);
  } catch {
    return role;
  }
}

function eventTone(type: string) {
  if (type.includes("death") || type.includes("kill")) return "danger";
  if (type.includes("vote")) return "vote";
  if (type.includes("reveal") || type.includes("role")) return "reveal";
  if (type.includes("game_over") || type.includes("win")) return "victory";
  return "neutral";
}

function formatDuration(startedAt: Date | null, endedAt: Date | null) {
  if (!startedAt || !endedAt) {
    return "няма данни";
  }
  const minutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
  if (minutes < 60) {
    return `${minutes} мин.`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} ч. ${rest} мин.` : `${hours} ч.`;
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

function formatPayload(type: string, payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Събитието няма допълнителни данни.";
  }

  const record = payloadRecord(payload);
  const actor = stringValue(record.actorNameBg) ?? stringValue(record.actorName);
  const target = stringValue(record.targetNameBg) ?? stringValue(record.targetName);
  const role = stringValue(record.roleNameBg) ?? roleNameFromCode(stringValue(record.role));

  if (type === "role_assignment" && actor && role) {
    return `${actor} получи ролята ${role}.`;
  }
  if (type === "night_action_submitted" && actor && target) {
    return `${actor} избра ${target} за нощното действие${role ? ` като ${role}` : ""}.`;
  }
  if ((type === "vote_submitted" || type === "vote_tally") && actor && target) {
    return `${actor} насочи гласа към ${target}.`;
  }
  if (type === "game_over" && actor) {
    return target ? `${actor} надделя над ${target}.` : `${actor} спечели играта.`;
  }

  const entries = Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 5)
    .map(([key, value]) => `${payloadKeyBg(key)}: ${String(value)}`);

  return entries.length > 0 ? entries.join(" · ") : "Събитието е записано без публични детайли.";
}

function payloadKeyBg(key: string) {
  const labels: Record<string, string> = {
    actorNameBg: "действащ",
    actorName: "действащ",
    targetNameBg: "цел",
    targetName: "цел",
    roleNameBg: "роля",
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

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
