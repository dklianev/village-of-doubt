"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementPlaque } from "@/components/achievements/AchievementPlaque";
import { AchievementProgressWreath } from "@/components/achievements/AchievementProgressWreath";
import { authClient } from "@/lib/auth-client";

interface OwnedAchievement {
  achievementId: string;
  gameId: string | null;
  unlockedAt: string;
}

export function AchievementsClient() {
  const { data: session, isPending } = authClient.useSession();
  const [owned, setOwned] = useState<OwnedAchievement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    const userId = session?.user?.id ?? "";
    if (!userId) {
      setLoaded(true);
      return;
    }

    fetch("/api/achievements")
      .then((response) => (response.ok ? response.json() : { achievements: [] }))
      .then((body: { achievements?: OwnedAchievement[] }) => setOwned(body.achievements ?? []))
      .catch(() => setOwned([]))
      .finally(() => setLoaded(true));
  }, [isPending, session?.user?.id]);

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
