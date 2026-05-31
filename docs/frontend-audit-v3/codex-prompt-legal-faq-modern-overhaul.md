# Codex prompt — Modern reader system for /faq, /privacy, /terms, /report

Цялостен redesign на 4 utility страници (`/faq`, `/privacy`, `/terms`, `/report`) от **дървен brass-plaque-on-painterly-art** към **modern editorial reader** с typographic hierarchy, sticky ToC, in-page search, deep linking.

Запазваме site-wide painterly aesthetic, но **разделяме marketing/game pages** (heavy painterly art) **от utility/legal pages** (modern editorial reader chrome). Двата стила coexist coherent — site има game-pages (Werewolf/Mafia/Tutorial) с full painterly heroes, и utility-pages с modernized chrome.

**Replaces and supersedes**: `codex-prompt-faq-overhaul.md` (предходният FAQ overhaul). Този промпт включва всичкото от него плюс новия design system.

~18 atomic English commits. Branch: `feat/legal-modern-system`.

---

## Pre-analysis (current state findings)

### Common pattern across all 4 pages — what's "дървено"

```
[ Painterly hero art ] | [ Heavy brass-textured card ]
       ляво            |    + cream-on-brass typography
                       |    + inset 6px brass borders
                       |    + dropped shadow
                       |    + dense numbered sections
```

Този pattern работи **отлично** за game/marketing pages (sign-in, account, history Evidence Wall). Но на **legal/utility pages** със 9-11 numbered секции:

- Brass-textured карта се чувства heavy за дълъг текст
- Cream-on-brass typography с text-shadow прави scanning trudен
- Painterly hero art ляво заема място, което може to стане ToC sidebar
- Няма visual hierarchy между секции — всичките изглеждат еднакво важни
- Няма ToC, anchor links, in-page search, scroll-spy
- Няма "TL;DR" callout-и да scannable
- Print stylesheet липсва на legal pages

### What modern editorial readers do well (Stripe, Vercel, Linear, GitHub docs)

1. **Functional hero** — title + last updated + ToC chips, no decorative art column
2. **Sticky ToC sidebar** with scroll-spy (active section highlight)
3. **Inline anchor links** (`§` symbol on hover)
4. **TL;DR callouts** at top of complex sections
5. **Search within page** (⌘K / Ctrl+F enhanced)
6. **Print-friendly** stylesheet
7. **Numbered sections via auto-counter** (no manual "1. ... 2. ... 3. ..." prefixes)
8. **Generous whitespace, narrow measure** (60-75ch optimal reading line)
9. **Subtle dividers, no heavy borders**
10. **Smooth scroll-to-anchor**

We adopt all of the above into a shared **`legal-modern`** design system.

---

## Pre-decisions (locked)

- **Two parallel design systems**: `painterly-marketing` (current cinematic style, used for game/account pages) and `legal-modern` (new clean editorial style, used for /faq, /privacy, /terms, /report). Documented in `docs/design-systems.md`.
- **Banner art format**: replace tall portrait painterly art (3:4) with **wide cinematic banner (16:9)** at the top of each page. Banners are darker, more atmospheric — they suggest theme without dominating content.
- **Typography**: serif for headers (Noto Serif Display — already in stack), sans-serif system font for body (system stack, fastest, native feel). No new fonts.
- **Sticky ToC sidebar**: desktop only (≥ 1024px). Mobile falls back to in-content "Към секция" jump chips.
- **Color palette**: keep dark site theme (`#0d0a08` background, `#f5e8c8` text), but tonally lighter cards (`#1a1410` to `#2a1f15` gradient) for body, no brass overlay. Accent color per page type:
  - Privacy → deep indigo `#3a4f7a`
  - Terms → warm earth `#8a6a4a`
  - Report → ember alert `#d94a3d`
  - FAQ → amber knowledge `#d19a42`
- **No new npm dependencies**. We build sticky ToC + scroll-spy from scratch with React + IntersectionObserver.
- **Use context7** for live Next.js 16 metadata API and Tailwind 4 typography utilities — specific queries listed in Stage 0.
- **Branch**: `feat/legal-modern-system`.

---

## Stage 0 — Context7 documentation lookups

Before writing code, run these context7 queries to ensure you're using current best practices, not 2023 outdated patterns.

**Required queries:**

1. **Next.js metadata + structured data** (App Router 16+):
   ```
   context7: "next.js app router metadata generateMetadata canonical alternates"
   ```
   Confirm:
   - Correct shape of `Metadata` type for `alternates.canonical`
   - Recommended way to inject JSON-LD `<script>` per route
   - `robots: { index, follow }` correct syntax
   - `openGraph` + `twitter` complete schema

2. **Tailwind 4 typography**:
   ```
   context7: "tailwind 4 typography prose plugin reading width line height"
   ```
   Confirm:
   - `prose` utility usage в Tailwind 4 (different from v3)
   - Optimal `max-width` for reading (`max-w-prose` или manual)
   - `text-balance` для headings (CSS native)
   - Container queries syntax

3. **React 19 + Next.js 16 SSR**:
   ```
   context7: "react 19 useEffect intersection observer scroll spy server component hydration"
   ```
   Confirm:
   - Best pattern for client-side scroll-spy without hydration mismatch
   - Whether `IntersectionObserver` needs SSR guard
   - useId() для unique element IDs across render

4. **Modern form UX patterns**:
   ```
   context7: "html form accessibility floating label autocomplete error inline feedback"
   ```
   Confirm:
   - Modern `<label>` placement (top vs inline floating)
   - `autocomplete` attributes for /report form
   - `aria-invalid` + `aria-describedby` for inline errors

5. **CSS print stylesheet**:
   ```
   context7: "css @media print page break inside avoid color adjust legal documents"
   ```
   Confirm:
   - `page-break-inside: avoid` modern equivalent (`break-inside: avoid`)
   - `print-color-adjust` for forced background colors
   - Hidden elements on print best practice

**Document the findings** in `docs/legal-modern-research.md` — short bullet list per query, citing context7 source. This becomes reference for future iterations.

---

## Stage 1 — Generate 4 new imagen banner assets

All 4 banners are wide cinematic format (16:9, 1920×1080), darker palette than current portrait arts, with intentional space at the bottom-center for text overlay legibility (gradient scrim).

### Asset 1: Privacy banner

**Path:** `apps/web/public/game-art/legal/privacy-banner.png`

```
A wide cinematic banner illustration showing an ornate brass-bound
mahogany strongbox sitting on dark velvet, captured from a slight
low angle to give it presence. Soft volumetric directional light
from upper-left creates rich highlights on the brass fittings and
deep shadows in the corners. The lower third of the frame fades
into near-black for legible text overlay. Mood: protection, kept
promises, quiet vigilance. Painterly oil style with visible
brushwork, deep indigo and warm umber palette, atmospheric depth.
No text, no letters, no numbers, no symbols, no readable markings
anywhere on the strongbox or scene. Aspect ratio 16:9 (wide
cinematic).
```

**Size:** 1920 × 1080.

### Asset 2: Terms banner

**Path:** `apps/web/public/game-art/legal/terms-banner.png`

