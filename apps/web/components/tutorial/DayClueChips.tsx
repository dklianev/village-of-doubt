"use client";

import { useEffect, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import { TUTORIAL_PLAYERS, type PlayerId, type TutorialSceneProps } from "./tutorial-scenario";

const REPLIES: Record<PlayerId, string> = {
  anna: "Борис първо подозираше Галя. После я защити, без да обясни защо.",
  boris: "Не съм сменял мнението си. Анна просто се опитва да отклони разговора.",
  galya: "Чух обвинението. Искам Борис да обясни какво го накара да се откаже от него.",
};

export function DayClueChips({ practice, onPracticeChange }: Pick<TutorialSceneProps, "practice" | "onPracticeChange">) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [active, setActive] = useState<PlayerId | null>(null);
  return (
    <div className="clue-chips" role="group" aria-label="Примерни играчи">
      <p className="clue-chips-hint">Примерни реплики <span>Прочетени: {practice.visited.length} / {TUTORIAL_PLAYERS.length}</span></p>
      <div className="clue-chips-row">
        {TUTORIAL_PLAYERS.map((player) => (
          <button key={player.id} type="button" className="clue-chip" disabled={!ready} aria-pressed={active === player.id}
            aria-label={`Чуй ${player.name}`} data-revealed={active === player.id}
            onClick={() => {
              setActive(player.id);
              if (!practice.visited.includes(player.id)) onPracticeChange({ ...practice, visited: [...practice.visited, player.id] });
            }}>
            <img src={`/game-art/avatars/portrait-${player.portrait}.webp`} width={560} height={560} loading="lazy" decoding="async" className="tutorial-portrait" alt="" />
            <span>{player.name}</span>
            {practice.visited.includes(player.id) ? <Check size={14} aria-label="Прочетено" /> : <MessageCircle size={14} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <aside className="clue-chip-detail" aria-live="polite">
        {active ? <><strong>{TUTORIAL_PLAYERS.find((player) => player.id === active)?.name}</strong><p>„{REPLIES[active]}“</p></>
          : <><strong>Какво чуха останалите?</strong><p>Избери Анна, Борис или Галя и сравни версиите им.</p></>}
      </aside>
    </div>
  );
}
