"use client";

import { useState } from "react";

interface VersionEntry {
  date: string;
  summary: string;
  details: string[];
}

const HISTORY: readonly VersionEntry[] = [
  {
    date: "17 май 2026",
    summary: "Цялостен redesign в стила на homepage. Добавена секция „Какво виждаме за теб“.",
    details: [
      "Преструктуриране от 9 секции в 5 тематични.",
      "Добавена promise wall с 6 ключови обещания.",
      "Добавени action-oriented GDPR права с директни бутони.",
      "Без съществени промени в правилата за обработка.",
    ],
  },
  {
    date: "14 май 2026",
    summary: "Публикуване на първоначалната политика преди публично пускане.",
    details: [
      "Дефинирани категории събирани данни.",
      "Технически партньори и срокове за съхранение.",
      "Права по GDPR.",
    ],
  },
];

export function PrivacyVersionHistory() {
  const [open, setOpen] = useState(false);

  return (
    <section className="privacy-section privacy-section-history">
      <button
        type="button"
        className="privacy-history-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="privacy-history-icon" aria-hidden>
          {open ? "−" : "+"}
        </span>
        <span>История на промените ({HISTORY.length})</span>
      </button>

      {open ? (
        <ol className="privacy-history-list">
          {HISTORY.map((entry) => (
            <li key={entry.date}>
              <article>
                <header>
                  <time className="privacy-history-date">{entry.date}</time>
                  <p className="privacy-history-summary">{entry.summary}</p>
                </header>
                <ul>
                  {entry.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
