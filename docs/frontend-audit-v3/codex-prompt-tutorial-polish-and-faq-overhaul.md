# Codex prompt — Tutorial polish + /faq complete overhaul (Hearth concept)

Един coherent PR с **4 свързани fixes**:

1. **Tutorial Step 3 clue chips** — text overflows the card when flipped (visual bug)
2. **"Прескочи" link** — too plain, needs polish to match design system
3. **Tutorial Step 6 footer secondary links** — currently underlined text, needs card-style upgrade
4. **`/faq` complete overhaul** — new "Огнището" (Hearth) concept с **2 new imagen** assets

**Работа директно на `main`.** ~10 atomic English commits.

---

## Pre-analysis

### 🔴 P0 #1 — Clue chips text overflow on flip

**File:** `apps/web/components/tutorial/DayClueChips.tsx` + CSS at `globals.css:2072-2148`

Текущи стилове:
```css
.clue-chip {
  min-height: 104px;
}
.clue-chip-inner {
  height: 100%;
  min-height: 104px;
  transform-style: preserve-3d;
}
.clue-chip-front,
.clue-chip-back {
  position: absolute;
  inset: 0;          /* ← FIXED to 0,0,0,0 */
  min-height: 104px;
}
```

**Bug**: `.clue-chip-back` се размество с `position: absolute; inset: 0` (locked to 104px parent height). Когато текстът е дълъг (e.g. "Обвинява силно без нова причина — често е жертва на блъф."), той overflow-ва extension visible area но container не grow-ва защото е absolute-positioned.

User screenshot showed text "излиза от тях" (escapes from them) after flip. Confirmed.

### 🟡 P2 #2 — "Прескочи" link too plain

**File:** `globals.css:1873-1888`

Текущо:
```css
.tutorial-skip-link {
  color: rgba(79, 56, 41, 0.78);
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0;        /* ← НЯМА letter-spacing — flat */
  text-decoration: none;
  text-transform: uppercase;
}
```

Изглежда like plain text without container. Plus е `letter-spacing: 0` for uppercase text (which нужно tracking). Visually weak за skip CTA.

### 🟡 P2 #3 — Tutorial step 6 secondary footer links

**File:** `apps/web/components/tutorial/SlideFinal.tsx` + CSS `globals.css:2206-2226`

Текущо: plain inline underlined text "Правила за Върколак · Правила за Мафия · Всички роли" с separator dots. Bland, не balances main CTAs above (Започни Върколак / Започни Мафия cards).

### 🟠 P1 #4 — /faq overall feel

