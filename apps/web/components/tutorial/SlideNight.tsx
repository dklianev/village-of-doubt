import { useState } from "react";
import { Check, EyeOff, Search } from "lucide-react";
import { TutorialSlide } from "./TutorialSlide";
import { TutorialPlayerChoice } from "./TutorialPlayerChoice";
import { tutorialWorld, type PlayerId, type TutorialSceneProps } from "./tutorial-scenario";
import { nightFinding, playerName } from "./tutorial-feedback";

export function SlideNight({ mode, practice, onPracticeChange }: TutorialSceneProps) {
  const [selection, setSelected] = useState<PlayerId | null>(null);
  const selected = selection ?? practice.night;
  const world = tutorialWorld(mode);
  const confirmed = selected !== null && selected === practice.night;
  return (
    <TutorialSlide bg="night" kicker="сцена 2 - личният ход" title="Очите се затварят."
      body={<><p>{world.mafia ? "Мафията избира" : "Върколаците избират"} жертва. Ти си {world.role}: посочи един играч и потвърди проверката.</p>
        <p>В истинската игра изчакай личния си резултат. Другите не го виждат.</p></>}
      callout={{ label: "Ако нямаш нощно действие", text: "Като обикновен участник изчакваш утрото. Не е нужно да посочваш никого, за да останеш в играта." }}>
      <form className="tutorial-practice" onSubmit={(event) => { event.preventDefault(); if (selected) onPracticeChange({ ...practice, night: selected }); }}>
        <TutorialPlayerChoice name="night-target" legend="Кого ще провериш?" selected={selected} onSelect={setSelected} />
        <p className="tutorial-selection">{selected ? <>Избран играч: <strong>{playerName(selected)}</strong></> : "Все още няма избран играч."}</p>
        <button type="submit" className="btn btn-primary" disabled={!selected || confirmed}>
          {confirmed ? <Check size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />} Потвърди проверката
        </button>
        <div className="tutorial-feedback" role="status" data-confirmed={confirmed}>
          <EyeOff size={17} aria-hidden="true" />
          <p>{confirmed ? <><strong>Личен резултат</strong>{nightFinding(mode, selected)}</> : "Изборът още не е изпратен. Резултатът идва след потвърждението."}</p>
        </div>
      </form>
    </TutorialSlide>
  );
}
