"use client";

import { useState } from "react";

interface PrivacyPromise {
  id: string;
  icon: "no-sell" | "no-track" | "no-payment" | "eu-host" | "delete-anytime" | "export-anytime";
  title: string;
  summary: string;
  detail: string;
}

const PROMISES: readonly PrivacyPromise[] = [
  {
    id: "no-sell",
    icon: "no-sell",
    title: "Не продаваме данните ти.",
    summary: "Никога не сме продавали и няма да продаваме лични данни на трети страни.",
    detail:
      "Не работим с data brokers. Не споделяме информация с рекламни мрежи. Не правим targeted ads. Ако някога добавим дарения, те няма да променят този принцип.",
  },
  {
    id: "no-track",
    icon: "no-track",
    title: "Не те следим извън играта.",
    summary: "Няма Google Analytics, Facebook Pixel или други tracking системи.",
    detail:
      "Не зареждаме скриптове за поведенчески анализ от трети страни. Не ползваме cross-site cookies. Не виждаме къде си бил преди да дойдеш при нас или след като си тръгнеш.",
  },
  {
    id: "no-payment",
    icon: "no-payment",
    title: "Не искаме платежни данни.",
    summary: "Играта е безплатна. Не искаме банкови карти, IBAN или подобни.",
    detail:
      "Няма paywall, няма premium tier, няма абонамент. Ако някога приемем дарения, ще се ползва външен доставчик и ние няма да виждаме номера на картата.",
  },
  {
    id: "eu-host",
    icon: "eu-host",
    title: "Сървърите ни са в Европа.",
    summary: "Хостинг в EU среда с GDPR data residency.",
    detail:
      "Базата данни и игровият сървър са в европейска инфраструктура. Това означава GDPR юрисдикция и по-ясни правила за защита на данните.",
  },
  {
    id: "delete-anytime",
    icon: "delete-anytime",
    title: "Изтриваш профила по всяко време.",
    summary: "Бутон в твоя профил. Backup следите се изчистват до 30 дни.",
    detail:
      "Профилът, постиженията и личните данни изчезват веднага. Имената от игрите ти се заменят с „Изтрит играч“, за да не се чупи историята на другите играчи на масата.",
  },
  {
    id: "export-anytime",
    icon: "export-anytime",
    title: "Извличаш всичко по всяко време.",
    summary: "GDPR право на преносимост — JSON download с цялата ти история.",
    detail:
      "Един клик — получаваш JSON файл с профила, игрите, постиженията и настройките. Файлът е структуриран и четим.",
  },
];

export function PrivacyPromiseWall() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <section className="privacy-section">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">обещания</p>
        <h2>Какво гарантираме.</h2>
        <p className="privacy-section-lede">
          Шест обещания, които стоят зад всичко в детайлите по-долу.
        </p>
      </header>

      <ul className="privacy-promise-grid">
        {PROMISES.map((promise) => {
          const isOpen = expandedId === promise.id;
          return (
            <li key={promise.id}>
              <article className="privacy-promise-card" data-open={isOpen}>
                <PromiseIcon name={promise.icon} className="privacy-promise-icon" />
                <h3 className="privacy-promise-title">{promise.title}</h3>
                <p className="privacy-promise-summary">{promise.summary}</p>
                <button
                  type="button"
                  className="privacy-promise-toggle"
                  onClick={() => toggle(promise.id)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? "Скрий детайла" : "Виж по-подробно"}
                </button>
                {isOpen ? <p className="privacy-promise-detail">{promise.detail}</p> : null}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PromiseIcon({
  name,
  className,
}: {
  name: PrivacyPromise["icon"];
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "no-sell":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="9" />
          <path d="M12 16 L20 16 M16 12 L16 20" />
          <path d="M6 6 L26 26" strokeWidth="2.2" />
        </svg>
      );
    case "no-track":
      return (
        <svg {...common}>
          <path d="M3 16 Q16 6 29 16 Q16 26 3 16 Z" />
          <circle cx="16" cy="16" r="3" />
          <path d="M5 5 L27 27" strokeWidth="2.2" />
        </svg>
      );
    case "no-payment":
      return (
        <svg {...common}>
          <rect x="4" y="9" width="24" height="14" rx="2" />
          <path d="M4 14 L28 14" />
          <path d="M6 6 L26 26" strokeWidth="2.2" />
        </svg>
      );
    case "eu-host":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" />
          <circle cx="16" cy="7" r="1.2" fill="currentColor" />
          <circle cx="22" cy="10" r="1.2" fill="currentColor" />
          <circle cx="25" cy="16" r="1.2" fill="currentColor" />
          <circle cx="22" cy="22" r="1.2" fill="currentColor" />
          <circle cx="16" cy="25" r="1.2" fill="currentColor" />
          <circle cx="10" cy="22" r="1.2" fill="currentColor" />
          <circle cx="7" cy="16" r="1.2" fill="currentColor" />
          <circle cx="10" cy="10" r="1.2" fill="currentColor" />
        </svg>
      );
    case "delete-anytime":
      return (
        <svg {...common}>
          <path d="M7 10 L25 10" />
          <path d="M9 10 L10 26 Q10 27 11 27 L21 27 Q22 27 22 26 L23 10" />
          <path d="M12 10 L12 7 Q12 6 13 6 L19 6 Q20 6 20 7 L20 10" />
          <path d="M13 14 L13 23 M16 14 L16 23 M19 14 L19 23" />
        </svg>
      );
    case "export-anytime":
      return (
        <svg {...common}>
          <path d="M16 4 L16 20 M10 14 L16 20 L22 14" />
          <path d="M5 24 L5 27 Q5 28 6 28 L26 28 Q27 28 27 27 L27 24" />
        </svg>
      );
  }
}