User said "изглежда странно". Currently is "Library Catalog Drawers" concept from earlier overhaul. Too forced thematic (drawer pulls feel literal, "cabinet" metaphor doesn't fit "ask a question" mental model). Plus visually crowded.

**New concept proposal: "Огнището" (The Hearth)**

Cozier framing — answers shared by firelight, like wisdom shared at a hearth. Less crowded, more inviting. Cinematic painterly hero of an oak hearth with old books, parchment, candle. Modern editorial body with clean expandable Q&A items, polished search, category filter chips.

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Clue chip flip fix | Change from absolute positioning to **dual-layer with content visibility toggle** (no 3D flip — content swap with subtle fade) |
| Прескочи style | Pill chip с border + amber arrow icon (lucide `ChevronRight`) |
| Step 6 secondary | 3 small cards с painterly icon, hover lift, replace inline links |
| /faq concept | "Огнището" — painterly hearth hero + modern editorial body |
| /faq imagen | 2 assets: hero banner + small inline hearth motif (for category section accents) |
| Branch | Directly on `main` |

---

## Stage 1 — Fix clue chip text overflow

**File:** `apps/web/components/tutorial/DayClueChips.tsx`

Refactor to **content-swap pattern** instead of 3D flip. The flip animation is nice in concept but causes overflow when content varies. Replace с subtle fade-swap (content height becomes natural).

```tsx
"use client";

import { useState } from "react";

const PLAYERS = [
  { name: "Анна", clue: "Говори спокойно, но винаги защитава един и същ играч." },
  { name: "Борис", clue: "Гласува рано, после сменя темата." },
  { name: "Виктор", clue: "Има проверка, но я разкрива косвено." },
  { name: "Галя", clue: "Слуша повече, отколкото говори. Запомня всичко." },
  { name: "Деян", clue: "Обвинява силно без нова причина — често е жертва на блъф." },
] as const;

export function DayClueChips() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const flip = (name: string) => {
    setRevealed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const visited = Object.values(revealed).filter(Boolean).length;

  return (
    <div className="clue-chips" role="group" aria-label="Примерни играчи">
      <p className="clue-chips-hint">
        Кликни две-три карти и прочети масата. Посетени: {visited} / {PLAYERS.length}
      </p>
      <div className="clue-chips-row">
        {PLAYERS.map((player) => {
          const isRevealed = Boolean(revealed[player.name]);
          return (
            <button
              key={player.name}
              type="button"
              className="clue-chip"
              data-revealed={isRevealed}
              onClick={() => flip(player.name)}
              aria-pressed={isRevealed}
              aria-label={isRevealed ? `Скрий ${player.name}` : `Разкрий ${player.name}`}
            >
              {isRevealed ? (
                <span className="clue-chip-content clue-chip-back-content">
                  <strong className="clue-chip-back-name">{player.name}</strong>
                  <span className="clue-chip-back-text">{player.clue}</span>
                </span>
              ) : (
                <span className="clue-chip-content clue-chip-front-content">
                  <span className="clue-chip-initial">{player.name[0]}</span>
                  <span className="clue-chip-name">{player.name}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**File:** `apps/web/app/globals.css`

Replace existing `.clue-chip*` rules (lines ~2072-2148) with:

```css
.clue-chips {
  display: grid;
  max-width: 56ch;
  gap: 14px;
  margin-top: 16px;
}

.clue-chips-hint {
  color: rgba(245, 232, 200, 0.78);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.clue-chips-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.clue-chip {
  position: relative;
  min-height: 124px;
  border: 1px solid rgba(83, 52, 31, 0.45);
  border-radius: 12px;
  padding: 12px 14px;
  background: linear-gradient(155deg, rgba(255, 240, 220, 0.95), rgba(220, 200, 160, 0.85));
  cursor: pointer;
  transition:
    transform 200ms ease,
    border-color 200ms ease,
    background 280ms ease,
    color 280ms ease;
  text-align: left;
  font-family: inherit;
}

.clue-chip:hover {
  transform: translateY(-2px);
  border-color: rgba(217, 74, 61, 0.65);
}

.clue-chip[data-revealed="true"] {
  background: rgba(20, 14, 10, 0.92);
  border-color: rgba(217, 74, 61, 0.7);
  color: #f5e8c8;
}

.clue-chip-content {
  display: grid;
  gap: 6px;
  animation: clue-chip-fade-in 280ms ease-out;
}

@keyframes clue-chip-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.clue-chip-front-content {
  align-content: center;
  justify-items: center;
  text-align: center;
  min-height: 100px;
}

.clue-chip-initial {
  color: #842f2b;
  font-family: "Noto Serif Display", serif;
  font-size: 2rem;
  font-weight: 900;
  line-height: 1;
}

.clue-chip-name {
  color: #2a1b10;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.clue-chip-back-content {
  align-content: start;
}

.clue-chip-back-name {
  color: #d94a3d;
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.clue-chip-back-text {
  color: #f5e8c8;
  font-size: 0.85rem;
  line-height: 1.5;
}
```

**Промени:**
- Премахнат 3D `rotateY` + `perspective` — content е now natural-height
- `min-height: 124px` (от 104) — повече breathing room за дълъг текст
- Single-element content (не front+back overlay) — flexbox/grid growth natural
- Smooth fade-in animation between states
- Background switches color чрез `[data-revealed="true"]` attribute

---

## Stage 2 — Polish "Прескочи" link as pill chip

**File:** `apps/web/components/tutorial/TutorialFlipbook.tsx`

Намери `.tutorial-skip-link`:

```tsx
<Link href="/" className="tutorial-skip-link">
  Прескочи
</Link>
```

Замени с lucide icon:

```tsx
import { ChevronRight } from "lucide-react";

// ...

<Link href="/" className="tutorial-skip-link">
  <span>Прескочи</span>
  <ChevronRight className="tutorial-skip-icon" aria-hidden strokeWidth={2} />
</Link>
```

**File:** `globals.css` — replace `.tutorial-skip-link` rules:

```css
.tutorial-skip-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(13, 10, 8, 0.45);
  border: 1px solid rgba(245, 232, 200, 0.16);
  border-radius: 999px;
  color: rgba(245, 232, 200, 0.75);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
  transition:
    border-color 200ms ease,
    color 200ms ease,
    background 200ms ease,
    transform 200ms ease;
}

.tutorial-skip-link:hover {
  background: rgba(13, 10, 8, 0.7);
  border-color: rgba(217, 154, 66, 0.5);
  color: #d19a42;
  transform: translateX(2px);
}

.tutorial-skip-icon {
  width: 14px;
  height: 14px;
  transition: transform 200ms ease;
}

.tutorial-skip-link:hover .tutorial-skip-icon {
  transform: translateX(3px);
}

/* Light theme */
[data-theme="light"] .tutorial-skip-link {
  background: rgba(252, 246, 236, 0.65);
  border-color: rgba(132, 47, 43, 0.22);
  color: rgba(79, 56, 41, 0.82);
}

[data-theme="light"] .tutorial-skip-link:hover {
  background: rgba(252, 246, 236, 0.9);
  border-color: rgba(132, 47, 43, 0.55);
  color: #842f2b;
}
```

---

## Stage 3 — Upgrade Step 6 footer secondary links to cards

**File:** `apps/web/components/tutorial/SlideFinal.tsx`

Намери existing footer block:

```tsx
<div className="tutorial-final-secondary">
  <Link href="/werewolf/rules" className="tutorial-final-secondary-link">Правила за Върколак</Link>
  <span aria-hidden>·</span>
  <Link href="/mafia/rules" className="tutorial-final-secondary-link">Правила за Мафия</Link>
  <span aria-hidden>·</span>
  <Link href="/roles" className="tutorial-final-secondary-link">Всички роли</Link>
</div>
```

Замени с:

```tsx
import { BookOpen, ScrollText, Users } from "lucide-react";

// ...

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
```

**File:** `globals.css` — replace `.tutorial-final-secondary*` rules:

```css
.tutorial-final-secondary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 24px;
}

.tutorial-final-secondary-card {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  background: rgba(13, 10, 8, 0.55);
  border: 1px solid rgba(245, 232, 200, 0.14);
  border-radius: 12px;
  color: rgba(232, 217, 187, 0.92);
  text-decoration: none;
  transition: border-color 200ms ease, background 200ms ease, transform 200ms ease;
}

.tutorial-final-secondary-card:hover {
  background: rgba(13, 10, 8, 0.78);
  border-color: rgba(217, 154, 66, 0.5);
  transform: translateY(-2px);
}

.tutorial-final-secondary-icon {
  width: 20px;
  height: 20px;
  color: #d19a42;
  margin-bottom: 4px;
}

.tutorial-final-secondary-label {
  font-family: "Noto Serif", serif;
  font-weight: 700;
  font-size: 0.92rem;
  color: #f5e8c8;
}

.tutorial-final-secondary-hint {
  font-size: 0.78rem;
  color: rgba(232, 217, 187, 0.6);
  font-style: italic;
}

/* Light theme */
[data-theme="light"] .tutorial-final-secondary-card {
  background: rgba(252, 246, 236, 0.6);
  border-color: rgba(132, 47, 43, 0.18);
  color: rgba(42, 27, 16, 0.85);
}

[data-theme="light"] .tutorial-final-secondary-card:hover {
  background: rgba(252, 246, 236, 0.92);
  border-color: rgba(132, 47, 43, 0.5);
}

[data-theme="light"] .tutorial-final-secondary-icon {
  color: #842f2b;
}

[data-theme="light"] .tutorial-final-secondary-label {
  color: #2a1b10;
}

[data-theme="light"] .tutorial-final-secondary-hint {
  color: rgba(79, 56, 41, 0.65);
}
```

**Delete** old `.tutorial-final-secondary` and `.tutorial-final-secondary-link` rules.

---

## Stage 4 — Generate 2 imagen assets for /faq

### Asset 1: Hearth hero banner

**Path:** `apps/web/public/game-art/legal/faq-hearth-banner.png`

```
A wide cinematic banner illustration of a stone hearth with a
warm glowing fire, captured at a slight low angle. On the hearth
ledge lie three worn leather-bound books with brass clasps, a
partially unrolled parchment scroll weighted by a brass quill
holder, and a single dripping candle in a brass candlestick.
Soft volumetric firelight casts warm amber and ember-red glows
across the books and stone surfaces; deep shadows pool in the
upper corners. A faint wisp of smoke rises from the candle. The
lower third of the frame gradient-fades to near-black for text
overlay legibility. Mood: cozy gathering, shared wisdom by
firelight, the place where questions find their answers.
Painterly oil style with rich impasto brushwork, warm amber and
umber palette with brass accents and ember-red firelight, deep
shadow falloff, vignetted corners. No text, no readable letters,
no numbers, no markings anywhere on books, scroll, or surfaces.
Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### Asset 2: Small inline hearth motif (category accent)

**Path:** `apps/web/public/game-art/legal/faq-hearth-motif.png`

```
A small painterly illustration of a single open leather-bound
book resting on a wooden surface, with a brass bookmark ribbon
draped from its pages. Warm candlelight from the upper-left casts
gentle highlights on the cover and pages. Background fades into
deep blurred brown. The mood: invitation to read, an answer
about to be revealed. Painterly oil style, warm amber and brown
palette, vignetted corners. No text, no readable letters, no
markings on the book or ribbon anywhere. Aspect ratio 3:2.
```

**Size:** 1200 × 800.

После: `pnpm optimize:assets`. Verify both PNG + WebP exist.

---

## Stage 5 — /faq complete overhaul with Hearth concept

### Update `apps/web/app/faq/page.tsx`

```tsx
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { FaqHearth } from "@/components/faq/FaqHearth";
import { FAQ_DATA } from "@/lib/faq-data";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Седни до огъня | Върколак и Мафия",
  description: "Отговори за геймплея, профила, техническите детайли и поверителността — споделени до огъня.",
  path: "/faq",
  image: "/game-art/legal/faq-hearth-banner.png",
  imageAlt: "Каменно огнище с книги и свещ",
  absoluteTitle: true,
});

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: absoluteUrl("/faq"),
    inLanguage: "bg-BG",
    mainEntity: FAQ_DATA.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: flattenAnswerForSchema(item.answer),
      },
    })),
  };

  return (
    <main className="shell faq-shell">
      <ResourceHints images={["/game-art/legal/faq-hearth-banner.webp"]} />
      <JsonLd data={faqJsonLd} />
      <FaqHearth items={FAQ_DATA} />
    </main>
  );
}

// Helper, may already exist in lib/faq-data.ts — reuse if so
function flattenAnswerForSchema(blocks: unknown): string {
  // Implementation depends on AnswerBlock shape from earlier work
  // If exists in lib/faq-data.ts, import from there instead
  return "";
}
```

### New component: `apps/web/components/faq/FaqHearth.tsx`

Wraps existing search/expand functionality with new visual treatment. Reuses existing AnswerBlock rendering logic.

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronDown, Flame, Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { FaqAnswerRenderer } from "./FaqAnswerRenderer";
import { CategoryIcon } from "./FaqCategoryIcon";
import type { FaqCategory, FaqItem } from "@/lib/faq-data";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory | "all">("all");
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(() => initialQ ? new Set([initialQ]) : new Set());
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_FEEDBACK_KEY);
      if (raw) setFeedback(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const firstOpen = [...openSlugs][0];
    const params = new URLSearchParams(searchParams.toString());
    if (firstOpen) params.set("q", firstOpen);
    else params.delete("q");
    const newQuery = params.toString();
    router.replace(`/faq${newQuery ? `?${newQuery}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSlugs]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!initialQ) return;
    const el = document.querySelector(`[data-slug="${initialQ}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (term && !item.searchableText.includes(term)) return false;
      return true;
    });
  }, [items, search, activeCategory]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      entries: filtered.filter((item) => item.category === category),
    })).filter((g) => g.entries.length > 0);
  }, [filtered]);

  const toggle = useCallback((slug: string) => {
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const setFeedbackFor = useCallback((slug: string, value: "up" | "down") => {
    setFeedback((prev) => {
      const current = prev[slug];
      const next = current === value ? { ...prev, [slug]: undefined } : { ...prev, [slug]: value };
      try {
        window.localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const copyLink = useCallback(async (slug: string) => {
    const url = `${window.location.origin}/faq?q=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* ignore */ }
  }, []);

  return (
    <article className="faq-hearth">
      {/* Hero */}
      <header className="faq-hearth-hero">
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

      {/* Search + category filter */}
      <div className="faq-hearth-toolbar">
        <div className="faq-hearth-search" role="search">
          <Search className="faq-hearth-search-icon" aria-hidden strokeWidth={2} />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Питай огъня..."
            aria-label="Търсене в често задавани въпроси"
            className="faq-hearth-search-input"
          />
          <span className="faq-hearth-search-hotkey" aria-hidden>⌘K</span>
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

      {/* Body */}
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
                      <article
                        className="faq-hearth-item"
                        data-open={isOpen}
                        data-slug={item.slug}
                      >
                        <button
                          type="button"
                          className="faq-hearth-item-handle"
                          onClick={() => toggle(item.slug)}
                          aria-expanded={isOpen}
                        >
                          <span className="faq-hearth-item-question">
                            <SearchHighlight text={item.question} term={search.trim()} />
                          </span>
                          <ChevronDown
                            className="faq-hearth-item-chevron"
                            aria-hidden
                            strokeWidth={2.2}
                          />
                        </button>

                        {isOpen ? (
                          <div className="faq-hearth-item-answer">
                            <FaqAnswerRenderer blocks={item.answer} />

                            {item.tutorialStep ? (
                              <p className="faq-hearth-item-link">
                                <Link href={`/tutorial?step=${item.tutorialStep}`}>
                                  Виж в Tutorial → сцена {item.tutorialStep}
                                </Link>
                              </p>
                            ) : null}

                            <footer className="faq-hearth-item-footer">
                              <button
                                type="button"
                                className="faq-hearth-item-copy"
                                onClick={() => copyLink(item.slug)}
                                aria-label={`Копирай линк към „${item.question}“`}
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

      {/* Footer */}
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
          <Link href="/report" className="btn btn-secondary">Дай ни бележка</Link>
          <Link href="/" className="btn btn-secondary">Към началото</Link>
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
```

### CSS for FaqHearth

Replace existing `.faq-*` rules в globals.css (keep `.faq-shell` framing — only redesign inside).

```css
/* ============================== */
/* FAQ — Hearth concept            */
/* ============================== */

.faq-hearth {
  display: grid;
  gap: 0;
}

/* Hero */

.faq-hearth-hero {
  position: relative;
  width: 100%;
  min-height: clamp(280px, 38vw, 460px);
  overflow: hidden;
}

.faq-hearth-banner {
  position: absolute;
  inset: 0;
}

.faq-hearth-banner-img {
  object-fit: cover;
  object-position: center 38%;
}

.faq-hearth-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(13, 10, 8, 0.22) 0%, rgba(13, 10, 8, 0.55) 50%, rgba(13, 10, 8, 0.95) 100%);
}

.faq-hearth-inner {
  position: relative;
  z-index: 1;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 24px 40px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.faq-hearth-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.74rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d19a42 !important;
  margin: 0 0 12px;
}

.faq-hearth-kicker-icon {
  width: 16px;
  height: 16px;
}

.faq-hearth-title {
  font-family: "Noto Serif Display", serif;
  font-size: clamp(2.4rem, 6vw, 4rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.015em;
  color: #f5e8c8 !important;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
  margin: 0 0 14px;
  max-width: 18ch;
  text-wrap: balance;
}

.faq-hearth-subtitle {
  font-size: 1.05rem;
  line-height: 1.6;
  color: rgba(245, 232, 200, 0.85) !important;
  max-width: 56ch;
  margin: 0;
}

/* Toolbar (search + filters) */

.faq-hearth-toolbar {
  max-width: 980px;
  margin: 0 auto;
  padding: 28px 24px 16px;
  display: grid;
  gap: 14px;
}

.faq-hearth-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  background: rgba(13, 10, 8, 0.45);
  border: 1px solid rgba(245, 232, 200, 0.16);
  border-radius: 14px;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.faq-hearth-search:focus-within {
  background: rgba(13, 10, 8, 0.68);
  border-color: rgba(217, 154, 66, 0.55);
  box-shadow: 0 0 0 3px rgba(217, 154, 66, 0.18);
}

.faq-hearth-search-icon {
  width: 18px;
  height: 18px;
  color: rgba(245, 232, 200, 0.6);
  flex-shrink: 0;
}

.faq-hearth-search-input {
  flex: 1;
  height: 50px;
  background: transparent;
  border: none;
  color: #f5e8c8;
  font-family: inherit;
  font-size: 0.98rem;
}

.faq-hearth-search-input:focus { outline: none; }
.faq-hearth-search-input::placeholder { color: rgba(245, 232, 200, 0.42); }

.faq-hearth-search-hotkey {
  padding: 4px 8px;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: rgba(245, 232, 200, 0.65);
  background: rgba(245, 232, 200, 0.08);
  border: 1px solid rgba(245, 232, 200, 0.18);
  border-radius: 6px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .faq-hearth-search-hotkey { display: none; }
}

.faq-hearth-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.faq-hearth-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(13, 10, 8, 0.5);
  border: 1px solid rgba(245, 232, 200, 0.14);
  border-radius: 999px;
  color: rgba(245, 232, 200, 0.78);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.faq-hearth-filter:hover {
  border-color: rgba(217, 154, 66, 0.45);
  color: #d19a42;
}

.faq-hearth-filter[data-active="true"] {
  background: rgba(217, 154, 66, 0.2);
  border-color: rgba(217, 154, 66, 0.65);
  color: #d19a42;
}

.faq-hearth-filter-icon {
  width: 14px;
  height: 14px;
}

/* Body */

.faq-hearth-body {
  max-width: 980px;
  margin: 0 auto;
  padding: 8px 24px 0;
  display: grid;
  gap: 28px;
}

.faq-hearth-section {
  display: grid;
  gap: 12px;
}

.faq-hearth-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(245, 232, 200, 0.1);
}

.faq-hearth-section-icon {
  width: 22px;
  height: 22px;
  color: #d19a42;
}

.faq-hearth-section-head h2 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #d19a42;
  margin: 0;
}

