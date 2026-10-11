import type { AchievementDefinition } from "@werewolf/shared";
import { isUuid } from "@/lib/identifiers";

export interface OwnedAchievement {
  achievementId: string;
  /** Already filtered for replay eligibility by the authenticated page. */
  gameId: string | null;
  unlockedAt: string;
}

export function achievementDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getAchievementCollection(catalog: readonly AchievementDefinition[], owned: readonly OwnedAchievement[]) {
  const ownedById = new Map<string, OwnedAchievement>();
  // Prefer dated records even if a legacy duplicate arrives last.
  const sortedOwned = [...owned].sort((a, b) =>
    (achievementDate(b.unlockedAt)?.getTime() ?? -Infinity)
      - (achievementDate(a.unlockedAt)?.getTime() ?? -Infinity)
    || (a.gameId ?? "").localeCompare(b.gameId ?? ""));
  for (const row of sortedOwned) {
    if (!ownedById.has(row.achievementId)) ownedById.set(row.achievementId, row);
  }
  const entries = catalog.map((achievement) => ({ achievement, owned: ownedById.get(achievement.id) ?? null }));
  // Stable sorting preserves catalog order for equal timestamps, independent of query order.
  const featured = entries
    .filter((entry) => achievementDate(entry.owned?.unlockedAt ?? null) !== null)
    .sort((a, b) => achievementDate(b.owned!.unlockedAt)!.getTime() - achievementDate(a.owned!.unlockedAt)!.getTime())[0] ?? null;

  return {
    featured,
    remaining: entries.filter((entry) => entry !== featured),
    unlockedCount: entries.filter((entry) => entry.owned !== null).length,
  };
}

export function achievementPresentation(
  achievement: AchievementDefinition,
  unlockedAt: string | null,
  gameId: string | null,
  visualReplay: boolean,
) {
  const tier = achievement.tier ?? "bronze";
  const family = achievement.family ?? "universal";
  const isUnlocked = unlockedAt !== null;
  return {
    tier,
    family,
    isUnlocked,
    tierLabel: { bronze: "Бронз", silver: "Сребро", gold: "Злато" }[tier],
    familyLabel: { werewolves: "Върколак", mafia: "Мафия", universal: "Двата свята" }[family],
    unlockedDate: achievementDate(unlockedAt),
    artSrc: `/game-art/achievements/relics/${achievement.id}.webp`,
    replayHref: isUnlocked && gameId && isUuid(gameId)
      ? `/history/${gameId}/replay${process.env.NODE_ENV !== "production" && visualReplay ? "?visualReplay=fixture" : ""}`
      : null,
  };
}
