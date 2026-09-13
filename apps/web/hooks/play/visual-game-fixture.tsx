"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Room } from "@colyseus/sdk";
import {
  avatarIdForSeed,
  createDefaultGameConfig,
  createRoomOptionsFromConfig,
  DEFAULT_PHASE_LABELS_BG,
  ROLE_DEFINITIONS,
  getGameFamily,
  type ChatChannel,
  type CreateRoomOptions,
  type GameMode,
  type GamePhase,
  type NightActionKind,
  type RoleCode,
} from "@werewolf/shared";
import type {
  ConnectionStatus,
  GameSnapshot,
  NightActionCapabilities,
  NarratorRoleSnapshot,
  PrivateChatMessage,
  PrivateLover,
  PrivateResult,
  PublicChatMessage,
  PublicEvent,
  PublicNomination,
  PublicPlayer,
  PublicRoleCount,
  TypingNotice,
  VoteTallyItem,
} from "@/lib/play/types";
import { targetKindsForRole } from "@/lib/play/night-actions";
import { PlayRoomClientCore } from "@/components/play-room-client";
import type { UseGameRoomOptions, UseGameRoomResult } from "@/hooks/play/use-game-room";

type VisualFamily = "werewolves" | "mafia";
type VisualViewer = "alive" | "dead" | "host" | "narrator" | "spectator";
type VisualVoteTally = "empty" | "full" | "tie";
type VisualCapabilities = "normal" | "spent";

interface VisualGameRoomFixtureOptions {
  code: string;
  createOptions: CreateRoomOptions | undefined;
  search?: string | undefined;
}

export interface VisualGameRoomFixtureResult {
  room: Room | null;
  snapshot: GameSnapshot | null;
  currentUserId: string;
  privateRole: { role: RoleCode; roleNameBg: string } | null;
  privateResult: PrivateResult | null;
  privateLover: PrivateLover | null;
  nightActionCapabilities: NightActionCapabilities | null;
  narratorSnapshot: NarratorRoleSnapshot | null;
  privateChats: PrivateChatMessage[];
  typingNotices: TypingNotice[];
  isBlessed: boolean;
  connectionMessage: string;
  connectionStatus: ConnectionStatus;
  unlockedAchievementIds: string[];
  setUnlockedAchievementIds: Dispatch<SetStateAction<string[]>>;
  recordedGameId: string | null;
  reconnectNow: () => void;
  isPending: boolean;
}

export interface VisualGameFixtureConfig {
  snapshot: GameSnapshot;
  currentUserId: string;
  privateRole: { role: RoleCode; roleNameBg: string } | null;
  privateResult: PrivateResult | null;
  privateLover: PrivateLover | null;
  nightActionCapabilities: NightActionCapabilities | null;
  narratorSnapshot: NarratorRoleSnapshot | null;
  privateChats: PrivateChatMessage[];
  typingNotices: TypingNotice[];
  isBlessed: boolean;
  connectionStatus: ConnectionStatus;
  recordedGameId: string | null;
}

export function VisualPlayRoomClient({
  code,
  createOptions,
  search,
}: {
  code: string;
  createOptions?: CreateRoomOptions;
  search: string;
}) {
  const useVisualRoom = (_options: UseGameRoomOptions): UseGameRoomResult => {
    const fixture = useVisualGameRoomFixture({ code, createOptions, search });
    if (!fixture) {
      throw new Error("Визуалната игрова сцена е достъпна само в среда за разработка.");
    }
    return { ...fixture, privateFactionRoster: null };
  };

  return (
    <PlayRoomClientCore
      code={code}
      {...(createOptions ? { createOptions } : {})}
      useRoom={useVisualRoom}
    />
  );
}

const WEREWOLF_ROLES: RoleCode[] = [
  "ordinary_villager",
  "werewolf",
  "seer",
  "witch",
  "hunter",
  "cupid",
  "healer",
  "priest",
  "jester",
  "vampire",
  "guard_dog",
  "drunk",
];