.faq-hearth-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.faq-hearth-item {
  background: rgba(13, 10, 8, 0.42);
  border: 1px solid rgba(245, 232, 200, 0.1);
  border-radius: 12px;
  transition: border-color 200ms ease, background 200ms ease;
}

.faq-hearth-item[data-open="true"] {
  background: rgba(13, 10, 8, 0.62);
  border-color: rgba(217, 154, 66, 0.4);
}

.faq-hearth-item-handle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: none;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  min-height: 56px;
}

.faq-hearth-item-question {
  font-family: "Noto Serif", serif;
  font-size: 1rem;
  font-weight: 600;
  color: #f5e8c8;
}

.faq-hearth-item-chevron {
  width: 20px;
  height: 20px;
  color: rgba(217, 154, 66, 0.85);
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  flex-shrink: 0;
}

.faq-hearth-item[data-open="true"] .faq-hearth-item-chevron {
  transform: rotate(180deg);
}

.faq-hearth-item-answer {
  padding: 0 20px 18px;
  color: rgba(245, 232, 200, 0.85);
  font-size: 0.95rem;
  line-height: 1.65;
}

.faq-hearth-item-link {
  margin: 12px 0 0;
  padding: 10px 14px;
  background: rgba(217, 154, 66, 0.16);
  border-radius: 8px;
  font-size: 0.88rem;
}

