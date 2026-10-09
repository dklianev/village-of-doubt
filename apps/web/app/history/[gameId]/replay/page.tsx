import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, Flag, LockKeyhole, Moon, ScrollText, Sun, Users, Vote } from "lucide-react";
import { createDatabase, GameTimelineCursorExpiredError, getGameHistoryById, getGameReplayParticipants, getGameReplayAchievements,
  getGameTimeline, getPlayerRolesInGames, getReplayParticipantContext } from "@werewolf/database";
import { ACHIEVEMENTS, ROLE_DEFINITIONS, getRoleNameBg, isAvatarId, safeMonitoringErrorMetadata, type GameFamily, type RoleCode } from "@werewolf/shared";
import { isUuid } from "@/lib/identifiers";
import { formatBulgarianDateTime } from "@/lib/date-time";
import { publicGameReference } from "@/lib/game-reference";
import { collectReplayParticipants } from "@/lib/play/replay-participants";
import { filterReplayTimelineByVisibility, resolveReplayTimelineVisibility } from "@/lib/replay-visibility";
import { requireSession } from "@/lib/require-session";
import { formatReplayEvent, groupReplayTimeline, parseReplayCursor, replayCursor,
  replayDuration, replayEventLabel, replayEventTone, replayMode, replayModeLabel, replayVisibilityLabel,
  replayWinner, type ReplayCursor } from "@/lib/replay-presentation";
import styles from "@/components/history/Replay.module.css";
import { roleThumbPath } from "@/lib/role-art";
import { groupReplayChapters } from "@/lib/replay-chapters";
import { ReplayReader } from "@/components/history/ReplayReader";

export const metadata: Metadata = {
  title: "Запис", description: "Хроника на завършена игра: фази, гласове и решаващи моменти.",
  robots: { index: false, follow: false },
};
export const instant = false;
const PAGE_SIZE = 200;
type ReplaySearch = { visualReplay?: string | string[]; after?: string | string[] };
type ReplayData = {
  game: NonNullable<Awaited<ReturnType<typeof getGameHistoryById>>>;
  timeline: Awaited<ReturnType<typeof getGameTimeline>>;
  participants: Awaited<ReturnType<typeof getGameReplayParticipants>>;
  participantContext: Awaited<ReturnType<typeof getGameTimeline>>;
  rolesVisible: boolean;
  achievements: string[];
  hasMore: boolean;
};
type ReplayResult = { status: "ready"; data: ReplayData } | { status: "unavailable" } | { status: "missing" } | { status: "expired" };

