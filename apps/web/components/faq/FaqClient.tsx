"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FaqCategory, FaqItem } from "@/lib/faq-data";

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  gameplay: "Геймплей",
  account: "Профил и достъп",
  tech: "Технически",
  privacy: "Поверителност и контакт",
};

const CATEGORY_ORDER: FaqCategory[] = ["gameplay", "account", "tech", "privacy"];

export function FaqClient({ items }: { items: readonly FaqItem[] }) {
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      entries: items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.category === category),
    }));
  }, [items]);

  function toggle(index: number) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <section className="faq-stage">
      <figure className="faq-hero-art" aria-hidden />

      <article className="faq-cabinet">
        <header className="faq-head">
          <p className="faq-kicker">библиотека на масата</p>
          <h1>Често задавани въпроси.</h1>
          <p className="faq-subtitle">
            Шкаф с малки чекмеджета. Всяко с по една карта — отвори, прочети, върни обратно.
          </p>
        </header>

        {grouped.map(({ category, entries }) => (
          <section key={category} className="faq-drawer-row">
            <h2 className="faq-drawer-label">{CATEGORY_LABELS[category]}</h2>
            <div className="faq-drawer-stack">
              {entries.map(({ item, index }) => {
                const isOpen = openIds.has(index);
                return (
                  <article key={item.question} className="faq-drawer" data-open={isOpen}>
                    <button
                      type="button"
                      className="faq-drawer-handle"
                      onClick={() => toggle(index)}
                      aria-expanded={isOpen}
                    >
                      <span className="faq-drawer-pull" aria-hidden />
                      <span className="faq-drawer-title">{item.question}</span>
                      <span className="faq-drawer-chevron" aria-hidden>
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="faq-drawer-card">
                        <div className="faq-drawer-card-inner">
                          {item.answer.map((part, partIndex) =>
                            part.href ? (
                              <Link key={`${item.question}-${partIndex}`} href={part.href}>
                                {part.text}
                              </Link>
                            ) : (
                              <span key={`${item.question}-${partIndex}`}>{part.text}</span>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <footer className="faq-foot">
          <p>Имаш въпрос, който не е тук?</p>
          <div className="faq-foot-actions">
            <Link href="/report" className="btn btn-secondary">
              Дай ни бележка
            </Link>
            <Link href="/" className="btn btn-secondary">
              Към началото
            </Link>
          </div>
        </footer>
      </article>
    </section>
  );
}