.faq-hearth-item-link a {
  color: #d19a42;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.faq-hearth-item-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(245, 232, 200, 0.08);
}

.faq-hearth-item-copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid rgba(245, 232, 200, 0.18);
  border-radius: 999px;
  color: rgba(245, 232, 200, 0.75);
  font-family: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease;
}

.faq-hearth-item-copy:hover {
  border-color: rgba(217, 154, 66, 0.55);
  color: #d19a42;
}

.faq-hearth-item-copy svg {
  width: 14px;
  height: 14px;
}

.faq-hearth-item-helpful {
  display: flex;
  align-items: center;
  gap: 6px;
}

.faq-hearth-item-helpful-label {
  font-size: 0.78rem;
  color: rgba(245, 232, 200, 0.6);
  margin-right: 4px;
}

.faq-hearth-item-thumb {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(245, 232, 200, 0.18);
  border-radius: 50%;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  color: rgba(245, 232, 200, 0.7);
}

.faq-hearth-item-thumb svg {
  width: 14px;
  height: 14px;
}

.faq-hearth-item-thumb:hover {
  border-color: rgba(217, 154, 66, 0.55);
  color: #d19a42;
}

.faq-hearth-item-thumb[data-active="true"] {
  background: rgba(217, 154, 66, 0.22);
  border-color: rgba(217, 154, 66, 0.65);
  color: #d19a42;
}

