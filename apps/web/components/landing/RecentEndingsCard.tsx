"use client";

import type { GameFamily } from "@werewolf/shared";
import { LastWinnerEmptyGlyph } from "@/components/landing/quickstart-icons";

export type Ending = {
  code: string;
  winnerTeam: string;
  winnerReasonBg?: string;
  family?: GameFamily;
  endedAt?: string;
};

type RecentEndingsCardProps = {
  family: GameFamily | null;
  endings: Ending[];
};

export function RecentEndingsCard({ family, endings }: RecentEndingsCardProps) {
  const visible = (family ? endings.filter((ending) => ending.family === family) : endings).slice(0, 3);

  return (
    <article className="quickstart-winner quickstart-mini-card recent-endings-card">
      <p className="section-kicker">{kicker(family)}</p>
      {visible.length === 0 ? (
        <div className="quickstart-winner-empty">
          <LastWinnerEmptyGlyph className="quickstart-dim-glyph" />
          <div>
            <h3>{emptyHeading(family)}</h3>
            <p>След първата завършена игра.</p>
          </div>
        </div>
      ) : (
        <ul className="recent-endings-list">
          {visible.map((ending, index) => (
            <li key={`${ending.code}-${index}`} className="recent-ending-row" data-family={ending.family ?? "unknown"}>
              <span className="recent-ending-mark" aria-hidden="true">
                {winnerGlyph(ending.winnerTeam)}
              </span>
              <div>
                <strong>{headline({ family, ending })}</strong>
                <small>{ending.endedAt ? relativeTimeBg(ending.endedAt) : ending.winnerReasonBg ?? "Завършена игра"}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function kicker(family: GameFamily | null) {
  if (family === "mafia") {
    return "вчерашни заглавия";
  }
  if (family === "werewolves") {
    return "разказите от селото";
  }
  return "последни истории";
}

function emptyHeading(family: GameFamily | null) {
  if (family === "mafia") {
    return "Първите досиета ще се появят тук.";
  }
  if (family === "werewolves") {
    return "Първите легенди ще се появят тук.";
  }
  return "Първите герои ще се появят тук.";
}

function headline({ family, ending }: { family: GameFamily | null; ending: Ending }) {
  if (family === "mafia" || (family === null && ending.family === "mafia")) {
    return `Стая ${ending.code}: ${winnerTeamBg(ending.winnerTeam)}`;
  }
  return `Стая ${ending.code} — ${winnerTeamBg(ending.winnerTeam)}`;
}

function winnerTeamBg(team: string) {
  const labels: Record<string, string> = {
    village: "Селото устоя",
    werewolves: "Върколаците надделяха",
    vampires: "Вампирите надделяха",
    mafia: "Мафията пое контрол",
    maniac: "Маниакът остана последен",
    lovers: "Влюбените оцеляха заедно",
    draw: "Нощта приключи без победител",
  };

  return labels[team] ?? "Играта приключи";
}

function winnerGlyph(team: string) {
  const glyphs: Record<string, string> = {
    village: "⌂",
    werewolves: "☾",
    vampires: "✦",
    mafia: "◆",
    maniac: "!",
    lovers: "♥",
    draw: "=",
  };

  return glyphs[team] ?? "✦";
}

function relativeTimeBg(value: string) {
  const endedAt = new Date(value).getTime();
  if (!Number.isFinite(endedAt)) {
    return "скоро";
  }

  const minutes = Math.max(1, Math.round((Date.now() - endedAt) / 60_000));
  if (minutes < 60) {
    return `преди ${minutes} мин.`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `преди ${hours} ч.`;
  }

  return `преди ${Math.round(hours / 24)} д.`;
}
