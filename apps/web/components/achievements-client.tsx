"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementPlaque } from "@/components/achievements/AchievementPlaque";
import { AchievementProgressWreath } from "@/components/achievements/AchievementProgressWreath";
import { ANONYMOUS_USER_ID_KEY } from "@/lib/anonymous-player";

interface OwnedAchievement {
  achievementId: string;
  gameId: string | null;
  unlockedAt: string;
}

export function AchievementsClient() {
  const [owned, setOwned] = useState<OwnedAchievement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const userId = window.localStorage.getItem(ANONYMOUS_USER_ID_KEY) ?? "";
    if (!userId) {
      setLoaded(true);
      return;
    }

    fetch(`/api/achievements?userId=${encodeURIComponent(userId)}`)
      .then((response) => (response.ok ? response.json() : { achievements: [] }))
      .then((body: { achievements?: OwnedAchievement[] }) => setOwned(body.achievements ?? []))
      .catch(() => setOwned([]))
      .finally(() => setLoaded(true));
  }, []);

  const ownedById = new Map(owned.map((achievement) => [achievement.achievementId, achievement]));
  const unlockedCount = ownedById.size;

  return (
    <>
      <AchievementProgressWreath unlocked={unlockedCount} total={ACHIEVEMENTS.length} />

      <section className="plaque-wall mt-8">
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = ownedById.get(achievement.id);
          return <AchievementPlaque key={achievement.id} achievement={achievement} unlockedAt={unlocked?.unlockedAt ?? null} />;
        })}
      </section>

      {!loaded ? <p className="plaque-loading">Зареждам легенди...</p> : null}
    </>
  );
}
