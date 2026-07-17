import { Flame, MoonStar, Percent, Sun } from "lucide-react";
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
        <p>{empty ? "Регистърът очаква първото ти дело." : "Какво остана след игрите досега."}</p>
      </header>

      <div className={styles.statsGrid}>
        <article className={styles.statCard} data-empty={empty || undefined}>
          <Sun className={styles.statIcon} aria-hidden="true" />
          <p className={styles.statLabel}>Селски победи</p>
          <p className={styles.statValue}>{empty ? "—" : stats.villageWins}</p>
          <p className={styles.statHint}>{empty ? "Очаква първата игра" : "от ролята на селянин"}</p>
        </article>

        <article className={styles.statCard} data-empty={empty || undefined}>
          <MoonStar className={styles.statIcon} aria-hidden="true" />
          <p className={styles.statLabel}>Нощни победи</p>
          <p className={styles.statValue}>{empty ? "—" : stats.threatWins}</p>
          <p className={styles.statHint}>{empty ? "Очаква първата игра" : "от ролята на върколак или мафиот"}</p>
        </article>

        <article className={styles.statCard} data-empty={empty || undefined}>
          <Flame className={styles.statIcon} aria-hidden="true" />
          <p className={styles.statLabel}>Най-дълга серия</p>
          <p className={styles.statValue}>{empty ? "—" : stats.longestStreak}</p>
          <p className={styles.statHint}>
            {empty ? "Очаква първата игра" : stats.longestStreak === 1 ? "поредна победа" : "поредни победи"}
          </p>
        </article>

        <article className={styles.statCard} data-empty={empty || undefined}>
          <Percent className={styles.statIcon} aria-hidden="true" />
          <p className={styles.statLabel}>Победна следа</p>
          <p className={styles.statValue}>
            {empty ? "—" : stats.winRate}
            {empty ? null : <span className={styles.statSuffix}>%</span>}
          </p>
          <p className={styles.statHint}>
            {empty ? "Очаква първата игра" : `от ${stats.totalGames} ${stats.totalGames === 1 ? "игра" : "игри"}`}
          </p>
        </article>
      </div>
    </section>
  );
}