.faq-hearth-highlight {
  background: rgba(217, 154, 66, 0.32);
  color: inherit;
  border-radius: 2px;
  padding: 0 2px;
}

.faq-hearth-empty {
  max-width: 56ch;
  margin: 24px auto 32px;
  padding: 24px;
  text-align: center;
  color: rgba(245, 232, 200, 0.62);
  font-style: italic;
  border: 1px dashed rgba(245, 232, 200, 0.16);
  border-radius: 14px;
}

/* Footer */

.faq-hearth-foot {
  max-width: 720px;
  margin: 40px auto 0;
  padding: 32px 24px 0;
  display: grid;
  justify-items: center;
  gap: 14px;
  text-align: center;
  border-top: 1px solid rgba(245, 232, 200, 0.1);
}

.faq-hearth-foot-art {
  width: 120px;
  height: auto;
  border-radius: 10px;
  margin-bottom: 4px;
  opacity: 0.85;
}

.faq-hearth-foot p {
  font-size: 0.95rem;
  color: rgba(245, 232, 200, 0.72);
  margin: 0;
}

.faq-hearth-foot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

/* Mobile sticky search */

@media (max-width: 768px) {
  .faq-hearth-toolbar {
    position: sticky;
    top: 80px;
    z-index: 5;
    backdrop-filter: blur(10px);
    background: rgba(13, 10, 8, 0.78);
    border-bottom: 1px solid rgba(245, 232, 200, 0.08);
    padding-bottom: 14px;
  }
}

