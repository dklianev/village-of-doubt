import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementPlaque } from "@/components/achievements/AchievementPlaque";
import { AchievementProgressWreath } from "@/components/achievements/AchievementProgressWreath";

export interface OwnedAchievement {
  achievementId: string;
  gameId: string | null;
  unlockedAt: string;
}

interface AchievementsClientProps {
  owned: OwnedAchievement[];
  status: "ready" | "unavailable";
}

export function AchievementsClient({ owned, status }: AchievementsClientProps) {
  const ownedById = new Map(owned.map((achievement) => [achievement.achievementId, achievement]));
  const unlockedCount = ownedById.size;

  if (status === "unavailable") {
    return (
      <section className="achievement-load-state" role="alert">
        <h2>Легендите временно са зад завесата</h2>
        <p>Не успяхме да прочетем отключените плочи. Опитай отново след малко.</p>
      </section>
    );
  }

  return (
    <>
      <AchievementProgressWreath unlocked={unlockedCount} total={ACHIEVEMENTS.length} />

      <section className="plaque-wall mt-8">
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = ownedById.get(achievement.id);
          return <AchievementPlaque key={achievement.id} achievement={achievement} unlockedAt={unlocked?.unlockedAt ?? null} />;
        })}
      </section>
    </>
  );
}