const MAFIA_ROLES: RoleCode[] = [
  "civilian",
  "mafioso",
  "commissioner",
  "doctor",
  "don",
  "lawyer",
  "roleblocker",
  "bodyguard",
  "jester",
  "maniac",
];

const WEREWOLF_NAMES = [
  "Искра",
  "Борил",
  "Рада",
  "Неда",
  "Велин",
  "Мира",
  "Димо",
  "Яна",
  "Калин",
  "Сияна",
  "Тодор",
  "Елена",
  "Румен",
  "Лора",
  "Петър",
  "Дара",
  "Стан",
  "Биляна",
];

const MAFIA_NAMES = [
  "Антон",
  "Борис",
  "Вера",
  "Георги",
  "Дани",
  "Емил",
  "Жана",
  "Захари",
  "Ива",
  "Камен",
  "Лилия",
  "Марко",
  "Никола",
  "Оля",
  "Павел",
  "Рая",
  "Сава",
  "Теа",
];

const PRESET_DEFAULTS: Record<string, Partial<ParsedVisualQuery>> = {
  lobby: { phase: "lobby", viewer: "host" },
  role: { phase: "role_reveal" },
  night: { phase: "night" },
  day: { phase: "day_discussion" },
  voting: { phase: "voting", voteTally: "full" },
  resolution: { phase: "resolution", dead: 2 },
  hunter_revenge: { phase: "hunter_revenge", role: "hunter", viewer: "dead", dead: 2 },
  reconnecting: { connection: "reconnecting" },
  winner_village: { phase: "game_over", winner: "village" },
  winner_werewolves: { phase: "game_over", winner: "werewolves" },
  winner_mafia: { phase: "game_over", family: "mafia", winner: "mafia" },
};

interface ParsedVisualQuery {
  phase: GamePhase;
  family: VisualFamily;
  mode: GameMode;
  players: number;
  dead: number;
  viewer: VisualViewer;
  role: RoleCode;
  winner: string;
  voteTally: VisualVoteTally;
  connection: ConnectionStatus;
  doctorCanSelfProtect: boolean;
  timerSeconds: number | null;
  capabilities: VisualCapabilities;
}

export function useVisualGameRoomFixture({
  code,
  createOptions,
  search: explicitSearch,
}: VisualGameRoomFixtureOptions): VisualGameRoomFixtureResult | null {
  const search = explicitSearch ?? (typeof window === "undefined" ? "" : window.location.search);
  const config = useMemo(
    () => parseVisualGameFixture(search, code, createOptions),
    [code, createOptions, search],
  );
  const [connectionMessage, setConnectionMessage] = useState(() => statusForConnection(config?.connectionStatus ?? "connected"));
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);
  const room = useMemo(() => createVisualRoom(), []);

  return useMemo(() => {
    if (!config) {
      return null;
    }
    return {
      room,
      snapshot: config.snapshot,
      currentUserId: config.currentUserId,
      privateRole: config.privateRole,
      privateResult: config.privateResult,
      privateLover: config.privateLover,
      nightActionCapabilities: config.nightActionCapabilities,
      narratorSnapshot: config.narratorSnapshot,
      privateChats: config.privateChats,
      typingNotices: config.typingNotices,
      isBlessed: config.isBlessed,
      connectionMessage,
      connectionStatus: config.connectionStatus,
      unlockedAchievementIds,
      setUnlockedAchievementIds,
      recordedGameId: config.recordedGameId,
      reconnectNow: () => setConnectionMessage("Визуалната връзка е възстановена."),
      isPending: false,
    };
  }, [config, connectionMessage, room, unlockedAchievementIds]);
}

