"use client";

import { useState } from "react";

const PLAYERS = [
  { name: "Анна", clue: "Говори спокойно, но винаги защитава един и същ играч." },
  { name: "Борис", clue: "Гласува рано, после сменя темата." },
  { name: "Виктор", clue: "Има проверка, но я разкрива косвено." },
  { name: "Галя", clue: "Слуша повече, отколкото говори. Запомня всичко." },
  { name: "Деян", clue: "Обвинява силно без нова причина - често е жертва на блъф." },
] as const;

export function DayClueChips() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [activeName, setActiveName] = useState<string | null>(null);

  const flip = (name: string) => {
    const willReveal = !revealed[name];
    const next = { ...revealed, [name]: willReveal };

    setRevealed(next);
    setActiveName(willReveal ? name : (PLAYERS.find((player) => player.name !== name && next[player.name])?.name ?? null));
  };

  const visited = Object.values(revealed).filter(Boolean).length;
  const activePlayer = activeName ? PLAYERS.find((player) => player.name === activeName) : null;

  return (
    <div className="clue-chips" role="group" aria-label="Примерни играчи">
      <p className="clue-chips-hint">
        Разкрий 2-3 карти. Посетени: {visited} / {PLAYERS.length}
      </p>
      <div className="clue-chips-row">
        {PLAYERS.map((player) => {
          const isRevealed = Boolean(revealed[player.name]);
          return (
            <button
              key={player.name}
              type="button"
              className="clue-chip"
              data-revealed={isRevealed}
              onClick={() => flip(player.name)}
              aria-pressed={isRevealed}
              aria-label={isRevealed ? `Скрий ${player.name}` : `Разкрий ${player.name}`}
            >
              <span className="clue-chip-content clue-chip-front-content">
                <span className="clue-chip-initial">{player.name[0]}</span>
                <span className="clue-chip-name">{player.name}</span>
                <span className="clue-chip-status">{isRevealed ? "следа" : "скрита"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <aside className="clue-chip-detail" aria-live="polite">
        {activePlayer ? (
          <>
            <strong>{activePlayer.name}</strong>
            <span>{activePlayer.clue}</span>
          </>
        ) : (
          <>
            <strong>Избери играч</strong>
            <span>Виж как една дребна реплика може да промени подозрението.</span>
          </>
        )}
      </aside>
    </div>
  );
}
