# Codex prompt — PR M15: /history identity polish

**Scope**: inject detective-archive **personality** into the existing M14 `/history` structure. Architecture stays — Hero + Ledger + Filter + Featured + Drawer Grid already work. What's missing is **visual character**: full-bleed atmosphere, faction iconography, drawer tabs, dossier stamps, wax seals, red thread.

**Effort**: ~3 hours, 7 atomic commits.

**Goal**: `/history` feels like a **physical detective archive case board**, on par with `/werewolf`'s misty village atmosphere and `/mafia`'s noir city mood. Currently it reads as "structured listing with case file aesthetic veneer".

**Scope LIMIT**: `/history` index only. `/history/[gameId]/replay` stays deferred. Internal `CaseFileCard` logic untouched — only visual treatments added via wrapper-context selectors and data attributes.

---

## Operating rules (inherit v2 conservative)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. Revert if red.
2. Visual diff review manually before `pnpm visual --update-snapshots`.
3. **NO `:global()` selectors overriding primitive identity.** Anti-pattern guard stays FAIL.
4. **NO new dependencies. No new fonts. No Motion imports.** Motion file count stays 3.
5. **NO `prefers-reduced-motion` guards.** Project convention.
6. **Bulgarian copy unchanged.** Filter labels, stat labels, ribbon copy stay verbatim. `bg-copy-reviewer` only if any new text introduced.
7. **Sacred files frozen** — primitives' existing API, game-server, play-room-client.
8. **Scope LIMITED**: `apps/web/components/history/*` + `apps/web/app/history/page.tsx` body backdrop only. Other routes untouched.
9. **Mobile + dark + light theme verified** per commit. Drift animation works on both themes.
10. **`bg-copy-reviewer` NOT needed** — no copy changes planned.

---

## Pre-flight context

```bash
# Verify M14 state is as expected
test -f apps/web/components/history/EvidenceWall.tsx && echo "✓ M14 shipped"
grep -q "archiveDesk\|ledgerStrip\|filterTray\|archiveBoard\|featuredCase" apps/web/components/history/History.module.css && echo "✓ M14 structure intact"
grep -q "art-history" apps/web/app/globals.css && echo "✓ archive desk tokens exist"

# Check current page bg behavior
grep -nE "history-shell|history-shell\\.evidence-shell" apps/web/components/history/History.module.css | head -10
grep -nE "body:has\\(\\.(history-shell|landing-shell|game-home-shell)" apps/web/app/globals.css | head -10

# Baseline metrics
rg ":global\(.*\.(paper-card|scene-card|pill|medallion|surface)" apps/web | wc -l  # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l           # MUST be 3
pnpm regression 2>&1 | tail -3                                                     # green
```

---

## Design philosophy (creative direction)

`/history` is a **physical detective archive** — case files spread on a wooden desk, candle light flickering, red thread connecting evidence, wax seals marking outcomes. Not a "modern admin dashboard with case file aesthetic". The user must feel: *„аз ровя из стари дела"*, not *„аз преглеждам списък".*

Reference moods:
- /werewolf body bg → misty village atmosphere visible THROUGH wizard
- /mafia body bg → rainy city noir
- /history body bg → archive desk with candlelight, drift, case files atmospheric

Per-card details suggest physical artifacts: paper aging (per outcome), wax seals (per win/loss), slight rotation as if pinned naturally.

---

## Commits

### Commit 1 — Full-bleed archive desk body backdrop + ambient drift

**Goal**: `/history` page gets atmospheric body backdrop like `/werewolf` and `/mafia`. Currently `/history` body is flat warm parchment.

**File**: `apps/web/app/globals.css`

Add `.history-shell` to the existing `body:has(...)::before` rule chain, OR create a dedicated rule:

