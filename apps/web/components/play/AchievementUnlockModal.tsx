import { ACHIEVEMENTS } from "@werewolf/shared";
import { Award, X } from "lucide-react";
import Link from "next/link";
import { AchievementIcon } from "@/components/achievements/AchievementIcon";
import { useModal } from "@/lib/use-modal";
import styles from "./AchievementUnlockModal.module.css";

export function AchievementUnlockModal({ achievementIds, onClose }: { achievementIds: string[]; onClose: () => void }) {
  const achievements = ACHIEVEMENTS.filter((achievement) => achievementIds.includes(achievement.id));
  const { ref } = useModal<HTMLElement>({ open: achievements.length > 0, onClose });
  if (achievements.length === 0) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <aside
        ref={ref}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Отключени легенди"
        onClick={(event) => event.stopPropagation()}
      >
        <button className={styles.close} type="button" aria-label="Затвори" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
        <header className={styles.header}>
          <span className={styles.seal} aria-hidden="true">
            <Award />
          </span>
          <p>нова легенда</p>
          <h2>Нова легенда в залата</h2>
          <span>Постижението вече е гравирано в личното ти досие.</span>
        </header>
        <div className={styles.list}>
          {achievements.map((achievement) => (
            <article className={styles.plaque} key={achievement.id}>
              <AchievementIcon id={achievement.id} />
              <div>
                <strong>{achievement.titleBg}</strong>
                <p>{achievement.descriptionBg}</p>
              </div>
            </article>
          ))}
        </div>
        <footer className={styles.actions}>
          <Link className="btn btn-primary" href="/achievements" onClick={onClose}>
            Виж залата на легендите
          </Link>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Продължи вечерта
          </button>
        </footer>
      </aside>
    </div>
  );
}
