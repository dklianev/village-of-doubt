"use client";

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
    <article className="achievement-plaque" data-tier={tier} data-family={family} data-locked={!isUnlocked}>
      <div className="achievement-plaque-inner">
        <AchievementIcon id={achievement.id} />
        <h3 className="achievement-plaque-title">{achievement.titleBg}</h3>
        <p className="achievement-plaque-desc">{achievement.descriptionBg}</p>
        <p className="achievement-plaque-meta">{unlockedAt ? `Отключено · ${formatDate(unlockedAt)}` : "Заключено"}</p>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "няма дата";
  }
  return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" }).format(date);
}
