# Codex prompt — PR M11: Float-on-world polish

**Scope**: remove parchment "section box" wrappers on landing + /werewolf + /mafia so cards float directly on the page background image. Add contextual frosted-glass plaques ONLY behind section titles (not whole sections). Image-first treatment for homepage hero faction cards.

**Effort**: ~2.5 hours, 5 atomic commits.

**Affected pages**:
- `/` (homepage hero + quickstart + recently-played + last-stories sections)
- `/werewolf` (night timeline + role snapshot + variants)
- `/mafia` (night timeline + role snapshot + variants)

**Not affected**: legal pages (`/privacy`, `/terms`, `/report`, `/faq`, `/status`), identity pages (`/account`, `/history`, etc.), flow pages (`/sign-in`, `/create`). These don't have the box-in-box issue per user feedback.

---

## Why this PR exists

User audit feedback (2026-05-25): hero/quickstart/timeline cards on landing + family pages sit inside light parchment "section boxes" that occlude the misty city/village page background. Cards feel disconnected from the world. Shadow clipping is a symptom — the real issue is that section wrappers cut off page art and create matryoshka-box visual hierarchy.

**Design principle for this PR**: *"Cards float on world. Page background is protagonist. Text gets contextual scrim only where needed for legibility."*

Reference screenshots: see chat thread 2026-05-25. The four problem areas:
1. Homepage quickstart (5 numbered cards in light parchment box)
2. Homepage hero (Върколак / Мафия faction cards with heavy dark overlays)
3. /werewolf timeline + role grid (cards in parchment section boxes)
4. /mafia timeline + role grid (same pattern)

---

## Operating rules (inherit v2)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. Revert if red.
2. After commits touching CSS modules: `pnpm visual --grep "home|werewolf-home|mafia-home"`. Inspect each diff manually BEFORE `pnpm visual:update`.
3. **NO `:global()` selectors that override primitive identity.** Anti-pattern guard from M1 stays in FAIL mode.
4. **NO new dependencies.** `backdrop-filter` is native CSS, no polyfill.
5. **NO Motion changes.** This is pure CSS-only polish. Motion files stay = 3.
6. **NO `prefers-reduced-motion` guards.** Project convention.
7. **NO new fonts.**
8. **Bulgarian copy preserved.** This PR does not touch text. `bg-copy-reviewer` NOT needed.
9. **Sacred files frozen.** Same list as v2.
10. **Mobile + dark theme verification mandatory** per commit. Page background visibility changes affect both viewports + themes.
11. **A11y contrast check** on every frosted plaque — text on translucent backgrounds must stay AA on both light and dark page backgrounds.

---

## Pre-flight

```bash
# v2.1 + M8 + M9 + M10 must have landed
test -f docs/hero-restoration-closing-report.md       && echo "✓ v2 closed"
test -f docs/post-m8-m9-visual-audit-2026-05-25.md    && echo "✓ audit ran"

# Snapshot current state of the section wrappers
grep -n "landing-quickstart\|game-choice-card\|night-timeline\|role-snapshot" apps/web/components/landing/LandingSurface.module.css apps/web/components/games/GameHomePage.module.css > /tmp/m11-current-wrappers.txt

# Baseline metrics
rg ":global\(.*\.(paper-card|scene-card|pill|medallion|surface)" apps/web | wc -l  # MUST be 0
grep -l "from \"motion/react\"" packages/ui/src/primitives/*.tsx | wc -l           # MUST be 3
pnpm regression 2>&1 | tail -3                                                     # green
```

---

## Design pattern (apply across all commits)

### Pattern A — Transparent section wrapper

```css
/* ❌ BEFORE — section box occludes page bg */
.section {
  padding: 56px 32px;
  background: linear-gradient(120deg, oklch(0.94 0.022 78 / 0.85), oklch(0.91 0.028 78 / 0.7));
  border: 1px solid oklch(0.86 0.035 75 / 0.45);
  border-radius: 24px;
  box-shadow: 0 24px 56px -28px oklch(0.20 0.05 60 / 0.45);
}

/* ✓ AFTER — section transparent, cards float on page art */
.section {
  padding: 48px 0;  /* keep vertical rhythm, drop horizontal padding if container handles */
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  /* Cards inside this section now show the page bg between them */
}
```