```
A wide cinematic banner illustration of two pairs of weathered
hands meeting in a firm handshake above a candlelit oak table,
captured straight-on at table height. A partially-unrolled blank
parchment scroll lies beneath, with a quill resting at its edge.
The candle flame glows warm gold from the lower-right; the
upper-left fades into deep shadow. The lower third gradient-fades
to near-black for text overlay. Mood: agreement, mutual respect,
the moment a deal is sealed. Painterly oil style with rich
brushwork, warm earth-brown and amber palette, vignetted corners.
No text, no letters, no numbers, no readable markings on the
parchment or surroundings. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### Asset 3: Report banner

**Path:** `apps/web/public/game-art/legal/report-banner.png`

```
A wide cinematic banner illustration of a small stone lighthouse
on a low coastal cliff at twilight, viewed from a moderate
distance across darkening sea water. The lighthouse beam cuts
warm amber through cool wispy fog, sweeping across the frame from
right toward the lower left. A few seabirds silhouetted against
the misty horizon. The lower third of the frame fades into deep
indigo near-black for text overlay legibility. Mood: vigilance,
guidance, the assurance that someone is watching. Painterly oil
style, cool blue-grey atmosphere with warm ember accents,
dramatic atmospheric perspective. No text, no letters, no
numbers, no symbols anywhere. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### Asset 4: FAQ banner

**Path:** `apps/web/public/game-art/legal/faq-banner.png`

```
A wide cinematic banner illustration of an antique brass-fitted
oak library card catalog cabinet, photographed at a slight three-
quarter angle from above. Multiple small wooden drawers with
brass label holders and pull-rings; one drawer pulled partially
open in the center revealing cream index cards inside. A brass
desk lamp glows warmly from the upper-left, casting golden light
across the cabinet face. The lower third gradient-fades to near-
black for text overlay. Mood: organized knowledge, ready answers,
the moment before learning. Painterly oil style, warm umber and
brass palette with deep wood tones, vignetted corners. No text,
no letters, no numbers, no readable labels on any drawer or
card. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### After generation

```bash
ls apps/web/public/game-art/legal/*.png    # 4 banners
pnpm optimize:assets                       # webp variants
ls apps/web/public/game-art/legal/*.webp   # 4 webp
```

Если ли imagen output на която и да е има stray текст/letters/numbers, regenerate с по-силен emphasis в "no text" клаузата.

**Note:** Запазете старите painterly assets (`privacy-vault.png`, `terms-handshake.png`, `report-lighthouse.png`, `library-catalog-hero.png`) в repo-то — те ще се ползват за OG images и социална preview. Само page-level chrome се сменя.

### Optional 5th asset — Paritet diagram for FAQ

Ако още не съществува от earlier prompt, generate:

**Path:** `apps/web/public/game-art/faq/paritet-diagram.png`

```
A painterly cinematic illustration showing a horizontal sequence
of three small wooden tabletop scenes from left to right, each
inside its own oval painterly frame, separated by warm directional
candlelight pools. Frame 1: two figure silhouettes on left facing
five smaller silhouettes on right. Frame 2: two facing only three.
Frame 3: two facing exactly two — equal balance, soft warm glow.
Painterly oil style, warm sepia palette, dark wood-brown surfaces.
No text, no letters, no numbers, no symbols on any silhouette.
Aspect ratio 3:1 (wide horizontal banner).
```

**Size:** 1500 × 500.

---

## Stage 2 — Shared `legal-modern` design system

Build reusable components in `apps/web/components/docs/`. These power all 4 redesigned pages.

### `apps/web/components/docs/DocLayout.tsx`

The shell — banner + (optional) sticky ToC sidebar + main content column + footer.

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DocBanner } from "./DocBanner";
import { DocTocSidebar } from "./DocTocSidebar";
import { DocBackToTop } from "./DocBackToTop";

export interface DocSectionRef {
  id: string;
  title: string;
  number?: number;
}

interface DocLayoutProps {
  accent: "privacy" | "terms" | "report" | "faq";
  banner: {
    src: string;
    srcSet?: string;
    alt: string;
  };
  kicker: string;
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  sections: readonly DocSectionRef[];
  showToc?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function DocLayout(props: DocLayoutProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    if (props.sections.length === 0) return;

    const elements = props.sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [props.sections]);

  return (
    <main className="doc-shell" data-accent={props.accent} ref={containerRef as never}>
      <DocBanner {...props.banner} kicker={props.kicker} title={props.title} subtitle={props.subtitle} lastUpdated={props.lastUpdated} />

      <div className="doc-layout">
        {props.showToc !== false && props.sections.length > 0 ? (
          <DocTocSidebar sections={props.sections} activeId={activeId} />
        ) : null}

        <article className="doc-content">
          {props.children}
        </article>
      </div>

      {props.footer ? <footer className="doc-page-footer">{props.footer}</footer> : null}

      <DocBackToTop />
    </main>
  );
}
```

### `apps/web/components/docs/DocBanner.tsx`

Wide banner area at top — image + gradient scrim + title + last-updated.

```tsx
import Image from "next/image";

interface DocBannerProps {
  src: string;
  srcSet?: string;
  alt: string;
  kicker: string;
  title: string;
  subtitle?: string;
  lastUpdated?: string;
}

export function DocBanner({ src, alt, kicker, title, subtitle, lastUpdated }: DocBannerProps) {
  return (
    <header className="doc-banner" aria-label={kicker}>
      <div className="doc-banner-image">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="doc-banner-img"
        />
        <div className="doc-banner-scrim" aria-hidden />
      </div>

      <div className="doc-banner-inner">
        <p className="doc-banner-kicker">{kicker}</p>
        <h1 className="doc-banner-title">{title}</h1>
        {subtitle ? <p className="doc-banner-subtitle">{subtitle}</p> : null}
        {lastUpdated ? (
          <p className="doc-banner-meta">
            <time>{lastUpdated}</time>
          </p>
        ) : null}
      </div>
    </header>
  );
}
```

### `apps/web/components/docs/DocTocSidebar.tsx`

Sticky sidebar (desktop only) with scroll-spy active highlight.

```tsx
"use client";

import { useCallback } from "react";
import type { DocSectionRef } from "./DocLayout";

interface DocTocSidebarProps {
  sections: readonly DocSectionRef[];
  activeId: string | null;
}

export function DocTocSidebar({ sections, activeId }: DocTocSidebarProps) {
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offsetTop = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: offsetTop, behavior: "smooth" });
  }, []);

  return (
    <nav className="doc-toc" aria-label="Съдържание">
      <p className="doc-toc-label">Съдържание</p>
      <ol className="doc-toc-list">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              data-active={activeId === section.id}
              onClick={(event) => {
                event.preventDefault();
                scrollTo(section.id);
                history.replaceState(null, "", `#${section.id}`);
              }}
            >
              {section.number !== undefined ? (
                <span className="doc-toc-num">{section.number}</span>
              ) : null}
              <span className="doc-toc-text">{section.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

### `apps/web/components/docs/DocSection.tsx`

A single section with anchor link, optional TL;DR, content slot.

```tsx
import type { ReactNode } from "react";

interface DocSectionProps {
  id: string;
  number?: number;
  title: string;
  tldr?: string;
  children: ReactNode;
}

export function DocSection({ id, number, title, tldr, children }: DocSectionProps) {
  return (
    <section id={id} className="doc-section">
      <h2 className="doc-section-title">
        <a href={`#${id}`} className="doc-section-anchor" aria-label={`Линк към „${title}“`}>
          §
        </a>
        {number !== undefined ? <span className="doc-section-num">{number}.</span> : null}
        {title}
      </h2>

      {tldr ? (
        <aside className="doc-section-tldr">
          <span className="doc-section-tldr-label">Накратко</span>
          <span>{tldr}</span>
        </aside>
      ) : null}

      <div className="doc-section-body">{children}</div>
    </section>
  );
}
```

### `apps/web/components/docs/DocBackToTop.tsx`

Floating "back to top" button (visible after scrolling > 600px).

```tsx
"use client";

import { useEffect, useState } from "react";

export function DocBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="doc-back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Към върха на страницата"
    >
      ↑
    </button>
  );
}
```

### `apps/web/components/docs/DocCallout.tsx`

Inline informational box (info/warning/note tones).

```tsx
import type { ReactNode } from "react";

interface DocCalloutProps {
  tone?: "info" | "warning" | "note";
  title?: string;
  children: ReactNode;
}

export function DocCallout({ tone = "info", title, children }: DocCalloutProps) {
  return (
    <aside className={`doc-callout doc-callout-${tone}`}>
      {title ? <p className="doc-callout-title">{title}</p> : null}
      <div className="doc-callout-body">{children}</div>
    </aside>
  );
}
```

### `apps/web/components/docs/DocSearchWithin.tsx` (FAQ only)

In-page search overlay (⌘K), used on /faq.

(Detailed implementation in Stage 5 below.)

---

## Stage 3 — `legal-modern` CSS system

Add to `apps/web/app/globals.css` (new section, after current FAQ styles):

```css
/* ============================== */
/* Legal Modern — shared chrome   */
/* ============================== */

