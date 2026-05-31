# Codex prompt — PR M17: /leaderboard Printer's Press identity polish

**Scope**: inject "Печатница на масата" personality into `/leaderboard`. Currently the page has newspaper concept structurally (Masthead, MainHeadline, RanksColumn, Classifieds) but visually it's a hybrid: dark cinematic Masthead floating above light parchment newspaper-page. Target: physical evening newspaper printed after games, integrated top-fold, halftone portraits, newspaper section voices, paper aging.

**Effort**: ~3.5 hours, 10 atomic commits (Commit 0 optional imagegen).

**Goal**: opening `/leaderboard` feels like **reading an evening newspaper** printed after last night's games — letterpress masthead, woodcut headline portrait, editorial flourishes, "ОБЯВИ ОТ МАСАТА" classifieds, "ВРЕМЕТО НА МАСАТА" sidebar. Currently it's "newspaper-styled list".

**Scope LIMIT**: `/leaderboard` only. No other routes affected. `MainHeadline`, `Masthead`, `RanksColumn`, `ClassifiedsList`, `SecondaryStories`, `NewspaperEmpty` components keep their data flow — only visual treatments + small JSX additions for new sections.

---

## Operating rules (inherit v2 conservative)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. Revert if red.
2. Visual diff review manually before `pnpm visual --update-snapshots`.
3. **NO `:global()` selectors overriding primitive identity.** Anti-pattern guard stays FAIL.
4. **NO new dependencies.** No new fonts. No Motion imports. Motion file count stays 3.
5. **NO `prefers-reduced-motion` guards.** Project convention.
6. **Bulgarian copy CHANGES expected** in Commits 4 + 7 + 8 — new section labels, bylines, supporting sections, empty state subtitle. `bg-copy-reviewer` agent MUST run after each copy-touching commit.
7. **Sacred files frozen** — primitives' existing API, game-server, play-room-client, headline portrait image (no new portrait assets, just CSS treatment).
8. **Scope LIMITED**: `apps/web/components/leaderboard/*` + `apps/web/app/leaderboard/page.tsx` body backdrop + `apps/web/lib/leaderboard-headlines.ts` if helper additions needed.
9. **Mobile + dark + light theme verified** per commit. Note: newspaper is fundamentally a **light artifact** — dark theme should not invert paper; only modulate ambient frame.
10. **Imagegen optional** — see Commit 0. Sample-first workflow strict.
11. **`bg-copy-reviewer` mandatory** for Commits 4, 7, 8 (new Bulgarian visible text).

---

## Pre-flight context

```bash
# Verify M14/M15/M16 baseline state intact
test -f apps/web/components/leaderboard/NewspaperPage.tsx && echo "✓ newspaper structure intact"
test -f apps/web/components/leaderboard/Masthead.tsx && echo "✓ masthead component exists"
test -f apps/web/components/leaderboard/MainHeadline.tsx && echo "✓ main headline exists"

# Current art token target (sanity)
grep -nE "art-leaderboard" apps/web/app/globals.css | head -5

# Available portrait asset (kept, only CSS-treated)
ls apps/web/public/game-art/leaderboard-headline-portrait.* 2>&1

# Verify fixture mode for development testing
grep -nE "LEADERBOARD_NEWSPAPER_FIXTURE" apps/web/app/leaderboard/page.tsx

# Baseline invariants
rg ":global\(.*\.(paper-card|scene-card|pill|medallion|surface)" apps/web | wc -l   # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l               # MUST be 3
pnpm regression 2>&1 | tail -3                                                         # green

# Visual baseline state (for diff context)
ls apps/web/__visual__ 2>&1 | grep -i leaderboard
```

Document deviations in PR description.

---

## Design philosophy (creative direction)

`/leaderboard` is **a physical evening newspaper** printed after the previous game session. Not a "leaderboard with newspaper aesthetic". Not a "ranking scoreboard". A **real newspaper** users hold in their hands.

The user feels: *"чета снощния вестник, виждам имената от масата"*, not *"гледам ranking list"*.

| Element | Now | Target |
|---|---|---|
| Body backdrop | Dark with stretched portrait | Printer's workshop / newspaper office (imagegen or CSS-only) with subtle drift |
| Masthead | Dark cinematic SceneCard | Integrated parchment top fold — letterpress title, ink-stamp issue number, ornamental rules |
| Headline portrait | Generic silhouette image stretched | Same image with CSS halftone + paper-grain overlay (woodcut/newspaper print) |
| Section labels | "Класирани", "Класифицирани · рангове 9–18" | "ИЗ КЛАСИРАНИТЕ", "ОБЯВИ ОТ МАСАТА" — newspaper voice |
| Body typography | Plain text | + bylines, pull quotes, dropcaps continuity |
| Section dividers | Plain double rule | Printer's marks (●─◆─●), editorial flourishes |
| Paper aging | None | Crease line, ink smudges, edge shadows |
| Sidebar sections | None | "ВРЕМЕТО НА МАСАТА" stat box, "ТЪРСИ СЕ" classified-style CTA |
| Empty state | Generic EmptyState | Custom "Печатницата чака" — empty press visual + evocative copy |
| Motion | Static | Subtle 80s ambient drift on body bg |

---

## Commits

### Commit 0 — OPTIONAL: Imagegen printer's press body backdrop (sample-first)

**Skip this commit if**:
- After Commit 1 (CSS-only atmospheric body bg) feels rich enough
- User wants to ship M17 without imagegen iteration

**Execute this commit if**:
- After Commits 1-3 land, body backdrop still feels generic
- Imagery would add meaningful "print shop atmosphere"

**Workflow** (sample-first, strict — same pattern as M16 Commit 0):

```bash
# 1. Generate 3 variants to TEMPORARY dir, do NOT commit yet
mkdir -p /tmp/m17-imagegen-samples

# 2. Use /imagegen skill — paste prompt:
```

**Imagegen prompt** (paste verbatim):
> "Bulgarian folk-style evening print shop interior at warm candle light, wooden type cases on the walls, ink wells and quill on a worn workbench, fresh newspaper drying on lines above, soft ink smudges on parchment surfaces, golden-hour glow through narrow window, painterly premium board-game key art, no people, no text, no logos, no UI, central negative space for newspaper foreground overlay."

