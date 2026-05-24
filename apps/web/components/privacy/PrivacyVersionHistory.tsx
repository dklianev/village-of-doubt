"use client";

import { useState } from "react";
import { PaperCard } from "@werewolf/ui";
import styles from "./PrivacyVersionHistory.module.css";

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
    <section className={`privacy-section ${styles.historySection}`}>
      <PaperCard eyebrow="ИСТОРИЯ" density="md">
        <button
          type="button"
          className={styles.historyToggle}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <span className={styles.historyIcon} aria-hidden>
            {open ? "−" : "+"}
          </span>
          <span>История на промените ({HISTORY.length})</span>
        </button>

        {open ? (
          <ol className={styles.historyList}>
            {HISTORY.map((entry) => (
              <li key={entry.date}>
                <article>
                  <header>
                    <time className={styles.historyDate}>{entry.date}</time>
                    <p className={styles.historySummary}>{entry.summary}</p>
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
      </PaperCard>
    </section>
  );
}