.doc-shell {
  --doc-bg: #0d0a08;
  --doc-surface: rgba(26, 20, 16, 0.65);
  --doc-surface-strong: rgba(36, 28, 22, 0.85);
  --doc-text: #f5e8c8;
  --doc-text-muted: rgba(245, 232, 200, 0.72);
  --doc-text-soft: rgba(245, 232, 200, 0.55);
  --doc-border: rgba(245, 232, 200, 0.1);
  --doc-border-strong: rgba(245, 232, 200, 0.18);
  --doc-accent: #d19a42;
  --doc-accent-soft: rgba(209, 154, 66, 0.18);

  background: var(--doc-bg);
  color: var(--doc-text);
  font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  min-height: 100vh;
  padding-bottom: 64px;
}

.doc-shell[data-accent="privacy"] {
  --doc-accent: #3a4f7a;
  --doc-accent-soft: rgba(58, 79, 122, 0.22);
}

.doc-shell[data-accent="terms"] {
  --doc-accent: #8a6a4a;
  --doc-accent-soft: rgba(138, 106, 74, 0.22);
}

.doc-shell[data-accent="report"] {
  --doc-accent: #d94a3d;
  --doc-accent-soft: rgba(217, 74, 61, 0.18);
}

.doc-shell[data-accent="faq"] {
  --doc-accent: #d19a42;
  --doc-accent-soft: rgba(209, 154, 66, 0.18);
}

/* Banner */

.doc-banner {
  position: relative;
  width: 100%;
  height: clamp(280px, 36vw, 480px);
  overflow: hidden;
  border-bottom: 1px solid var(--doc-border);
}

.doc-banner-image {
  position: absolute;
  inset: 0;
}

.doc-banner-img {
  object-fit: cover;
  object-position: center 35%;
}

.doc-banner-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(13, 10, 8, 0.25) 0%, rgba(13, 10, 8, 0.45) 50%, rgba(13, 10, 8, 0.95) 100%),
    linear-gradient(90deg, rgba(13, 10, 8, 0.4) 0%, transparent 30%, transparent 70%, rgba(13, 10, 8, 0.4) 100%);
}

.doc-banner-inner {
  position: relative;
  z-index: 1;
  max-width: 880px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-bottom: 36px;
}

.doc-banner-kicker {
  font-size: 0.78rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--doc-accent);
  margin-bottom: 12px;
}

.doc-banner-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-weight: 900;
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1.05;
  letter-spacing: -0.015em;
  color: var(--doc-text);
  text-wrap: balance;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
  margin-bottom: 12px;
}

.doc-banner-subtitle {
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--doc-text-muted);
  max-width: 60ch;
  margin-bottom: 8px;
}

.doc-banner-meta {
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: var(--doc-text-soft);
  font-variant-numeric: tabular-nums;
}

/* Layout */

.doc-layout {
  max-width: 1240px;
  margin: 0 auto;
  padding: 48px 24px 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
}

@media (min-width: 1024px) {
  .doc-layout {
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 48px;
  }
}

/* ToC sidebar */

.doc-toc {
  display: none;
}

@media (min-width: 1024px) {
  .doc-toc {
    display: block;
    position: sticky;
    top: 104px;
    align-self: start;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    padding-right: 8px;
  }
}

.doc-toc-label {
  font-size: 0.7rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--doc-text-soft);
  margin-bottom: 12px;
}

.doc-toc-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-left: 1px solid var(--doc-border);
}

.doc-toc-list a {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 14px;
  margin-left: -1px;
  border-left: 2px solid transparent;
  color: var(--doc-text-muted);
  font-size: 0.875rem;
  line-height: 1.4;
  text-decoration: none;
  transition: color 120ms ease, border-color 120ms ease;
}

.doc-toc-list a:hover {
  color: var(--doc-text);
}

.doc-toc-list a[data-active="true"] {
  color: var(--doc-accent);
  border-left-color: var(--doc-accent);
}

.doc-toc-num {
  font-size: 0.78rem;
  color: var(--doc-text-soft);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.doc-toc-text {
  flex: 1;
}

/* Content column */

.doc-content {
  max-width: 72ch;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--doc-text);
}

.doc-content p {
  margin: 0 0 1em;
  color: var(--doc-text);
}

.doc-content ul,
.doc-content ol {
  margin: 0 0 1em;
  padding-left: 1.25em;
}

.doc-content li {
  margin: 0.35em 0;
}

.doc-content strong {
  color: var(--doc-text);
  font-weight: 700;
}

.doc-content a {
  color: var(--doc-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  transition: text-decoration-thickness 120ms ease;
}

.doc-content a:hover {
  text-decoration-thickness: 2px;
}

/* Section */

.doc-section {
  scroll-margin-top: 88px;
  padding: 32px 0;
  border-bottom: 1px solid var(--doc-border);
}

.doc-section:last-child {
  border-bottom: none;
}

.doc-section-title {
  position: relative;
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.5rem, 3vw, 1.9rem);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--doc-text);
  margin: 0 0 16px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.doc-section-num {
  font-size: 0.7em;
  color: var(--doc-text-soft);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.doc-section-anchor {
  position: absolute;
  left: -28px;
  top: 0;
  font-weight: 400;
  color: var(--doc-text-soft);
  text-decoration: none;
  opacity: 0;
  transition: opacity 160ms ease;
  font-size: 1.4rem;
}

.doc-section-title:hover .doc-section-anchor,
.doc-section-anchor:focus-visible {
  opacity: 1;
}

@media (max-width: 1024px) {
  .doc-section-anchor {
    position: static;
    margin-right: 4px;
    opacity: 0.4;
  }
}

/* TL;DR */

.doc-section-tldr {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
  margin: 0 0 20px;
  padding: 14px 18px;
  background: var(--doc-accent-soft);
  border-left: 3px solid var(--doc-accent);
  border-radius: 0 10px 10px 0;
}

.doc-section-tldr-label {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--doc-accent);
  white-space: nowrap;
}