export function parseVisualGameFixture(
  search: string | URLSearchParams,
  code: string,
  createOptions: CreateRoomOptions | undefined,
  environment = process.env.NODE_ENV,
): VisualGameFixtureConfig | null {
  if (!isVisualGameFixtureEnabled(search, environment)) {
    return null;
  }

  const params = toSearchParams(search);
  const parsed = parseVisualQuery(params, createOptions);
  const assignedRoles = rolesForFamily(parsed.family, parsed.players, parsed.role);
  const currentUserId = "visual-player-1";
  const players = buildPlayers(parsed, currentUserId, assignedRoles);
  const roleCounts = buildRoleCounts(players, assignedRoles);
  const winner = parsed.phase === "game_over" ? parsed.winner || defaultWinner(parsed.family) : "";
  const nominations = buildNominations(parsed, players);
  const voteTally = buildVoteTally(parsed, players, nominations);
  const revoteEligibleUserIds = parsed.voteTally === "tie" && voteTally.length > 1
    ? voteTally.map((item) => item.targetUserId)
    : [];
  const snapshot: GameSnapshot = {
    code,
    mode: parsed.mode,
    playerCount: players.filter((player) => player.playing).length,
    narratorMode: parsed.viewer === "narrator" ? "full_human" : "automatic",
    communicationMode: "built_in_chat",
    tempoProfile: parsed.mode === "mafia_sport" ? "sport_mafia" : "normal_online",
    dayDiscussionSeconds: 180,
    playerSpeechSeconds: 60,
    voteSeconds: 60,
    revealRolesOnDeath: true,
    loversEnabled: parsed.family === "werewolves",
    doctorCanSelfProtect: parsed.doctorCanSelfProtect,
    allowSkipVote: parsed.mode !== "mafia_sport",
    majorityMode: "simple",
    narratorVoice: parsed.family === "mafia" ? "inspector" : "classic",
    phase: parsed.phase,
    round: parsed.phase === "lobby" ? 0 : ["role_reveal", "first_night"].includes(parsed.phase) ? 1 : 2,
    votingCycle: parsed.phase === "voting" ? revoteEligibleUserIds.length > 0 ? 2 : 1 : 0,
    phaseEndsAt: parsed.timerSeconds === null ? 0 : Date.now() + parsed.timerSeconds * 1_000,
    currentSpeakerUserId:
      parsed.mode === "mafia_sport" && parsed.phase === "day_discussion"
        ? players.find((player) => player.playing && player.alive)?.userId ?? ""
        : "",
    currentDefenseUserId:
      parsed.mode === "mafia_sport" && parsed.phase === "defense"
        ? nominations[0]?.targetUserId ?? ""
        : "",
    nominations,
    revoteEligibleUserIds,
    winnerTeam: winner,
    winnerReasonBg: winner ? winnerReasonBg(winner, parsed.family) : "",
    players,
    roleCounts,
    voteTally,
    publicEvents: [],
    publicChat: buildPublicChat(parsed.family),
  };
  snapshot.publicEvents = buildPublicEvents(snapshot);
  snapshot.nextRoomOptions = createRoomOptionsFromConfig({
    ...createDefaultGameConfig(parsed.mode, parsed.mode === "mafia_sport" ? 10
      : parsed.mode === "mafia_free" ? Math.min(24, Math.max(4, snapshot.playerCount))
        : Math.max(6, snapshot.playerCount)),
    playerCount: snapshot.playerCount,
    maxPlayers: snapshot.playerCount,
    rolePreset: "manual",
    roles: Object.fromEntries(roleCounts.map(({ role, count }) => [role, count])),
    narratorMode: parsed.viewer === "narrator" ? "full_human" : "automatic",
    communicationMode: "built_in_chat",
    narratorVoice: snapshot.narratorVoice,
    loversEnabled: snapshot.loversEnabled,
    doctorCanSelfProtect: parsed.doctorCanSelfProtect,
    allowSkipVote: snapshot.allowSkipVote,
  });

  const viewerRole = parsed.viewer === "narrator" || parsed.viewer === "spectator" ? null : parsed.role;
  return {
    snapshot,
    currentUserId,
    privateRole: viewerRole ? { role: viewerRole, roleNameBg: ROLE_DEFINITIONS[viewerRole].nameBg } : null,
    privateResult: viewerRole && !["lobby", "role_reveal", "first_night"].includes(parsed.phase)
      ? privateResultForRole(viewerRole, players, assignedRoles)
      : null,
    privateLover: viewerRole === "cupid" ? privateLoverForPlayers(players) : null,
    nightActionCapabilities: buildVisualNightActionCapabilities(parsed),
    narratorSnapshot: parsed.viewer === "narrator" ? narratorSnapshotFor(players, assignedRoles) : null,
    privateChats: buildPrivateChats(viewerRole, parsed.family),
    typingNotices: buildTypingNotices(parsed),
    isBlessed: viewerRole === "ordinary_villager" && parsed.phase === "night",
    connectionStatus: parsed.connection,
    recordedGameId: parsed.phase === "game_over" ? cleanFixtureGameId(params.get("gameId")) : null,
  };
}

