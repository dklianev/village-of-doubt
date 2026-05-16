"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FaqCategory, FaqItem } from "@/lib/faq-data";
import { FaqAnswerRenderer } from "./FaqAnswerRenderer";

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  "pre-game": "Преди първа игра",
  gameplay: "Геймплей",
  account: "Профил и сесия",
  tech: "Технически",
  privacy: "Поверителност и контакт",
};

const CATEGORY_ORDER: FaqCategory[] = ["pre-game", "gameplay", "account", "tech", "privacy"];

export function FaqClient({ items }: { items: readonly FaqItem[] }) {
  const [search, setSearch] = useState("");
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return items;
    }

    return items.filter((item) => item.searchableText.includes(term));
  }, [items, search]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      entries: filtered.filter((item) => item.category === category),
    })).filter((group) => group.entries.length > 0);
  }, [filtered]);

  const toggle = useCallback((slug: string) => {
    setOpenSlugs((current) => {
      const next = new Set(current);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

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

          <div className="faq-search" role="search">
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Търси въпрос..."
              aria-label="Търсене в често задавани въпроси"
              className="faq-search-input"
            />
            <span className="faq-search-hotkey" aria-hidden>
              ⌘K
            </span>
          </div>

          {search ? (
            <p className="faq-result-count">
              {filtered.length} {filtered.length === 1 ? "резултат" : "резултата"}
            </p>
          ) : null}
        </header>

        {grouped.length === 0 ? (
          <p className="faq-empty">Нищо не намерихме за „{search}“. Опитай друга дума.</p>
        ) : (
          grouped.map(({ category, entries }) => (
            <section key={category} className="faq-drawer-row" data-category={category}>
              <h2 className="faq-drawer-label">{CATEGORY_LABELS[category]}</h2>

              <div className="faq-drawer-stack">
                {entries.map((item) => {
                  const isOpen = openSlugs.has(item.slug);
                  return (
                    <article key={item.slug} className="faq-drawer" data-open={isOpen} data-slug={item.slug}>
                      <button
                        type="button"
                        className="faq-drawer-handle"
                        onClick={() => toggle(item.slug)}
                        aria-expanded={isOpen}
                      >
                        <span className="faq-drawer-pull" aria-hidden />
                        <span className="faq-drawer-title">
                          <SearchHighlight text={item.question} term={search.trim()} />
                        </span>
                        <span className="faq-drawer-chevron" aria-hidden>
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>

                      {isOpen ? (
                        <div className="faq-drawer-card">
                          <FaqAnswerRenderer blocks={item.answer} />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}

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

function SearchHighlight({ text, term }: { text: string; term: string }) {
  if (!term) {
    return <>{text}</>;
  }

  const lower = text.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index < 0) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, index)}
      <mark className="faq-highlight">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