```bash
# 3. Save 3 variants:
# /tmp/m17-imagegen-samples/press-v1.png
# /tmp/m17-imagegen-samples/press-v2.png
# /tmp/m17-imagegen-samples/press-v3.png

# 4. Show variants to user for selection (DO NOT commit any to repo yet)
```

**User selects** preferred variant. ONLY after explicit user pick, copy to repo:

```bash
mkdir -p apps/web/public/game-art/leaderboard
cp /tmp/m17-imagegen-samples/press-vN.png \
   apps/web/public/game-art/leaderboard/bg-press-workshop-v1.png

# Optimize through existing pipeline
pnpm optimize:assets

# Add new token alongside existing --art-leaderboard (don't replace — see below)
```

Add to `apps/web/app/globals.css`:

```diff
 :where(:root, [data-ds]) {
   /* existing tokens */
   --art-leaderboard: image-set(url("/game-art/leaderboard-headline-portrait.webp") type("image/webp"), url("/game-art/leaderboard-headline-portrait.png") type("image/png"));
+  --art-leaderboard-press: image-set(
+    url("/game-art/leaderboard/bg-press-workshop-v1.webp") type("image/webp"),
+    url("/game-art/leaderboard/bg-press-workshop-v1.png") type("image/png")
+  );
 }

 @media (max-width: 720px) {
+  --art-leaderboard-press: image-set(
+    url("/game-art/mobile/leaderboard/bg-press-workshop-v1.webp") type("image/webp")
+  );
 }
```

**Important**: keep `--art-leaderboard` (portrait) intact. The new `--art-leaderboard-press` is for body bg only. They serve different purposes:
- `--art-leaderboard` → headline portrait (existing)
- `--art-leaderboard-press` → printer's workshop body backdrop (new)

**Commit message** (only if executed):
```
feat(leaderboard): add selected printer's press body backdrop art

Sample-first imagegen workflow: 3 variants generated, user picked
preferred. New --art-leaderboard-press token added; existing
--art-leaderboard portrait token preserved for headline use.
Optimized through pipeline. Used by Commit 1 body backdrop rule.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm perf:budget  # verify new asset within bundle/asset budgets
```

---

### Commit 1 — Full-bleed body backdrop + ambient drift

**Goal**: `/leaderboard` page bg becomes atmospheric like `/werewolf`, `/mafia`, `/history`, `/achievements`. Currently `.newspaper-shell::before` uses portrait image stretched + heavy dark gradient — feels wrong.

**File**: `apps/web/components/leaderboard/Leaderboard.module.css` (current `:global(.newspaper-shell::before)` rule needs rewrite)

Replace existing `:global(.newspaper-shell::before)` rule:

```diff
-:global(.newspaper-shell::before) {
-  position: fixed;
-  inset: 0;
-  z-index: -1;
-  background:
-    radial-gradient(ellipse at 18% 16%, rgba(132, 47, 43, 0.2), transparent 34rem),
-    radial-gradient(ellipse at 86% 22%, rgba(200, 154, 85, 0.16), transparent 38rem),
-    linear-gradient(115deg, rgba(8, 8, 8, 0.94), rgba(26, 16, 12, 0.82) 44%, rgba(8, 9, 9, 0.96)),
-    var(--art-leaderboard) center / cover no-repeat;
-  content: "";
-}
```

ADD body-level backdrop in `apps/web/app/globals.css` (alongside existing body backdrop rules):

```diff
 body:has(.landing-shell)::before,
 body:has(.lobby-shell)::before,
 body:has(.history-shell)::before,
 body:has(.game-home-shell)::before,
 body:has(.rules-shell)::before,
 body:has(.achievement-shell)::before,
+body:has(.newspaper-shell)::before,
 body:has(.utility-shell)::before {
   position: absolute;
   inset: -4vh -4vw;
   display: block;
   z-index: -2;
   background: var(--page-art, var(--art-landing)) center / cover no-repeat;
   animation: ambient-drift 48s ease-in-out infinite alternate;
   transform: translate3d(-1%, 0, 0) scale(1.035);
   will-change: transform;
 }

 .newspaper-shell {
+  --page-art: var(--art-leaderboard-press, var(--art-landing));  /* fallback if Commit 0 skipped */
+  z-index: 0;
+  isolation: isolate;
 }

 /* Light theme: brighter brass tone */
 html[data-theme="light"] body:has(.newspaper-shell)::before {
   filter: saturate(0.92) brightness(1.04) sepia(0.08);
   animation: ambient-drift-light 80s ease-in-out infinite alternate;
 }

 /* Dark theme: deeper warmth */
 html[data-theme="dark"] body:has(.newspaper-shell)::before {
   display: block;
   filter: saturate(0.95) brightness(0.85) sepia(0.04);
 }

 /* Center vignette focusing newspaper page */
 body:has(.newspaper-shell)::after {
   display: block;
   position: fixed;
   inset: 0;
   z-index: -1;
   pointer-events: none;
   background: radial-gradient(
     ellipse 72vw 60vh at 50% 38%,
     transparent 0%,
     oklch(0.08 0.012 60 / 0.20) 55%,
     oklch(0.08 0.012 60 / 0.62) 100%
   );
 }

 html[data-theme="light"] body:has(.newspaper-shell)::after {
   background: radial-gradient(
     ellipse 72vw 60vh at 50% 38%,
     transparent 0%,
     oklch(0.94 0.022 78 / 0.22) 55%,
     oklch(0.94 0.022 78 / 0.62) 100%
   );
 }
```

**`.newspaper-shell` container** (in module CSS) — soften dark backdrop, page itself remains parchment:

```diff
 :global(.newspaper-shell) {
   display: grid;
   place-items: start center;
   width: min(1180px, 94vw);
   min-height: auto;
   margin: 24px auto 96px;
-  border: 1px solid rgba(245, 232, 200, 0.14);
-  border-radius: 28px;
   padding: clamp(16px, 2.4vw, 32px);
-  background: rgba(17, 12, 10, 0.9);
-  box-shadow:
-    0 32px 60px rgba(0, 0, 0, 0.45),
-    inset 0 1px 0 rgba(245, 232, 200, 0.08);
+  background: transparent;  /* body backdrop shows through */
   z-index: 0;
   isolation: isolate;
 }
```

