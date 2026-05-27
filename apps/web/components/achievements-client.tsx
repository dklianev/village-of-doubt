"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { EmptyState, Pill } from "@werewolf/ui";
import { EMPTY_STATES } from "@werewolf/ui/states";
import { AchievementPlaque } from "@/components/achievements/AchievementPlaque";
import { AchievementProgressWreath } from "@/components/achievements/AchievementProgressWreath";
import { ArtifactImage } from "@/components/ArtifactImage";
import { authClient } from "@/lib/auth-client";
import "@/components/achievements/Achievements.module.css";

export interface OwnedAchievement {
  achievementId: string;
  gameId: string | null;
  unlockedAt: string;
}

interface AchievementsClientProps {
  initialOwned?: OwnedAchievement[] | undefined;
}

export function AchievementsClient({ initialOwned }: AchievementsClientProps) {
  const { data: session, isPending } = authClient.useSession();
  const [owned, setOwned] = useState<OwnedAchievement[]>(initialOwned ?? []);
  const [loaded, setLoaded] = useState(initialOwned !== undefined);

  useEffect(() => {
    if (initialOwned !== undefined) {
      setOwned(initialOwned);
      setLoaded(true);
      return;
    }

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
  }, [initialOwned, isPending, session?.user?.id]);

  const ownedById = new Map(owned.map((achievement) => [achievement.achievementId, achievement]));
  const unlockedCount = ownedById.size;
  const zeroState = EMPTY_STATES["achievements-zero"];

  if (!loaded) {
    return (
      <>
        <AchievementProgressWreath unlocked={0} total={ACHIEVEMENTS.length} />
        <section className="plaque-wall achievements-skeleton mt-8" aria-hidden="true">
          {Array.from({ length: Math.min(12, ACHIEVEMENTS.length) }).map((_, index) => (
            <article key={index} className="achievement-plaque achievement-plaque-skeleton">
              <div className="achievement-plaque-inner">
                <span className="achievement-skeleton-line achievement-skeleton-line-title" />
                <span className="achievement-skeleton-line" />
                <span className="achievement-skeleton-line achievement-skeleton-line-short" />
              </div>
            </article>
          ))}
        </section>
        <p className="plaque-loading" role="status">
          Зареждам легенди...
        </p>
      </>
    );
  }

  return (
    <>
      <AchievementProgressWreath unlocked={unlockedCount} total={ACHIEVEMENTS.length} />

      {unlockedCount === 0 ? (
        <div className="achievement-empty-state">
          <EmptyState
            artifact={<ArtifactImage artifact={zeroState.artifact} />}
            title={zeroState.title}
            body={zeroState.body}
            action={
              zeroState.action?.href ? (
                <Pill as="a" href={zeroState.action.href}>
                  {zeroState.action.label}
                </Pill>
              ) : null
            }
          />
        </div>
      ) : (
        <section className="plaque-wall mt-8">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = ownedById.get(achievement.id);
            return <AchievementPlaque key={achievement.id} achievement={achievement} unlockedAt={unlocked?.unlockedAt ?? null} />;
          })}
        </section>
      )}
    </>
  );
}
