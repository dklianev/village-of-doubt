"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@werewolf/shared";
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
      <section className="empty-state-card utility-empty mt-6 rounded-[2rem] p-6">
        <span aria-hidden="true" />
        <h2>{unlockedCount > 0 ? "Легендите вече имат следи" : "Първото постижение още чака своята сцена"}</h2>
        <p>
          {unlockedCount > 0
            ? `Отключени са ${unlockedCount} от ${ACHIEVEMENTS.length} постижения за този anonymous играч.`
            : "След завършена игра тук ще различаваме отключените моменти от заключените легенди."}
        </p>
      </section>

      <section className="achievement-grid mt-6">
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = ownedById.get(achievement.id);
          return (
            <article
              key={achievement.id}
              className={`paper-card achievement-card rounded-[2rem] p-6 ${unlocked ? "is-unlocked" : "is-locked"}`}
            >
              <span>{achievement.iconBg}</span>
              <h2>{achievement.titleBg}</h2>
              <p>{achievement.descriptionBg}</p>
              <small className="achievement-meta">
                {unlocked ? `Отключено: ${formatDate(unlocked.unlockedAt)}` : loaded ? "Заключено" : "Зареждане..."}
              </small>
            </article>
          );
        })}
      </section>
    </>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "няма дата";
  }
  return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" }).format(date);
}
