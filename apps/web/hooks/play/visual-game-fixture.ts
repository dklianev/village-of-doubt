"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Room } from "@colyseus/sdk";
import {
  ROLE_DEFINITIONS,
  getGameFamily,
  type ChatChannel,
  type CreateRoomOptions,
  type GameMode,
  type GamePhase,
  type RoleCode,
} from "@werewolf/shared";
import type {
  ConnectionStatus,
  GameSnapshot,
  NarratorRoleSnapshot,
  PrivateChatMessage,
  PrivateLover,
  PrivateResult,
  PublicChatMessage,
  PublicEvent,
  PublicPlayer,
  PublicRoleCount,
  TypingNotice,
  VoteTallyItem,
} from "@/lib/play/types";

type VisualFamily = "werewolves" | "mafia";
type VisualViewer = "alive" | "dead" | "host" | "narrator" | "spectator";
type VisualVoteTally = "empty" | "full" | "tie";

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
  narratorSnapshot: NarratorRoleSnapshot | null;
  privateChats: PrivateChatMessage[];
  typingNotices: TypingNotice[];
  isBlessed: boolean;
  status: string;
  setStatus: Dispatch<SetStateAction<string>>;
  connectionStatus: ConnectionStatus;
  unlockedAchievementIds: string[];
  setUnlockedAchievementIds: Dispatch<SetStateAction<string[]>>;
  reconnectNow: () => void;
  isPending: boolean;
}

export interface VisualGameFixtureConfig {
  snapshot: GameSnapshot;
  currentUserId: string;
  privateRole: { role: RoleCode; roleNameBg: string } | null;
  privateResult: PrivateResult | null;
  privateLover: PrivateLover | null;
  narratorSnapshot: NarratorRoleSnapshot | null;
  privateChats: PrivateChatMessage[];
  typingNotices: TypingNotice[];
  isBlessed: boolean;
  connectionStatus: ConnectionStatus;
}

const PHASE_COPY: Record<GamePhase, string> = {
  lobby: "Стаята чака готовност преди първата карта.",
  role_reveal: "Всеки вижда само своята тайна карта.",
  first_night: "Първата нощ подрежда еднократните роли.",
  night: "Нощта пази действията скрити от площада.",
  day_announcement: "Утрото брои какво е оцеляло.",
  day_discussion: "Площадът търси истината в гласовете.",
  nomination: "Подозренията вече имат имена.",
  defense: "Обвинените получават последна дума.",
  voting: "Гласовете превръщат съмнението в присъда.",
  resolution: "Развръзката обръща картата на масата.",
  hunter_revenge: "Ловецът избира последния си изстрел.",
  mayor_successor: "Кметската значка търси следващ пазител.",
  paused: "Играта е спряна, докато Разказвачът подреди сцената.",
  game_over: "Последната история вече има победител.",
};

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
  hunter_revenge: { phase: "hunter_revenge", role: "hunter", dead: 2 },
  reconnecting: { connection: "reconnecting" },
  winner_village: { phase: "game_over", winner: "village" },
  winner_werewolves: { phase: "game_over", winner: "werewolves" },
  winner_mafia: { phase: "game_over", family: "mafia", winner: "mafia" },
};