The `.newspaper-shell` becomes layout container only — the newspaper page itself (`.newspaper-page`) keeps its parchment.

**Commit message**:
```
feat(leaderboard): full-bleed printer's press body bg with ambient drift

Newspaper page now joins /werewolf, /mafia, /history, /achievements
atmospheric depth. Body ::before renders --art-leaderboard-press
(if Commit 0 ran) or --art-landing fallback, with drift animation
matching landing/lobby cadence (80s in light theme). Vignette
focuses center. Newspaper-shell becomes transparent layout container;
.newspaper-page parchment surface remains unchanged.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "leaderboard"
# Manual: press workshop visible behind newspaper page; newspaper page floats on it cleanly
```

---

### Commit 2 — Integrate Masthead into newspaper page (remove dark SceneCard)

**Goal**: Masthead stops being separate dark cinematic SceneCard. Becomes **inline newspaper top fold** with parchment, letterpress title, ink-stamp issue number.

**File**: `apps/web/components/leaderboard/Masthead.tsx` + `Leaderboard.module.css`

Replace SceneCard-based Masthead:

```diff
 import { Display, SceneCard } from "@werewolf/ui/server";
 import { formatNewspaperDate, issueNumber } from "@/lib/leaderboard-headlines";

 export function Masthead({ issueCount }: { issueCount: number }) {
   const today = new Date();

   return (
-    <header className="leaderboard-hero-frame">
-      <SceneCard
-        eyebrow="ВЕЧЕРЕН БРОЙ"
-        density="lg"
-        background={{
-          image: "var(--art-leaderboard)",
-          overlay: "scrim",
-          focalX: 42,
-          minHeight: "var(--ds-scene-hero-min-standard)",
-        }}
-      >
-        <div className="masthead masthead-primitive">
-          <div className="masthead-ornament" aria-hidden="true">...</div>
-          <Display size="hero">Вечерен Брой на Масата</Display>
-          <p className="masthead-meta">
-            Брой № {issueNumber(issueCount)} · {formatNewspaperDate(today)} · Издание след игра
-          </p>
-          <div className="masthead-ornament" aria-hidden="true">...</div>
-        </div>
-      </SceneCard>
-    </header>
+    <header className="newspaper-masthead">
+      <div className="newspaper-masthead-eyebrow" aria-hidden>
+        <span className="newspaper-masthead-eyebrow-rule" />
+        <span>ВЕЧЕРЕН БРОЙ</span>
+        <span className="newspaper-masthead-eyebrow-rule" />
+      </div>
+      <h1 className="newspaper-masthead-title">Вечерен Брой на Масата</h1>
+      <div className="newspaper-masthead-meta">
+        <span className="newspaper-masthead-meta-left">
+          {formatNewspaperDate(today)}
+        </span>
+        <span className="newspaper-masthead-meta-divider" aria-hidden>◆</span>
+        <span className="newspaper-masthead-meta-right">Издание след игра</span>
+      </div>
+      <div className="newspaper-masthead-stamp" aria-hidden>
+        <span className="newspaper-masthead-stamp-line-1">БРОЙ</span>
+        <strong className="newspaper-masthead-stamp-line-2">№ {issueNumber(issueCount)}</strong>
+      </div>
+    </header>
   );
 }
```

CSS in `Leaderboard.module.css`:

```css
:global(.newspaper-masthead) {
  position: relative;
  display: grid;
  place-items: center;
  gap: 12px;
  margin-bottom: clamp(28px, 4vw, 48px);
  padding-bottom: 22px;
  border-bottom: 4px double oklch(0.18 0.014 50);
  text-align: center;
  color: oklch(0.18 0.014 50);
}

:global(.newspaper-masthead-eyebrow) {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  color: oklch(0.45 0.06 50);
  font-family: ui-monospace, "Cascadia Mono", monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

:global(.newspaper-masthead-eyebrow-rule) {
  display: block;
  width: 32px;
  height: 1px;
  background: oklch(0.45 0.06 50);
}

:global(.newspaper-masthead-title) {
  margin: 0;
  font-family: "Noto Serif Display", "Noto Serif", "Times New Roman", serif;
  font-size: clamp(2rem, 5.5vw, 4.2rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  /* Letterpress text shadow stack */
  text-shadow:
    0 1px 0 oklch(1 0 0 / 0.5),
    0 -1px 0 oklch(0 0 0 / 0.25),
    1px 1px 2px oklch(0 0 0 / 0.15);
}

:global(.newspaper-masthead-meta) {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  font-family: "Noto Serif", serif;
  font-size: 0.92rem;
  font-style: italic;
  color: oklch(0.32 0.04 50);
}

:global(.newspaper-masthead-meta-divider) {
  font-size: 0.6rem;
  color: oklch(0.55 0.08 65);
  font-style: normal;
}

/* Ink-stamp issue number — rotated, top-right corner */
:global(.newspaper-masthead-stamp) {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  gap: 2px;
  width: 88px;
  height: 88px;
  padding: 12px;
  border: 2px solid oklch(0.50 0.155 25 / 0.62);
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 30%,
    oklch(0.94 0.022 78 / 0.88),
    oklch(0.86 0.035 75 / 0.55) 70%
  );
  transform: rotate(-6deg);
  color: oklch(0.42 0.155 25);
  font-family: "Noto Serif Display", "Noto Serif", serif;
  text-align: center;
  pointer-events: none;
}

:global(.newspaper-masthead-stamp-line-1) {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

:global(.newspaper-masthead-stamp-line-2) {
  font-size: 1.02rem;
  font-weight: 900;
  line-height: 1;
}

/* Mobile adjustments */
@media (max-width: 640px) {
  :global(.newspaper-masthead-stamp) {
    top: -8px;
    right: -8px;
    width: 64px;
    height: 64px;
    padding: 8px;
    transform: rotate(-8deg);
  }
  :global(.newspaper-masthead-stamp-line-2) {
    font-size: 0.82rem;
  }
  :global(.newspaper-masthead-eyebrow-rule) {
    width: 20px;
  }
}
```