### Pattern B — Frosted plaque ONLY behind section title

```tsx
<section className={styles.section}>
  <header className={styles.sectionHead}>  {/* small plaque wraps text */}
    <Eyebrow>ПЪРВА ИГРА ЗА 30 СЕКУНДИ</Eyebrow>
    <h2>Как започва добра игра</h2>
    <p>Влез, избери стая, играй.</p>
  </header>
  <div className={styles.cards}>
    {/* cards float on page bg, no section wrapper around them */}
  </div>
</section>
```

```css
.sectionHead {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 24px;
  background: linear-gradient(120deg, oklch(0.94 0.022 78 / 0.82), oklch(0.94 0.022 78 / 0.62));
  border-radius: var(--ds-radius-tile);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);  /* Safari */
  border: 1px solid oklch(0.94 0.022 78 / 0.45);
  box-shadow: 0 8px 24px -16px oklch(0.20 0.05 60 / 0.35);
  margin-bottom: 32px;
}

/* Dark theme: invert the plaque tone */
html[data-theme="dark"] .sectionHead {
  background: linear-gradient(120deg, oklch(0.13 0.014 50 / 0.78), oklch(0.18 0.012 60 / 0.55));
  border-color: oklch(0.45 0.02 60 / 0.4);
}
```

**A11y note**: backdrop-filter blur must NOT compromise contrast. Test with axe — text-on-frosted-plaque must stay AA (4.5:1 small, 3:1 large) on BOTH light and dark page backgrounds.

### Pattern C — Card depth amplification (now visible on page bg)

Since cards no longer sit on a parchment section box, their shadows now extend onto the page art. Bump shadow strength so they read as "placed on world" rather than "floating in air":

```css
.floatingCard {
  /* Existing PaperCard look + amplified shadows */
  box-shadow:
    0 1px 0 oklch(1 0 0 / 0.6) inset,                       /* top highlight (paper edge) */
    0 12px 28px -12px oklch(0.20 0.05 60 / 0.42),           /* near drop */
    0 32px 64px -32px oklch(0 0 0 / 0.32);                  /* far ambient */
}

.floatingCard:hover {
  transform: translateY(-3px);
  box-shadow:
    0 1px 0 oklch(1 0 0 / 0.7) inset,
    0 18px 36px -14px oklch(0.20 0.05 60 / 0.5),
    0 48px 80px -36px oklch(0 0 0 / 0.4);
}
```

### Pattern D — Image-first faction card (homepage hero only)

```diff
- .gameChoiceCard {
-   background:
-     linear-gradient(180deg, rgba(8,9,9,0.92) 0%, rgba(21,12,9,0.78) 48%, rgba(8,9,9,0.95) 100%),
-     var(--family-art) center / cover no-repeat;
-   border-radius: 18px;
-   color: oklch(0.96 0.02 80);
- }

+ .gameChoiceCard {
+   /* Image is the card; scrim ONLY in bottom half behind text */
+   position: relative;
+   overflow: hidden;
+   border-radius: 14px;
+   background: var(--family-art) center / cover no-repeat;
+   border: 1px solid oklch(0.78 0.115 75 / 0.28);  /* vintage poster gold frame */
+   box-shadow:
+     0 1px 0 oklch(1 0 0 / 0.12) inset,
+     0 24px 56px -28px oklch(0 0 0 / 0.6);
+   color: oklch(0.96 0.02 80);
+ }
+
+ .gameChoiceCard::after {
+   content: "";
+   position: absolute;
+   inset: 45% 0 0;  /* bottom 55% only */
+   background: linear-gradient(180deg,
+     transparent 0%,
+     oklch(0.13 0.014 50 / 0.75) 40%,
+     oklch(0.10 0.014 50 / 0.95) 100%
+   );
+   pointer-events: none;
+ }
+
+ /* Card content must be above the scrim layer */
+ .gameChoiceCard > * {
+   position: relative;
+   z-index: 1;
+ }
```