export default async function ReplayPage({ params, searchParams }: {
  params: Promise<{ gameId: string }>;
  searchParams?: Promise<ReplaySearch>;
}) {
  const { gameId } = await params;
  const search = await searchParams;
  const visualReplay = first(search?.visualReplay);
  const after = parseReplayCursor(first(search?.after));
  const fixture = process.env.NODE_ENV !== "production" && ["fixture", "demo", "public", "mafia", "unknown-codes", "long", "unavailable", "empty"].includes(visualReplay ?? "");
  if (!fixture && !isUuid(gameId)) notFound();
  const basePath = `/history/${encodeURIComponent(gameId)}/replay`;
  const href = (cursor?: ReplayCursor) => {
    const query = new URLSearchParams();
    if (fixture && visualReplay) query.set("visualReplay", visualReplay);
    if (cursor) query.set("after", replayCursor(cursor));
    return `${basePath}${query.size ? `?${query}` : ""}`;
  };
  const result = fixture
    ? visualReplay === "unavailable" ? { status: "unavailable" as const } : fixtureReplay(gameId, visualReplay, after)
    : await loadReplayForSession(gameId, after);
  if (result.status === "missing") notFound();
  if (result.status === "unavailable" || result.status === "expired") {
    const expired = result.status === "expired";
    return <main className={styles.shell}>
      <div className={styles.content}>
        <Link className={styles.back} href="/history"><ArrowLeft size={18} aria-hidden="true" />Назад към историята</Link>
        <section className={styles.unavailable} role="alert">
          <BookOpen size={30} aria-hidden="true" />
          <h1>{expired ? "Продължението на записа вече не е достъпно" : "Записът временно не е достъпен"}</h1>
          <p>{expired ? "Записът е променен. Върни се към началото на тази вечер." : "Не успяхме да заредим тази вечер. Опитай отново след малко."}</p>
          <Link className="btn btn-primary" href={href(expired ? undefined : after)}>{expired ? "Към началото" : "Опитай отново"}</Link>
        </section>
      </div>
    </main>;
  }
  const replay = result.data;
  const mode = replayMode(replay.game.config);
  const groups = groupReplayTimeline(replay.timeline, mode);
  const chapters = groupReplayChapters(replay.timeline, mode);
  const defaultChapter = (after || replay.hasMore ? chapters[0] : chapters.at(-1))?.key ?? "";
  const participants = collectReplayParticipants(replay.participants, [...replay.participantContext, ...replay.timeline], replay.rolesVisible);
  const names = new Map(participants.map((participant) => [participant.id, participant.label]));
  const awards = ACHIEVEMENTS.filter((award) => replay.achievements.includes(award.id));
  const last = replay.timeline.at(-1);
  const family: GameFamily = mode === "werewolves_classic" ? "werewolves" : "mafia";
  const winner = replayWinner(replay.game.winnerTeam, mode);
  const headline = replay.game.winnerTeam === "village" ? family === "werewolves" ? "Селото оцеля." : "Градът оцеля." : `${winner}.`;
  const finale = [...groups].reverse().find((group) => group.events.some((event) => event.phase === "game_over"
    && (event.type === "game_over" || event.type === "phase_change")));
  const finalVote = hasRecordedFinalVote(replay.timeline, finale?.events[0]?.id);
  const subtitle = finalVote ? "Последният глас сложи край на вечерта." : "Гласовете, съмненията и развръзката на една вечер.";
  const rosterData = new Map(replay.participants.map((participant) => [participant.userId, participant]));
  // Only persisted roles authorized for this viewer may supply roster portraits.
  const portraits = new Map(replay.rolesVisible ? replay.participants.map((participant) =>
    [participant.userId, knownRole(participant.role)] as const) : []);
  const portrait = (role: RoleCode | undefined) => role ? roleThumbPath(family, role)
    : `/game-art/thumbs/${family === "mafia" ? "mafia/" : ""}card-back-secret.webp`;
  const playerPortrait = (id: string) => {
    const avatar = rosterData.get(id)?.avatarId;
    return isAvatarId(avatar) ? `/game-art/avatars/${avatar}.webp` : portrait(portraits.get(id));
  };
  const renderParticipant = (participant: typeof participants[number]) => {
    const alive = rosterData.get(participant.id)?.isAlive;
    return <li key={participant.id}>
      <Portrait src={playerPortrait(participant.id)} />
      <div><strong>{participant.label}</strong><span data-survival={participant.spectator || alive === undefined ? undefined : alive ? "alive" : "dead"}>
        {participant.spectator ? "Наблюдател" : alive === undefined ? participant.role ?? "Ролята не е показана" : alive ? "Оцеля" : "Елиминиран"}
      </span>{alive !== undefined && participant.role && <small>{participant.role}</small>}</div>
    </li>;
  };
  const renderEvents = (chapter: typeof chapters[number]) => <div key={chapter.key}>
    <header key="heading" className={styles.chapterHeading}><h3>{chapter.label}</h3><p>{chapter.groups.some((group) => group.key === finale?.key) ? finalVote ? "Последният вот" : "Развръзката" : "Хроника на масата"}</p></header>
    {chapter.groups.map((group) => <section key={group.key} id={group.key} className={styles.phase} data-replay-phase tabIndex={-1} role="group" aria-label={group.phaseLabel}>
      <ol>{group.events.map((event, index) => {
        const final = event.phase === "game_over" && (event.type === "game_over" || event.type === "phase_change");
        const subject = event.type === "death" ? event.targetId ?? event.actorId : event.actorId;
        const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {};
        const revealed = event.type === "death" ? knownRole(payload.revealRole) : undefined;
        const title = event.type === "death" ? `${subject ? names.get(subject) ?? "Играч" : "Играч"} е елиминиран.`
          : event.type === "vote_submitted" ? index > 0 && group.events[index - 1]?.type === "vote_submitted" ? "Още един глас" : "Гласуване"
          : final ? winner : replayEventLabel(event.type);
        return <li key={event.id} className={styles.event} data-replay-event data-tone={final ? "victory" : replayEventTone(event.type)}>
          <time dateTime={event.createdAt.toISOString()} title={formatDate(event.createdAt)}>{formatBulgarianDateTime(event.createdAt, { hour: "2-digit", minute: "2-digit" })}</time>
          <div className={styles.eventBody}>
            {subject || revealed ? <Portrait src={revealed ? portrait(revealed) : playerPortrait(subject!)} />
              : final && replay.game.winnerTeam === "village" ? <Portrait src={family === "mafia" ? "/game-art/mafia/bg-hero-light-v1.webp" : "/game-art/history/replay-dawn-light-v1.webp"} />
              : <span className={styles.eventSymbol} aria-hidden="true">{final ? <Flag size={25} /> : <PhaseIcon phase={event.phase} />}</span>}
            <div><h4>{title}</h4><p>{event.type === "death" && revealed
              ? <>{typeof payload.causeBg === "string" && <span className={styles.deathCause}>{payload.causeBg} </span>}Разкрита роля: {getRoleNameBg(revealed)}.</>
              : formatReplayEvent(event, names, mode)}</p>
              {event.visibility !== "public" && <small>{replayVisibilityLabel(event.visibility)}</small>}
            </div>
          </div>
        </li>;
      })}</ol>
    </section>)}
  </div>;

  return <main className={styles.shell} data-replay-shell data-family={family}>
    <header className={styles.header}>
      <div className={styles.heroContent}>
        <Link className={styles.back} href="/history"><ArrowLeft size={18} aria-hidden="true" />Назад към историята</Link>
        <p className={styles.kicker}>{replayModeLabel(mode)} · Дело №{publicGameReference(replay.game.id)}</p>
        <h1>{headline}</h1>
        <p className={styles.verdict}>{subtitle}</p>
        <div className={styles.summary} data-replay-summary>
          <span><CalendarDays size={17} aria-hidden="true" />{formatDate(replay.game.endedAt)}</span>
          <span><Clock3 size={17} aria-hidden="true" />{replayDuration(replay.game.startedAt, replay.game.endedAt)}</span>
          <span><Users size={17} aria-hidden="true" />{replay.participants.length} {replay.participants.length === 1 ? "участник" : "участници"}</span>
          <span>{replay.rolesVisible ? <LockKeyhole size={17} aria-hidden="true" /> : <ScrollText size={17} aria-hidden="true" />}{replay.rolesVisible ? "Пълен запис" : "Публичен запис"}</span>
        </div>
      </div>
    </header>
    <div className={styles.content}>
      <ReplayReader key={after ? replayCursor(after) : "start"} defaultChapter={defaultChapter}>
        <div className={styles.journal}>
          <noscript><style>{"[data-replay-chapter][hidden]{display:block}"}</style></noscript>
          <aside className={styles.index}>
            <nav aria-label="Фази в тази част" className={styles.phaseNav} data-replay-nav>
              <p className={styles.kicker}>Хроника</p>
              <ol>{chapters.map((chapter) => <li key={chapter.key}>
                <a href={`#${chapter.key}`} aria-current={defaultChapter === chapter.key ? "location" : undefined}>
                  <PhaseIcon phase={chapter.phase} /><span>{chapter.label}</span>
                </a>
              </li>)}{finale && !chapters.some((chapter) => chapter.phase === "game_over" && chapter.groups.some((group) => group.key === finale.key))
                && <li><a href={`#${finale.key}`}><Flag size={19} aria-hidden="true" /><span>Край</span></a></li>}</ol>
            </nav>
          </aside>
          <div className={styles.records}>
            <div className={styles.timelineHeading} id="chronicle" data-replay-landmark tabIndex={-1}>
              <div><h2>{after ? "Продължение на записа" : "Ходът на вечерта"}</h2>
                <p className={styles.recordCount}>{replay.timeline.length} {replay.timeline.length === 1 ? "събитие" : "събития"} в тази част</p></div>
              <div className={styles.timelineActions}>
                <a href="#replay-participants" className={styles.rosterShortcut}><Users size={18} aria-hidden="true" />Участници</a>
                {finale && <a href={`#${finale.key}`} className={styles.finaleLink}>Към развръзката<ArrowRight size={18} aria-hidden="true" /></a>}
              </div>
            </div>
            <div className={styles.recordBody}>
              <section className={styles.timeline} aria-label="Хронология на играта">
                {chapters.map((chapter) => <section key={chapter.key} id={chapter.key} hidden={defaultChapter !== chapter.key}
                  data-replay-chapter className={styles.chapter} tabIndex={-1} aria-label={chapter.label}>{renderEvents(chapter)}</section>)}
                {chapters.length === 0 && <div className={styles.empty}><h3>{after ? "Няма следващи събития" : "Няма записани събития"}</h3>
                  <p>{after ? "Върни се към началото на тази вечер." : "Играта е приключила, но хронологията е празна."}</p></div>}
                {(after || replay.hasMore) && <nav className={styles.pagination} aria-label="Части на записа">
                  {after && <Link href={href()}><ArrowLeft size={18} aria-hidden="true" />Към началото</Link>}
                  {replay.hasMore && last && <Link href={`${href(last)}#chronicle`} className="btn btn-secondary">Следващи събития<ArrowRight size={18} aria-hidden="true" /></Link>}
                </nav>}
              </section>
        <aside className={styles.participants} id="replay-participants" data-replay-landmark aria-label="Участници в записа" tabIndex={-1}>
          <header><h2>На масата</h2><span>{replay.participants.length} {replay.participants.length === 1 ? "участник" : "участници"}</span></header>
          <a href="#chronicle" className={styles.rosterShortcut}><ArrowLeft size={18} aria-hidden="true" />Към хрониката</a>
          <ul>{participants.slice(0, 4).map(renderParticipant)}</ul>
          {participants.length > 4 && <details><summary>Всички участници<ChevronDown size={18} aria-hidden="true" /></summary>
            <ul>{participants.slice(4).map(renderParticipant)}</ul>
          </details>}
          {participants.length === 0 && <p>Няма записан състав на масата.</p>}
          {replay.participants.some((participant) => participant.isAlive === undefined) && <p className={styles.rosterNote}>{replay.rolesVisible ? "Ролите са видими за участниците в завършената игра." : "Скритите роли остават извън публичния запис."}</p>}
          {awards.length > 0 && <section className={styles.awards} aria-label="Отличия от тази вечер">
            <h2>Отключени за първи път</h2>
            <ul>{awards.map((award) => <li key={award.id}><strong>{award.titleBg}</strong><p>{award.descriptionBg}</p></li>)}</ul>
          </section>}
        </aside>
            </div>
          </div>
        </div>
      </ReplayReader>
      <footer className={styles.footer}><Link href="/history"><ArrowLeft size={18} aria-hidden="true" />Към архива на масата</Link><p>Всяка вечер оставя следа.</p></footer>
    </div>
  </main>;
}