**Remove existing `.masthead`, `.masthead-primitive`, `.masthead-ornament` rules** in Leaderboard.module.css (dead CSS sweep per PR A delete protocol):

```bash
# Sanity check before delete
for cls in masthead masthead-primitive masthead-ornament masthead-meta; do
  hits=$(grep -rE "(className=\"[^\"]*${cls}|className=\\\`[^\\\`]*${cls})" apps/web --include="*.tsx" | wc -l)
  echo "$cls: $hits live refs"
done
# Expect: 0 after JSX update
```

Delete dead rules; preserve any wider rules that still serve newspaper-page.

**Commit message**:
```
refactor(leaderboard): integrate masthead into newspaper page

Masthead drops dark SceneCard chrome and becomes inline newspaper
top fold: letterpress title with text-shadow stack, italic Bulgarian
date center, rotated ink-stamp issue number in top-right corner,
double-rule editorial border underneath. Reads as one continuous
newspaper document — no more "hero + body" visual whiplash.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "leaderboard"
# Manual: masthead now part of newspaper page, ink stamp visible in corner
```

---

### Commit 3 — Halftone/woodcut headline portrait treatment

**Goal**: existing `leaderboard-headline-portrait.webp` stays as the image asset, but receives **CSS halftone overlay + paper-grain mask** giving it newspaper-print woodcut feel.

**File**: `apps/web/components/leaderboard/MainHeadline.tsx` + `Leaderboard.module.css`

JSX update — wrap Image in halftone container:

```diff
 <figure className="headline-portrait">
-  <Image
-    src="/game-art/leaderboard-headline-portrait.webp"
-    alt=""
-    width={512}
-    height={683}
-    sizes="(max-width: 768px) 70vw, 512px"
-    priority
-    className="headline-portrait-img"
-  />
+  <div className="headline-portrait-wrap">
+    <Image
+      src="/game-art/leaderboard-headline-portrait.webp"
+      alt=""
+      width={512}
+      height={683}
+      sizes="(max-width: 768px) 70vw, 512px"
+      priority
+      className="headline-portrait-img"
+    />
+    <div className="headline-portrait-halftone" aria-hidden />
+  </div>
   <figcaption className="headline-portrait-caption">«Силуетът, който масата вече разпознава.»</figcaption>
 </figure>
```

CSS in `Leaderboard.module.css`:

```css
:global(.headline-portrait-wrap) {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  /* Heavy paper-print border */
  border: 1px solid oklch(0.32 0.04 50 / 0.6);
  box-shadow:
    inset 0 0 0 1px oklch(1 0 0 / 0.35),
    0 2px 4px oklch(0 0 0 / 0.18);
}

:global(.headline-portrait-img) {
  display: block;
  width: 100%;
  height: auto;
  /* Apply mild newsprint filter to the image itself */
  filter: contrast(1.08) saturate(0.78) sepia(0.18) brightness(0.96);
}

/* Halftone dot overlay — multiplied, creates newspaper print feel */
:global(.headline-portrait-halftone) {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(
      oklch(0.18 0.014 50 / 0.22) 0.7px,
      transparent 1px
    );
  background-size: 3px 3px;
  background-position: 0 0;
  mix-blend-mode: multiply;
  opacity: 0.65;
}

/* Paper grain noise overlay using existing inline SVG noise pattern */
:global(.headline-portrait-wrap)::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/%3E%3CfeColorMatrix values='0 0 0 0 0.18 0 0 0 0 0.12 0 0 0 0 0.05 0 0 0 0.18 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  mix-blend-mode: multiply;
  opacity: 0.55;
  pointer-events: none;
}

/* Ink bleed corners (very subtle) */
:global(.headline-portrait-wrap)::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 0% 0%, oklch(0.18 0.014 50 / 0.18) 0%, transparent 18%),
    radial-gradient(circle at 100% 100%, oklch(0.18 0.014 50 / 0.14) 0%, transparent 22%);
  pointer-events: none;
}

/* Light theme: slightly less aggressive overlays */
:global(html[data-theme="light"] .headline-portrait-halftone) {
  opacity: 0.55;
}
```

**Commit message**:
```
style(leaderboard): halftone newspaper print on headline portrait

Existing portrait silhouette image now wrapped with CSS overlays
that simulate newspaper print: tight halftone dot pattern
(multiplied), paper grain noise (SVG turbulence), ink bleed
corners. Image filter applies sepia + contrast lift giving period
photogravure feel. No new image asset — pure CSS treatment.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "leaderboard"
# Manual: portrait reads as old newspaper print, not stock photo
```

---

### Commit 4 — Newspaper section labels + bylines + pull quotes

**Goal**: section titles, ranking columns, and classifieds adopt **newspaper-voice copy**. Add bylines under headlines, pull quotes inside main story, editorial flourishes.

**Files**:
- `apps/web/components/leaderboard/MainHeadline.tsx`
- `apps/web/components/leaderboard/SecondaryStories.tsx`
- `apps/web/components/leaderboard/RanksColumn.tsx`
- `apps/web/components/leaderboard/ClassifiedsList.tsx`
- `apps/web/components/leaderboard/Leaderboard.module.css`

**JSX rename — section titles**:

```diff
 // RanksColumn.tsx
-<h3 className="ranks-column-title">Класирани</h3>
+<h3 className="ranks-column-title">Из класираните</h3>
+<p className="ranks-column-subtitle">Имена, които вече знаят масата.</p>
```

```diff
 // ClassifiedsList.tsx
-<h3 className="classifieds-title">
-  Класифицирани · рангове {startRank}–{startRank + entries.length - 1}
-</h3>
+<h3 className="classifieds-title">Обяви от масата</h3>
+<p className="classifieds-subtitle">
+  Кратки имена · рангове {startRank}–{startRank + entries.length - 1}
+</p>
```

**MainHeadline — add byline + pull quote** (extracted from existing data):

