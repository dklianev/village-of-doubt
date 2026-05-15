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
    descriptionBg: "Играч преживява първата голяма сцена на елиминация в началото на играта.",
    iconBg: "кръв",
    tier: "bronze",
    family: "universal",
    predicate: ({ events }) =>
      uniqueUserIds(events.filter((event) => event.type === "death" && event.phase === "first_night").map((event) => event.targetId)),
  },
  {
    id: "jester_win",
    titleBg: "Шут на годината",
    descriptionBg: "Шутът успява да убеди масата да го елиминира и печели личната си игра.",
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
    descriptionBg: "Защитна роля спира поне две смърти в една игра.",
    iconBg: "щит",
    tier: "silver",
    family: "universal",
    predicate: ({ events, players }) => {
      const preventedDeaths = events.filter((event) =>
        ["night_death_prevented", "priest_blessing_protected", "guard_dog_protected_mayor"].includes(event.type),
      );
      if (preventedDeaths.length < 2) {
        return [];
      }
      return players
        .filter((player) => player.role && PROTECTIVE_ROLES.has(player.role))
        .map((player) => player.userId);
    },
  },
  {
    id: "hunter_revenge",
    titleBg: "Ловецът-вдовица",
    descriptionBg: "Ловецът пада, но последният му изстрел променя финала.",
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
    titleBg: "Тих гражданин",
    descriptionBg: "Обикновен играч оцелява до края, без да пропуска дневния си глас.",
    iconBg: "свещ",
    tier: "bronze",
    family: "universal",
    predicate: ({ events, players }) => {
      const skipVoters = new Set(
        events
          .filter(
            (event) =>
              event.type === "vote_submitted" &&
              (payloadStringValue(event.payload, "targetUserId") === "skip" || payloadBooleanValue(event.payload, "skipped")),
          )
          .map((event) => event.actorId)
          .filter((userId): userId is string => Boolean(userId)),
      );

      return players
        .filter((player) => player.alive && player.role && CIVILIAN_ROLES.has(player.role) && !skipVoters.has(player.userId))
        .map((player) => player.userId);
    },
  },
  {
    id: "perfect_record",
    titleBg: "Протокол без празнини",
    descriptionBg: "Записът има поне 20 запазени събития.",
    iconBg: "архив",
    tier: "bronze",
    family: "universal",
    predicate: ({ events, players }) => (events.length >= 20 ? players.map((player) => player.userId) : []),
  },
  {
    id: "maniac_endgame",
    titleBg: "Сам срещу града",
    descriptionBg: "Маниакът печели като последна реална заплаха.",
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

export function deriveAchievementsFromEvents(events: AchievementEventLike[]) {
  const unlocked = new Set<string>();

  if (events.some((event) => event.type === "death" && event.phase === "first_night")) {
    unlocked.add("first_blood");
  }
  if (events.some((event) => event.type === "jester_personal_win" || event.type === "personal_win")) {
    unlocked.add("jester_win");
  }
  if (
    events.some((event) =>
      ["night_death_prevented", "priest_blessing_protected", "guard_dog_protected_mayor"].includes(event.type),
    )
  ) {
    unlocked.add("guardian_save");
  }
  if (events.some((event) => event.type === "death" && payloadAsText(event.payload).includes("Ловеца"))) {
    unlocked.add("hunter_revenge");
  }
  if (events.length >= 20) {
    unlocked.add("perfect_record");
  }
  if (events.some((event) => payloadAsText(event.payload).includes("maniac") || payloadAsText(event.payload).includes("Маниак"))) {
    unlocked.add("maniac_endgame");
  }

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

function payloadBooleanValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return false;
  }

  return (payload as Record<string, unknown>)[key] === true;
}