interface ParsedVisualQuery {
  phase: GamePhase;
  family: VisualFamily;
  players: number;
  dead: number;
  viewer: VisualViewer;
  role: RoleCode;
  winner: string;
  voteTally: VisualVoteTally;
  connection: ConnectionStatus;
  doctorCanSelfProtect: boolean;
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
  const [status, setStatus] = useState(() => statusForConnection(config?.connectionStatus ?? "connected"));
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
      narratorSnapshot: config.narratorSnapshot,
      privateChats: config.privateChats,
      typingNotices: config.typingNotices,
      isBlessed: config.isBlessed,
      status,
      setStatus,
      connectionStatus: config.connectionStatus,
      unlockedAchievementIds,
      setUnlockedAchievementIds,
      reconnectNow: () => setStatus("Визуалната връзка е възстановена."),
      isPending: false,
    };
  }, [config, room, setStatus, status, unlockedAchievementIds]);
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
  const snapshot: GameSnapshot = {
    code,
    mode: parsed.family === "mafia" ? "mafia_sport" : "werewolves_classic",
    playerCount: players.filter((player) => player.playing).length,
    narratorMode: parsed.viewer === "narrator" ? "full_human" : "automatic",
    communicationMode: "built_in_chat",
    tempoProfile: "normal_online",
    dayDiscussionSeconds: 180,
    voteSeconds: 60,
    revealRolesOnDeath: true,
    loversEnabled: parsed.family === "werewolves",
    doctorCanSelfProtect: parsed.doctorCanSelfProtect,
    allowSkipVote: parsed.phase === "voting",
    majorityMode: "simple",
    narratorVoice: parsed.family === "mafia" ? "inspector" : "classic",
    phase: parsed.phase,
    round: parsed.phase === "lobby" ? 0 : 2,
    phaseEndsAt: 0,
    winnerTeam: winner,
    winnerReasonBg: winner ? winnerReasonBg(winner, parsed.family) : "",
    players,
    roleCounts,
    voteTally:
      parsed.phase === "voting" && parsed.voteTally !== "empty" ? buildVoteTally(players, parsed.voteTally) : [],
    publicEvents: buildPublicEvents(parsed),
    publicChat: buildPublicChat(parsed.family),
  };

  const viewerRole = parsed.viewer === "narrator" || parsed.viewer === "spectator" ? null : parsed.role;
  return {
    snapshot,
    currentUserId,
    privateRole: viewerRole ? { role: viewerRole, roleNameBg: ROLE_DEFINITIONS[viewerRole].nameBg } : null,
    privateResult: viewerRole ? privateResultForRole(viewerRole, players, parsed.family) : null,
    privateLover: viewerRole === "cupid" ? privateLoverForPlayers(players) : null,
    narratorSnapshot: parsed.viewer === "narrator" ? narratorSnapshotFor(players, assignedRoles) : null,
    privateChats: buildPrivateChats(viewerRole, parsed.family),
    typingNotices: buildTypingNotices(parsed),
    isBlessed: viewerRole === "ordinary_villager" && parsed.phase === "night",
    connectionStatus: parsed.connection,
  };
}

export function isVisualGameFixtureEnabled(search: string | URLSearchParams, environment = process.env.NODE_ENV) {
  return environment !== "production" && toSearchParams(search).get("visualGame") === "1";
}

function parseVisualQuery(params: URLSearchParams, createOptions: CreateRoomOptions | undefined): ParsedVisualQuery {
  const preset = PRESET_DEFAULTS[params.get("preset") ?? ""] ?? {};
  const family = parseFamily(params.get("family") ?? preset.family, createOptions);
  const winnerParam = params.get("winner") ?? preset.winner ?? "";
  const phase = parsePhase(params.get("phase") ?? preset.phase ?? (winnerParam ? "game_over" : "night"));
  const viewer = parseViewer(params.get("viewer") ?? preset.viewer);
  const basePlayers = family === "mafia" ? 10 : 12;
  const playerCount = clampInteger(params.get("players") ?? preset.players, 3, 18, basePlayers);
  const deadMinimum = viewer === "dead" ? 1 : 0;
  const dead = Math.max(deadMinimum, clampInteger(params.get("dead") ?? preset.dead, 0, playerCount - 1, phase === "lobby" ? 0 : 1));
  const roleFallback = family === "mafia" ? "commissioner" : "seer";
  const role = parseRole(params.get("role") ?? preset.role, roleFallback);
  return {
    phase,
    family,
    players: playerCount,
    dead,
    viewer,
    role,
    winner: parseWinner(winnerParam),
    voteTally: parseVoteTally(params.get("voteTally") ?? preset.voteTally),
    connection: parseConnection(params.get("connection") ?? preset.connection),
    doctorCanSelfProtect: parseBooleanParam(params.get("doctorSelf"), createOptions?.doctorCanSelfProtect ?? false),
  };
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
    return {
      userId: isCurrent ? currentUserId : `visual-player-${index + 1}`,
      displayName: names[index] ?? `Играч ${index + 1}`,
      connected: index % 7 !== 5,
      ready: parsed.phase !== "lobby" || index % 5 !== 4,
      playing,
      alive,
      host: parsed.viewer === "host" ? isCurrent : index === 1,
      narrator: isNarratorViewer,
      acceptedFullNarrator: true,
      mayor: parsed.family === "werewolves" && index === 2,
      hasVoted: parsed.phase === "voting" && playing && alive && index % 2 === 0,
      actedThisPhase: (parsed.phase === "night" || parsed.phase === "first_night") && playing && alive && index % 3 === 0,
      revealedRole,
    };
  });
}

