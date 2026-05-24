import Link from "next/link";
import { Display, PaperCard } from "@werewolf/ui/server";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementIcon } from "@/components/achievements/AchievementIcon";
import styles from "./AccountAchievements.module.css";

interface Props {
  unlockedIds: string[];
  total: number;
}

export function AccountAchievements({ unlockedIds, total }: Props) {
  const unlockedSet = new Set(unlockedIds);
  const top3 = ACHIEVEMENTS.filter((definition) => unlockedSet.has(definition.id)).slice(0, 3);

  return (
    <section aria-labelledby="account-achievements-title">
      <PaperCard eyebrow="ПОСТИЖЕНИЯ" density="md">
        <div className="account-card-content">
          <header className="account-section-head">
            <Display size="h3" as="h2">
              <span id="account-achievements-title">Легенди</span>
            </Display>
            <p>
              {unlockedIds.length} от {total} легенди отключени.
            </p>
          </header>

          {top3.length > 0 ? (
            <ul className={styles.achievementRow}>
              {top3.map((definition) => (
                <li key={definition.id}>
                  <article
                    className={styles.achievementMini}
                    data-tier={definition.tier ?? "bronze"}
                    data-family={definition.family ?? "universal"}
                  >
                    <AchievementIcon id={definition.id} className={styles.achievementIcon ?? ""} />
                    <p className={styles.achievementTitle}>{definition.titleBg}</p>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <p className="account-empty-note">
              Заключени са все още. Завърши първата игра, за да гравираш плоча.
            </p>
          )}

          <Link href="/achievements" className="account-section-link">
            Виж всички легенди →
          </Link>
        </div>
      </PaperCard>
    </section>
  );
}
