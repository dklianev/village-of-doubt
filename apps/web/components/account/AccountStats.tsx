import { Display, PaperCard } from "@werewolf/ui/server";
import type { PlayerStats } from "@/lib/account-stats";
import styles from "./AccountStats.module.css";

export function AccountStats({ stats }: { stats: PlayerStats }) {
  return (
    <section aria-labelledby="account-stats-title">
      <PaperCard eyebrow="СЛЕДАТА ТИ" density="md">
        <div className="account-card-content">
          <header className="account-section-head">
            <Display size="h3" as="h2">
              <span id="account-stats-title">Следата ти</span>
            </Display>
            <p>Какво остана след игрите досега.</p>
          </header>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>Селски победи</p>
              <p className={styles.statValue}>{stats.villageWins}</p>
              <p className={styles.statHint}>от ролята на селянин</p>
            </article>

            <article className={styles.statCard}>
              <p className={styles.statLabel}>Нощни победи</p>
              <p className={styles.statValue}>{stats.threatWins}</p>
              <p className={styles.statHint}>от ролята на върколак или мафиот</p>
            </article>

            <article className={styles.statCard}>
              <p className={styles.statLabel}>Най-дълга серия</p>
              <p className={styles.statValue}>{stats.longestStreak}</p>
              <p className={styles.statHint}>{stats.longestStreak === 1 ? "поредна победа" : "поредни победи"}</p>
            </article>

            <article className={styles.statCard}>
              <p className={styles.statLabel}>Победна следа</p>
              <p className={styles.statValue}>
                {stats.winRate}
                <span className={styles.statSuffix}>%</span>
              </p>
              <p className={styles.statHint}>
                от {stats.totalGames} {stats.totalGames === 1 ? "игра" : "игри"}
              </p>
            </article>
          </div>
        </div>
      </PaperCard>
    </section>
  );
}
