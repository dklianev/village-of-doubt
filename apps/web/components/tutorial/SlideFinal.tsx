import Link from "next/link";
import { TutorialSlide } from "./TutorialSlide";

export function SlideFinal() {
  return (
    <TutorialSlide
      bg="split"
      kicker="сцена 6 - готов?"
      title="Изборът сега е твой."
      body={<p>Шест сцени, една вечер. Вече можеш да отвориш първата стая.</p>}
    >
      <div className="tutorial-final-picker" role="group" aria-label="Избор на семейство">
        <Link href="/werewolf/create" className="tutorial-final-card" data-family="werewolves">
          <span className="tutorial-final-kicker">фолклор</span>
          <span className="tutorial-final-title">Започни Върколак</span>
          <span className="tutorial-final-line">Първо пада мъглата. После никой не лъже спокойно.</span>
        </Link>
        <Link href="/mafia/create" className="tutorial-final-card" data-family="mafia">
          <span className="tutorial-final-kicker">ноар</span>
          <span className="tutorial-final-title">Започни Мафия</span>
          <span className="tutorial-final-line">Дъждът измива улицата, но не и алибитата.</span>
        </Link>
      </div>

      <div className="tutorial-final-secondary">
        <Link href="/werewolf/rules" className="tutorial-final-secondary-link">
          Правила за Върколак
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/mafia/rules" className="tutorial-final-secondary-link">
          Правила за Мафия
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/roles" className="tutorial-final-secondary-link">
          Всички роли
        </Link>
      </div>
    </TutorialSlide>
  );
}
