"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FaqCategory, FaqItem } from "@/lib/faq-data";
import { FaqAnswerRenderer } from "./FaqAnswerRenderer";
import { CategoryIcon } from "./FaqCategoryIcon";

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  "pre-game": "Преди първа игра",
  gameplay: "Геймплей",
  account: "Профил и сесия",
  tech: "Технически",
  privacy: "Поверителност и контакт",
};

const CATEGORY_ORDER: FaqCategory[] = ["pre-game", "gameplay", "account", "tech", "privacy"];
const STORAGE_FEEDBACK_KEY = "faq-feedback";

interface FeedbackState {
  [slug: string]: "up" | "down" | undefined;
}

export function FaqClient({ items }: { items: readonly FaqItem[] }) {
  const [search, setSearch] = useState("");
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_FEEDBACK_KEY);
      if (raw) {
        setFeedback(JSON.parse(raw) as FeedbackState);
      }
    } catch {
      // Ignore corrupt local storage.
    }
  }, []);

  useEffect(() => {
    const initialSlug = new URLSearchParams(window.location.search).get("q");
    if (!initialSlug || !items.some((item) => item.slug === initialSlug)) {
      return;
    }

    setOpenSlugs(new Set([initialSlug]));
    window.setTimeout(() => {
      document.querySelector(`[data-slug="${initialSlug}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, [items]);

  useEffect(() => {
    const firstOpen = [...openSlugs][0];
    const url = new URL(window.location.href);
    if (firstOpen) {
      url.searchParams.set("q", firstOpen);
    } else {
      url.searchParams.delete("q");
    }

    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [openSlugs]);

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

  const expandAll = useCallback(() => {
    setOpenSlugs(new Set(filtered.map((item) => item.slug)));
  }, [filtered]);

  const collapseAll = useCallback(() => {
    setOpenSlugs(new Set());
  }, []);

  const copyLink = useCallback(async (slug: string) => {
    const url = `${window.location.origin}/faq?q=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be blocked in non-secure preview contexts.
    }
  }, []);

  const setFeedbackFor = useCallback((slug: string, value: "up" | "down") => {
    setFeedback((current) => {
      const next = current[slug] === value ? { ...current, [slug]: undefined } : { ...current, [slug]: value };
      try {
        window.localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(next));
      } catch {
        // Local storage can be blocked in private browsing contexts.
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

          <div className="faq-toolbar">
            <button type="button" className="faq-tool-btn" onClick={expandAll} aria-label="Отвори всички чекмеджета">
              Разтвори всичко
            </button>
            <button type="button" className="faq-tool-btn" onClick={collapseAll} aria-label="Затвори всички чекмеджета">
              Затвори всичко
            </button>
            {search ? (
              <span className="faq-result-count">
                {filtered.length} {filtered.length === 1 ? "резултат" : "резултата"}
              </span>
            ) : null}
          </div>
        </header>

        {grouped.length === 0 ? (
          <p className="faq-empty">Нищо не намерихме за „{search}“. Опитай друга дума.</p>
        ) : (
          grouped.map(({ category, entries }) => (
            <section key={category} className="faq-drawer-row" data-category={category}>
              <h2 className="faq-drawer-label">
                <CategoryIcon category={category} className="faq-category-icon" />
                {CATEGORY_LABELS[category]}
              </h2>

              <div className="faq-drawer-stack">
                {entries.map((item) => {
                  const isOpen = openSlugs.has(item.slug);
                  const feedbackValue = feedback[item.slug];
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
                          <footer className="faq-drawer-footer">
                            <button
                              type="button"
                              className="faq-copy-link"
                              onClick={() => copyLink(item.slug)}
                              aria-label={`Копирай линк към „${item.question}“`}
                            >
                              🔗 Копирай линк
                            </button>

                            <div className="faq-helpful" role="group" aria-label="Помогна ли отговорът?">
                              <span className="faq-helpful-label">Помогна ли?</span>
                              <button
                                type="button"
                                className="faq-helpful-btn"
                                data-active={feedbackValue === "up"}
                                onClick={() => setFeedbackFor(item.slug, "up")}
                                aria-label="Да, помогна"
                              >
                                👍
                              </button>
                              <button
                                type="button"
                                className="faq-helpful-btn"
                                data-active={feedbackValue === "down"}
                                onClick={() => setFeedbackFor(item.slug, "down")}
                                aria-label="Не, не помогна"
                              >
                                👎
                              </button>
                            </div>
                          </footer>
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