export function isVisualGameFixtureEnabled(search: string | URLSearchParams, environment = process.env.NODE_ENV) {
  return environment !== "production" && toSearchParams(search).get("visualGame") === "1";
}

function parseVisualQuery(params: URLSearchParams, createOptions: CreateRoomOptions | undefined): ParsedVisualQuery {
  const preset = PRESET_DEFAULTS[params.get("preset") ?? ""] ?? {};
  const requestedMode = parseMode(params.get("mode")) ?? createOptions?.mode;
  const family = parseFamily(params.get("family") ?? preset.family, requestedMode);
  const mode = requestedMode && getGameFamily(requestedMode) === family
    ? requestedMode
    : family === "mafia" ? "mafia_sport" : "werewolves_classic";
  const winnerParam = params.get("winner") ?? preset.winner ?? "";
  const phase = parsePhase(params.get("phase") ?? preset.phase ?? (winnerParam ? "game_over" : "night"));
  const viewer = parseViewer(params.get("viewer") ?? preset.viewer);
  const basePlayers = family === "mafia" ? 10 : 12;
  const playerCount = clampInteger(params.get("players") ?? preset.players, 3, 30, basePlayers);
  const deadMinimum = viewer === "dead" ? 1 : 0;
  const dead = ["lobby", "role_reveal", "first_night"].includes(phase)
    ? 0
    : Math.max(deadMinimum, clampInteger(params.get("dead") ?? preset.dead, 0, playerCount - 1, 1));
  const roleFallback = family === "mafia" ? "commissioner" : "seer";
  const role = parseRole(params.get("role") ?? preset.role, roleFallback);
  return {
    phase,
    family,
    mode,
    players: playerCount,
    dead,
    viewer,
    role,
    winner: parseWinner(winnerParam),
    voteTally: parseVoteTally(params.get("voteTally") ?? preset.voteTally),
    connection: parseConnection(params.get("connection") ?? preset.connection),
    doctorCanSelfProtect: parseBooleanParam(params.get("doctorSelf"), createOptions?.doctorCanSelfProtect ?? false),
    timerSeconds: parseVisualTimer(params.get("timer")),
    capabilities: params.get("capabilities") === "spent" ? "spent" : "normal",
  };
}

function buildVisualNightActionCapabilities(parsed: ParsedVisualQuery): NightActionCapabilities | null {
  if (parsed.capabilities !== "spent") {
    return null;
  }

  const kinds = targetKindsForRole(parsed.role, parsed.phase);
  const usedFlags: NightActionCapabilities["usedFlags"] = {};
  for (const kind of kinds) {
    usedFlags[kind] = { reasonBg: spentCapabilityReasonBg(kind) };
  }
  return {
    availableKinds: [],
    usedFlags,
    disallowedTargetsByKind: {},
  };
}

function spentCapabilityReasonBg(kind: NightActionKind) {
  const reasons: Partial<Record<NightActionKind, string>> = {
    witch_heal: "Лечебната отвара вече е използвана.",
    witch_poison: "Отровата вече е използвана.",
    priest_bless: "Благословията вече е дадена.",
    blacksmith_sword: "Мечът вече е изкован.",
    investigator_check: "Проверката вече е използвана.",
    faction_kill: "Това действие вече не е достъпно.",
  };
  return reasons[kind] ?? "Това действие вече е използвано.";
}

