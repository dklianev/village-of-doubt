"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

const SECTIONS: readonly LegalSection[] = [
  {
    id: "ip",
    title: "Интелектуална собственост",
    body: (
      <p>
        Името на платформата, дизайнът, кодът, правилата в сайта и визуалните материали са защитени
        като наше съдържание или съдържание, за което имаме право на ползване. Можеш да споделяш
        линкове към стаи и страници, но не можеш да копираш платформата като собствена услуга.
      </p>
    ),
  },
  {
    id: "user-content",
    title: "Съдържание от играчи",
    body: (
      <p>
        Имената на масата, съобщенията в стая и сигналите са съдържание, което въвеждаш ти. Даваш
        ни ограничено право да го показваме, съхраняваме и обработваме само доколкото е нужно за
        работата на играта, модерацията и историята на стаите.
      </p>
    ),
  },
  {
    id: "as-is",
    title: "Услугата във вида, в който е налична",
    body: (
      <p>
        Работим да поддържаме играта стабилна, но не гарантираме непрекъснат достъп. Възможни са
        прекъсвания, промени в правилата, техническа поддръжка и временни ограничения.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Ограничаване на отговорност",
    body: (
      <p>
        Не носим отговорност за косвени вреди, пропуснати ползи, загубена игрова статистика при
        технически срив или поведение на други играчи извън нашия разумен контрол.
      </p>
    ),
  },
  {
    id: "law",
    title: "Приложимо право",
    body: (
      <p>
        Тези условия се тълкуват според българското право. При спор страните първо търсят
        доброволно уреждане. Ако това не е възможно, компетентни са съдилищата в София, освен ако
        законът изисква друго.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Контакт",
    body: (
      <p>
        За въпроси, сигнали и искания използвай <Link href="/report">страницата за сигнал</Link>.
        За лични данни виж и <Link href="/privacy">политиката за поверителност</Link>.
      </p>
    ),
  },
];

export function TermsLegalAnnex() {
  const [open, setOpen] = useState(false);

  return (
    <section className="terms-section terms-section-annex">
      <button
        type="button"
        className="terms-annex-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="terms-annex-icon" aria-hidden>
          {open ? "−" : "+"}
        </span>
        <div>
          <p className="terms-annex-kicker">правен анекс</p>
          <p className="terms-annex-title">Формалните клаузи ({SECTIONS.length})</p>
          <p className="terms-annex-hint">
            Интелектуална собственост, отговорност, приложимо право — за тези, които искат пълния
            правен текст.
          </p>
        </div>
      </button>

      {open ? (
        <ol className="terms-annex-list">
          {SECTIONS.map((section, index) => (
            <li key={section.id} id={section.id} className="terms-annex-item">
              <h3>
                <span className="terms-annex-num">{index + 1}.</span>
                {section.title}
              </h3>
              <div className="terms-annex-body">{section.body}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