```css
/* Find existing rule with body:has(.landing-shell)::before and add .history-shell */
body:has(.landing-shell)::before,
body:has(.lobby-shell)::before,
body:has(.history-shell)::before,           /* ← ADD */
body:has(.game-home-shell)::before,
body:has(.rules-shell)::before {
  position: absolute;
  inset: -4vh -4vw;
  display: block;
  z-index: -2;
  background: var(--page-art, var(--art-landing)) center / cover no-repeat;
  animation: ambient-drift 48s ease-in-out infinite alternate;
  mask-image: none;
  transform: translate3d(-1%, 0, 0) scale(1.035);
  will-change: transform;
}

/* history-shell ties --page-art to --art-history */
.history-shell {
  --page-art: var(--art-history);
  z-index: 0;
  isolation: isolate;
}

/* light theme: ambient drift stays but lighter brightness */
html[data-theme="light"] body:has(.history-shell)::before {
  filter: saturate(0.92) brightness(1.06);
  animation: ambient-drift-light 72s ease-in-out infinite alternate;  /* reuse existing */
}

html[data-theme="dark"] body:has(.history-shell)::before {
  display: block;
  filter: saturate(0.95) brightness(0.88);
}

/* Add vignette focusing center, same pattern as landing/lobby */
body:has(.history-shell)::after {
  display: block;
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(
    ellipse 72vw 60vh at 50% 38%,
    transparent 0%,
    oklch(0.08 0.012 60 / 0.18) 55%,
    oklch(0.08 0.012 60 / 0.58) 100%
  );
}

html[data-theme="light"] body:has(.history-shell)::after {
  background: radial-gradient(
    ellipse 72vw 60vh at 50% 38%,
    transparent 0%,
    oklch(0.94 0.022 78 / 0.22) 55%,
    oklch(0.94 0.022 78 / 0.62) 100%
  );
}
```

**Wizard hero adjustment** in `apps/web/components/history/EvidenceWall.tsx`:

```diff
 <SceneCard
   eyebrow="АРХИВ"
   density="lg"
   background={{
     image: "var(--art-history)",
-    overlay: "scrim",
+    overlay: "veil",                                  // body has its own backdrop now
     minHeight: "var(--ds-scene-hero-min-cinematic)",
   }}
 >
```

`veil` overlay (lighter scrim) lets body backdrop show through; hero stops being isolated dark banner.

**Commit message**:
```
feat(history): full-bleed archive desk page bg with ambient drift

History page now joins /werewolf and /mafia atmospheric depth.
Body ::before renders --art-history with subtle drift animation
matching landing/lobby cadence. Hero SceneCard softens overlay
to veil so atmosphere stays visible behind/around the content.
Vignette focuses eyes at archive board center.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "history"
# Manual: open /history both empty + ?visualHistory=fixture, light + dark
# Expected: archive desk visible behind all content, subtle drift, no clipped edges
```

---

### Commit 2 — Faction iconography on ledger stats

**Goal**: 5 ledger stats stop being "numbers in a strip" and become "evidence ledger with iconography". Each stat gets a small inline SVG glyph above the count.

**Files**:
- `apps/web/components/history/EvidenceWall.tsx` (pass icon prop to LedgerStat)
- `apps/web/components/history/History.module.css` (style stat icons)

**JSX update**:

```diff
 <div className={styles.ledgerStrip} aria-label="Статистика на архива">
-  <LedgerStat label="Дела" value={stats.total} />
-  <LedgerStat label="Върколак" value={stats.werewolves} />
-  <LedgerStat label="Мафия" value={stats.mafia} />
-  <LedgerStat label="Победи" value={stats.wins} />
-  <LedgerStat label="Следи" value={eventsBg(stats.events)} />
+  <LedgerStat icon={<ScrollGlyph />}    label="Дела"     value={stats.total} />
+  <LedgerStat icon={<WerewolfGlyph />}  label="Върколак" value={stats.werewolves} tone="werewolves" />
+  <LedgerStat icon={<FedoraGlyph />}    label="Мафия"    value={stats.mafia} tone="mafia" />
+  <LedgerStat icon={<ScalesGlyph />}    label="Победи"   value={stats.wins} tone="win" />
+  <LedgerStat icon={<LensGlyph />}      label="Следи"    value={eventsBg(stats.events)} />
 </div>
```

