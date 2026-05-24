import Link from "next/link";
import { Display, PaperCard } from "@werewolf/ui/server";
import { getGameModeNameBg, type GameMode, type WinnerTeam } from "@werewolf/shared";
import styles from "./AccountRecentGames.module.css";

export interface RecentGameSummary {
  id: string;
  code: string;
  mode: GameMode;
  winnerTeam: WinnerTeam | null;
  endedAt: Date | null;
}

const WINNER_LABEL: Record<WinnerTeam, string> = {
  village: "Селото оцеля",
  werewolves: "Върколаците надделяха",
  vampires: "Вампирите надделяха",
  mafia: "Мафията владее",
  maniac: "Маниакът победи",
  lovers: "Влюбените се измъкнаха",
  draw: "Равенство",
};

export function AccountRecentGames({ games }: { games: RecentGameSummary[] }) {
  return (
    <section aria-labelledby="account-recent-title">
      <PaperCard eyebrow="ПОСЛЕДНИ ВЕЧЕРИ" density="md">
        <div className="account-card-content">
          <header className="account-section-head">
            <Display size="h3" as="h2">
              <span id="account-recent-title">Последни вечери</span>
            </Display>
            <p>Архивът помни последните ти три маси.</p>
          </header>

          <ul className={styles.gameList}>
            {games.map((game) => (
              <li key={game.id}>
                <article className={styles.gameCard}>
                  <header className={styles.gameHead}>
                    <span className={styles.gameCode}>Дело №{game.code}</span>
                    <time className={styles.gameDate}>{formatDate(game.endedAt)}</time>
                  </header>
                  <p className={styles.gameVerdict}>
                    {game.winnerTeam ? WINNER_LABEL[game.winnerTeam] : "Незавършена"}
                  </p>
                  <p className={styles.gameMode}>{getGameModeNameBg(game.mode)}</p>
                  <Link href={`/history/${game.id}/replay`} className={styles.gameLink}>
                    Отвори дело →
                  </Link>
                </article>
              </li>
            ))}
          </ul>

          <Link href="/history" className="account-section-link">
            Виж пълния архив →
          </Link>
        </div>
      </PaperCard>
    </section>
  );
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short" }).format(date);
}