/* Light theme overrides */

[data-theme="light"] .faq-hearth-search {
  background: rgba(252, 246, 236, 0.65);
  border-color: rgba(132, 47, 43, 0.2);
}

[data-theme="light"] .faq-hearth-search:focus-within {
  background: rgba(252, 246, 236, 0.92);
  border-color: rgba(132, 47, 43, 0.55);
  box-shadow: 0 0 0 3px rgba(132, 47, 43, 0.14);
}

[data-theme="light"] .faq-hearth-search-icon { color: rgba(79, 56, 41, 0.55); }
[data-theme="light"] .faq-hearth-search-input { color: #2a1b10; }
[data-theme="light"] .faq-hearth-search-input::placeholder { color: rgba(79, 56, 41, 0.5); }

[data-theme="light"] .faq-hearth-search-hotkey {
  background: rgba(132, 47, 43, 0.08);
  border-color: rgba(132, 47, 43, 0.22);
  color: rgba(79, 56, 41, 0.72);
}

[data-theme="light"] .faq-hearth-filter {
  background: rgba(252, 246, 236, 0.6);
  border-color: rgba(132, 47, 43, 0.18);
  color: rgba(79, 56, 41, 0.82);
}

[data-theme="light"] .faq-hearth-filter:hover {
  border-color: rgba(132, 47, 43, 0.5);
  color: #842f2b;
}

[data-theme="light"] .faq-hearth-filter[data-active="true"] {
  background: rgba(132, 47, 43, 0.18);
  border-color: rgba(132, 47, 43, 0.6);
  color: #842f2b;
}

[data-theme="light"] .faq-hearth-section-icon { color: #842f2b; }
[data-theme="light"] .faq-hearth-section-head { border-color: rgba(132, 47, 43, 0.18); }
[data-theme="light"] .faq-hearth-section-head h2 { color: #842f2b; }

[data-theme="light"] .faq-hearth-item {
  background: rgba(252, 246, 236, 0.6);
  border-color: rgba(132, 47, 43, 0.16);
}

[data-theme="light"] .faq-hearth-item[data-open="true"] {
  background: rgba(252, 246, 236, 0.9);
  border-color: rgba(132, 47, 43, 0.5);
}

[data-theme="light"] .faq-hearth-item-question { color: #2a1b10; }
[data-theme="light"] .faq-hearth-item-chevron { color: rgba(132, 47, 43, 0.85); }
[data-theme="light"] .faq-hearth-item-answer { color: rgba(42, 27, 16, 0.85); }

[data-theme="light"] .faq-hearth-item-link {
  background: rgba(132, 47, 43, 0.12);
}

[data-theme="light"] .faq-hearth-item-link a { color: #842f2b; }

[data-theme="light"] .faq-hearth-item-copy,
[data-theme="light"] .faq-hearth-item-thumb {
  border-color: rgba(132, 47, 43, 0.2);
  color: rgba(79, 56, 41, 0.72);
}

[data-theme="light"] .faq-hearth-item-copy:hover,
[data-theme="light"] .faq-hearth-item-thumb:hover {
  border-color: rgba(132, 47, 43, 0.55);
  color: #842f2b;
}

[data-theme="light"] .faq-hearth-item-thumb[data-active="true"] {
  background: rgba(132, 47, 43, 0.16);
  border-color: rgba(132, 47, 43, 0.55);
  color: #842f2b;
}

[data-theme="light"] .faq-hearth-highlight {
  background: rgba(132, 47, 43, 0.18);
}

[data-theme="light"] .faq-hearth-empty {
  color: rgba(79, 56, 41, 0.7);
  border-color: rgba(132, 47, 43, 0.22);
}

[data-theme="light"] .faq-hearth-foot p { color: rgba(79, 56, 41, 0.72); }
[data-theme="light"] .faq-hearth-foot { border-color: rgba(132, 47, 43, 0.18); }
```

### Delete old FAQ styles

Премахни от globals.css всичките стари `.faq-cabinet`, `.faq-drawer*`, `.faq-hero-art`, `.faq-head`, `.faq-stage`, `.faq-kicker` etc. — те се замениха с `.faq-hearth*` система.

Запази `.faq-shell` (frame styling, painterly bg) — само renamed components inside.

---

## Stage 6 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected:
- `/tutorial?step=3` desktop + mobile (clue chips behavior — verify text fits после flip)
- `/tutorial?step=6` desktop + mobile (secondary cards visible)
- Tutorial flipbook (skip pill style)
- `/faq` desktop + mobile (complete redesign)
- `/faq` in light theme

---

## Acceptance criteria

1. **Tutorial Step 3 clue chips**: text fits inside chip border дори при дълъг clue (e.g. "Обвинява силно..." до "...на блъф."). No overflow.
2. **3D flip removed** — replaced с natural-height content swap + fade-in animation (280ms).
3. **"Прескочи" link** е pill chip с border + ChevronRight icon, hover state intensifies amber accent.
4. **Tutorial Step 6 secondary** — 3 card-style links (BookOpen / ScrollText / Users icons) replace inline text.
5. **/faq complete redesign** with Hearth concept:
   - Cinematic painterly hearth banner
   - Sticky search bar (mobile) + ⌘K shortcut
   - Category filter chips (replace previous drawer system)
   - Clean expandable Q&A items (no brass drawers)
   - Each item: question + chevron toggle + copy-link + thumbs-up/down feedback
   - Tutorial deep-link surface на параметри въпрос
   - Small painterly hearth motif at bottom footer
6. **2 new imagen** assets generated: `faq-hearth-banner.png` (1920×1080) + `faq-hearth-motif.png` (1200×800).
7. **Light theme variants** работят за всичките components.
8. **Old FAQ cabinet/drawer styles** removed from globals.css.
9. **БГ copy** непроменена за съществуващите FAQ items, English commits.
10. **`pnpm verify` passes**.
11. **Работено директно на `main`**.

---

## Не пипай

- `lib/faq-data.ts` — съществуващи Q&A items, AnswerBlock types, helper functions остават.
- `FaqAnswerRenderer.tsx` — reuse existing renderer for rich answer blocks.
- `FaqCategoryIcon.tsx` — reuse existing inline SVG icons per category.
- Server-side `app/faq/page.tsx` outer wrapper, JsonLd, ResourceHints — keep skeleton.
- Tutorial Slide 1-5 components (only Step 3 DayClueChips + Step 6 SlideFinal touched).
- Frame styling (`.faq-shell`), painterly bg, navbar dropdowns, auth chip.
- Game-server, schemas, Better Auth.

---

## Verification

```bash
pnpm install
pnpm optimize:assets
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm visual:update
pnpm visual
pnpm perf:budget
```

Manual:

1. Open `/tutorial?step=3` → click all 5 player chips → all texts visible inside borders, no overflow. Click Деян (longest text) → still fits.
2. Open `/tutorial?step=1` → "Прескочи" link top-right е pill chip с chevron icon. Hover → border amber, chevron slides right.
3. Open `/tutorial?step=6` → footer shows 3 card links (Правила Върколак / Правила Мафия / Всички роли) с icons. Hover lift.
4. Open `/faq`:
   - Cinematic hearth banner visible top
   - Search bar with Search icon + ⌘K hotkey badge
   - 5 category filter chips below search
   - Categories visible как разделени sections, не drawers
   - Each Q expandable с chevron rotation
   - Copy link + 👍/👎 thumb buttons в footer per item
5. Toggle light theme → all components adapt cleanly.
6. Mobile (390×844) → search bar sticky on scroll. Items stack 1-col.
7. `/faq?q=paritet-rule` → auto-opens correct item, scrolls into view.
8. Test ⌘K shortcut → focuses search input.

---

## Commit strategy (10 atomic English commits, on `main`)

1. `fix(tutorial): clue chips natural-height content swap fixes text overflow`
2. `style(tutorial): polish skip link as pill chip with chevron icon`
3. `feat(tutorial): card-style secondary links on final slide with icons`
4. `chore(art): generate cinematic hearth banner and book motif for FAQ`
5. `feat(faq): new FaqHearth component with cinematic banner and toolbar`
6. `feat(faq): search bar with Cmd K shortcut and lucide search icon`
7. `feat(faq): category filter chips replace drawer cabinet`
8. `feat(faq): flat expandable items with copy link and helpful feedback`
9. `style(faq): light theme variant for hearth components`
10. `chore(css): remove obsolete FAQ cabinet drawer brass styles`

Plus optional:
11. `chore(visual): regenerate baselines for tutorial polish and FAQ overhaul`

Workflow:
```bash
git status
git pull origin main --rebase

# Per commit:
# Edit files, validate, commit
git add <files>
git commit -m "English message"
pnpm regression && pnpm typecheck && pnpm build
# If green → push. If red → fix.
```

---

(End of prompt)