```diff
 export function MainHeadline({ entry }: { entry: LeaderboardEntry }) {
   const headline = headlineFor(entry, 1);
   const quote = flavorQuoteFor(entry, 1);

   return (
     <section className="headline-main" aria-label="Главна новина">
-      <p className="headline-kicker">главна новина</p>
+      <p className="headline-kicker">главна новина · от снощи</p>
       <div className="headline-main-title">
         <Display size="h2" as="h2">
           {headline}
         </Display>
       </div>
+      <p className="headline-byline">Подпис: от архива на масата</p>
       ...
```

CSS additions in `Leaderboard.module.css`:

```css
:global(.headline-byline) {
  margin: 4px 0 16px;
  font-family: "Noto Serif", serif;
  font-style: italic;
  font-size: 0.86rem;
  color: oklch(0.42 0.04 50);
}

:global(.ranks-column-subtitle),
:global(.classifieds-subtitle) {
  margin: 4px 0 14px;
  font-family: "Noto Serif", serif;
  font-style: italic;
  font-size: 0.84rem;
  color: oklch(0.42 0.04 50);
}

/* Pull quote inside main headline body — make existing .headline-lede more pronounced */
:global(.headline-lede) {
  position: relative;
  padding-left: 18px;
  margin-bottom: 18px;
  border-left: 3px solid oklch(0.45 0.06 50);
  font-family: "Noto Serif", serif;
  font-style: italic;
  font-size: 1.06rem;
  line-height: 1.55;
  color: oklch(0.18 0.014 50);
}

:global(.headline-dropcap) {
  /* enrich existing dropcap with newspaper letterpress */
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 3.4rem;
  font-weight: 900;
  line-height: 0.86;
  margin: 0 6px 0 0;
  float: left;
  color: oklch(0.18 0.014 50);
  text-shadow:
    0 1px 0 oklch(1 0 0 / 0.4),
    0 -1px 0 oklch(0 0 0 / 0.15);
}

/* Secondary story bylines */
:global(.secondary-story) {
  position: relative;
}

:global(.secondary-story)::before {
  content: "Подпис: от снощната маса";
  display: block;
  margin: 2px 0 8px;
  font-family: "Noto Serif", serif;
  font-style: italic;
  font-size: 0.78rem;
  color: oklch(0.45 0.04 50);
}
```

**Bulgarian copy review** — invoke `bg-copy-reviewer` agent after this commit to verify:
- „Из класираните" (acceptable; matches dictionary spec)
- „Обяви от масата" (acceptable; thematic)
- „Имена, които вече знаят масата" (acceptable; flavorful)
- „Кратки имена · рангове X–Y" (acceptable)
- „Подпис: от архива на масата" (acceptable; newspaper byline)
- „Подпис: от снощната маса" (acceptable)
- „главна новина · от снощи" (acceptable; existing + suffix)

If `bg-copy-reviewer` flags any phrase as awkward, refine before next commit.

Run `pnpm check:dict` — must remain at 0 hard warnings.

**Commit message**:
```
feat(leaderboard): newspaper-voice section labels with bylines and pull quotes

Section titles adopt newspaper editorial voice:
- "Класирани" → "Из класираните" (with subtitle)
- "Класифицирани · рангове X–Y" → "Обяви от масата" (with subtitle)
- "главна новина" → "главна новина · от снощи"

Main headline gains italic byline ("Подпис: от архива на масата")
and richer pull quote border. Dropcap gets letterpress text-shadow.
Secondary stories gain pseudo-element bylines. New Bulgarian text
reviewed via bg-copy-reviewer.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm check:dict  # MUST stay 0 hard warnings
pnpm visual --grep "leaderboard"
# Manual: section labels read as newspaper voice, bylines visible, pull quote bordered
# Invoke bg-copy-reviewer agent on this commit
```

---

### Commit 5 — Editorial flourishes (printer's marks between sections)

**Goal**: Plain double-rule section dividers gain **printer's marks** between them (●─◆─●), giving newspaper editorial feel.

**File**: `apps/web/components/leaderboard/Leaderboard.module.css`

```css
/* Printer's mark between sections — decorative pseudo-element */
:global(.newspaper-page > section)::before {
  content: "● ─ ◆ ─ ●";
  display: block;
  text-align: center;
  font-size: 0.62rem;
  letter-spacing: 0.4em;
  color: oklch(0.55 0.08 65);
  margin: 0 auto 18px;
  width: max-content;
  padding: 0 12px;
}

/* First section (headline) has no mark — masthead provides the divider */
:global(.newspaper-page > section:first-of-type)::before {
  display: none;
}

/* Light theme: brass tone for marks */
:global(html[data-theme="light"] .newspaper-page > section)::before {
  color: oklch(0.50 0.10 65);
}
```

**Special case**: `RanksColumn` and `ClassifiedsList` are `<section>` elements. Marks appear above each. Verify visual rhythm:

```bash
pnpm visual --grep "leaderboard"
# Manual: marks appear between sections, not stacked
```

If marks feel too frequent on long pages, scope them only between `.secondary-stories`, `.ranks-column`, `.classifieds` (not above `.headline-main`):

```css
/* Alternative scoping */
:global(.secondary-stories)::before,
:global(.ranks-column)::before,
:global(.classifieds)::before {
  /* same printer's mark rule */
}
```

Pick whichever pattern looks better visually.

**Commit message**:
```
style(leaderboard): printer's marks between newspaper sections

Decorative ● ─ ◆ ─ ● pattern in brass tone appears between
secondary stories, ranks column, and classifieds. Editorial flair
suggesting hand-set typography between articles. Light theme
uses brass tone; dark theme adjusts contrast.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "leaderboard"
# Manual: marks visible, not overwhelming, mobile scales
```

---

### Commit 6 — Paper aging details (crease, smudges, edges)

**Goal**: `.newspaper-page` gets **physical paper aging cues** — crease line, ink smudges in corners, edge shadows.

**File**: `apps/web/components/leaderboard/Leaderboard.module.css`