Result: upper half of card shows scene art unobstructed. Text sits on bottom scrim. Card feels like a vintage cinema poster, not a dark rectangle pasted on the page.

---

## Commits

### Commit 1 — Homepage quickstart: transparent section

**File**: `apps/web/components/landing/LandingSurface.module.css`

Target classes (per current `:global(.landing-quickstart ...)` rules):
- `.landing-quickstart` — remove background, `::before`, border, box-shadow
- `.landing-quickstart .quickstart-surface` — remove parchment overlay
- `.landing-quickstart .quickstart-mini-card` — remove parchment overlay (cards become floating)
- KEEP `.quickstart-step` PaperCard-style — but amplify shadows via Pattern C

Apply Pattern A to section wrapper. Apply Pattern B to `.landing-quickstart .quickstart-header` (the eyebrow + title + lede block). Apply Pattern C to the 5 step cards.

**Grep before edit**:
```bash
grep -nE "(landing-quickstart|quickstart-step|quickstart-mini-card|quickstart-surface|quickstart-header)" \
  apps/web/components/landing/LandingSurface.module.css | head -30
```

**Run gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "home"  # inspect diff; expect quickstart cards now show page bg between them
```

**Commit message**:
```
refactor(landing): float quickstart cards on page background

Remove the parchment section box around quickstart so cards sit
directly on the page art. Section title gets a frosted plaque only
behind text, not the full section. Card shadows amplified to read
as placed-on-world rather than floating-in-void.
```

### Commit 2 — Homepage hero: image-first faction cards

**Files**:
- `apps/web/components/landing/LandingSurface.module.css` (`.game-choice-card` + variants)
- (No JSX change — `ModeChoiceCards.tsx` structure stays)

Apply Pattern D. Target classes:
- `.game-choice-card` — image-first background, gold frame
- `.game-choice-card::after` (or `::before` if already taken) — bottom scrim
- `.game-choice-werewolf`, `.game-choice-mafia` — keep `--family-art` variant tokens
- `.game-choice-card h2`, `.game-choice-card p`, `.game-choice-card .section-kicker` — ensure z-index above scrim

**Important**: existing `.game-choice-card::before` rule (shimmer or transition) — check if it conflicts with the bottom scrim. If yes, use `::after` for scrim and keep `::before` for shimmer. If no, choose whichever is simpler.

Also fix the main hero heading "Върколак или Мафия":
- Target the `mode-hero` or equivalent container holding the main heading
- Apply Pattern B (frosted plaque) ONLY behind the heading + lede block — NOT the whole hero section

**Run gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "home"
```

**Commit message**:
```
refactor(landing): image-first faction cards with bottom scrim only

Mode-choice cards now show scene art in their top half unobstructed.
Dark scrim limited to bottom half behind text. Vintage poster gold
frame replaces heavy dark overlay. Main hero copy gets frosted plaque
for readability without occluding the page background.
```

### Commit 3 — /werewolf timeline + role grid: transparent sections

**File**: `apps/web/components/games/GameHomePage.module.css`

Target classes:
- `.night-timeline` (section wrapper) — Pattern A
- `.night-timeline__header` — Pattern B (frosted plaque)
- `.night-timeline--werewolf .night-phase__step` — keep card shape, apply Pattern C (amplified shadows on page bg)
- Role snapshot section ("Кой се събужда нощем"):
  - Find the section wrapper (likely `.role-snapshot` or `.role-grid` — confirm via grep)
  - Apply Pattern A to wrapper
  - Apply Pattern B to header
  - Apply Pattern C to role tiles

