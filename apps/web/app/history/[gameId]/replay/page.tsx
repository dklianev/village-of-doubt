import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Display, PaperCard, Pill, SceneCard } from "@werewolf/ui/server";
import { createDatabase, getGameHistoryById, getGameTimeline, getPlayerRolesInGames } from "@werewolf/database";
import {
  deriveAchievementsFromEvents,
  getRoleNameBg,
  phaseLabelBg,
  type GameMode,
  type GamePhase,
  type RoleCode,
} from "@werewolf/shared";
import { requireSession } from "@/lib/require-session";
import "@/components/achievements/Achievements.module.css";
import "@/components/history/History.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Запис | Върколак и Мафия",
  description: "Преглед на завършена игра: фази, гласове, смърти и победител.",
};

export default async function ReplayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const session = await requireSession(`/history/${gameId}/replay`);
  const replay = await loadReplay(gameId, session.user.id);
  if (!replay) {
    notFound();
  }

  const mode = modeFromConfig(replay.game.config);
  const groupedTimeline = groupTimeline(replay.timeline, mode);
  const participants = collectReplayParticipants(replay.timeline);
  const duration = formatDuration(replay.game.startedAt, replay.game.endedAt);

  return (
    <main
      className="shell history-shell replay-shell framed-shell"
      data-theme={mode === "werewolves_classic" ? "werewolves" : "mafia"}
      data-faction={mode === "werewolves_classic" ? "werewolves" : "mafia"}
    >
      <div className="framed-shell-inner">
        <header aria-label="Запис след игра">
          <SceneCard
            eyebrow="ПРЕГЛЕД СЛЕД ИГРА"
            density="lg"
            background={{
              image: "var(--art-replay)",
              overlay: "scrim",
              minHeight: "var(--ds-scene-hero-min-standard)",
            }}
          >
            <Display size="hero">Запис на стая {replay.game.code}.</Display>
            <p className="replay-hero-subtitle">
              Хронология от записаните събития. Тайните роли се показват само ако вече са част от
              записа.
            </p>
            <div className="replay-summary replay-summary-primitive">
              <Summary label="Режим" value={modeBg(mode)} />
              <Summary label="Победител" value={winnerBg(replay.game.winnerTeam)} />
              <Summary label="Времетраене" value={duration} />
              <Summary label="Събития" value={String(replay.game.eventCount)} />
            </div>
          </SceneCard>
        </header>

        <section className="replay-verdict-card">
          <PaperCard eyebrow="ПОБЕДАТА" density="md">
            <h2>{winnerBg(replay.game.winnerTeam)}</h2>
            <p>
              Финалът е записан на {formatDate(replay.game.endedAt)}. В хронологията има{" "}
              {replay.timeline.length} събития, групирани по фаза за по-лесен преглед.
            </p>
          </PaperCard>
        </section>

        <section className="replay-participants" aria-label="Играчите в записа">
          <PaperCard eyebrow="ИГРАЧИ" density="md">
            <div className="replay-section-head">
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
          </PaperCard>
        </section>

        <section className="replay-timeline-v2" aria-label="Хронология на играта">
          {replay.achievements.length > 0 ? (
            <article className="replay-achievements">
              <PaperCard eyebrow="ОТКЛЮЧЕНИ МОМЕНТИ" density="md">
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
              </PaperCard>
            </article>
          ) : null}
          {groupedTimeline.map((group) => (
            <article key={group.key} className="replay-phase-group">
              <PaperCard density="sm">
                <div className="replay-phase-content">
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
                          <p>{formatPayload(event.payload)}</p>
                          <small>
                            {visibilityBg(event.visibility)} · {formatDate(event.createdAt)}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </PaperCard>
            </article>
          ))}
          {replay.timeline.length === 0 ? (
            <article className="replay-empty-card">
              <PaperCard density="md">
                <h2>Няма записани събития</h2>
                <p>Играта съществува, но записът е празен.</p>
              </PaperCard>
            </article>
          ) : null}
        </section>

        <nav className="replay-actions" aria-label="Действия със записа">
          <Pill as="a" href="/history" intent="secondary">
            Назад към историята
          </Pill>
        </nav>
      </div>
    </main>
  );
}

async function loadReplay(gameId: string, viewerUserId: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const game = await getGameHistoryById(db, gameId);
    if (!game) {
      return null;
    }
    const rolesByGameId = await getPlayerRolesInGames(db, viewerUserId, [game.id]);
    const canSeeFullTimeline = game.hostId === viewerUserId || rolesByGameId.has(game.id);
    const timeline = await getGameTimeline(db, game.id, 300, {
      visibilityFilter: canSeeFullTimeline ? "all" : "public",
    });
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

type ReplayData = NonNullable<Awaited<ReturnType<typeof loadReplay>>>;
type TimelineEvent = ReplayData["timeline"][number];
type ReplayParticipant = { id: string; label: string; role: string | undefined; initial: string };

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

function collectReplayParticipants(events: TimelineEvent[]) {
  const participants = new Map<string, ReplayParticipant>();

  for (const event of events) {
    const payload = payloadRecord(event.payload);
    const actorName = stringValue(payload.actorNameBg) ?? stringValue(payload.actorName) ?? stringValue(payload.displayName);
    const targetName = stringValue(payload.targetNameBg) ?? stringValue(payload.targetName);
    const role = stringValue(payload.roleNameBg) ?? roleNameFromCode(stringValue(payload.role));

    if (event.actorId) {
      upsertParticipant(participants, event.actorId, actorName, role);
    }
    if (event.targetId) {
      upsertParticipant(participants, event.targetId, targetName, role);
    }
    if (!event.actorId && actorName) {
      upsertParticipant(participants, actorName, actorName, role);
    }
    if (!event.targetId && targetName) {
      upsertParticipant(participants, targetName, targetName, role);
    }
  }

  return [...participants.values()].slice(0, 12);
}

function upsertParticipant(
  participants: Map<string, ReplayParticipant>,
  id: string,
  label: string | undefined,
  role: string | undefined,
) {
  const nextLabel = label ?? shortId(id);
  const existing = participants.get(id);
  participants.set(id, {
    id,
    label: existing?.label && existing.label !== shortId(id) ? existing.label : nextLabel,
    role: existing?.role ?? role,
    initial: initialFor(nextLabel),
  });
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

function shortId(id: string) {
  return id.length > 8 ? `играч ${id.slice(0, 4)}` : id;
}

function initialFor(label: string) {
  return label.trim().charAt(0).toLocaleUpperCase("bg-BG") || "И";
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