```diff
-function LedgerStat({ label, value }: { label: string; value: number | string }) {
+function LedgerStat({ icon, label, value, tone }: {
+  icon: React.ReactNode;
+  label: string;
+  value: number | string;
+  tone?: "werewolves" | "mafia" | "win" | "default";
+}) {
   return (
-    <div className={styles.ledgerStat}>
+    <div className={styles.ledgerStat} data-tone={tone ?? "default"}>
+      <span className={styles.ledgerIcon} aria-hidden>{icon}</span>
       <span>{label}</span>
       <strong>{value}</strong>
     </div>
   );
 }
```

**Inline SVG glyphs** (add to `EvidenceWall.tsx` bottom or new file `apps/web/components/history/LedgerGlyphs.tsx`):

```tsx
function ScrollGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h11c1.5 0 2.5 1 2.5 2.5v11c0 1.5-1 2.5-2.5 2.5H6" />
      <path d="M6 4c-1.5 0-2.5 1-2.5 2.5v11c0 1.5 1 2.5 2.5 2.5" />
      <path d="M9 9h7M9 12h7M9 15h5" />
    </svg>
  );
}

function WerewolfGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7l3 3.5M20 7l-3 3.5" />
      <path d="M6.5 11c.5 4 2.5 6 5.5 6s5-2 5.5-6" />
      <circle cx="9.5" cy="13" r="0.6" fill="currentColor" />
      <circle cx="14.5" cy="13" r="0.6" fill="currentColor" />
      <path d="M11 16l1 1 1-1" />
    </svg>
  );
}

function FedoraGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16h18" />
      <path d="M6 16c0-2 2-7 6-7s6 5 6 7" />
      <path d="M9 12h6" />
    </svg>
  );
}

function ScalesGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16" />
      <path d="M7 20h10" />
      <path d="M4 8h16" />
      <path d="M4 8l-1.5 4h3z" />
      <path d="M20 8l-1.5 4h3z" />
    </svg>
  );
}

function LensGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="6" />
      <path d="M14.5 14.5l5.5 5.5" />
    </svg>
  );
}
```

**CSS for `.ledgerIcon` + tone variants** in `History.module.css`:

```css
.ledgerIcon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: var(--ds-accent-gold);
  margin-bottom: 4px;
  opacity: 0.85;
}

.ledgerStat[data-tone="werewolves"] .ledgerIcon { color: oklch(0.65 0.14 145); }
.ledgerStat[data-tone="mafia"]      .ledgerIcon { color: oklch(0.65 0.16 25); }
.ledgerStat[data-tone="win"]        .ledgerIcon { color: oklch(0.70 0.12 145); }

.ledgerStat[data-tone="werewolves"] strong { color: oklch(0.78 0.12 145); }
.ledgerStat[data-tone="mafia"]      strong { color: oklch(0.78 0.14 25); }
```

**Commit message**:
```
feat(history): add faction iconography to ledger stats

Each ledger stat now carries an inline SVG glyph above the count:
scroll for cases, werewolf silhouette for werewolf games, fedora for
mafia, scales for wins, magnifying lens for traces. Per-tone colour
ties stat to its faction palette. Stops the ledger reading as
generic number strip.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "history"
# Manual: verify icons render at correct stroke weight, faction tones distinct
```

---

### Commit 3 — Filter tray as drawer tab metaphor

**Goal**: filters stop being a Pill row and become "drawer tabs sticking up from the archive bottom edge". Active tab pulled up; inactive tabs slightly recessed.

**File**: `apps/web/components/history/EvidenceWall.tsx` + `History.module.css`

**JSX update** — replace Pill chips with custom drawer tab buttons:

```diff
 <div className={styles.filterTray} role="group" aria-label="Филтри по дело">
   <span className={styles.filterTrayLabel}>Нишка на доказателствата</span>
-  <div className={styles.evidenceFilters}>
+  <div className={styles.filterTabs} role="tablist">
     {FILTERS.map((item) => (
-      <Pill
+      <button
         key={item.value}
         type="button"
-        intent={filter === item.value ? "secondary" : "ghost"}
-        size="sm"
-        tracked
+        role="tab"
+        className={styles.filterTab}
+        data-active={filter === item.value}
         aria-pressed={filter === item.value}
+        aria-selected={filter === item.value}
         onClick={() => setFilter(item.value)}
       >
         {item.label}
-      </Pill>
+      </button>
     ))}
   </div>
 </div>
```