.doc-section-tldr span:last-child {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--doc-text);
}

/* Body */

.doc-section-body p:first-child {
  margin-top: 0;
}

.doc-section-body p:last-child {
  margin-bottom: 0;
}

/* Callouts */

.doc-callout {
  margin: 1em 0;
  padding: 14px 18px;
  border-left: 3px solid var(--doc-accent);
  background: var(--doc-accent-soft);
  border-radius: 0 10px 10px 0;
}

.doc-callout-info { border-color: #6a8caf; background: rgba(106, 140, 175, 0.16); }
.doc-callout-warning { border-color: #d19a42; background: rgba(209, 154, 66, 0.18); }
.doc-callout-note { border-color: var(--doc-text-soft); background: rgba(245, 232, 200, 0.08); }

.doc-callout-title {
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--doc-accent);
  margin: 0 0 6px;
}

.doc-callout-body {
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--doc-text);
}

.doc-callout-body p:last-child { margin-bottom: 0; }

/* Back to top */

.doc-back-to-top {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--doc-border-strong);
  background: var(--doc-surface-strong);
  color: var(--doc-text);
  font-size: 1.4rem;
  cursor: pointer;
  z-index: 30;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  transition: transform 160ms ease, border-color 160ms ease;
}

.doc-back-to-top:hover {
  transform: translateY(-2px);
  border-color: var(--doc-accent);
}

@media (max-width: 768px) {
  .doc-back-to-top {
    bottom: 88px;
    right: 16px;
  }
}

/* Page footer */

.doc-page-footer {
  max-width: 880px;
  margin: 48px auto 0;
  padding: 24px;
  border-top: 1px solid var(--doc-border);
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--doc-text-soft);
}