async function loadReplayForSession(gameId: string, after?: ReplayCursor): Promise<ReplayResult> {
  const session = await requireSession(`/history/${gameId}/replay${after ? `?after=${encodeURIComponent(replayCursor(after))}` : ""}`);
  if (!process.env.DATABASE_URL) return { status: "unavailable" };
  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const game = await getGameHistoryById(db, gameId);
    if (!game || game.status !== "ended" || !game.endedAt) return { status: "missing" };
    const participantGameIds = await getPlayerRolesInGames(db, session.user.id, [game.id]);
    const visibility = resolveReplayTimelineVisibility({ gameId: game.id, status: game.status, endedAt: game.endedAt,
      hostId: game.hostId, roomVisibility: game.roomVisibility, viewerUserId: session.user.id, participantGameIds });
    if (visibility === "none") return { status: "missing" };
    const rolesVisible = visibility === "all";
    const [events, participants, achievements] = await Promise.all([
      getGameTimeline(db, game.id, PAGE_SIZE + 1, { visibilityFilter: visibility, order: "asc", after }),
      getGameReplayParticipants(db, game.id, { includeRoles: rolesVisible }),
      rolesVisible ? getGameReplayAchievements(db, game.id) : Promise.resolve([]),
    ]);
    const authorized = filterReplayTimelineByVisibility(events, visibility);
    const timeline = authorized.slice(0, PAGE_SIZE);
    const knownIds = new Set(participants.map((participant) => participant.userId));
    const missingIds = [...new Set(timeline.flatMap((event) => [event.actorId, event.targetId])
      .filter((id): id is string => Boolean(id) && !knownIds.has(id!)))];
    // Spectators have no gamePlayers row. Their last authorized join record must
    // remain available even when the displayed page is far beyond that event.
    const participantContext = missingIds.length
      ? filterReplayTimelineByVisibility(await getReplayParticipantContext(db, game.id, missingIds, visibility), visibility) : [];
    return { status: "ready", data: { game, timeline, participants, participantContext, rolesVisible,
      achievements, hasMore: authorized.length > PAGE_SIZE } };
  } catch (error) {
    if (error instanceof GameTimelineCursorExpiredError) return { status: "expired" };
    console.error("[replay]", safeMonitoringErrorMetadata(error));
    return { status: "unavailable" };
  }
}