**CSS** in `History.module.css`:

```css
.filterTabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: flex-end;
  margin: 0;
}

.filterTab {
  position: relative;
  padding: 11px 18px 13px;
  border: 1px solid oklch(0.78 0.055 75 / 0.4);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  background: linear-gradient(
    180deg,
    oklch(0.91 0.028 78 / 0.82) 0%,
    oklch(0.86 0.035 75 / 0.78) 100%
  );
  color: var(--ds-ink-primary);
  cursor: pointer;
  font: inherit;
  font-family: "Noto Serif", serif;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition:
    transform 200ms ease,
    background 200ms ease,
    border-color 200ms ease,
    color 200ms ease,
    box-shadow 200ms ease;
  transform: translateY(3px);
  min-height: 44px;
}

.filterTab:hover:not([data-active="true"]) {
  transform: translateY(0);
  border-color: var(--ds-accent-gold);
}

.filterTab[data-active="true"] {
  background: linear-gradient(
    180deg,
    oklch(0.94 0.022 78) 0%,
    oklch(0.91 0.028 78) 100%
  );
  border-color: var(--ds-accent-gold);
  color: var(--ds-ink-primary);
  transform: translateY(0);
  box-shadow:
    0 -3px 6px oklch(0 0 0 / 0.12),
    inset 0 1px 0 oklch(1 0 0 / 0.6);
  z-index: 1;
}

.filterTab[data-active="true"]::after {
  /* Slim active indicator at bottom — bleeds into card surface */
  content: "";
  position: absolute;
  inset: auto 0 -1px 0;
  height: 2px;
  background: var(--ds-accent-gold);
}

/* Dark theme parchment glass */
html[data-theme="dark"] .filterTab {
  background: linear-gradient(
    180deg,
    oklch(0.18 0.012 60 / 0.78) 0%,
    oklch(0.13 0.014 50 / 0.65) 100%
  );
  color: var(--ds-ink-scene);
  border-color: oklch(0.45 0.02 60 / 0.45);
}

html[data-theme="dark"] .filterTab[data-active="true"] {
  background: linear-gradient(
    180deg,
    oklch(0.22 0.014 55 / 0.92) 0%,
    oklch(0.16 0.014 50 / 0.78) 100%
  );
  border-color: var(--ds-accent-gold);
  box-shadow:
    0 -3px 6px oklch(0 0 0 / 0.3),
    inset 0 1px 0 oklch(1 0 0 / 0.08);
}

/* Mobile: tabs become horizontal scroll */
@media (max-width: 640px) {
  .filterTabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .filterTab {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
}
```

Remove unused `.evidenceFilters` rule from `History.module.css` (dead code sweep — apply PR A delete protocol first):

```bash
# Sanity check before deletion
grep -rE "(className=\"[^\"]*evidenceFilters|className=\\\`[^\\\`]*evidenceFilters)" apps/web --include="*.tsx" | wc -l
# Expected: 0 after JSX update
```

**Commit message**:
```
refactor(history): redesign filter tray as drawer tab metaphor

Filters drop the Pill chrome and become parchment tabs rising from
the archive bottom edge. Active tab pulled up with gold underline;
inactive tabs recessed 3px. Mobile: horizontal scroll-snap.
Custom local CSS — Pill primitive unchanged elsewhere.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "history"
# Verify keyboard nav: Tab/Enter still works; aria-selected announces; mobile scroll snaps
```

---

### Commit 4 — Featured case as image-first dossier with stamp

**Goal**: featured case stops looking "slightly bigger card" and becomes "the case currently on the desk". Image-first treatment + rotated dossier number stamp.

**File**: `apps/web/components/history/CaseFileCard.tsx` + `History.module.css`

