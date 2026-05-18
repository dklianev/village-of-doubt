import type { PlayerStats } from "@/lib/account-stats";

export function AccountStats({ stats }: { stats: PlayerStats }) {
  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Следата ти</h2>
        <p>Какво остана след игрите досега.</p>
      </header>

      <div className="account-stats-grid">
        <article className="account-stat-card">
          <p className="account-stat-label">Селски победи</p>
          <p className="account-stat-value">{stats.villageWins}</p>
          <p className="account-stat-hint">от ролята на селянин</p>
        </article>

        <article className="account-stat-card">
          <p className="account-stat-label">Нощни победи</p>
          <p className="account-stat-value">{stats.threatWins}</p>
          <p className="account-stat-hint">от ролята на върколак или мафиот</p>
        </article>

        <article className="account-stat-card">
          <p className="account-stat-label">Най-дълга серия</p>
          <p className="account-stat-value">{stats.longestStreak}</p>
          <p className="account-stat-hint">{stats.longestStreak === 1 ? "поредна победа" : "поредни победи"}</p>
        </article>

        <article className="account-stat-card">
          <p className="account-stat-label">Победна следа</p>
          <p className="account-stat-value">
            {stats.winRate}
            <span className="account-stat-suffix">%</span>
          </p>
          <p className="account-stat-hint">
            от {stats.totalGames} {stats.totalGames === 1 ? "игра" : "игри"}
          </p>
        </article>
      </div>
    </section>
  );
}