function fixtureReplay(gameId: string, variant: string | undefined, after?: ReplayCursor): ReplayResult {
  const mafia = variant === "mafia";
  const demo = variant === "demo";
  const startedAt = new Date(demo ? "2026-09-25T17:30:00.000Z" : "2026-05-14T20:30:00.000Z");
  const endedAt = variant === "long" ? new Date(startedAt.getTime() + 1_004_000) : new Date(demo ? "2026-09-25T18:18:00.000Z" : "2026-05-14T21:18:00.000Z");
  const participants: ReplayData["participants"] = demo ? [
    { userId: "fixture-anna", displayName: "Анна", role: null, avatarId: "portrait-f01", isAlive: true },
    { userId: "fixture-rada", displayName: "Рада", role: null, avatarId: "portrait-f02", isAlive: true },
    { userId: "fixture-boris", displayName: "Борис", role: null, avatarId: "portrait-m02", isAlive: false },
    { userId: "fixture-elena", displayName: "Елена", role: null, avatarId: "portrait-f03", isAlive: false },
    { userId: "fixture-ivan", displayName: "Иван", role: null, avatarId: "portrait-m01", isAlive: true },
    { userId: "fixture-georgi", displayName: "Георги", role: null, avatarId: "portrait-m03", isAlive: true },
    { userId: "fixture-mira", displayName: "Мира", role: null, avatarId: "portrait-f04", isAlive: false },
    { userId: "fixture-todor", displayName: "Тодор", role: null, avatarId: "portrait-m04", isAlive: false },
  ] : [
    { userId: "fixture-anna", displayName: "Анна", role: mafia ? "commissioner" : "seer" },
    { userId: "fixture-boris", displayName: "Борис", role: mafia ? "mafioso" : "werewolf" },
    { userId: "fixture-rada", displayName: "Рада", role: mafia ? "civilian" : "ordinary_villager" },
  ];
  const event = (index: number, fields: Partial<ReplayData["timeline"][number]>): ReplayData["timeline"][number] => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, round: 1, phase: "voting", type: "vote_submitted",
    actorId: "fixture-anna", targetId: "fixture-boris", payload: {}, visibility: "public",
    createdAt: new Date(startedAt.getTime() + index * (variant === "long" ? 1_000 : 60_000)), ...fields,
  });
  const all = demo ? [
    event(0, { phase: "role_reveal", type: "game_started", actorId: null, targetId: null }),
    event(1, { phase: "first_night", type: "phase_change", actorId: null, targetId: null, payload: { phase: "first_night" } }),
    event(2, { phase: "day_discussion", type: "phase_change", actorId: null, targetId: null, payload: { phase: "day_discussion" } }),
    event(3, { round: 2, phase: "night", type: "phase_change", actorId: null, targetId: null, payload: { phase: "night" } }),
    event(4, { round: 2, createdAt: new Date("2026-09-25T18:12:00.000Z") }),
    event(5, { round: 2, actorId: "fixture-rada", createdAt: new Date("2026-09-25T18:13:00.000Z") }),
    event(6, { round: 2, phase: "resolution", type: "death", actorId: null,
      payload: { causeBg: "Елиминиран след дневното гласуване.", revealRole: "werewolf" }, createdAt: new Date("2026-09-25T18:15:00.000Z") }),
    event(7, { round: 2, phase: "game_over", type: "phase_change", actorId: null, targetId: null, payload: { phase: "game_over" }, createdAt: endedAt }),
  ] : variant === "empty" ? [] : variant === "unknown-codes" ? [
    event(0, { phase: "future_phase", type: "role_assignment", payload: { role: "future_role" } }),
    event(1, { phase: "future_phase", type: "future_event", visibility: "future_visibility", payload: { futurePayload: "future_payload" } }),
  ] : variant === "long" ? Array.from({ length: 1_005 }, (_, index) => event(index, index === 1_004
    ? { round: 51, phase: "game_over", type: "phase_change", actorId: null, targetId: null, payload: { phase: "game_over" } }
    : { round: Math.floor(index / 20) + 1 })) : [
    event(0, { phase: "role_reveal", type: "game_started", actorId: null, targetId: null, payload: { assignments: participants }, visibility: "moderator" }),
    event(1, { phase: "first_night", type: "night_action_submitted", payload: { action: { kind: "check_alignment", targetUserId: "fixture-boris" } }, visibility: "moderator" }),
    event(2, { round: 2 }),
    event(3, { round: 2, phase: "paused", type: "phase_change", actorId: null, targetId: null, payload: { phase: "paused" } }),
    event(4, { round: 2, actorId: "fixture-rada" }),
    event(5, { round: 2, phase: "voting", type: "vote_tally", actorId: null, targetId: null,
      payload: { tally: [{ userId: "fixture-boris", count: 2 }], totalVotes: 2 }, visibility: "moderator" }),
    event(6, { round: 2, phase: "resolution", type: "death", actorId: null,
      payload: { causeBg: "Елиминиран след дневното гласуване.", revealRole: mafia ? "mafioso" : "werewolf" } }),
    event(7, { round: 2, phase: "game_over", type: "phase_change", actorId: null, targetId: null, payload: { phase: "game_over" }, createdAt: endedAt }),
  ];
  const authorized = variant === "public" ? all.filter((item) => item.visibility === "public") : all;
  const anchorIndex = after ? authorized.findIndex((item) => item.id === after.id.toLowerCase()) : -1;
  if (after && anchorIndex === -1) return { status: "expired" };
  const events = authorized.slice(anchorIndex + 1);
  return { status: "ready", data: { game: { id: gameId, code: "4821", config: { mode: mafia ? "mafia_free" : "werewolves_classic" }, winnerTeam: variant === "unknown-codes" ? "future_winner" : "village",
    startedAt, endedAt, eventCount: all.length, hostId: "fixture-host", status: "ended", roomVisibility: "public" },
    timeline: events.slice(0, PAGE_SIZE), participants: variant === "public" ? participants.map((participant) => ({ ...participant, role: null })) : participants,
    participantContext: [], rolesVisible: variant !== "public" && !demo, achievements: [], hasMore: events.length > PAGE_SIZE } };
}