**Special case — role tiles dark artwork on light parchment**:
The role thumbnails have dark backgrounds (per audit polish #3.4). Now that they float on the misty village page bg, the contrast is even harsher. Two options:
1. Add a thin gold frame around each role thumbnail (matches faction theme)
2. Apply a subtle warm-tone gradient overlay to soften the dark blocks

Pick option 1 (gold frame). Implementation:

```css
.roleTile {
  /* existing PaperCard styling */
}

.roleTile [class*="role-art"] {  /* or whatever the artwork wrapper is */
  border: 1px solid oklch(0.78 0.115 75 / 0.4);  /* gold frame */
  border-radius: var(--ds-radius-tile);
  overflow: hidden;
}
```

**Grep before edit**:
```bash
grep -nE "(night-timeline|night-phase|role-snapshot|role-grid|role-tile)" \
  apps/web/components/games/GameHomePage.module.css | head -30
```

**Run gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "werewolf-home"
```

**Commit message**:
```
refactor(werewolf): float night timeline and role grid on village bg

Remove section box wrappers so timeline cards and role tiles sit
directly on the misty village page art. Section headers use frosted
plaques. Role thumbnails get a thin gold frame so dark artwork no
longer reads as harsh black blocks on warm parchment.
```

### Commit 4 — /mafia timeline + role grid: same pattern

**File**: same `apps/web/components/games/GameHomePage.module.css`

If the timeline + role grid styles for /mafia share the same `.night-timeline` / role tile classes as /werewolf, this commit may overlap with Commit 3. In that case:
- Make Commit 3 cover BOTH families if the changes are identical
- This commit covers ONLY mafia-specific variants (`.night-timeline--mafia .night-phase__step` color tuning, mafia-specific role art frame)

If structures are truly distinct, this commit mirrors Commit 3 for /mafia selectors.

**Special case**: mafia cards have noir city backgrounds (darker than werewolf). The frosted plaque pattern might need stronger blur or higher alpha to ensure readability. Verify with visual diff.

**Commit message**:
```
refactor(mafia): float night timeline and role grid on city bg

Same float-on-world treatment as werewolf. Frosted plaques tuned for
the noir city palette. Role frames in restrained brass tone.
```

### Commit 5 — Visual baselines refresh

After Commits 1-4, baselines on `/`, `/werewolf`, `/mafia` (+ their `home`/`werewolf-home`/`mafia-home` visual variants × 2 themes × 2 viewports) have shifted intentionally.

```bash
pnpm visual --grep "home|werewolf-home|mafia-home"
# Manually inspect each diff PNG:
# - Page background image visible BETWEEN/AROUND cards ✓
# - Cards have clear depth via shadows ✓
# - Section title plaques readable, no hard rectangles ✓
# - Mobile (375px) baselines: cards stack, plaques readable ✓
# - Dark theme: plaques invert tone, page art still visible ✓
# - Hero faction cards: top half art, bottom scrim, gold frame ✓

# Only after manual sign-off:
pnpm visual --grep "home|werewolf-home|mafia-home" --update-snapshots
```

**Commit message**:
```
test(visual): refresh landing and family baselines for float-on-world treatment

Section wrappers transparentized on /, /werewolf, /mafia. Cards now
visibly float on page background. Frosted plaques behind section
titles only. Image-first faction cards on homepage hero. Baselines
updated after manual review of each diff.
```

---

## Acceptance criteria

| Metric | Target |
|---|---|
| `:global(.*\.(paper-card\|scene-card\|...))` overrides | **0** (unchanged) |
| Motion file count | **3** (unchanged) |
| New dependencies | **0** |
| Section wrappers on landing/family with own bg | **0** (all transparent or wrapper-only-for-layout) |
| Frosted plaques behind section titles | **5+** (quickstart, hero, werewolf timeline, werewolf role grid, mafia timeline, mafia role grid) |
| Visual baselines refreshed | landing + werewolf-home + mafia-home × dark/light × desktop/mobile |
| `pnpm regression` | green |
| `pnpm typecheck` | green |
| `pnpm visual` | green after manual baseline refresh |
| Backdrop-filter Safari support | `-webkit-backdrop-filter` set on every plaque |
| A11y contrast (text on frosted plaque) | AA on light + dark page bg |

### Qualitative

- Page background image (misty village / rainy city / homepage hero art) is VISIBLE between and around cards
- No "matryoshka box" feeling — sections don't have visible rectangular bounds
- Cards feel placed on the world via amplified depth shadows
- Section titles remain readable via small contextual plaques (NOT full-section overlays)
- Homepage faction cards feel like vintage cinema posters (image-first) not dark rectangles
- Mobile layout still readable; plaques scale; cards stack with page art visible between
- Dark theme: plaques invert tone; page art still showing through

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Cards look "naked" without section box | Shadows too weak after removing section bg | Bump shadow values in Pattern C; check `--ds-shadow-card-elevated` token |
| Text on frosted plaque unreadable on dark bg | Plaque alpha too low for dark theme | Increase `oklch(... / 0.55)` to `oklch(... / 0.78)` for dark variant |
| Hero faction card image cropped wrong | `background-position` default off-center | Tune `background-position: center 35%` or similar to focus subject |
| Backdrop-filter doesn't render in older Safari | Missing `-webkit-` prefix | Add prefix to every `backdrop-filter` declaration |
| Mobile plaque overflows card width | `display: inline-block` with long text | Switch to `display: flex; align-self: flex-start` so plaque hugs content but wraps cleanly |
| Section vertical rhythm collapses | Lost padding from removed section bg | Keep `padding: 48px 0` on section wrapper for vertical spacing even when bg removed |
| Card hover lift glitches | Conflict with parent transform | Ensure parent `.section` has no `transform` or `overflow: hidden` |
| Dark role artwork still harsh on /werewolf or /mafia | Gold frame too thin | Bump to `2px` or use slightly warmer surrounding gradient on tile background |
| `pnpm visual` baselines change on unrelated page | CSS change leaked via shared selector | Inspect; if shared selector used by another page, scope tighter |
| Anti-pattern regression guard fires | Used `:global([data-ds-paper-card])` instead of wrapper-context | Refactor selector to use wrapper class context, not primitive class directly |

---

## Operator notes

- **One commit at a time, gate between each.** No folding.
- **Visual baselines NEED manual review.** Every diff PNG should show: page bg now visible where section box was. If a diff shows unexpected layout shift, revert.
- **Test in BOTH themes per commit.** Toggle `html data-theme` in DevTools.
- **Test mobile 375px after every commit.** Frosted plaques scale differently than full-width sections.
- **Backdrop-filter has GPU cost.** Verify `pnpm perf:budget` stays green at PR close-out. If perf regresses materially, switch plaques to opaque parchment fill without blur.
- **No new tokens unless needed.** If a plaque pattern repeats verbatim 3+ times, promote to a shared utility class in a follow-up PR — don't bloat tokens in this PR.
- **`bg-copy-reviewer` agent NOT needed** — no JSX text changes.
- **`frontend-design` skill optional** at PR close-out — invoke if you want a "does it feel like cards floating on world" review.
- **Sacred files unchanged.**

---

## After this PR lands

Production deploy → 1-2 week visual smoke. If users feel cards float well on world, M11 is done.

Potential M12 follow-up (if needed):
- Storytelling connection lines between quickstart numbered cards (subtle dotted line)
- Page-wide vignette to focus card area (radial gradient at viewport edges)
- Card entrance stagger animation when scrolling into view (Tier 3 motion, page-local, NOT primitive)

These are out of scope for M11 — separate PR if user requests.

---

## TL;DR for handoff to Codex

> Execute PR M11 at `docs/frontend-audit-v3/codex-prompt-float-on-world-polish-pr-m11.md`. 5 atomic CSS-only commits, ~2.5 hours. Remove section box wrappers on landing + /werewolf + /mafia so cards float on page background. Frosted plaques only behind section titles. Image-first faction cards on homepage hero. Stop at PR boundary. Manual visual review before every baseline update. Anti-pattern guard stays FAIL.
