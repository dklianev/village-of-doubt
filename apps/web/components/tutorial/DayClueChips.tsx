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

  const flip = (name: string) => {
    setRevealed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const visited = Object.values(revealed).filter(Boolean).length;

  return (
    <div className="clue-chips" role="group" aria-label="Примерни играчи">
      <p className="clue-chips-hint">
        Кликни две-три карти и прочети масата. Посетени: {visited} / {PLAYERS.length}
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
              <span className="clue-chip-inner">
                <span className="clue-chip-front">
                  <span className="clue-chip-initial">{player.name[0]}</span>
                  <span className="clue-chip-name">{player.name}</span>
                </span>
                <span className="clue-chip-back">
                  <strong>{player.name}</strong>
                  <span>{player.clue}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
