import { useState } from "react";
import { Check, Vote } from "lucide-react";
import { TutorialSlide } from "./TutorialSlide";
import { TutorialPlayerChoice } from "./TutorialPlayerChoice";
import type { PlayerId, TutorialSceneProps } from "./tutorial-scenario";
import { playerName } from "./tutorial-feedback";

export function SlideVote({ mode, practice, onPracticeChange }: TutorialSceneProps) {
  const [selection, setSelected] = useState<PlayerId | null>(null);
  const selected = selection ?? practice.vote;
  const confirmed = selected !== null && selected === practice.vote;
  return (
    <TutorialSlide bg="day" kicker="сцена 4 - твоят глас" title="Гласът оставя следа."
      body={<><p>Сравни чутото с личната си проверка. Избери играч и потвърди гласа си. Самото посочване не е достатъчно.</p>
        <p>{mode === "mafia_sport" ? "В Спортна Мафия номинираш по време на своята реч. След защитите гласуваш между номинираните." : "В този пример можеш да посочиш Анна, Борис или Галя. В истинската игра масата решава с общия вот."}</p></>}
      callout={{ label: "Изборът не е потвърждение", text: "Можеш да посочиш друг играч. Винаги провери името, преди да потвърдиш." }}>
      <form className="tutorial-practice tutorial-vote" onSubmit={(event) => { event.preventDefault(); if (selected) onPracticeChange({ ...practice, vote: selected }); }}>
        <TutorialPlayerChoice name="tutorial-vote" legend={mode === "mafia_sport" ? "Номинираните на масата" : "Примерно гласуване"} selected={selected} onSelect={setSelected} />
        <p className="tutorial-selection">{selected ? <>Избран играч: <strong>{playerName(selected)}</strong></> : "Все още няма избран играч."}</p>
        <button type="submit" className="btn btn-primary" disabled={!selected || confirmed}><Vote size={17} aria-hidden="true" /> Потвърди гласа</button>
        <div className="tutorial-feedback tutorial-vote-result" role="status" data-confirmed={confirmed}>
          <Check size={17} aria-hidden="true" />
          <p>{confirmed ? `Гласът ти за ${playerName(selected)} е потвърден. В следващата сцена ще видиш последствието.` : practice.vote ? `Последният потвърден глас е за ${playerName(practice.vote)}. Новият избор още не е изпратен.` : "Гласът се отчита след потвърждение."}</p>
        </div>
      </form>
    </TutorialSlide>
  );
}