```css
/* Add to existing .newspaper-page rule or as new layer */
:global(.newspaper-page) {
  position: relative;
  /* existing background + box-shadow rules stay */
}

/* Horizontal crease line at ~46% down — subtle fold hint */
:global(.newspaper-page)::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 46%;
  height: 28px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    oklch(0.18 0.014 50 / 0.06) 50%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 0;
}

/* Ink smudges — bottom corners radial gradients */
:global(.newspaper-page)::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      circle at 4% 96%,
      oklch(0.18 0.014 50 / 0.18) 0%,
      transparent 12%
    ),
    radial-gradient(
      circle at 96% 8%,
      oklch(0.18 0.014 50 / 0.14) 0%,
      transparent 10%
    );
  pointer-events: none;
  z-index: 1;
}

/* Edge shadow — slight darker tone at paper edges */
:global(.newspaper-page) {
  /* existing box-shadow extended */
  box-shadow:
    0 24px 60px oklch(0 0 0 / 0.55),
    inset 0 0 0 1px oklch(0.30 0.04 50 / 0.35),
    inset 0 0 40px oklch(0.32 0.045 50 / 0.18);  /* NEW — paper edge tint */
}
```

**Mobile**: simplify smudges (one corner only, reduce GPU cost):

```css
@media (max-width: 640px) {
  :global(.newspaper-page)::after {
    display: none;  /* crease line not needed on mobile single-column */
  }
  :global(.newspaper-page)::before {
    background: radial-gradient(
      circle at 96% 4%,
      oklch(0.18 0.014 50 / 0.14) 0%,
      transparent 14%
    );
  }
}
```

**Commit message**:
```
style(leaderboard): paper aging — crease line, ink smudges, edge shadows

Newspaper-page gains physical paper cues:
- Horizontal crease gradient at ~46% (fold hint)
- Radial ink smudges in opposing corners
- Inner edge tint shadow suggesting paper depth

CSS-only via pseudo-elements. Mobile simplifies to single corner
smudge for performance.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "leaderboard"
# Manual: paper feels physical, crease subtle, smudges read as ink not stain
pnpm perf:budget  # verify no GPU cost regression
```

---

### Commit 7 — Supporting newspaper sections (ВРЕМЕТО НА МАСАТА + ТЪРСИ СЕ)

**Goal**: add two small newspaper sections that give the page **content rhythm** beyond rankings.

**Files**:
- `apps/web/components/leaderboard/NewspaperPage.tsx` (add new section components)
- `apps/web/components/leaderboard/Leaderboard.module.css`
- Optionally: `apps/web/lib/leaderboard-headlines.ts` (add helper for weather copy)

**New small components** — inline in NewspaperPage.tsx or as separate files:

```tsx
// Inside NewspaperPage.tsx
function WeatherBox({ totalGames, totalWins }: { totalGames: number; totalWins: number }) {
  const savedNights = Math.max(0, totalWins);  // village wins = saved nights
  return (
    <aside className="newspaper-weather" aria-label="Времето на масата">
      <h4 className="newspaper-weather-title">Времето на масата</h4>
      <p className="newspaper-weather-line">
        Този брой: <strong>{totalGames}</strong> игри, <strong>{savedNights}</strong> спасени нощи.
      </p>
    </aside>
  );
}

function SearchingClassified() {
  return (
    <aside className="newspaper-search" aria-label="Търси се">
      <h4 className="newspaper-search-title">Търси се</h4>
      <p className="newspaper-search-body">
        Опитен водач за следваща маса. Носи кафе и спокойствие.{" "}
        <a href="/create" className="newspaper-search-link">Влез сега →</a>
      </p>
    </aside>
  );
}
```

Insert into NewspaperPage layout — between RanksColumn and Classifieds (or as right-column sidebar; choose layout that fits best visually):

```diff
 export function NewspaperPage({ entries, issueCount }: { entries: LeaderboardEntry[]; issueCount: number }) {
   const top1 = entries[0];
   const top2 = entries[1];
   const top3 = entries[2];
   const ranksColumn = entries.slice(3, 8);
   const classifieds = entries.slice(8);
+  const totalGames = entries.reduce((sum, e) => sum + e.games, 0);
+  const totalWins = entries.reduce((sum, e) => sum + e.wins, 0);
   ...
   return (
     <article className="newspaper-page" aria-label="Вечерен брой">
       <Masthead issueCount={issueCount} />
       <MainHeadline entry={top1} />
       <SecondaryStories second={top2} third={top3} />
+      <div className="newspaper-sidebars">
+        <WeatherBox totalGames={totalGames} totalWins={totalWins} />
+        <SearchingClassified />
+      </div>
       {ranksColumn.length > 0 ? <RanksColumn entries={ranksColumn} startRank={4} /> : null}
       {classifieds.length > 0 ? <ClassifiedsList entries={classifieds} startRank={9} /> : null}
     </article>
   );
 }
```

CSS:

```css
:global(.newspaper-sidebars) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(16px, 2.4vw, 28px);
  margin: clamp(18px, 3vw, 28px) 0;
  padding: 18px;
  border-top: 1px solid oklch(0.32 0.04 50 / 0.3);
  border-bottom: 1px solid oklch(0.32 0.04 50 / 0.3);
}

@media (max-width: 640px) {
  :global(.newspaper-sidebars) {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}

:global(.newspaper-weather),
:global(.newspaper-search) {
  position: relative;
  padding-left: 18px;
  border-left: 2px solid oklch(0.55 0.08 65);
}

:global(.newspaper-weather-title),
:global(.newspaper-search-title) {
  margin: 0 0 6px;
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 0.94rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: oklch(0.18 0.014 50);
}

:global(.newspaper-weather-line),
:global(.newspaper-search-body) {
  margin: 0;
  font-family: "Noto Serif", serif;
  font-size: 0.94rem;
  line-height: 1.5;
  color: oklch(0.22 0.02 50);
}

:global(.newspaper-search-link) {
  color: oklch(0.42 0.155 25);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

:global(.newspaper-search-link:hover) {
  color: oklch(0.32 0.155 25);
}
```

**Bulgarian copy** — invoke `bg-copy-reviewer` agent:
- „Времето на масата" — accepted (newspaper-voice + thematic)
- „Този брой: X игри, Y спасени нощи." — accepted (paper voice)
- „Търси се" — accepted (newspaper classified standard)
- „Опитен водач за следваща маса. Носи кафе и спокойствие." — flavorful, review
- „Влез сега →" — accepted (CTA)

