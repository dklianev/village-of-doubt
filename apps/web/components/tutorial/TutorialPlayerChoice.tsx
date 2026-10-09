import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { TUTORIAL_PLAYERS, type PlayerId } from "./tutorial-scenario";

export function TutorialPlayerChoice({ name, legend, selected, onSelect }: {
  name: string;
  legend: string;
  selected: PlayerId | null;
  onSelect: (id: PlayerId) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <fieldset className="tutorial-players" disabled={!ready}>
      <legend>{legend}</legend>
      <div className="tutorial-seats">
        {TUTORIAL_PLAYERS.map((player, index) => (
          <label key={player.id} className="tutorial-seat" data-selected={selected === player.id}>
            <input type="radio" name={name} value={player.id} checked={selected === player.id}
              onChange={() => onSelect(player.id)} />
            <span className="tutorial-seat-number" aria-hidden="true">{index + 1}</span>
            <img src={`/game-art/avatars/portrait-${player.portrait}.webp`} width={560} height={560}
              alt="" loading="lazy" decoding="async" className="tutorial-portrait" />
            <span>{player.name}</span>
            <span className="tutorial-seat-mark" aria-hidden="true">{selected === player.id ? <Check size={14} /> : null}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