**CaseFileCard logic** — when `variant === "featured"`:
- Show case scene art (top 55% of card) — IF available; else dark scene tone
- Bottom 45% has scrim with text + CTA
- Rotated `ДОСИЕ №<code>` stamp in top-right corner

```tsx
{variant === "featured" && game.scene && (
  <div className={styles.featuredArt} aria-hidden style={{ backgroundImage: `url(${game.scene})` }} />
)}
<div className={styles.featuredStamp} aria-hidden>
  <span>ДОСИЕ</span>
  <strong>№{game.code}</strong>
</div>
```

(`game.scene` may not exist as a field — if not, use a generic case-file-paper texture or omit the art layer. Confirm via grep on `HistoryGameView` type.)

**CSS** in `History.module.css`:

```css
/* Featured-specific styling — wrapper-context, primitive untouched */
.caseFileShell[data-variant="featured"] {
  position: relative;
  overflow: visible;
  min-height: 360px;
}

.caseFileShell[data-variant="featured"] [data-ds-paper-card] {
  position: relative;
  overflow: hidden;
  min-height: 360px;
}

.featuredArt {
  position: absolute;
  inset: 0 0 auto 0;
  height: 55%;
  background: center / cover no-repeat;
  z-index: 0;
}

.featuredArt::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    transparent 30%,
    oklch(0.94 0.022 78 / 0.86) 90%,
    oklch(0.94 0.022 78) 100%
  );
}

html[data-theme="dark"] .featuredArt::after {
  background: linear-gradient(
    180deg,
    transparent 0%,
    transparent 30%,
    oklch(0.13 0.014 50 / 0.86) 90%,
    oklch(0.13 0.014 50) 100%
  );
}

/* Content sits on top of featuredArt scrim */
.caseFileShell[data-variant="featured"] .caseFileContent {
  position: relative;
  z-index: 1;
  padding-top: 50%;  /* push content below art area */
}

.featuredStamp {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  border: 2px solid oklch(0.50 0.155 25 / 0.62);
  border-radius: 50%;
  background: radial-gradient(circle, oklch(0.94 0.022 78 / 0.78), oklch(0.91 0.028 78 / 0.55));
  transform: rotate(-8deg);
  font-family: "Noto Serif Display", "Noto Serif", serif;
  text-align: center;
  color: oklch(0.42 0.155 25);
  pointer-events: none;
}

.featuredStamp span {
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 800;
  display: block;
}

.featuredStamp strong {
  font-size: 1.05rem;
  font-weight: 800;
  display: block;
  margin-top: 2px;
}
```

**JSX prop forward** in `CaseFileCard.tsx` (if not already):

```diff
 export function CaseFileCard({ game, variant }: { game: HistoryGameView; variant?: "featured" }) {
   return (
-    <article className={styles.caseFileShell} ...>
+    <article className={styles.caseFileShell} data-variant={variant} ...>
```

**Commit message**:
```
style(history): elevate featured case as image-first dossier with rotated stamp

Featured case now reads as "the case currently on the desk": scene
art fills top 55%, scrim fades into PaperCard surface below for
text legibility, ДОСИЕ №<code> wax stamp rotated -8deg in top-right
corner. Drawer grid cards untouched.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "history"
# Manual: verify featured case dominates visually; drawer grid cards still distinct rhythm
```

---

### Commit 5 — Per-card tilt + wax seal outcome stamps

**Goal**: drawer grid cards stop looking identical. Each gets deterministic ±1.6deg tilt (straightens on hover) + wax seal pseudo-element (green win / red loss).

**File**: `apps/web/components/history/CaseFileCard.tsx` + `History.module.css`

**JSX update** in `CaseFileCard.tsx` — add `data-tilt` based on case ID:

```diff
 export function CaseFileCard({ game, variant }: { game: HistoryGameView; variant?: "featured" }) {
+  const tiltSlot = variant === "featured"
+    ? 0
+    : (game.id.charCodeAt(0) % 5) + 1;
   return (
     <article
       className={styles.caseFileShell}
       data-variant={variant}
       data-outcome={outcomeFor(game)}
+      data-tilt={tiltSlot}
       ...
     >
```