Run `pnpm check:dict` — must remain at 0 hard warnings.

**Commit message**:
```
feat(leaderboard): supporting newspaper sections — ВРЕМЕТО + ТЪРСИ СЕ

Two small editorial sidebars between top-3 stories and rankings:
- "Времето на масата" — stat box with total games + saved nights
- "Търси се" — classified-style CTA pointing to /create

Adds content rhythm beyond rankings and feels like real newspaper
multi-section layout. Mobile stacks single column. Bulgarian text
reviewed via bg-copy-reviewer.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm check:dict
pnpm visual --grep "leaderboard"
# Manual: sidebars feel editorial, not promotional; CTA link doesn't dominate
# Invoke bg-copy-reviewer agent
```

---

### Commit 8 — Custom "Печатницата чака" empty state

**Goal**: replace generic `EmptyState` with **custom empty press treatment** — evocative copy + decorative empty newspaper preview.

**File**: `apps/web/components/leaderboard/NewspaperEmpty.tsx` + `Leaderboard.module.css`

```diff
 import { ARTIFACT_SVG } from "@werewolf/ui/artifacts";
-import { EmptyState, Pill } from "@werewolf/ui/server";
+import { Pill } from "@werewolf/ui/server";
 import { EMPTY_STATES } from "@werewolf/ui/states";
 import { Masthead } from "./Masthead";

 export function NewspaperEmpty() {
   const emptyState = EMPTY_STATES["leaderboard-empty"];
   const Artifact = ARTIFACT_SVG[emptyState.artifact];

   return (
     <article className="newspaper-page newspaper-page-empty" aria-label="Бъдещ брой">
       <Masthead issueCount={1} />

-      <div className="leaderboard-empty-state">
-        <EmptyState
-          artifact={<Artifact size={144} />}
-          title={emptyState.title}
-          body={emptyState.body}
-          action={
-            emptyState.action?.href ? (
-              <Pill as="a" href={emptyState.action.href}>
-                {emptyState.action.label}
-              </Pill>
-            ) : null
-          }
-        />
-      </div>
+      <section className="newspaper-empty-press" aria-label="Чакаме първото издание">
+        <div className="newspaper-empty-press-art" aria-hidden>
+          <Artifact size={180} />
+        </div>
+        <div className="newspaper-empty-press-copy">
+          <h2 className="newspaper-empty-press-title">{emptyState.title}</h2>
+          <p className="newspaper-empty-press-body">{emptyState.body}</p>
+          <p className="newspaper-empty-press-subtitle">
+            Завърши една игра — името ти ще се появи на първа страница.
+          </p>
+          {emptyState.action?.href ? (
+            <Pill as="a" href={emptyState.action.href} intent="primary" shimmer tracked size="lg">
+              {emptyState.action.label}
+            </Pill>
+          ) : null}
+        </div>
+        <div className="newspaper-empty-press-ghost" aria-hidden>
+          {/* Ghost placeholder for future headline */}
+          <div className="ghost-headline-line ghost-line-1" />
+          <div className="ghost-headline-line ghost-line-2" />
+          <div className="ghost-headline-line ghost-line-3" />
+          <div className="ghost-headline-line ghost-line-short" />
+        </div>
+      </section>
     </article>
   );
 }
```

CSS in `Leaderboard.module.css`:

```css
:global(.newspaper-empty-press) {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 28px;
  align-items: center;
  padding: clamp(24px, 4vw, 48px) 0;
}

:global(.newspaper-empty-press-art) {
  color: oklch(0.42 0.04 50);
  opacity: 0.78;
}

:global(.newspaper-empty-press-copy) {
  display: grid;
  gap: 12px;
}

:global(.newspaper-empty-press-title) {
  margin: 0;
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.4rem, 3vw, 2.2rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  color: oklch(0.18 0.014 50);
}

:global(.newspaper-empty-press-body) {
  margin: 0;
  font-family: "Noto Serif", serif;
  font-size: 1.05rem;
  line-height: 1.55;
  color: oklch(0.22 0.02 50);
}

:global(.newspaper-empty-press-subtitle) {
  margin: 0;
  font-family: "Noto Serif", serif;
  font-style: italic;
  font-size: 0.92rem;
  color: oklch(0.42 0.04 50);
}

/* Ghost headline placeholder — empty page suggestion */
:global(.newspaper-empty-press-ghost) {
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
  margin-top: 28px;
  padding: 24px;
  border: 1px dashed oklch(0.45 0.04 50 / 0.4);
  border-radius: var(--ds-radius-card);
  opacity: 0.55;
}

:global(.ghost-headline-line) {
  height: 12px;
  background: oklch(0.50 0.04 50 / 0.3);
  border-radius: 2px;
}

:global(.ghost-line-1) { width: 70%; height: 22px; }
:global(.ghost-line-2) { width: 92%; }
:global(.ghost-line-3) { width: 88%; }
:global(.ghost-line-short) { width: 60%; }

/* Mobile: single column stack */
@media (max-width: 640px) {
  :global(.newspaper-empty-press) {
    grid-template-columns: 1fr;
    text-align: center;
  }
  :global(.newspaper-empty-press-art) {
    justify-self: center;
  }
  :global(.newspaper-empty-press-ghost) {
    grid-column: auto;
  }
}
```

**Bulgarian copy** — only one new line: „Завърши една игра — името ти ще се появи на първа страница." Run `bg-copy-reviewer` on this commit.

**Commit message**:
```
feat(leaderboard): custom "Печатницата чака" empty state

Replace generic EmptyState component with newspaper-themed empty
treatment: existing artifact glyph stays, custom serif typography,
evocative subtitle "името ти ще се появи на първа страница",
ghost headline placeholder with dashed border suggesting where
future stories will print. Primary Pill upgraded to shimmer +
tracked + size lg matching landing hero rhythm.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm check:dict
pnpm visual --grep "leaderboard"
# Manual: empty state feels like "press waiting for next issue", not "no data"
# Verify ghost lines have aria-hidden, screen reader doesn't announce
# Invoke bg-copy-reviewer agent
```

---

### Commit 9 — Visual baselines refresh