function cleanFixtureGameId(value: string | null) {
  return value && /^[a-zA-Z0-9-]{1,80}$/.test(value) ? value : null;
}

function buildPlayers(parsed: ParsedVisualQuery, currentUserId: string, assignedRoles: RoleCode[]): PublicPlayer[] {
  const names = parsed.family === "mafia" ? MAFIA_NAMES : WEREWOLF_NAMES;
  const deadIndexes = deadIndexesFor(parsed.players, parsed.dead, parsed.viewer);
  return Array.from({ length: parsed.players }, (_, index) => {
    const isCurrent = index === 0;
    const isNarratorViewer = parsed.viewer === "narrator" && isCurrent;
    const isSpectatorViewer = parsed.viewer === "spectator" && isCurrent;
    const playing = !isNarratorViewer && !isSpectatorViewer;
    const alive = !playing || !deadIndexes.has(index);
    const revealedRole = playing && !alive ? assignedRoles[index] ?? "" : "";
    const userId = isCurrent ? currentUserId : `visual-player-${index + 1}`;
    return {
      userId,
      avatarId: avatarIdForSeed(userId),
      displayName: names[index] ?? `Играч ${index + 1}`,
      connected: index % 7 !== 5,
      ready: parsed.phase !== "lobby" || index % 5 !== 4,
      playing,
      alive,
      host: parsed.viewer === "host" ? isCurrent : index === 1,
      narrator: isNarratorViewer,
      acceptedFullNarrator: true,
      mayor: parsed.family === "werewolves" && index === 2,
      hasVoted: false,
      actedThisPhase: (parsed.phase === "night" || parsed.phase === "first_night") && playing && alive && index % 3 === 0,
      revealedRole,
    };
  });
}

function deadIndexesFor(playerCount: number, deadCount: number, viewer: VisualViewer) {
  const indexes = new Set<number>();
  if (viewer === "dead" && deadCount > 0) {
    indexes.add(0);
  }
  for (let index = playerCount - 1; indexes.size < deadCount && index >= 0; index -= 1) {
    if (index === 0 && viewer !== "dead") {
      continue;
    }
    indexes.add(index);
  }
  return indexes;
}

function rolesForFamily(family: VisualFamily, playerCount: number, viewerRole: RoleCode) {
  const source = family === "mafia" ? MAFIA_ROLES : WEREWOLF_ROLES;
  const fallback = source[0] ?? viewerRole;
  const roles: RoleCode[] = Array.from({ length: playerCount }, (_, index) => source[index % source.length] ?? fallback);
  roles[0] = viewerRole;
  return roles;
}

function buildRoleCounts(players: PublicPlayer[], assignedRoles: RoleCode[]): PublicRoleCount[] {
  const counts = new Map<RoleCode, number>();
  players.forEach((player, index) => {
    if (!player.playing) {
      return;
    }
    const role = assignedRoles[index];
    if (role) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
  });
  return Array.from(counts, ([role, count]) => ({ role, count }));
}

function buildVoteTally(parsed: ParsedVisualQuery, players: PublicPlayer[], nominations: PublicNomination[]): VoteTallyItem[] {
  if (parsed.phase !== "voting" || parsed.voteTally === "empty") return [];
  const living = players.filter((player) => player.playing && player.alive);
  if (living.length < 2) return [];
  let candidates = parsed.mode === "mafia_sport"
    ? nominations.flatMap((nomination) => living.filter((player) => player.userId === nomination.targetUserId))
    : living.slice(1, 4);
  if (parsed.voteTally === "tie" && candidates.length < 2) {
    candidates = parsed.mode === "mafia_sport" ? candidates : living.slice(0, 2);
    if (candidates.length < 2) return [];
  }
  let remaining = living.length;
  const tally = candidates.map((player, index) => {
    const count = parsed.voteTally === "tie"
      ? Math.min(2, Math.floor(living.length / candidates.length))
      : Math.min(candidates.length - index, living.length - 1, remaining - (candidates.length - index - 1));
    remaining -= count;
    return { targetUserId: player.userId, targetName: player.displayName, count, hasMayorVote: false };
  });

  // Fixture-only ballots keep the counters, voter badges and mayor marker in sync.
  const available = [...living];
  const ballots: Array<{ voter: PublicPlayer; target: VoteTallyItem }> = [];
  for (const target of tally) {
    for (let index = 0; index < target.count; index += 1) {
      const voterIndex = available.findIndex((player) => player.userId !== target.targetUserId);
      if (voterIndex >= 0) {
        ballots.push({ voter: available.splice(voterIndex, 1)[0]!, target });
      } else {
        // Swap an earlier ballot if the final unassigned voter is this candidate.
        const voter = available.shift()!;
        const earlier = ballots.find((ballot) => ballot.target.targetUserId !== voter.userId)!;
        ballots.push({ voter: earlier.voter, target });
        earlier.voter = voter;
      }
    }
  }
  for (const { voter, target } of ballots) {
    voter.hasVoted = true;
    target.hasMayorVote ||= voter.mayor;
  }
  return tally;
}