function hasRecordedFinalVote(events: ReplayData["timeline"], finaleId: string | undefined): boolean {
  const end = events.findIndex((event) => event.id === finaleId);
  const finale = events[end];
  const resolution = events[end - 1];
  const death = events[end - 2];
  // Legacy/compact demo compatibility: exact wording, same round, directly before the recorded finale.
  const legacyPayload = resolution?.payload;
  if (finale && resolution?.type === "death" && resolution.phase === "resolution" && resolution.round === finale.round
    && legacyPayload && typeof legacyPayload === "object" && "causeBg" in legacyPayload
    && legacyPayload.causeBg === "Елиминиран след дневното гласуване.") return true;
  // Only the uninterrupted, same-round producer sequence on this page supports this wording.
  if (!finale || resolution?.type !== "phase_change" || resolution.phase !== "resolution"
    || death?.type !== "death" || death.phase !== "voting"
    || death.round !== finale.round || resolution.round !== finale.round) return false;
  const payload = death.payload;
  return Boolean(payload && typeof payload === "object" && "causeBg" in payload
    && typeof payload.causeBg === "string"
    && /^Напусна играта след дневното гласуване(?: \([^()\r\n]+\))?\.$/.test(payload.causeBg));
}

function knownRole(value: unknown): RoleCode | undefined {
  return typeof value === "string" && Object.hasOwn(ROLE_DEFINITIONS, value) ? value as RoleCode : undefined;
}
function Portrait({ src }: { src: string }) {
  // The existing pre-sized WebP thumbnails avoid another image transformation.
  // eslint-disable-next-line @next/next/no-img-element
  return <span className={styles.portrait}><img src={src} width={66} height={72} alt="" loading="lazy" /></span>;
}
function PhaseIcon({ phase }: { phase: string }) {
  const Icon = phase === "game_over" ? Flag : phase.includes("night") ? Moon : phase === "voting" ? Vote
    : phase === "resolution" ? Check : phase.startsWith("day") ? Sun : BookOpen;
  return <Icon size={19} aria-hidden="true" />;
}

function formatDate(value: Date | null) {
  return value ? formatBulgarianDateTime(value, { dateStyle: "medium", timeStyle: "short" }) : "няма данни";
}
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
