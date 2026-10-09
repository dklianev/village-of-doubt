import { ArrowLeft, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { TutorialSlide } from "./TutorialSlide";
import { tutorialWorld, type TutorialSceneProps } from "./tutorial-scenario";
import { playerName } from "./tutorial-feedback";

export function SlideResolution({ mode, practice, onScene }: TutorialSceneProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const world = tutorialWorld(mode);
  return (
    <TutorialSlide bg="night" kicker="сцена 5 - след вота" title="Още една нощ. Или победа."
      body={<><p>В истинската игра общият вот и правилото за мнозинство решават кой напуска. Разкриването на роли зависи от настройките на стаята.</p>
        <p>{world.town} печели след премахването на всички вражески заплахи. Скритият отбор трябва да остане единствената заплаха и да достигне нужния брой живи участници. Специалните роли могат да добавят други условия.</p></>}
      callout={{ label: "Ако ти си елиминиран", text: "Не гласуваш и не подсказваш на живите. Можеш да следиш вечерта, а твоят отбор все още може да спечели." }}>
      <aside className="tutorial-outcome" aria-label="Резултат от репетицията">
        <p className="tutorial-role-private">Нашата примерна вечер</p>
        {practice.vote ? <>
          <h2>{playerName(practice.vote)} напуска масата.</h2>
          <p>В тази репетиция останалите подкрепят гласа ти. {practice.vote === "boris"
            ? `Борис беше ${world.mafia ? "мафиот" : "върколак"}. Добра следа, но на масата остава още заплаха.`
            : `${playerName(practice.vote)} беше от ${world.mafia ? "Града" : "Селото"}. Противоречието не беше достатъчно, за да посочите правилния човек.`}</p>
          <div className="tutorial-next-night"><Moon size={20} aria-hidden="true" /><span><strong>Започва нова нощ</strong>Няма победител. Следва нов личен ход.</span></div>
        </> : <>
          <h2>Още няма потвърден глас.</h2>
          <p>Прескочил си упражнението. Можеш да се върнеш и да видиш как изборът ти променя примерната вечер.</p>
          <button type="button" className="btn btn-secondary" disabled={!ready} onClick={() => onScene?.(4)}><ArrowLeft size={17} aria-hidden="true" /> Към гласуването</button>
        </>}
      </aside>
    </TutorialSlide>
  );
}