function buildNominations(parsed: ParsedVisualQuery, players: PublicPlayer[]): PublicNomination[] {
  if (
    parsed.mode !== "mafia_sport"
    || (parsed.phase !== "day_discussion"
      && parsed.phase !== "nomination"
      && parsed.phase !== "defense"
      && parsed.phase !== "voting")
  ) {
    return [];
  }

  const living = players.filter((player) => player.playing && player.alive);
  if (living.length < 2) return [];
  const firstTarget = Math.min(2, Math.max(0, living.length - 2));
  const targets = living.slice(firstTarget, firstTarget + 2);
  return targets.map((target) => ({
    nominatorUserId: living[(living.indexOf(target) + living.length - Math.min(2, living.length - 1)) % living.length]!.userId,
    targetUserId: target.userId,
  }));
}

function buildPublicEvents(snapshot: GameSnapshot): PublicEvent[] {
  const { phase, players, round, voteTally } = snapshot;
  const living = players.filter((player) => player.playing && player.alive);
  const nameFor = (userId: string | undefined) => players.find((player) => player.userId === userId)?.displayName;
  const speaker = nameFor(snapshot.currentSpeakerUserId);
  const defender = nameFor(snapshot.currentDefenseUserId);
  const eligibleNames = snapshot.revoteEligibleUserIds?.map((id) => nameFor(id)).join(", ");
  const phaseCopy: Record<GamePhase, string> = {
    lobby: `Масата се събира. Готови участници: ${players.filter((player) => player.playing && player.ready).length} от ${snapshot.playerCount}.`,
    role_reveal: `Ролите са раздадени на ${snapshot.playerCount} участници.`,
    first_night: "Започна първата нощ. Нощните действия са отворени.",
    night: `Започна нощ ${round}. Нощните действия са отворени.`,
    day_announcement: `Настъпи ден ${round}. Живи участници: ${living.length}.`,
    day_discussion: speaker ? `Ден ${round}. Думата има ${speaker}.` : `Започна обсъждането за ден ${round}.`,
    nomination: `Номинациите за ден ${round} са отворени.`,
    defense: defender ? `${defender} получава думата за защита.` : "Започна фазата за защита. Няма номинирани участници.",
    voting: eligibleNames ? `Започна прегласуване между ${eligibleNames}.` : `Гласуването за ден ${round} е отворено.`,
    resolution: `Гласуването за ден ${round} приключи. Живи участници: ${living.length}.`,
    hunter_revenge: "Играта изчаква избора за последния изстрел.",
    mayor_successor: "Играта изчаква избора на нов кмет.",
    paused: `Играта е на пауза в ден ${round}.`,
    game_over: `Играта приключи. ${snapshot.winnerReasonBg}`,
  };
  return [
    { id: "visual-event-1", type: "narrator", messageBg: `На масата играят ${snapshot.playerCount} участници.` },
    ...players.filter((player) => player.playing && !player.alive).map((player) => ({
      id: `visual-death-${player.userId}`, type: "death" as const, messageBg: `${player.displayName} е извън играта.`,
    })),
    ...(snapshot.nominations ?? []).map((nomination) => ({
      id: `visual-nomination-${nomination.nominatorUserId}`,
      type: "nomination" as const,
      messageBg: `${nameFor(nomination.nominatorUserId)} номинира ${nameFor(nomination.targetUserId)}.`,
    })),
    { id: "visual-event-2", type: "phase", messageBg: phaseCopy[phase] },
    ...(voteTally.length > 0 ? [{
      id: "visual-votes", type: "vote" as const,
      messageBg: `Гласове до момента: ${voteTally.map((item) => `${item.targetName} (${item.count})`).join(", ")}.`,
    }] : []),
  ];
}

