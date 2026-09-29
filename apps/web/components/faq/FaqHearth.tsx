"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, Copy, Flame, Search, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaqCategory, FaqItem } from "@/lib/faq-data";
import { copyTextToClipboard } from "@/lib/clipboard";
import { safeLocalStorage } from "@/lib/safe-storage";
import { CategoryIcon } from "./FaqCategoryIcon";
import { FaqAnswerRenderer } from "./FaqAnswerRenderer";
import "./LegacyFaq.module.css";

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  "pre-game": "Преди първа игра",
  gameplay: "По време на игра",
  account: "Досие и сесия",
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
  const [announcement, setAnnouncement] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hydration must adopt text typed into the server-rendered input.
    setSearch(searchInputRef.current?.value ?? "");
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const updateSticky = () => {
      toolbar.dataset.sticky = String(toolbar.offsetHeight + 112 <= window.innerHeight);
    };
    updateSticky();
    const observer = new ResizeObserver(updateSticky);
    observer.observe(toolbar);
    window.addEventListener("resize", updateSticky);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSticky);
    };
  }, []);

  useEffect(() => {
    const saved = safeLocalStorage.getJson<unknown>(STORAGE_FEEDBACK_KEY);
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      setFeedback(Object.fromEntries(Object.entries(saved).filter(([, value]) => value === "up" || value === "down")));
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    function readQuery(event?: PopStateEvent) {
      const slug = new URLSearchParams(window.location.search).get("q");
      const item = items.find((entry) => entry.slug === slug);
      setOpenSlugs(new Set(item ? [item.slug] : []));
      setActiveCategory("all");
      if (event) setSearch("");
      window.cancelAnimationFrame(frame);
      if (item && (event || !searchInputRef.current?.value)) {
        frame = window.requestAnimationFrame(() => {
          document.getElementById(`faq-${item.slug}`)?.scrollIntoView({ block: "start" });
        });
      }
    }
    readQuery();
    window.addEventListener("popstate", readQuery);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", readQuery);
    };
  }, [items]);

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
    const next = new Set(openSlugs);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setOpenSlugs(next);
    const url = new URL(window.location.href);
    const linkedSlug = next.has(slug) ? slug : [...next][0];
    if (linkedSlug) url.searchParams.set("q", linkedSlug);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [openSlugs]);

  function clearSearch() {
    setSearch("");
    setActiveCategory("all");
    searchInputRef.current?.focus();
  }

  const copyLink = useCallback(async (slug: string) => {
    const url = `${window.location.origin}/faq?q=${encodeURIComponent(slug)}`;
    try {
      await copyTextToClipboard(url);
      setAnnouncement("Линкът е копиран.");
    } catch {
      setAnnouncement("Не успяхме да копираме линка.");
    }
  }, []);

  const setFeedbackFor = useCallback((slug: string, value: "up" | "down") => {
    setFeedback((current) => {
      const next = current[slug] === value ? { ...current, [slug]: undefined } : { ...current, [slug]: value };
      safeLocalStorage.setJson(STORAGE_FEEDBACK_KEY, next);
      return next;
    });
  }, []);

  return (
    <article className="faq-hearth">
      <header className="faq-hearth-hero" aria-labelledby="faq-title">
        <div className="faq-hearth-banner" aria-hidden="true">
          <div className="faq-hearth-scrim" aria-hidden />
        </div>

        <div className="faq-hearth-inner">
          <p className="faq-hearth-kicker">
            <Flame className="faq-hearth-kicker-icon" aria-hidden strokeWidth={2} />
            <span>седни до огъня</span>
          </p>
          <h1 id="faq-title" className="faq-hearth-title">Помощ</h1>
          <p className="faq-hearth-subtitle">
            Въпроси за играта, досието и връзката.
          </p>
        </div>
      </header>

      <div className="faq-hearth-layout">
      <div className="faq-hearth-toolbar" ref={toolbarRef}>
        <div className="faq-hearth-search" role="search">
          <Search className="faq-hearth-search-icon" aria-hidden strokeWidth={2} />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              if (value.trim()) {
                setActiveCategory("all");
              }
            }}
            placeholder="Търси въпрос..."
            aria-label="Търсене в често задавани въпроси"
            className="faq-hearth-search-input"
          />
          {search ? <button type="button" className="faq-search-clear" onClick={clearSearch} aria-label="Изчисти търсенето" title="Изчисти търсенето"><X aria-hidden /></button> : null}
        </div>

        <label className="faq-category-mobile">
          <span>Тема</span>
          <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value as FaqCategory | "all")}>
            <option value="all">Всички теми</option>
            {CATEGORY_ORDER.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
          </select>
        </label>

        <div className="faq-hearth-filters" role="group" aria-label="Категории">
          <button
            type="button"
            className="faq-hearth-filter"
            data-active={activeCategory === "all"}
            aria-pressed={activeCategory === "all"}
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
              aria-pressed={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            >
              <CategoryIcon category={category} className="faq-hearth-filter-icon" />
              <span>{CATEGORY_LABELS[category]}</span>
            </button>
          ))}
        </div>
        <Link href="/tutorial" className="faq-first-evening">Първа вечер? <ArrowRight aria-hidden /></Link>
      </div>

      <div className="faq-hearth-results">
      <p className="faq-results-count" aria-live="polite" aria-atomic="true">{filtered.length} {filtered.length === 1 ? "отговор" : "отговора"}</p>
      {grouped.length === 0 ? (
        <div className="faq-hearth-empty">
          <h2>Няма намерени отговори</h2>
          <p>Опитай друга дума или разгледай всички теми.</p>
          <button type="button" onClick={clearSearch}>Изчисти търсенето <X aria-hidden /></button>
        </div>
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
                      <article id={`faq-${item.slug}`} className="faq-hearth-item" data-open={isOpen} data-slug={item.slug}>
                        <button
                          type="button"
                          className="faq-hearth-item-handle"
                          onClick={() => toggle(item.slug)}
                          aria-expanded={isOpen}
                          aria-controls={`faq-answer-${item.slug}`}
                        >
                          <span className="faq-hearth-item-question">
                            <SearchHighlight text={item.question} term={search.trim()} />
                          </span>
                          <ChevronDown className="faq-hearth-item-chevron" aria-hidden strokeWidth={2.2} />
                        </button>

                        <div id={`faq-answer-${item.slug}`} className="faq-hearth-item-answer-shell" hidden={!isOpen}>
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
                                title="Копирай линк"
                              >
                                <Copy aria-hidden strokeWidth={2} />
                              </button>

                              <div className="faq-hearth-item-helpful" role="group" aria-label="Помогна ли отговорът?">
                                <span className="faq-hearth-item-helpful-label">Помогна ли?</span>
                                <button
                                  type="button"
                                  className="faq-hearth-item-thumb"
                                  data-active={feedbackValue === "up"}
                                  aria-pressed={feedbackValue === "up"}
                                  onClick={() => setFeedbackFor(item.slug, "up")}
                                  aria-label="Да, помогна"
                                  title="Да, помогна"
                                >
                                  <ThumbsUp aria-hidden strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  className="faq-hearth-item-thumb"
                                  data-active={feedbackValue === "down"}
                                  aria-pressed={feedbackValue === "down"}
                                  onClick={() => setFeedbackFor(item.slug, "down")}
                                  aria-label="Не, не помогна"
                                  title="Не, не помогна"
                                >
                                  <ThumbsDown aria-hidden strokeWidth={2} />
                                </button>
                              </div>
                            </footer>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      </div>
      </div>

      <footer className="faq-hearth-foot">
        <div><p className="faq-foot-kicker">Насреща сме</p><h2>Не намираш отговор?</h2></div>
        <div className="faq-hearth-foot-actions">
          <Link href="/report" className="btn btn-primary">
            Свържи се с нас <ArrowRight aria-hidden />
          </Link>
          <Link href="/status">
            Състояние на услугите
          </Link>
        </div>
      </footer>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
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
