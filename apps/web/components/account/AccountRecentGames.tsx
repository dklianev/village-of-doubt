import Link from "next/link";
import { getGameModeNameBg, type GameMode, type WinnerTeam } from "@werewolf/shared";
import styles from "./Account.module.css";

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
    <section className={`${styles.section} ${styles.recentSection}`}>
      <header className={styles.sectionHead}>
        <h2>Последни вечери</h2>
        <p>Архивът помни последните ти три маси.</p>
      </header>

      <ul className={styles.gameList}>
        {games.map((game) => (
          <li key={game.id}>
            <article className={styles.gameCard} data-winner={game.winnerTeam ?? "unknown"}>
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

      <Link href="/history" className={styles.sectionLink}>
        Виж пълния архив →
      </Link>
    </section>
  );
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short" }).format(date);
}