**CSS** in `History.module.css`:

```css
/* Deterministic tilt — drawer grid only, featured stays straight (slot 0) */
.caseFileShell[data-tilt="0"] { --case-tilt: 0deg; }
.caseFileShell[data-tilt="1"] { --case-tilt: -1.4deg; }
.caseFileShell[data-tilt="2"] { --case-tilt: 0.9deg; }
.caseFileShell[data-tilt="3"] { --case-tilt: -0.6deg; }
.caseFileShell[data-tilt="4"] { --case-tilt: 1.2deg; }
.caseFileShell[data-tilt="5"] { --case-tilt: -1.1deg; }

.caseFileShell {
  transform: rotate(var(--case-tilt, 0deg));
  transition:
    transform 320ms cubic-bezier(0.18, 0.9, 0.3, 1.1),
    box-shadow 320ms ease;
}

.caseFileShell:not([data-variant="featured"]):hover {
  transform: rotate(0deg) translateY(-4px);
  z-index: 2;
}

/* Mobile: drop tilt for layout stability */
@media (max-width: 640px) {
  .caseFileShell {
    transform: none;
  }
  .caseFileShell:not([data-variant="featured"]):hover {
    transform: translateY(-2px);
  }
}

/* Wax seal pseudo-element — win/loss outcome */
.caseFileShell[data-outcome="win"]::before,
.caseFileShell[data-outcome="loss"]::before {
  content: "";
  position: absolute;
  top: -8px;
  right: 18px;
  z-index: 3;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow:
    0 3px 6px oklch(0 0 0 / 0.32),
    inset 0 -2px 4px oklch(0 0 0 / 0.22),
    inset 0 2px 4px oklch(1 0 0 / 0.18);
  pointer-events: none;
  transform: rotate(-14deg);
}

.caseFileShell[data-outcome="win"]::before {
  background: radial-gradient(circle at 40% 35%, oklch(0.62 0.13 145), oklch(0.40 0.13 145) 70%);
}

.caseFileShell[data-outcome="loss"]::before {
  background: radial-gradient(circle at 40% 35%, oklch(0.58 0.16 25), oklch(0.38 0.15 22) 70%);
}

/* Featured case: wax seal larger and positioned differently */
.caseFileShell[data-variant="featured"]::before {
  top: -10px;
  right: 110px;  /* offset to not overlap with featuredStamp */
  width: 44px;
  height: 44px;
}

/* Featured + outcome: featuredStamp shown ALONG with wax seal — both can coexist */

/* Light theme tweaks */
html[data-theme="light"] .caseFileShell[data-outcome="win"]::before,
html[data-theme="light"] .caseFileShell[data-outcome="loss"]::before {
  /* Wax seals already work on light theme — keep same */
}
```

**Important**: `position: relative` must be on `.caseFileShell` already (or add it). Wax seal is `position: absolute`, so parent needs positioning context. Verify:

```bash
grep -A3 "\\.caseFileShell\\s*{" apps/web/components/history/History.module.css | head -8
```

If `position` is not set, add it in the same commit:

```diff
 .caseFileShell {
+  position: relative;
   transform: rotate(var(--case-tilt, 0deg));
   ...
 }
```

**Commit message**:
```
style(history): per-card subtle tilt and wax seal outcome stamps

Drawer grid cards get deterministic ±1.4deg tilt based on case ID
(featured stays straight). Wax seal pseudo-element in top-right
corner: green for wins, red for losses, rotated -14deg, protrudes
above card edge. Hover straightens tilt and lifts card. Mobile
disables tilt for layout stability.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "history"
# Manual: cards in grid have organic feel (slight tilt); wax seals read as physical
# Mobile: tilt should be off, cards aligned
```

---

### Commit 6 — Red thread SVG connecting featured to drawer grid

**Goal**: thin dashed red SVG line connects the featured case to the drawer grid — suggests investigation thread on detective board. Decorative, `aria-hidden`.

