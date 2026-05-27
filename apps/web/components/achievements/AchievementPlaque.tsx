import type { AchievementDefinition } from "@werewolf/shared";
import { AchievementIcon } from "./AchievementIcon";

interface PlaqueProps {
  achievement: AchievementDefinition;
  unlockedAt: string | null;
}

export function AchievementPlaque({ achievement, unlockedAt }: PlaqueProps) {
  const tier = achievement.tier ?? "bronze";
  const family = achievement.family ?? "universal";
  const isUnlocked = unlockedAt !== null;

  return (
    <div className="achievement-plaque-mount" data-family={family}>
      <span className="achievement-plaque-family-backing" aria-hidden="true" />
      <article className="achievement-plaque" data-tier={tier} data-family={family} data-locked={!isUnlocked}>
        <span className="achievement-plaque-tier-deco" aria-hidden="true" />
        <span className="achievement-plaque-lock-deco" aria-hidden="true" />
        <div className="achievement-plaque-inner">
          <AchievementIcon id={achievement.id} />
          <h3 className="achievement-plaque-title">{achievement.titleBg}</h3>
          <p className="achievement-plaque-desc">{achievement.descriptionBg}</p>
          <p className="achievement-plaque-meta">{unlockedAt ? `Отключено · ${formatDate(unlockedAt)}` : "Заключено"}</p>
        </div>
      </article>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "няма дата";
  }
  return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" }).format(date);
}
