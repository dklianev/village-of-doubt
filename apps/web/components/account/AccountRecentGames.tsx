import Link from "next/link";
import { getGameModeNameBg, type GameMode, type WinnerTeam } from "@werewolf/shared";

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
    <section className="account-section">
      <header className="account-section-head">
        <h2>Последни вечери</h2>
        <p>Архивът помни последните ти три маси.</p>
      </header>

      <ul className="account-game-list">
        {games.map((game) => (
          <li key={game.id}>
            <article className="account-game-card">
              <header className="account-game-head">
                <span className="account-game-code">Дело №{game.code}</span>
                <time className="account-game-date">{formatDate(game.endedAt)}</time>
              </header>
              <p className="account-game-verdict">
                {game.winnerTeam ? WINNER_LABEL[game.winnerTeam] : "Незавършена"}
              </p>
              <p className="account-game-mode">{getGameModeNameBg(game.mode)}</p>
              <Link href={`/history/${game.id}/replay`} className="account-game-link">
                Отвори дело →
              </Link>
            </article>
          </li>
        ))}
      </ul>

      <Link href="/history" className="account-section-link">
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