**File**: `apps/web/components/history/EvidenceWall.tsx` + `History.module.css`

**JSX update** — add SVG between `featuredCase` and `caseDrawerGrid`:

```diff
 <section className={styles.archiveBoard} aria-label="Списък с дела">
   <div className={styles.featuredCase}>
     <span className={styles.boardKicker}>Последно заведено дело</span>
     <CaseFileCard key={featuredCase!.id} game={featuredCase!} variant="featured" />
   </div>
+  {drawerCases.length > 0 && (
+    <svg
+      className={styles.redThread}
+      aria-hidden
+      width="100%"
+      height="100%"
+      preserveAspectRatio="none"
+      viewBox="0 0 200 100"
+    >
+      <path
+        d="M 15 50 C 55 35, 100 70, 145 45 C 170 30, 180 55, 195 50"
+        stroke="oklch(0.50 0.155 25 / 0.42)"
+        strokeWidth="1.4"
+        strokeDasharray="5 6"
+        fill="none"
+        strokeLinecap="round"
+      />
+    </svg>
+  )}
   {drawerCases.length > 0 ? (
     <div className={styles.caseDrawerGrid} aria-label="Останали дела">
       ...
```

**CSS** in `History.module.css`:

```css
.archiveBoard {
  position: relative;  /* if not already */
}

.redThread {
  position: absolute;
  inset: 50% 0 auto 0;
  width: 100%;
  height: 100px;
  pointer-events: none;
  z-index: 1;
  transform: translateY(-50%);
  opacity: 0.7;
  mix-blend-mode: multiply;
}

/* Hide on mobile (grid becomes single column, thread doesn't make sense) */
@media (max-width: 768px) {
  .redThread {
    display: none;
  }
}

/* Dark theme: lighten thread blend */
html[data-theme="dark"] .redThread {
  mix-blend-mode: screen;
  opacity: 0.42;
}
```

**Commit message**:
```
feat(history): red thread svg connecting featured to drawer grid

Thin dashed red SVG curve traverses the archive board between the
featured case and the drawer grid, suggesting an investigation
thread on a detective evidence board. Decorative — aria-hidden,
multiply blend on light theme, screen on dark, hidden on mobile.
```

**Gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "history"
# Manual: thread visible but subtle; doesn't dominate; mobile hides cleanly
```

---

### Commit 7 — Visual baselines refresh

After Commits 1-6, baselines on `/history` empty + `/history?visualHistory=fixture` × light/dark × desktop/mobile have shifted intentionally.

```bash
# Inspect every diff before update
pnpm visual --grep "history"

# Expected per page state × theme × viewport:
# - body backdrop shows archive desk
# - hero veil overlay (lighter)
# - ledger stats have inline glyphs (faction colors)
# - filter tabs as drawer-tab metaphor
# - featured case dominant with rotated stamp
# - drawer cards tilted slightly + wax seals
# - red thread visible on desktop (hidden mobile)
# - empty state preserved

# Only after sign-off:
pnpm visual --grep "history" --update-snapshots
```

**Commit message**:
```
test(visual): refresh history baselines after M15 identity polish

