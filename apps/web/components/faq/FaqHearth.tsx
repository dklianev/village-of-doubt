"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Copy, Flame, Search, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaqCategory, FaqItem } from "@/lib/faq-data";
import { CategoryIcon } from "./FaqCategoryIcon";
import { FaqAnswerRenderer } from "./FaqAnswerRenderer";

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

export function FaqHearth({ items }: { items: readonly FaqItem[] }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory | "all">("all");
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initialQueryState = useRef<"pending" | "opening" | "ready">("pending");

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
      initialQueryState.current = "ready";
      return;
    }

    initialQueryState.current = "opening";
    setOpenSlugs(new Set([initialSlug]));
    window.setTimeout(() => {
      document.querySelector(`[data-slug="${initialSlug}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      initialQueryState.current = "ready";
    }, 50);
  }, [items]);

  useEffect(() => {
    if (initialQueryState.current === "pending") return;
    if (initialQueryState.current === "opening" && openSlugs.size === 0) return;

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
    return items.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (term && !item.searchableText.includes(term)) return false;
      return true;
    });
  }, [activeCategory, items, search]);

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
    <article className="faq-hearth">
      <header className="faq-hearth-hero" aria-label="Често задавани въпроси">
        <div className="faq-hearth-banner">
          <Image
            src="/game-art/legal/faq-hearth-banner.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="faq-hearth-banner-img"
          />
          <div className="faq-hearth-scrim" aria-hidden />
        </div>

        <div className="faq-hearth-inner">
          <p className="faq-hearth-kicker">
            <Flame className="faq-hearth-kicker-icon" aria-hidden strokeWidth={2} />
            <span>седни до огъня</span>
          </p>
          <h1 className="faq-hearth-title">Често задавани въпроси.</h1>
          <p className="faq-hearth-subtitle">
            Отговори за геймплея, профила, техниката и поверителността — споделени на топло.
          </p>
        </div>
      </header>

      <div className="faq-hearth-toolbar">
        <div className="faq-hearth-search" role="search">
          <Search className="faq-hearth-search-icon" aria-hidden strokeWidth={2} />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Питай огъня..."
            aria-label="Търсене в често задавани въпроси"
            className="faq-hearth-search-input"
          />
          <span className="faq-hearth-search-hotkey" aria-hidden>
            ⌘K
          </span>
        </div>

        <div className="faq-hearth-filters" role="group" aria-label="Категории">
          <button
            type="button"
            className="faq-hearth-filter"
            data-active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          >
            Всички
          </button>
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              className="faq-hearth-filter"
              data-active={activeCategory === category}
              data-category={category}
              onClick={() => setActiveCategory(category)}
            >
              <CategoryIcon category={category} className="faq-hearth-filter-icon" />
              <span>{CATEGORY_LABELS[category]}</span>
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="faq-hearth-empty">Никой не е питал това още. Опитай друга дума.</p>
      ) : (
        <div className="faq-hearth-body">
          {grouped.map(({ category, entries }) => (
            <section key={category} className="faq-hearth-section" data-category={category}>
              <header className="faq-hearth-section-head">
                <CategoryIcon category={category} className="faq-hearth-section-icon" />
                <h2>{CATEGORY_LABELS[category]}</h2>
              </header>

              <ul className="faq-hearth-list">
                {entries.map((item) => {
                  const isOpen = openSlugs.has(item.slug);
                  const feedbackValue = feedback[item.slug];
                  return (
                    <li key={item.slug}>
                      <article className="faq-hearth-item" data-open={isOpen} data-slug={item.slug}>
                        <button
                          type="button"
                          className="faq-hearth-item-handle"
                          onClick={() => toggle(item.slug)}
                          aria-expanded={isOpen}
                        >
                          <span className="faq-hearth-item-question">
                            <SearchHighlight text={item.question} term={search.trim()} />
                          </span>
                          <ChevronDown className="faq-hearth-item-chevron" aria-hidden strokeWidth={2.2} />
                        </button>

                        {isOpen ? (
                          <div className="faq-hearth-item-answer">
                            <FaqAnswerRenderer blocks={item.answer} />

                            {item.tutorialStep ? (
                              <p className="faq-hearth-item-link">
                                <Link href={`/tutorial?step=${item.tutorialStep}`}>
                                  Виж в урока → сцена {item.tutorialStep}
                                </Link>
                              </p>
                            ) : null}

                            <footer className="faq-hearth-item-footer">
                              <button
                                type="button"
                                className="faq-hearth-item-copy"
                                onClick={() => copyLink(item.slug)}
                                aria-label={`Копирай линк към "${item.question}"`}
                              >
                                <Copy aria-hidden strokeWidth={2} />
                                <span>Копирай линк</span>
                              </button>

                              <div className="faq-hearth-item-helpful" role="group" aria-label="Помогна ли отговорът?">
                                <span className="faq-hearth-item-helpful-label">Помогна ли?</span>
                                <button
                                  type="button"
                                  className="faq-hearth-item-thumb"
                                  data-active={feedbackValue === "up"}
                                  onClick={() => setFeedbackFor(item.slug, "up")}
                                  aria-label="Да, помогна"
                                >
                                  <ThumbsUp aria-hidden strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  className="faq-hearth-item-thumb"
                                  data-active={feedbackValue === "down"}
                                  onClick={() => setFeedbackFor(item.slug, "down")}
                                  aria-label="Не, не помогна"
                                >
                                  <ThumbsDown aria-hidden strokeWidth={2} />
                                </button>
                              </div>
                            </footer>
                          </div>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="faq-hearth-foot">
        <Image
          src="/game-art/legal/faq-hearth-motif.webp"
          alt=""
          width={120}
          height={80}
          className="faq-hearth-foot-art"
        />
        <p>Имаш въпрос, който не е тук?</p>
        <div className="faq-hearth-foot-actions">
          <Link href="/report" className="btn btn-secondary">
            Дай ни бележка
          </Link>
          <Link href="/" className="btn btn-secondary">
            Към началото
          </Link>
        </div>
      </footer>
    </article>
  );
}

function SearchHighlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;

  const lower = text.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="faq-hearth-highlight">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
