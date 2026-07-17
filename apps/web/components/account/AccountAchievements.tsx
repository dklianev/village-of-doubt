import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementIcon } from "@/components/achievements/AchievementIcon";
import styles from "./Account.module.css";

interface Props {
  unlockedIds: string[];
  total: number;
}

export function AccountAchievements({ unlockedIds, total }: Props) {
  const unlockedSet = new Set(unlockedIds);
  const visibleAchievements = ACHIEVEMENTS.filter((definition) => unlockedSet.has(definition.id)).slice(0, 7);
  const visibleSlotCount = Math.min(total, 7);
  const lockedCount = Math.max(0, visibleSlotCount - visibleAchievements.length);

  return (
    <section
      className={`${styles.section} ${styles.achievementsSection}`}
      data-empty={visibleAchievements.length === 0 ? "true" : undefined}
      data-account-empty-legends={visibleAchievements.length === 0 ? "true" : undefined}
    >
      <header className={styles.sectionHead}>
        <h2>Легенди</h2>
        <p>
          {unlockedIds.length} от {total} легенди отключени.
        </p>
      </header>

      <ul className={styles.achievementRow} aria-label="Печатите в досието">
        {visibleAchievements.map((definition) => (
          <li key={definition.id}>
            <article
              className={styles.achievementSeal}
              data-tier={definition.tier ?? "bronze"}
              data-family={definition.family ?? "universal"}
            >
              <AchievementIcon id={definition.id} className={styles.achievementIcon!} />
              <p className={styles.achievementTitle}>{definition.titleBg}</p>
            </article>
          </li>
        ))}
        {Array.from({ length: lockedCount }, (_, index) => (
          <li key={`locked-${index}`}>
            <div
              className={styles.lockedAchievement}
              data-account-locked-legend
              role="img"
              aria-label="Заключена легенда"
            >
              <LockKeyhole className={styles.lockedAchievementIcon} aria-hidden="true" />
              <span>заключена</span>
            </div>
          </li>
        ))}
      </ul>

      {visibleAchievements.length === 0 ? (
        <div className={styles.achievementEmptyCopy}>
          <h3>Легендите още не са започнали.</h3>
          <p>Първата завършена игра ще остави първия печат в личното ти досие.</p>
          <Link href="/create" className={styles.sectionLink}>
            Седни на масата →
          </Link>
        </div>
      ) : null}

      {visibleAchievements.length > 0 ? (
        <Link href="/achievements" className={styles.sectionLink}>
          Виж всички легенди →
        </Link>
      ) : null}
    </section>
  );
}