.doc-page-footer a {
  color: var(--doc-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Print stylesheet */

@media print {
  .doc-shell {
    background: white !important;
    color: black !important;
    padding: 0 !important;
  }

  .doc-banner,
  .doc-toc,
  .doc-back-to-top,
  .doc-page-footer {
    display: none !important;
  }

  .doc-content {
    max-width: 100% !important;
    color: black !important;
  }

  .doc-section {
    break-inside: avoid;
    page-break-inside: avoid;
    border-color: #ccc !important;
  }

  .doc-section-title {
    color: black !important;
  }

  .doc-section-tldr,
  .doc-callout {
    border-color: #999 !important;
    background: #f6f6f6 !important;
    color: black !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
```

---

## Stage 4 — `/privacy` redesign

Rewrite `apps/web/app/privacy/page.tsx`. Reuse most of the existing БГ content (it's already legally serviceable), but render through `DocLayout` + `DocSection` + `DocCallout`. Add TL;DR per section.

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { DocLayout, type DocSectionRef } from "@/components/docs/DocLayout";
import { DocSection } from "@/components/docs/DocSection";
import { DocCallout } from "@/components/docs/DocCallout";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

const LAST_UPDATED = "17 май 2026";

const SECTIONS: readonly DocSectionRef[] = [
  { id: "who-we-are", title: "Кои сме ние", number: 1 },
  { id: "what-we-collect", title: "Какви данни събираме", number: 2 },
  { id: "why", title: "Защо ги пазим", number: 3 },
  { id: "sharing", title: "С кого споделяме", number: 4 },
  { id: "retention", title: "Колко дълго ги пазим", number: 5 },
  { id: "rights", title: "Твоите права", number: 6 },
  { id: "cookies", title: "Бисквитки и памет на браузъра", number: 7 },
  { id: "children", title: "Деца под 13 години", number: 8 },
  { id: "changes", title: "Промени в политиката", number: 9 },
];

export const metadata: Metadata = routeMetadata({
  title: "Поверителност | Върколак и Мафия",
  description: "Какви данни събираме, защо ги пазим и какво можеш да направиш с тях.",
  path: "/privacy",
  image: "/game-art/legal/privacy-banner.png",
  imageAlt: "Месингов сандък в полусянка",
  robots: { index: false, follow: true },
  absoluteTitle: true,
});

export default function PrivacyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Поверителност",
    inLanguage: "bg-BG",
    dateModified: "2026-05-17",
    url: absoluteUrl("/privacy"),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <DocLayout
        accent="privacy"
        banner={{
          src: "/game-art/legal/privacy-banner.webp",
          alt: "Месингов сандък в полусянка",
        }}
        kicker="политика за поверителност"
        title="Твоите тайни остават при теб."
        subtitle="Какви данни събираме, защо ги пазим, и как да упражниш правата си."
        lastUpdated={`Последна актуализация: ${LAST_UPDATED}`}
        sections={SECTIONS}
        footer={
          <>
            <span>Имаш въпрос за лични данни?</span>
            <Link href="/report">Подай сигнал →</Link>
          </>
        }
      >
        <DocSection
          id="who-we-are"
          number={1}
          title="Кои сме ние"
          tldr="Малък екип зад социална онлайн игра. Тази политика обяснява какво правим с твоите данни."
        >
          <p>
            „Върколак и Мафия“ е онлайн социална игра за стаи с приятели. Тази политика обяснява какви лични данни обработваме, защо са нужни и как можеш да упражниш правата си.
          </p>
          <p>
            За въпроси относно поверителност ползвай <Link href="/report">страницата за сигнал</Link>. Преди публичното пускане ще бъде добавен и постоянен адрес за кореспонденция.
          </p>
        </DocSection>

        <DocSection
          id="what-we-collect"
          number={2}
          title="Какви данни събираме"
          tldr="Имейл, име на масата, идентификатори от OAuth, игрова история и постижения. Нищо повече."
        >
          <p>Когато създаваш профил и играеш, обработваме:</p>
          <ul>
            <li><strong>Имейл адрес</strong> — за вход, потвърждение и нова парола.</li>
            <li><strong>Име на масата</strong> — видимо за другите играчи в стаите.</li>
            <li><strong>Данни от Google или Discord</strong> — само ако избереш вход през тях: публичен идентификатор, име и снимка.</li>
            <li><strong>Игрова история</strong> — стаи, роли, резултат, ходове и край на играта.</li>
            <li><strong>Постижения</strong> — кои са отключени и кога.</li>
            <li><strong>Сесийни данни</strong> — технически записи за вход, защита и предотвратяване на злоупотреби.</li>
          </ul>
          <DocCallout tone="info" title="Какво НЕ събираме">
            Не събираме телефон, адрес, платежни данни или чувствителни категории лични данни. Не показваме реклами. Не ползваме рекламни проследяващи системи.
          </DocCallout>
        </DocSection>

        <DocSection
          id="why"
          number={3}
          title="Защо ги пазим"
          tldr="За да работи играта, за история, за сигурност, за служебни писма."
        >
          <ul>
            <li><strong>За да работи играта</strong> — профилът те разпознава между стаи и устройства.</li>
            <li><strong>За история и постижения</strong> — класацията и архивът изискват завършени игри.</li>
            <li><strong>За сигурност</strong> — сесиите и техническите записи помагат срещу измами и автоматизирано натоварване.</li>
            <li><strong>За служебни писма</strong> — потвърждение на имейл, нова парола и важни промени.</li>
          </ul>
        </DocSection>

        <DocSection
          id="sharing"
          number={4}
          title="С кого споделяме"
          tldr="Не продаваме данни. Малък списък технически партньори по необходимост."
        >
          <p>Не продаваме данни и не показваме реклами. Технически партньори обработват ограничени данни:</p>
          <ul>
            <li><strong>ДиджиталОушън</strong> — хостинг на сървърите и базата данни в европейска среда.</li>
            <li><strong>Рисенд</strong> — системни имейли за потвърждение и нова парола.</li>
            <li><strong>Google и Discord</strong> — само ако използваш техния вход.</li>
            <li><strong>ОупънЕйАй</strong> — използван само за статични изображения преди старта, без лични данни на играчи.</li>
          </ul>
        </DocSection>

        <DocSection
          id="retention"
          number={5}
          title="Колко дълго ги пазим"
          tldr="Профил докато не го изтриеш. Сесии 30 дни. Игрова история до 24 месеца."
        >
          <ul>
            <li><strong>Профил</strong> — докато го поддържаш или докато не поискаш изтриване.</li>
            <li><strong>Сесии</strong> — до 30 дни от последна активност.</li>
            <li><strong>Игрова история</strong> — до 24 месеца, след което може да бъде анонимизирана.</li>
            <li><strong>Служебни писма</strong> — доставчикът пази технически записи за доставка за ограничен срок.</li>
          </ul>
        </DocSection>

        <DocSection
          id="rights"
          number={6}
          title="Твоите права"
          tldr="Достъп, изтегляне, изтриване, поправка, ограничаване, жалба до КЗЛД."
        >
          <p>Имаш право да:</p>
          <ul>
            <li>изтеглиш копие на данните си от <Link href="/account">твоето досие</Link>;</li>
            <li>изтриеш профила си от същата страница;</li>
            <li>поправиш името си на масата;</li>
            <li>поискаш ограничаване или възражение срещу обработка;</li>
            <li>подадеш жалба до Комисията за защита на личните данни.</li>
          </ul>
          <DocCallout tone="warning" title="Какво се случва при изтриване">
            Игрите ти остават в архива, за да не се чупи историята на другите играчи, но името ти се заменя с „Изтрит играч“, а постиженията се премахват окончателно.
          </DocCallout>
        </DocSection>

        <DocSection
          id="cookies"
          number={7}
          title="Бисквитки и памет на браузъра"
          tldr="Само технически необходими. Без реклами, без проследяване."
        >
          <p>Използваме само технически необходими бисквитки и локални настройки:</p>
          <ul>
            <li>сесийна бисквитка за вход;</li>
            <li>настройки за звук, тема и последно избрано семейство игри;</li>
            <li>маркер, че си видял въвеждащото съобщение.</li>
          </ul>
        </DocSection>

        <DocSection
          id="children"
          number={8}
          title="Деца под 13 години"
          tldr="Услугата не е за деца под 13. Родител може да поиска изтриване."
        >
          <p>
            Платформата не е предназначена за деца под 13 години. Ако родител или настойник установи, че дете е създало профил, може да поиска изтриване чрез страницата за сигнал.
          </p>
        </DocSection>

        <DocSection
          id="changes"
          number={9}
          title="Промени в политиката"
          tldr="При промени публикуваме нова дата и ще те уведомим за съществените."
        >
          <p>
            Ако променим тази политика, ще публикуваме нова дата на актуализация и при съществени промени ще уведомим потребителите през платформата или по имейл.
          </p>
        </DocSection>
      </DocLayout>
    </>
  );
}
```

**Acceptance:** Open `/privacy`. Banner takes top ~40% of screen, content column scrolls underneath. Desktop ≥ 1024px shows sticky ToC ляво. Each section has a TL;DR callout, anchor `§` появява se on hover. Click ToC item → smooth scroll + URL hash updates.

---

## Stage 5 — `/terms` redesign

Same pattern as `/privacy`. Use `accent="terms"`, banner `/game-art/legal/terms-banner.png`, 11 sections.

**File:** `apps/web/app/terms/page.tsx` — full rewrite following Privacy template.

Sections list:

```ts
const SECTIONS: readonly DocSectionRef[] = [
  { id: "acceptance", title: "Приемане на условията", number: 1 },
  { id: "age", title: "Възрастови ограничения", number: 2 },
  { id: "your-account", title: "Твоят профил", number: 3 },
  { id: "behavior", title: "Поведение в играта", number: 4 },
  { id: "ip", title: "Интелектуална собственост", number: 5 },
  { id: "user-content", title: "Съдържание от играчи", number: 6 },
  { id: "as-is", title: "Услугата във вида, в който е налична", number: 7 },
  { id: "liability", title: "Ограничаване на отговорност", number: 8 },
  { id: "termination", title: "Прекратяване на достъп", number: 9 },
  { id: "law", title: "Приложимо право", number: 10 },
  { id: "contact", title: "Контакт", number: 11 },
];
```

TL;DR per section (Codex: write one for each — short one-liner summarizing the legal point in everyday БГ):
- Acceptance → "Ако ползваш сайта, приемаш тези условия. Иначе — не го ползвай."
- Age → "13+. Под 18 — със знанието на родител."
- Your account → "Пазиш профила си. Подвеждащи имена не са позволени."
- Behavior → "Блъфът е ок. Тормоз и лични данни — не."
- IP → "Кодът, дизайнът и материалите са наши или ползваме с право."
- User content → "Имената и съобщенията ти остават твои; ние ги показваме само за работа на играта."
- As is → "Старем се да работи, но не гарантираме нула прекъсвания."
- Liability → "Не носим отговорност за косвени вреди или поведение на други играчи."
- Termination → "Можем да ограничим достъп при нарушение или риск."
- Law → "Българско право; София съдилища при спор."
- Contact → "Сигнали и въпроси през /report."

Reuse all existing БГ legal text from current `terms/page.tsx` content. Carry over verbatim.

---

## Stage 6 — `/report` modern form redesign

Replace `apps/web/app/report/page.tsx` + `apps/web/components/report/ReportClient.tsx` to use `DocLayout` + modern form patterns.

### `/report` page

```tsx
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { DocLayout } from "@/components/docs/DocLayout";
import { ReportClient } from "@/components/report/ReportClient";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Сигнал | Върколак и Мафия",
  description: "Подай сигнал за нарушение, неуместно поведение или авторски права.",
  path: "/report",
  image: "/game-art/legal/report-banner.png",
  imageAlt: "Каменен фар сред мъгла",
  robots: { index: false, follow: false },
  absoluteTitle: true,
});

export default function ReportPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Сигнал",
    inLanguage: "bg-BG",
    url: absoluteUrl("/report"),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <DocLayout
        accent="report"
        banner={{
          src: "/game-art/legal/report-banner.webp",
          alt: "Каменен фар сред мъгла",
        }}
        kicker="сигнал"
        title="Светим за тебе."
        subtitle="Ако нещо не е наред — играч с неуместно поведение, спорно съдържание или нарушение на авторски права — кажи ни. Преглеждаме сигнали в рамките на 48 часа."
        sections={[]}
        showToc={false}
      >
        <ReportClient />
      </DocLayout>
    </>
  );
}
```

### ReportClient — modern form patterns

Rewrite `apps/web/components/report/ReportClient.tsx`:

```tsx
"use client";

import { FormEvent, useId, useState } from "react";
import Link from "next/link";

type ReportType = "abuse" | "copyright" | "bug" | "other";

const TYPE_LABELS: Record<ReportType, string> = {
  abuse: "Неуместно поведение или тормоз",
  copyright: "Авторски права",
  bug: "Технически проблем",
  other: "Друго",
};

const TYPE_HINTS: Record<ReportType, string> = {
  abuse: "Тормоз, заплахи, омраза или унижение към друг играч.",
  copyright: "Съдържание, което нарушава нечии авторски права.",
  bug: "Технически проблем — нещо не работи, неочаквано поведение.",
  other: "Друго съдържание, поведение или въпрос.",
};

export function ReportClient() {
  const [type, setType] = useState<ReportType>("abuse");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const bodyId = useId();
  const emailId = useId();
  const evidenceId = useId();
  const errorBodyId = useId();
  const errorEmailId = useId();

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (body.trim().length < 20) {
      next.body = "Опиши с поне 20 символа.";
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      next.email = "Невалиден имейл.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          body: body.trim(),
          email: email.trim() || null,
          evidence: evidence.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrors({ form: data.error ?? "Грешка при изпращане." });
        setStatus("error");
        return;
      }

      setStatus("sent");
      setBody("");
      setEvidence("");
    } catch {
      setErrors({ form: "Грешка при изпращане." });
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="report-success">
        <h2>Сигналът е получен.</h2>
        <p>Преглеждаме сигнали в рамките на 48 часа. Ако си посочил имейл, ще ти отговорим.</p>
        <div className="report-success-actions">
          <Link href="/" className="btn btn-secondary">Към началото</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="report-form" onSubmit={submit} noValidate>
      {/* Type selector — segmented control instead of dropdown */}
      <fieldset className="report-type">
        <legend>За какво е сигналът?</legend>
        <div className="report-type-grid">
          {(Object.keys(TYPE_LABELS) as ReportType[]).map((key) => (
            <label key={key} className="report-type-option" data-active={type === key}>
              <input
                type="radio"
                name="report-type"
                value={key}
                checked={type === key}
                onChange={() => setType(key)}
              />
              <span className="report-type-label">{TYPE_LABELS[key]}</span>
              <span className="report-type-hint">{TYPE_HINTS[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="report-field">
        <label htmlFor={bodyId}>
          Описание
          <span className="report-field-required" aria-label="задължително">*</span>
        </label>
        <textarea
          id={bodyId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Какво се случи? Кога? Кой?"
          rows={6}
          minLength={20}
          maxLength={4000}
          required
          aria-invalid={Boolean(errors.body)}
          aria-describedby={errors.body ? errorBodyId : undefined}
        />
        <div className="report-field-foot">
          <span className="report-field-count">{body.length} / 4000</span>
          {errors.body ? <span id={errorBodyId} className="report-field-error" role="alert">{errors.body}</span> : null}
        </div>
      </div>

      <div className="report-field">
        <label htmlFor={evidenceId}>Доказателство <span className="report-field-optional">(по избор)</span></label>
        <input
          id={evidenceId}
          type="text"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Линк, код на стая, screenshot URL"
        />
      </div>

      <div className="report-field">
        <label htmlFor={emailId}>Твоят имейл <span className="report-field-optional">(по избор, за отговор)</span></label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@domain.com"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? errorEmailId : undefined}
        />
        {errors.email ? <span id={errorEmailId} className="report-field-error" role="alert">{errors.email}</span> : null}
      </div>

      {errors.form ? <p className="report-form-error" role="alert">{errors.form}</p> : null}

      <div className="report-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Изпращаме..." : "Изпрати сигнал"}
        </button>
        <Link href="/" className="report-cancel-link">Назад към началото</Link>
      </div>
    </form>
  );
}
```

### Report CSS

Add to globals.css under legal-modern section:

```css
/* ============================== */
/* Report — modern form           */
/* ============================== */

.report-form {
  display: grid;
  gap: 28px;
  max-width: 64ch;
}

.report-type {
  border: none;
  padding: 0;
  margin: 0;
}

.report-type legend {
  font-size: 0.85rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--doc-text-muted);
  margin-bottom: 12px;
}

.report-type-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

@media (min-width: 640px) {
  .report-type-grid { grid-template-columns: 1fr 1fr; }
}

.report-type-option {
  position: relative;
  display: block;
  padding: 14px 18px;
  background: var(--doc-surface);
  border: 1px solid var(--doc-border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}

.report-type-option:hover {
  border-color: var(--doc-border-strong);
}

.report-type-option[data-active="true"] {
  border-color: var(--doc-accent);
  background: var(--doc-accent-soft);
}

.report-type-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.report-type-label {
  display: block;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--doc-text);
  margin-bottom: 4px;
}

.report-type-hint {
  display: block;
  font-size: 0.82rem;
  color: var(--doc-text-soft);
  line-height: 1.45;
}

.report-field {
  display: grid;
  gap: 6px;
}

.report-field label {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--doc-text);
}

.report-field-required { color: var(--doc-accent); margin-left: 4px; }
.report-field-optional { color: var(--doc-text-soft); font-weight: 500; font-size: 0.78rem; }

.report-field input,
.report-field textarea {
  padding: 12px 14px;
  border: 1px solid var(--doc-border-strong);
  border-radius: 10px;
  background: rgba(13, 10, 8, 0.4);
  color: var(--doc-text);
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  transition: border-color 120ms ease;
}

.report-field input:focus,
.report-field textarea:focus {
  outline: none;
  border-color: var(--doc-accent);
  box-shadow: 0 0 0 3px var(--doc-accent-soft);
}

.report-field textarea { resize: vertical; min-height: 120px; }

.report-field-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
}

.report-field-count { color: var(--doc-text-soft); font-variant-numeric: tabular-nums; }
.report-field-error { color: #e57373; font-weight: 600; }

.report-form-error {
  padding: 12px 14px;
  background: rgba(217, 74, 61, 0.18);
  border-left: 3px solid #d94a3d;
  border-radius: 0 10px 10px 0;
  color: var(--doc-text);
  font-weight: 600;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
}

.report-cancel-link {
  color: var(--doc-text-soft);
  text-decoration: none;
  font-size: 0.88rem;
}

.report-cancel-link:hover {
  color: var(--doc-accent);
  text-decoration: underline;
}

.report-success {
  padding: 32px;
  background: var(--doc-accent-soft);
  border-left: 3px solid var(--doc-accent);
  border-radius: 0 14px 14px 0;
  display: grid;
  gap: 14px;
  max-width: 64ch;
}

.report-success h2 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
}

.report-success p {
  margin: 0;
  color: var(--doc-text-muted);
}

.report-success-actions {
  margin-top: 8px;
}
```

---

## Stage 7 — `/faq` modern overhaul

Bring `/faq` into the legal-modern system, while keeping all rich content / search / deep linking from earlier overhaul plan.

### `/faq` page wrapper

```tsx
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { DocLayout } from "@/components/docs/DocLayout";
import { FaqClient } from "@/components/faq/FaqClient";
import { FAQ_DATA } from "@/lib/faq-data";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Често задавани въпроси",
  description: "Отговори за геймплея, профила, техническите детайли и поверителността.",
  path: "/faq",
  image: "/game-art/legal/faq-banner.png",
  imageAlt: "Стар библиотечен каталог",
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
      acceptedAnswer: { "@type": "Answer", text: flattenAnswerForSchema(item.answer) },
    })),
  };

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <DocLayout
        accent="faq"
        banner={{
          src: "/game-art/legal/faq-banner.webp",
          alt: "Стар библиотечен каталог",
        }}
        kicker="често задавани въпроси"
        title="Шкаф с малки чекмеджета."
        subtitle="Всяко с по една карта — отвори, прочети, върни обратно."
        sections={[]}
        showToc={false}
      >
        <FaqClient items={FAQ_DATA} />
      </DocLayout>
    </>
  );
}
```

### FAQ data + client

Adopt the full **rich answer blocks + search + deep linking + helpful feedback + category color accents + tutorial deep-links** spec from `codex-prompt-faq-overhaul.md`:

- 30 questions in 5 categories (pre-game / gameplay / account / tech / privacy)
- Rich `AnswerBlock` types: tldr / paragraph / steps / bullets / callout / link-list / image
- Search bar at top with ⌘K shortcut and token highlighting
- Deep linking `/faq?q=slug`
- "Копирай линк" per question
- 👍/👎 feedback persisted to localStorage
- Inline SVG category icons (5 designs)
- Tutorial deep-link from "паритет" question

**Critical:** Replace `FaqClient`'s old brass-cabinet drawer styling with **flat modern cards** (matches new legal-modern aesthetic):

```css
/* FAQ — flat modern cards (overrides earlier brass drawer styling) */

.faq-search {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 14px;
  background: var(--doc-surface);
  border: 1px solid var(--doc-border-strong);
  border-radius: 12px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.faq-search:focus-within {
  border-color: var(--doc-accent);
  box-shadow: 0 0 0 3px var(--doc-accent-soft);
}

.faq-search-input {
  flex: 1;
  height: 48px;
  background: transparent;
  border: none;
  color: var(--doc-text);
  font-size: 1rem;
}

.faq-search-input::placeholder { color: var(--doc-text-soft); }
.faq-search-input:focus { outline: none; }

.faq-search-hotkey {
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: var(--doc-text-soft);
  background: rgba(245, 232, 200, 0.08);
  border: 1px solid var(--doc-border);
  border-radius: 4px;
  padding: 4px 8px;
}

@media (max-width: 640px) { .faq-search-hotkey { display: none; } }

.faq-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 24px;
  align-items: center;
}

.faq-tool-btn {
  padding: 6px 12px;
  background: var(--doc-surface);
  border: 1px solid var(--doc-border-strong);
  border-radius: 8px;
  color: var(--doc-text-muted);
  font-family: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.faq-tool-btn:hover { border-color: var(--doc-accent); color: var(--doc-text); }
.faq-result-count { margin-left: auto; font-size: 0.8rem; color: var(--doc-text-soft); font-style: italic; }

.faq-drawer-row {
  margin-bottom: 32px;
}

.faq-drawer-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--doc-border);
  color: var(--doc-accent);
}

.faq-category-icon { width: 22px; height: 22px; }

.faq-drawer-stack { display: grid; gap: 6px; }

.faq-drawer {
  background: var(--doc-surface);
  border: 1px solid var(--doc-border);
  border-radius: 12px;
  transition: border-color 160ms ease, background 160ms ease;
  overflow: hidden;
}

.faq-drawer[data-open="true"] {
  border-color: var(--doc-accent);
  background: var(--doc-surface-strong);
}

.faq-drawer-handle {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: none;
  color: var(--doc-text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  min-height: 56px;
}

.faq-drawer-pull { display: none; } /* drop the brass pull-ring */

.faq-drawer-title {
  flex: 1;
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.4;
}

.faq-drawer-chevron {
  width: 28px;
  height: 28px;
  border: 1px solid var(--doc-border-strong);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 600;
  color: var(--doc-accent);
  flex-shrink: 0;
  font-size: 1.1rem;
  background: rgba(13, 10, 8, 0.3);
}

.faq-drawer-card {
  padding: 0 20px 20px;
  border-top: 1px solid var(--doc-border);
  margin-top: -1px;
}

.faq-drawer-card-inner { padding-top: 16px; }

.faq-answer {
  display: grid;
  gap: 14px;
  color: var(--doc-text-muted);
  font-size: 0.95rem;
  line-height: 1.65;
}

.faq-block-tldr {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--doc-accent-soft);
  border-left: 3px solid var(--doc-accent);
  border-radius: 0 10px 10px 0;
}

.faq-block-tldr-label {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--doc-accent);
}

.faq-block-tldr-text {
  color: var(--doc-text);
  font-weight: 600;
  font-size: 0.98rem;
}

.faq-block-paragraph { color: var(--doc-text-muted); }
.faq-block-steps { display: grid; gap: 8px; list-style: none; padding: 0; }
.faq-block-steps li { display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: start; }
.faq-step-marker {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--doc-accent-soft);
  border: 1px solid var(--doc-accent);
  color: var(--doc-accent);
  font-family: "Noto Serif Display", serif;
  font-weight: 800;
  font-size: 0.92rem;
  flex-shrink: 0;
}

.faq-block-bullets { display: grid; gap: 6px; list-style: none; padding: 0; }
.faq-block-bullets li { display: grid; grid-template-columns: 14px 1fr; gap: 10px; align-items: start; }
.faq-bullet-marker {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-top: 9px;
  border-radius: 50%;
  background: var(--doc-accent);
}

.faq-block-callout {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  border-left: 3px solid;
}

.faq-block-callout-info { border-color: #6a8caf; background: rgba(106, 140, 175, 0.16); }
.faq-block-callout-warning { border-color: var(--doc-accent); background: var(--doc-accent-soft); }

.faq-block-link-list {
  padding: 12px 14px;
  background: rgba(245, 232, 200, 0.05);
  border-left: 2px solid var(--doc-border-strong);
  border-radius: 0 10px 10px 0;
}

.faq-link-list-title {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--doc-text-soft);
  margin: 0 0 6px;
}

.faq-block-link-list ul { list-style: none; padding: 0; display: grid; gap: 4px; }
.faq-link { color: var(--doc-accent); text-decoration: underline; text-underline-offset: 3px; font-weight: 500; }

.faq-block-image figure { margin: 0; display: grid; gap: 8px; }
.faq-block-image-img { width: 100%; height: auto; border-radius: 10px; }
.faq-block-image figcaption { font-size: 0.85rem; color: var(--doc-text-soft); text-align: center; font-style: italic; }

.faq-tutorial-hint {
  margin: 12px 0 0;
  padding: 10px 14px;
  background: var(--doc-accent-soft);
  border-radius: 8px;
  font-size: 0.88rem;
}

.faq-tutorial-hint a { color: var(--doc-accent); text-decoration: underline; font-weight: 600; }

.faq-drawer-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--doc-border);
}

.faq-copy-link, .faq-helpful-btn {
  background: transparent;
  border: 1px solid var(--doc-border-strong);
  border-radius: 8px;
  color: var(--doc-text-muted);
  font-family: inherit;
  font-size: 0.82rem;
  padding: 6px 12px;
  cursor: pointer;
}

.faq-copy-link:hover { border-color: var(--doc-accent); color: var(--doc-accent); }

.faq-helpful { display: flex; align-items: center; gap: 6px; }
.faq-helpful-label { font-size: 0.78rem; color: var(--doc-text-soft); margin-right: 4px; }
.faq-helpful-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 1rem;
  border-radius: 50%;
}

.faq-helpful-btn[data-active="true"] {
  border-color: var(--doc-accent);
  background: var(--doc-accent-soft);
}

.faq-highlight {
  background: var(--doc-accent-soft);
  color: var(--doc-text);
  border-radius: 2px;
  padding: 0 2px;
}

.faq-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--doc-text-soft);
  font-style: italic;
}

@media (max-width: 768px) {
  .faq-search {
    position: sticky;
    top: 80px;
    z-index: 5;
    backdrop-filter: blur(8px);
    background: rgba(13, 10, 8, 0.85);
  }
}
```

**Remove** the old `faq-hero-art`, `faq-cabinet`, `faq-head`, `faq-drawer-pull`, brass-textured `faq-drawer` rules — all superseded.

---

## Stage 8 — JSON-LD and SEO updates

Each page's metadata uses `routeMetadata()` helper (already in lib/seo.ts) with new banner OG image. JSON-LD types:

- `/privacy` → `WebPage` with `dateModified`
- `/terms` → `WebPage` with `dateModified`
- `/report` → `ContactPage`
- `/faq` → `FAQPage` with all 30 questions

OG images now point to **new banner assets** (`/game-art/legal/<page>-banner.png`). The banners are 16:9 cinematic, which works perfectly for OG sharing (Twitter/Facebook prefer 1.91:1).

---

## Stage 9 — Visual regression baselines

After implementation:

```bash
pnpm visual:update
pnpm visual
```

New baselines for:
- `/privacy` desktop + mobile
- `/terms` desktop + mobile
- `/report` desktop + mobile
- `/faq` desktop + mobile (replaces existing)

Inspect screenshots — confirm:
- Banner takes top, sticky ToC visible на desktop
- No more brass-plaque visual heaviness
- TL;DR callouts visible on every section
- Anchor `§` symbols hide until hover

Commit updated baselines.

---

## Acceptance criteria

1. **Context7 lookups documented** in `docs/legal-modern-research.md`.
2. **5 new imagen assets** generated and optimized (4 banners + 1 paritet diagram if missing).
3. **Shared design system**: `DocLayout`, `DocBanner`, `DocTocSidebar`, `DocSection`, `DocCallout`, `DocBackToTop` all in `apps/web/components/docs/`.
4. **CSS `legal-modern` block** in `globals.css` with accent color variables per `data-accent`.
5. **`/privacy` rewritten** using `DocLayout` + `DocSection` + TL;DR per section + sticky ToC.
6. **`/terms` rewritten** similar pattern, 11 sections with TL;DRs.
7. **`/report` rewritten** with `DocLayout` + modern form (segmented radio cards, floating helper text, inline validation, character counter, success state).
8. **`/faq` rewritten** using `DocLayout` (banner instead of hero art column) + retains all 30 questions / 5 categories / rich answer blocks / search / deep linking / category colors / tutorial deep-link / helpful feedback from earlier overhaul.
9. **Old brass-plaque page styles** (`.vault-*`, `.handshake-*`, `.lighthouse-*`, `.faq-cabinet`, `.faq-hero-art`) **removed** from globals.css. CSS file is leaner.
10. **Print stylesheets** work — hidden chrome, expanded content, break-inside avoid per section.
11. **Sticky ToC scroll-spy** highlights active section on desktop ≥ 1024px.
12. **Back-to-top floating button** appears after 600px scroll.
13. **Mobile**: ToC hidden, content full-width, drawer touch targets ≥ 48px on FAQ.
14. **JSON-LD** correct per page type (WebPage / ContactPage / FAQPage).
15. **Visual baselines updated**.
16. **`pnpm verify` passes** end to end.
17. **All commit messages in English**.
18. **All copy in Bulgarian**.

---

## Не пипай

- `/account`, `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email` — they remain on painterly-marketing system (brass plaque + cinematic art). Different page type.
- Game pages (`/werewolf`, `/mafia`, `/history`, `/achievements`, `/leaderboard`, `/tutorial`) — painterly heroes intact.
- Game-server, schemas, role-assignment.
- Better Auth config.
- Old painterly assets (`privacy-vault.png`, `terms-handshake.png`, `report-lighthouse.png`, `library-catalog-hero.png`) — keep for now in case referenced elsewhere. Can be deleted in follow-up cleanup PR.

---

## Verification

```bash
pnpm install
pnpm optimize:assets
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm smoke
pnpm frontend:e2e
E2E_LOCAL_ONLY=true pnpm e2e:auth
pnpm playtest
pnpm visual:update
pnpm visual
pnpm perf:budget
```

Manual checks:

1. **`/privacy`** desktop ≥ 1024px:
   - Banner top with title + last-updated
   - Sticky ToC ляво, 9 items with current section highlighted as scroll
   - Click ToC item → smooth scroll + URL hash updates
   - Hover section title → `§` anchor appears
   - TL;DR callout visible on each section
   - Back-to-top button appears after scroll > 600px

2. **`/privacy`** mobile < 1024px:
   - No sticky ToC
   - Banner + content stack vertically
   - All TL;DRs visible

3. **`/terms`** desktop + mobile:
   - Same chrome as Privacy but with handshake banner and earth-brown accent
   - 11 sections with TL;DRs

4. **`/report`**:
   - Lighthouse banner, ember-red accent
   - Type segmented radio cards (4 options) with hint text
   - Textarea с character counter (X / 4000)
   - Inline validation errors next to fields with `aria-invalid`
   - Success state shows after submit

5. **`/faq`**:
   - Library banner, amber accent
   - Search bar focused with ⌘K
   - Type "паритет" → filters to 1 result with highlighted token
   - Click question → opens flat card (no brass texture)
   - URL updates to `?q=paritet-rule`
   - "Копирай линк" copies full URL
   - 👍/👎 persisted to localStorage
   - "Виж в Tutorial → сцена 5" link works on paritet question

6. **Print preview** on any page → clean white, expanded sections, no chrome.

---

## Commit strategy (18 atomic English commits)

Branch: `feat/legal-modern-system`

1. `docs(research): context7 findings for legal modern overhaul`
2. `chore(art): generate cinematic banner assets for /privacy /terms /report /faq`
3. `chore(art): generate paritet diagram for FAQ`
4. `feat(docs): shared DocLayout component with sticky ToC and scroll-spy`
5. `feat(docs): DocBanner DocSection DocCallout DocBackToTop primitives`
6. `style(docs): legal-modern CSS with per-page accent palette`
7. `feat(privacy): rewrite using DocLayout with TL;DR per section`
8. `feat(terms): rewrite using DocLayout with TL;DR per section`
9. `feat(report): rewrite with modern form patterns and DocLayout`
10. `feat(faq): switch to DocLayout banner chrome and flat card drawers`
11. `feat(faq): rich answer blocks with tldr steps bullets callouts`
12. `feat(faq): search bar with token highlighting and Cmd K shortcut`
13. `feat(faq): deep linking via slug with copy-link and helpful feedback`
14. `feat(faq): inline category icons and tutorial deep-link from paritet`
15. `chore(css): remove obsolete vault handshake lighthouse FAQ cabinet rules`
16. `feat(seo): per-route OG metadata and JSON-LD for legal modern pages`
17. `style(docs): print stylesheet for legal modern pages`
18. `chore(visual): regenerate baselines for privacy terms report faq`

PR title: `feat: modern editorial reader system for legal and FAQ pages`

PR body should:
- Note that game/marketing pages stay on painterly system; only utility pages migrate.
- Note that this **replaces** the earlier `codex-prompt-faq-overhaul.md` design.
- Link to before/after screenshots showing visual transition.
- Note new env need: none.

---

(End of prompt)
