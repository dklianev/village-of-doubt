import { Flame, MoonStar, Sun } from "lucide-react";
import type { PlayerStats } from "@/lib/account-stats";
import styles from "./Account.module.css";

interface Props {
  stats: PlayerStats;
  activityState?: "ready" | "empty";
}

export function AccountStats({ stats, activityState = "ready" }: Props) {
  const empty = activityState === "empty";

  return (
    <section className={`${styles.section} ${styles.statsSection}`}>
      <header className={styles.sectionHead}>
        <h2>Следата ти</h2>
        <p>{empty ? "Завърши първата си игра, за да започне историята ти." : "Резултати от завършените игри, в които си участвал."}</p>
      </header>

      <div className={styles.statsGrid}>
        <article className={styles.statCard} data-empty={empty || undefined}>
          <Sun className={styles.statIcon} aria-hidden="true" />
          <p className={styles.statLabel}>На страната на мирните</p>
          <p className={styles.statValue}>{empty ? "—" : stats.villageWins}</p>
          <p className={styles.statHint}>{empty ? "Очаква първата игра" : "победи със Селото или Града"}</p>
        </article>

        <article className={styles.statCard} data-empty={empty || undefined}>
          <MoonStar className={styles.statIcon} aria-hidden="true" />
          <p className={styles.statLabel}>Нощни победи</p>
          <p className={styles.statValue}>{empty ? "—" : stats.threatWins}</p>
          <p className={styles.statHint}>{empty ? "Очаква първата игра" : "с Върколаците, Вампирите или Мафията"}</p>
        </article>

        <article className={styles.statCard} data-empty={empty || undefined}>
          <Flame className={styles.statIcon} aria-hidden="true" />
          <p className={styles.statLabel}>Най-дълга серия</p>
          <p className={styles.statValue}>{empty ? "—" : stats.longestStreak}</p>
          <p className={styles.statHint}>
            {empty ? "Очаква първата игра" : stats.longestStreak === 1 ? "поредна победа" : "поредни победи"}
          </p>
        </article>

      </div>
    </section>
  );
}