function deadIndexesFor(playerCount: number, deadCount: number, viewer: VisualViewer) {
  const indexes = new Set<number>();
  if (viewer === "dead") {
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

function buildVoteTally(players: PublicPlayer[], mode: VisualVoteTally): VoteTallyItem[] {
  const candidates = players.filter((player) => player.playing && player.alive).slice(1, 4);
  return candidates.map((player, index) => ({
    targetUserId: player.userId,
    targetName: player.displayName,
    count: mode === "tie" ? 2 : Math.max(1, candidates.length - index),
    hasMayorVote: index === 0,
  }));
}

function buildPublicEvents(parsed: ParsedVisualQuery): PublicEvent[] {
  return [
    { id: "visual-event-1", messageBg: "Разказвачът отвори визуална сцена за проверка." },
    { id: "visual-event-2", messageBg: PHASE_COPY[parsed.phase] },
    ...(parsed.dead > 0 ? [{ id: "visual-event-3", messageBg: "На площада вече липсва един глас." }] : []),
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

function privateResultForRole(role: RoleCode, players: PublicPlayer[], family: VisualFamily): PrivateResult | null {
  const target = players.find((player) => player.playing && player.alive && player.userId !== "visual-player-1") ?? players[1];
  if (!target) {
    return null;
  }
  if (role === "seer") {
    return {
      targetUserId: target.userId,
      role: "werewolf",
      messageBg: `${target.displayName} носи опасна тайна.`,
    };
  }
  if (role === "commissioner") {
    return {
      targetUserId: target.userId,
      isEvil: true,
      isCommissioner: false,
      messageBg: `${target.displayName} изглежда свързан с Мафията.`,
    };
  }
  if (role === "hunter") {
    return {
      targetUserId: target.userId,
      messageBg: "Последният изстрел чака избрана цел.",
    };
  }
  if ((family === "mafia" && role === "don") || (family === "werewolves" && role === "werewolf")) {
    return {
      targetUserId: target.userId,
      messageBg: "Фракцията вече обсъжда нощната си цел.",
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
      .filter((player) => player.playing)
      .map((player, index) => {
        const role = assignedRoles[index] ?? "ordinary_villager";
        return {
          userId: player.userId,
          displayName: player.displayName,
          role,
          roleNameBg: ROLE_DEFINITIONS[role].nameBg,
        };
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
    village: "Селото събра достатъчно смелост, за да изгони сенките.",
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

function parseFamily(value: string | undefined, createOptions: CreateRoomOptions | undefined): VisualFamily {
  if (value === "mafia" || value === "werewolves") {
    return value;
  }
  return getGameFamily((createOptions?.mode ?? "werewolves_classic") as GameMode);
}

function parsePhase(value: string | undefined): GamePhase {
  return isGamePhase(value) ? value : "night";
}

function isGamePhase(value: string | undefined): value is GamePhase {
  return Boolean(value && value in PHASE_COPY);
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