```bash
# Inspect each diff manually before update
pnpm visual --grep "leaderboard"

# Expected diffs (per state × theme × viewport):
# - body backdrop: press workshop (if Commit 0) or atmospheric drift fallback
# - newspaper-shell transparent (no more dark frame around page)
# - masthead inline parchment with letterpress title + ink stamp
# - headline portrait halftone + grain treatment
# - section labels in newspaper voice
# - printer's marks between sections
# - paper aging (crease, smudges, edges)
# - weather + classified sidebars
# - empty state: custom press treatment with ghost lines

# Only after manual sign-off:
pnpm visual --grep "leaderboard" --update-snapshots
```

**Commit message**:
```
test(visual): refresh leaderboard baselines after M17 printer's press polish

Significant intentional diffs on /leaderboard empty + populated states.
Reviewed manually before snapshot update.
```

---

## Acceptance criteria

| Metric | Target |
|---|---|
| `body:has(.newspaper-shell)::before` renders backdrop with drift | ✓ |
| `.newspaper-shell` transparent (no dark frame) | ✓ |
| `--art-leaderboard-press` token (if Commit 0 ran) | ✓ |
| Masthead inline parchment, no dark SceneCard | ✓ |
| Ink-stamp issue number rotated in corner | ✓ |
| Headline portrait has halftone + grain | ✓ |
| Section labels in newspaper voice | "Из класираните", "Обяви от масата" |
| Bylines under main headline + secondary | ✓ |
| Printer's marks (●─◆─●) between sections | ✓ |
| Paper aging — crease + smudges + edge tint | ✓ |
| Weather sidebar with stat counts | ✓ |
| Classified-style CTA sidebar | ✓ |
| Empty state custom "Печатницата чака" with ghost lines | ✓ |
| `:global()` primitive overrides | 0 |
| Motion file count | 3 (unchanged) |
| New dependencies | 0 |
| New fonts | 0 |
| `pnpm regression` | green |
| `pnpm check:dict` | 0 hard warnings |
| `pnpm visual --grep "leaderboard"` | green after manual sign-off |
| `bg-copy-reviewer` on Commits 4, 7, 8 | clean |
| Mobile: sidebars stack, crease disabled, marks scale | ✓ |

### Qualitative

- Opening `/leaderboard` feels like reading evening newspaper, not viewing scoreboard
- Masthead reads as integrated newspaper top fold, not hero banner
- Headline portrait reads as period photogravure
- Section voices feel editorial
- Paper aging adds physical artifact realism
- Sidebars give content rhythm
- Empty state suggests "press waiting for next issue"
- Dark + light themes both intentional (newspaper is fundamentally light, dark theme adjusts only ambient frame)
- Mobile remains readable as single-column newspaper

---

## Failure modes

| Symptom | Fix |
|---|---|
| Press workshop image not loading | Verify Commit 0 ran + `--art-leaderboard-press` token defined; fall back to `--art-landing` |
| Masthead stamp overlaps title on mobile | Reduce stamp size + reposition with negative inset |
| Letterpress text shadow looks heavy | Reduce 2nd/3rd shadow stop alpha from 0.25 to 0.18 |
| Halftone pattern too aggressive | Lower `.headline-portrait-halftone` opacity from 0.65 to 0.45 |
| Paper grain SVG fails in Safari | Verify SVG data-URL is encoded properly; quote escaping |
| Printer's marks duplicated above masthead | Add `:first-of-type` exception OR scope marks to specific sections |
| Crease line visible as hard band | Verify pseudo gradient soft fade transparent edges |
| Weather sidebar count shows 0 | Verify entries map reduces correctly; fallback to N/A copy |
| Classified link too prominent (looks like CTA hero) | Reduce link size, use dotted underline (already in CSS) |
| Empty state ghost lines announced by SR | `aria-hidden` on `.newspaper-empty-press-ghost` |
| `bg-copy-reviewer` flags Bulgarian phrases | Refine immediately in same commit; do not move to next |
| Anti-pattern guard fires | Selector targeting primitive class — refactor to local `:global(.newspaper-*)` patterns |
| Mobile masthead stamp too cramped | Verify mobile media query reduces stamp + adjusts position |
| Visual baseline diff massive | Inspect; intentional drift from structural changes — manual review then update |

---

## Operator notes

- **Sample-first imagegen strict.** Do NOT commit generated variants before user picks.
- **All wrapper-context CSS.** `.newspaper-*` is a page-local class family; primitives never overridden.
- **`bg-copy-reviewer` MANDATORY for Commits 4, 7, 8.** New Bulgarian visible text.
- **Mobile = single-column newspaper.** Stack everything; scale typography; disable crease/sidebars-grid where needed.
- **Dark theme adjusts ambient only.** Newspaper page itself stays parchment-light.
- **`frontend-design` skill optional** at PR close-out — invoke if you want "does it feel like real newspaper" review.
- **One commit at a time, gate between each.**
- **Sacred files frozen**: leaderboard headline portrait image asset (CSS-treated only), primitive APIs, `flavorQuoteFor` / `headlineFor` helpers.

---

## After this PR lands

Production deploy → 1-2 day visual smoke → if `/leaderboard` feels intentional and newspaper-themed → next polish round can target `/friends` (similar identity injection needed) or other pages user flags.

Optional follow-up M17.1:
- Per-faction headline portrait variants (werewolf vs mafia winner portraits) — needs imagegen variants
- Animated typewriter effect on headline reveal (Tier 3 motion, page-local) — celebrate first issue
- Multiple "section pages" rotation (today's news vs week's recap) — content feature
- More extensive printer's marks per section type (different ornament per section)

Defer all until M17 stabilizes in production.

---

## TL;DR for handoff

> Execute M17 at `docs/frontend-audit-v3/codex-prompt-leaderboard-printers-press-pr-m17.md`. 10 atomic commits (Commit 0 optional imagegen, sample-first), ~3.5 hours. Identity injection on existing newspaper structure: integrate masthead, halftone portrait, newspaper-voice labels, printer's marks, paper aging, supporting sidebars, custom empty press state. Stop at PR boundary. Manual visual review before baseline update. Invoke `bg-copy-reviewer` on Commits 4, 7, 8.
