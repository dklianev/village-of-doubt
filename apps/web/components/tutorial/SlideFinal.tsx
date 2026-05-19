import Link from "next/link";
import { BookOpen, ScrollText, Users } from "lucide-react";
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

      <div className="tutorial-final-secondary-grid">
        <Link href="/werewolf/rules" className="tutorial-final-secondary-card">
          <BookOpen className="tutorial-final-secondary-icon" aria-hidden strokeWidth={1.8} />
          <span className="tutorial-final-secondary-label">Правила за Върколак</span>
          <span className="tutorial-final-secondary-hint">Как се събужда селото</span>
        </Link>
        <Link href="/mafia/rules" className="tutorial-final-secondary-card">
          <ScrollText className="tutorial-final-secondary-icon" aria-hidden strokeWidth={1.8} />
          <span className="tutorial-final-secondary-label">Правила за Мафия</span>
          <span className="tutorial-final-secondary-hint">Алибита и подозрения</span>
        </Link>
        <Link href="/roles" className="tutorial-final-secondary-card">
          <Users className="tutorial-final-secondary-icon" aria-hidden strokeWidth={1.8} />
          <span className="tutorial-final-secondary-label">Всички роли</span>
          <span className="tutorial-final-secondary-hint">Разгледай героите</span>
        </Link>
      </div>
    </TutorialSlide>
  );
}