function buildPublicChat(family: VisualFamily): PublicChatMessage[] {
  return [
    { id: "visual-chat-1", channel: "public", senderName: family === "mafia" ? "Вера" : "Рада", message: "Някой твърде бързо смени историята си." },
    { id: "visual-chat-2", channel: "public", senderName: family === "mafia" ? "Камен" : "Борил", message: "Гласът ми ще отиде там, където има най-малко алиби." },
  ];
}

function buildPrivateChats(role: RoleCode | null, family: VisualFamily): PrivateChatMessage[] {
  const channel = role ? privateChannelForRole(role, family) : null;
  if (!channel) {
    return [];
  }
  return [
    {
      id: "visual-private-chat-1",
      channel,
      senderUserId: "visual-player-2",
      senderName: family === "mafia" ? "Борис" : "Борил",
      message: "Избираме внимателно. Утрото ще пита.",
      createdAt: Date.UTC(2026, 4, 29, 20, 30),
    },
  ];
}

function buildTypingNotices(parsed: ParsedVisualQuery): TypingNotice[] {
  if (parsed.phase !== "day_discussion") {
    return [];
  }
  return [{
    channel: "public",
    senderUserId: "visual-player-3",
    senderName: parsed.family === "mafia" ? "Вера" : "Рада",
    active: true,
    createdAt: Date.UTC(2026, 4, 29, 20, 31),
  }];
}

function privateResultForRole(role: RoleCode, players: PublicPlayer[], assignedRoles: RoleCode[]): PrivateResult | null {
  const target = players.find((player) => player.playing && player.alive && player.userId !== "visual-player-1") ?? players[1];
  if (!target) {
    return null;
  }
  const targetRole = assignedRoles[players.indexOf(target)];
  const targetTeam = targetRole ? ROLE_DEFINITIONS[targetRole].team : undefined;
  if (role === "seer" || role === "oracle") {
    const isThreat = targetTeam === "werewolves" || targetTeam === "vampires";
    return {
      targetUserId: target.userId,
      isEvil: isThreat,
      messageBg: isThreat
        ? "Видението потвърди нощна заплаха."
        : "Видението не откри Върколак или Вампир.",
    };
  }
  if (role === "commissioner") {
    return {
      targetUserId: target.userId,
      isEvil: targetTeam === "mafia" || targetTeam === "werewolves" || targetTeam === "vampires",
    };
  }
  if (role === "don") {
    return {
      targetUserId: target.userId,
      isCommissioner: targetRole === "commissioner",
    };
  }
  return null;
}

function privateLoverForPlayers(players: PublicPlayer[]): PrivateLover | null {
  const lover = players.find((player) => player.userId !== "visual-player-1" && player.playing);
  return lover ? { loverUserId: lover.userId, loverName: lover.displayName } : null;
}

function narratorSnapshotFor(players: PublicPlayer[], assignedRoles: RoleCode[]): NarratorRoleSnapshot {
  return {
    roles: players
      .flatMap((player, index) => {
        if (!player.playing) {
          return [];
        }
        const role = assignedRoles[index] ?? "ordinary_villager";
        return [{
          userId: player.userId,
          displayName: player.displayName,
          role,
          roleNameBg: ROLE_DEFINITIONS[role].nameBg,
        }];
      }),
  };
}

