import type { RoleCode } from "./roles.js";

export interface AchievementEventLike {
  round?: number;
  phase: string;
  type: string;
  actorId?: string | null;
  targetId?: string | null;
  payload: unknown;
}

export interface AchievementPlayerLike {
  userId: string;
  role?: RoleCode | string;
  alive?: boolean;
}

export interface AchievementGameContext {
  events: AchievementEventLike[];
  players: AchievementPlayerLike[];
  winnerTeam?: string | null;
  eventsTruncated?: boolean;
}

export type AchievementTier = "bronze" | "silver" | "gold";
export type AchievementFamily = "werewolves" | "mafia" | "universal";

export interface AchievementDefinition {
  id: string;
  titleBg: string;
  descriptionBg: string;
  iconBg: string;
  tier?: AchievementTier;
  family?: AchievementFamily;
  predicate: (context: AchievementGameContext) => string[];
}

const PROTECTIVE_ROLES = new Set(["healer", "doctor", "bodyguard", "priest", "witch"]);
const CIVILIAN_ROLES = new Set(["civilian", "ordinary_villager"]);

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first_blood",
    titleBg: "Първа кръв",
    descriptionBg: "Напускаш играта още през първата нощ.",
    iconBg: "кръв",
    tier: "bronze",
    family: "universal",
    predicate: ({ events }) =>
      uniqueUserIds(events.filter((event) => event.type === "death" && event.phase === "first_night").map((event) => event.targetId)),
  },
  {
    id: "jester_win",
    titleBg: "Шут на годината",
    descriptionBg: "Караш масата да те елиминира и печелиш личната си игра.",
    iconBg: "маска",
    tier: "silver",
    family: "universal",
    predicate: ({ events }) =>
      uniqueUserIds(
        events
          .filter((event) => event.type === "jester_personal_win" || event.type === "personal_win")
          .map((event) => event.targetId ?? payloadStringValue(event.payload, "targetUserId")),
      ),
  },
  {
    id: "guardian_save",
    titleBg: "Спасител",
    descriptionBg: "Спираш поне две нощни смърти в една игра.",
    iconBg: "щит",
    tier: "silver",
    family: "universal",
    predicate: personalGuardianSaves,
  },
  {
    id: "hunter_revenge",
    titleBg: "Последният изстрел",
    descriptionBg: "Падаш като Ловец, но последният ти изстрел променя финала.",
    iconBg: "куршум",
    tier: "gold",
    family: "werewolves",
    predicate: ({ events, players }) => {
      const hasHunterShot = events.some((event) => event.type === "death" && payloadAsText(event.payload).includes("Ловеца"));
      if (!hasHunterShot) {
        return [];
      }
      return players.filter((player) => player.role === "hunter").map((player) => player.userId);
    },
  },
  {
    id: "silent_civilian",
    titleBg: "Глас до края",
    descriptionBg: "Оцеляваш като обикновен играч, без да пропуснеш дневен глас.",
    iconBg: "свещ",
    tier: "bronze",
    family: "universal",
    predicate: ({ events, players, eventsTruncated }) => {
      if (eventsTruncated) {
        return [];
      }
      // Each tally is a completed ballot, including same-round revotes. Only
      // the server's final voter snapshot proves participation, not submissions.
      const ballots = events.filter((event) => event.type === "vote_tally" && event.phase === "voting");
      const voterSets = ballots.map((event) => completedBallotVoters(event.payload));
      if (voterSets.length === 0 || voterSets.some((voters) => voters === null)) {
        return [];
      }
      return players
        .filter((player) => player.alive && player.role && CIVILIAN_ROLES.has(player.role)
          && voterSets.every((voters) => voters?.has(player.userId)))
        .map((player) => player.userId);
    },
  },
  {
    id: "perfect_record",
    titleBg: "Дълга нощ",
    descriptionBg: "Участваш в игра с поне 20 важни събития.",
    iconBg: "архив",
    tier: "bronze",
    family: "universal",
    predicate: ({ events, players }) => (events.filter((event) => event.type !== "chat").length >= 20
      ? players.map((player) => player.userId) : []),
  },
  {
    id: "maniac_endgame",
    titleBg: "Сам срещу града",
    descriptionBg: "Печелиш като единствената останала заплаха.",
    iconBg: "нож",
    tier: "gold",
    family: "mafia",
    predicate: ({ winnerTeam, players }) =>
      winnerTeam === "maniac" ? players.filter((player) => player.role === "maniac").map((player) => player.userId) : [],
  },
];

export function evaluateAchievementUnlocks(context: AchievementGameContext) {
  return ACHIEVEMENTS.flatMap((achievement) =>
    achievement.predicate(context).map((userId) => ({
      userId,
      achievementId: achievement.id,
    })),
  );
}

// A prediction from the same predicates, not evidence of a persisted award.
// Without a roster/result, conditions needing them deliberately remain unmet.
export function deriveAchievementsFromEvents(
  events: AchievementEventLike[],
  context: Omit<AchievementGameContext, "events"> = { players: [] },
) {
  const unlocked = new Set(evaluateAchievementUnlocks({ ...context, events }).map((unlock) => unlock.achievementId));
  return ACHIEVEMENTS.filter((achievement) => unlocked.has(achievement.id));
}

export function getAchievementById(id: string) {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

function uniqueUserIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function payloadAsText(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

function payloadStringValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function personalGuardianSaves({ events, players }: AchievementGameContext) {
  const savers = new Set(players.filter((player) => player.role && PROTECTIVE_ROLES.has(player.role))
    .map((player) => player.userId));
  const deaths = new Set<string>();
  const savesByUser = new Map<string, Set<string>>();
  let night: { round: number; phase: string } | undefined;
  for (const event of events) {
    const isNight = event.phase === "night" || event.phase === "first_night";
    // Events are chronological. Death interruptions (including lover chains)
    // and pauses belong to the originating night until ordinary play resumes.
    if (isNight) {
      night = typeof event.round === "number" && Number.isInteger(event.round) && event.round >= 1
        ? { round: event.round, phase: event.phase } : undefined;
    } else if (event.round !== night?.round
      || (event.phase !== "hunter_revenge" && event.phase !== "mayor_successor" && event.phase !== "paused")) {
      night = undefined;
    }
    if (!night || !event.targetId) {
      continue;
    }
    const key = JSON.stringify([night.round, night.phase, event.targetId]);
    if (event.type === "death") {
      deaths.add(key);
      continue;
    }
    if ((event.type !== "night_death_prevented" && event.type !== "priest_blessing_protected_target")
      || !isNight || !event.actorId || !savers.has(event.actorId)) {
      continue;
    }
    // Multiple attacks and duplicate reports on one target in one night are
    // still one saved life; anonymous legacy reports never establish credit.
    const saves = savesByUser.get(event.actorId) ?? new Set<string>();
    saves.add(key);
    savesByUser.set(event.actorId, saves);
  }
  return [...savesByUser].filter(([, saves]) => [...saves].filter((key) => !deaths.has(key)).length >= 2)
    .map(([userId]) => userId);
}

function completedBallotVoters(payload: unknown): Set<string> | null {
  if (!payload || typeof payload !== "object" || !("voters" in payload) || !Array.isArray(payload.voters)) {
    return null;
  }
  const voters = new Set<string>();
  for (const voter of payload.voters) {
    if (!voter || typeof voter !== "object" || !("userId" in voter)
      || typeof voter.userId !== "string" || !voter.userId) {
      return null;
    }
    voters.add(voter.userId);
  }
  return voters;
}