Significant intentional diffs across /history empty + fixture
states. Reviewed manually before snapshot update.
```

---

## Acceptance criteria

| Metric | Target |
|---|---|
| `body:has(.history-shell)::before` renders `--art-history` | ✓ |
| Ambient drift animation runs | ✓ |
| Hero SceneCard overlay | `veil` (was scrim) |
| Ledger stats include inline SVG glyphs | 5/5 (Scroll, Werewolf, Fedora, Scales, Lens) |
| Filter chips replaced by drawer tabs | ✓ |
| Featured case has rotated ДОСИЕ stamp | ✓ |
| Drawer grid cards have deterministic tilt | ✓ (slots 1-5 by ID hash) |
| Wax seal pseudo-element on win/loss cards | ✓ |
| Red thread SVG between featured + grid | ✓ desktop only |
| Mobile: tilt off, thread hidden, filter tabs scroll-snap | ✓ |
| `:global()` primitive overrides | 0 |
| Motion file count | 3 (unchanged) |
| New dependencies | 0 |
| Bulgarian copy | unchanged |
| `pnpm regression` | green |
| `pnpm visual --grep "history"` | green after manual sign-off |

### Qualitative

- Opening `/history` feels like opening an archive room, not loading an admin list
- Ledger stats look like an evidence ledger with iconography
- Filter tabs feel like file folder tabs sticking up
- Featured case dominates visually as "the case on the desk"
- Drawer cards have organic pinned feel via subtle tilt
- Wax seals read as physical artifact (top-right corner)
- Red thread suggests investigation continuity
- Dark + light themes both intentional
- Mobile remains clean and readable

---

## Failure modes

| Symptom | Fix |
|---|---|
| Body backdrop not visible | Verify `.history-shell` has `--page-art: var(--art-history)` set |
| Drift animation jerky | Confirm `will-change: transform` and `translate3d` on `::before` |
| Hero feels too washed-out | Bump overlay back to scrim OR tighten min-height |
| Glyphs render at wrong size | Inline SVG width/height should be 22px; check `.ledgerIcon` rules |
| Drawer tabs don't look like tabs | Verify `border-bottom: none` and `border-radius: 10px 10px 0 0`; active tab `transform: translateY(0)` |
| Active tab indicator missing | Check `::after` rule for `inset: auto 0 -1px 0; height: 2px` |
| Featured stamp overlaps content | Adjust `top` or rotate angle; consider z-index conflicts with featuredArt |
| Tilt creates horizontal scroll | Verify `.archiveBoard` has `overflow: hidden` OR cards stay inside |
| Wax seal clipped by card overflow | `.caseFileShell { overflow: visible }` — seal protrudes intentionally |
| Hover doesn't straighten tilt | Verify cubic-bezier transition + hover specificity beats tilt rule |
| Red thread misaligned | Adjust viewBox or SVG path — non-stretching layout requires tuned coordinates |
| Mobile shows thread | Confirm `@media (max-width: 768px) { .redThread { display: none } }` |
| Anti-pattern guard fires | A `:global(.paper-card)` or `:global([data-ds-paper-card])` was added — refactor to wrapper-context only |

---

## Operator notes

- **All wrapper-context selectors**. Primitive identity NEVER overridden. `.caseFileShell[data-variant="featured"] [data-ds-paper-card]` is wrapper-context (page-local class targets primitive child via parent context) — allowed.
- **Featured stamp + wax seal both visible on featured win/loss cards** — that's intentional. Stamp = file label, seal = outcome.
- **Tilt deterministic per ID hash**, NOT random. Random would change every render and break visual baselines.
- **Mobile: tilt off, thread hidden, filter tabs scroll-snap**. Verify each commit on 375px.
- **No new tokens** unless a value repeats verbatim in 3+ places. Current scope: scoped CSS values acceptable.
- **`bg-copy-reviewer` NOT needed** — no JSX text changes.
- **`frontend-design` skill optional** at PR close-out — invoke if you want a "does it feel like detective archive" review after deploy.
- **One commit at a time, gate between each. No folding.**
- **Sacred files frozen** — CaseFileCard component logic untouched except for adding `data-variant` and `data-tilt` attributes.

---

## After this PR lands

Production deploy → 1-2 day visual smoke → if `/history` feels intentional and detective-themed → optional M16 (`/history/[gameId]/replay` identity polish, similar treatment).

Optional follow-ups (defer):
- Cork board background texture overlay on archive board section
- Hand-written margin annotations decoration (CSS-only, paper-clip glyphs)
- Per-case ribbon banners showing winner faction

---

## TL;DR for handoff

> Execute M15 at `docs/frontend-audit-v3/codex-prompt-history-identity-polish-pr-m15.md`. 7 atomic CSS/JSX commits, ~3 hours. Identity injection on top of M14 structure: archive desk body bg, faction glyphs on stats, drawer tab filters, dossier stamps, wax seal outcomes, red thread. Stop at PR boundary. Manual visual review before baseline update.