function privateChannelForRole(role: RoleCode, family: VisualFamily): ChatChannel | null {
  const team = ROLE_DEFINITIONS[role].team;
  if (team === "mafia") {
    return "mafia";
  }
  if (team === "werewolves") {
    return "werewolves";
  }
  if (team === "vampires") {
    return "vampires";
  }
  return family === "mafia" && role === "don" ? "mafia" : null;
}

function statusForConnection(connection: ConnectionStatus) {
  const labels: Record<ConnectionStatus, string> = {
    connecting: "Свързване...",
    connected: "Свързан",
    reconnecting: "Визуална връзка: възстановяване.",
    disconnected: "Визуална връзка: прекъсната.",
    lost: "Визуална връзка: изгубена.",
    error: "Визуална връзка: грешка.",
  };
  return labels[connection];
}

function winnerReasonBg(winner: string, family: VisualFamily) {
  const reasons: Record<string, string> = {
    village: family === "mafia"
      ? "Гражданите разкриха Мафията и върнаха спокойствието в града."
      : "Селото събра достатъчно смелост, за да изгони сенките.",
    werewolves: "Върколаците останаха твърде много, а площадът замлъкна.",
    mafia: "Мафията заключи последното алиби и градът прие нейната версия.",
    lovers: "Влюбените оцеляха между всички обвинения.",
    draw: "Историята се затвори без чист победител.",
  };
  return reasons[winner] ?? (family === "mafia" ? "Последната версия остана единствена." : "Последната песен остана на площада.");
}

function defaultWinner(family: VisualFamily) {
  return family === "mafia" ? "mafia" : "village";
}

function createVisualRoom() {
  return {
    id: "visual-room",
    name: "visual-game-room",
    reconnectionToken: "visual-reconnect-token",
    send() {},
    leave() {},
    onStateChange() {},
    onMessage() {},
    onLeave() {},
  } as unknown as Room;
}

function parseMode(value: string | null): GameMode | undefined {
  return value === "mafia_free" || value === "mafia_sport" || value === "werewolves_classic" ? value : undefined;
}

function parseFamily(value: string | undefined, mode: GameMode | undefined): VisualFamily {
  if (value === "mafia" || value === "werewolves") {
    return value;
  }
  return getGameFamily(mode ?? "werewolves_classic");
}

function parsePhase(value: string | undefined): GamePhase {
  return isGamePhase(value) ? value : "night";
}

function isGamePhase(value: string | undefined): value is GamePhase {
  return Boolean(value && Object.hasOwn(DEFAULT_PHASE_LABELS_BG, value));
}

function parseViewer(value: string | undefined): VisualViewer {
  return value === "dead" || value === "host" || value === "narrator" || value === "spectator" ? value : "alive";
}

function parseRole(value: string | undefined, fallback: RoleCode): RoleCode {
  return value && value in ROLE_DEFINITIONS ? (value as RoleCode) : fallback;
}

function parseWinner(value: string | undefined) {
  return value === "village" || value === "werewolves" || value === "mafia" || value === "lovers" || value === "draw" ? value : "";
}

function parseVoteTally(value: string | undefined): VisualVoteTally {
  return value === "empty" || value === "tie" ? value : "full";
}

function parseConnection(value: string | undefined): ConnectionStatus {
  return value === "reconnecting" || value === "lost" || value === "error" ? value : "connected";
}

function parseVisualTimer(value: string | null): number | null {
  if (value === "none") {
    return null;
  }
  if (value === "90") {
    return 90;
  }
  if (value === "20") {
    return 20;
  }
  if (value === "8") {
    return 8;
  }
  if (value === "0") {
    return 0;
  }
  return null;
}

function parseBooleanParam(value: string | null, fallback: boolean) {
  if (value === "1" || value === "true") {
    return true;
  }
  if (value === "0" || value === "false") {
    return false;
  }
  return fallback;
}

function clampInteger(value: string | number | undefined, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function toSearchParams(search: string | URLSearchParams) {
  if (search instanceof URLSearchParams) {
    return search;
  }
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}
