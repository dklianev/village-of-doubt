# Codex prompt — PR M13: Create wizard atmospheric foundation

**Scope**: refresh the /create, /werewolf/create, /mafia/create wizard chrome — atmospheric backdrop + step navigation + faction-aware borders + vignette. **Internal form elements (StepRoom presets, StepRoles tiles, StepStyle tempo cards, StepPreview) STAY in this PR** — they are M14-M16.

**Effort**: ~2 hours, 5 atomic commits.

**Goal**: when user opens /werewolf/create, they should FEEL "I'm preparing for a folk-horror village night". When they open /mafia/create, they should FEEL "I'm setting up a noir city crime evening". Currently both feel like generic dark JSON config forms with faction-accent dot.

---

## Pre-flight context

Run these greps before editing:

```bash
# 1. Verify --art-lobby tokens exist (they should, from earlier PRs)
grep -nE "art-lobby" apps/web/app/globals.css | head -10

# 2. Confirm LobbyWizard already wraps content in SceneCard with background
grep -nB2 -A8 'background:\s*{' apps/web/components/lobby/LobbyWizard.tsx

# 3. Find StepNav current implementation
cat apps/web/components/lobby/StepNav.tsx | head -80

# 4. Find lobby-wizard-frame CSS
grep -nE "lobby-wizard-frame|lobby-wizard-main|lobby-step-pane" apps/web/components/lobby/LobbyWizard.module.css | head -10
```

Document any deviations from expected state in PR description.

---

## Operating rules (inherit from v2.1 conservative)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. Revert if red.
2. Visual diff review manually before `pnpm visual --update-snapshots`.
3. **NO `:global()` selectors overriding primitive identity.** Anti-pattern guard stays FAIL.
4. **NO new dependencies.** No Motion. No new fonts.
5. **Motion file count stays 3** (Dialog, Sheet, Toast). This PR is CSS-only + minimal JSX restructure of StepNav.
6. **NO `prefers-reduced-motion` guards.** Project convention.
7. **Bulgarian copy unchanged.** Step labels stay: Стая, Роли, Стил, Преглед. `bg-copy-reviewer` NOT needed unless polish text added.
8. **Sacred files frozen** — game-server, play-room-client, primitives' existing API.
9. **Scope LIMITED to wizard chrome.** Internal form bodies of StepRoom/StepRoles/StepStyle/StepPreview are M14-M16, do not touch in M13.
10. **Mobile + dark + light theme verified** per commit. Tavern atmosphere must read on both themes.

---

## Design philosophy (creative direction)

The wizard is a **tavern preparation ritual**. Each step is a chapter:

| Step | Bulgarian | Mood |
|---|---|---|
| 1 | Стая | „Picking the table" — choosing the world |
| 2 | Роли | „Casting the players" — dealing the deck |
| 3 | Стил | „Setting the rhythm" — conducting the tempo |
| 4 | Преглед | „Final invocation" — signing the night |

Faction theming runs **deep**:
- werewolves → misty village evening; moss-green hairlines; warm gold seal accents
- mafia → rainy city noir; brass-red hairlines; wine-burgundy seal accents
- default `/create` → generic tavern interior; warm parchment

Page-level mood: tavern bg visible behind wizard; vignette focuses eyes at center; wizard floats as a "ritual stage" on the world.

---

## Commits

### Commit 1 — Page-level tavern backdrop visible behind wizard

**Goal**: tavern art becomes page protagonist (like /werewolf and /mafia do for hero). Currently wizard SceneCard's scrim swallows the image.

**Files**:
- `apps/web/app/globals.css` — extend `.lobby-shell` body-level backdrop rules
- `apps/web/app/(create routes)` — verify `data-faction` is set on `<main>` for context inheritance

**Pattern** (`globals.css` near existing `body:has(.lobby-shell)::before`):

```css
/* Add or extend existing rule */
body:has(.lobby-shell)::before {
  position: absolute;
  inset: -4vh -4vw;
  display: block;
  z-index: -2;
  background:
    var(--art-lobby) center / cover no-repeat;
  filter: saturate(0.95) brightness(0.85);
  transform: translate3d(0, 0, 0) scale(1.02);
  will-change: transform;
  animation: ambient-drift 56s ease-in-out infinite alternate;
}

/* Werewolf faction context */
[data-faction="werewolves"] :is(.lobby-shell)::before,
.lobby-shell[data-faction="werewolves"]::before {
  background-image: var(--art-lobby-werewolves, var(--art-lobby));
}

/* Mafia faction context — already exists via [data-theme="mafia"] override but ensure data-faction also wired */
[data-faction="mafia"] :is(.lobby-shell)::before,
.lobby-shell[data-faction="mafia"]::before {
  background-image: var(--art-lobby-mafia, var(--art-lobby));
}

/* Light theme: ambient drift stays (M9 polish); just lighter brightness */
html[data-theme="light"] body:has(.lobby-shell)::before {
  filter: saturate(0.92) brightness(1.04);
}

/* Vignette focusing eyes at viewport center */
body:has(.lobby-shell)::after {
  display: block;
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(
    ellipse 70vw 60vh at 50% 42%,
    transparent 0%,
    oklch(0.08 0.012 60 / 0.18) 55%,
    oklch(0.08 0.012 60 / 0.58) 100%
  );
}

html[data-theme="light"] body:has(.lobby-shell)::after {
  background: radial-gradient(
    ellipse 70vw 60vh at 50% 42%,
    transparent 0%,
    oklch(0.94 0.022 78 / 0.22) 55%,
    oklch(0.94 0.022 78 / 0.62) 100%
  );
}
```

**Verify `--art-lobby-werewolves` token exists**. If only `--art-lobby` exists (which uses mobile/desktop variants but isn't faction-aware at body level), add:

```css
:where(:root, [data-ds]) {
  --art-lobby-werewolves: image-set(
    url("/game-art/werewolf/bg-hero-light-v1.webp") type("image/webp"),
    url("/game-art/werewolf/bg-hero-light-v1.png") type("image/png")
  );
  --art-lobby-mafia: image-set(
    url("/game-art/mafia/bg-hero-light-v1.webp") type("image/webp"),
    url("/game-art/mafia/bg-hero-light-v1.png") type("image/png")
  );
}
```

(Use existing family hero art as fallback — for now don't generate new tavern-specific assets; reuse what we have. If user requests dedicated tavern-interior art later, that's a separate imagegen PR.)

**Wizard SceneCard adjustment**: Currently SceneCard has `background={{ image: "var(--art-lobby)", overlay: "scrim", ... }}`. With body-level backdrop now visible, the wizard's own bg becomes redundant noise. Soften it:

```diff
 <SceneCard
   eyebrow="ЛОБИ"
   density="lg"
-  background={{
-    image: "var(--art-lobby)",
-    overlay: "scrim",
-    focalY: 42,
-    minHeight: "var(--ds-scene-hero-min-compact)",
-  }}
+  background={{
+    image: "var(--art-lobby)",
+    overlay: "veil",     // lighter — body has its own backdrop now
+    focalY: 42,
+    minHeight: "var(--ds-scene-hero-min-compact)",
+  }}
 >
```

`veil` overlay vs `scrim` lets the SceneCard be a "stage" on top of the world, not a black box swallowing it.

**Commit message**:
```
feat(lobby): bring tavern atmosphere to /create body backdrop with faction art

Currently /create wizard's SceneCard scrim swallows the tavern image,
leaving the page feeling like a generic dark config form. This adds
body-level --art-lobby backdrop with faction-aware overrides (werewolves
village, mafia city, default generic tavern), a centered radial vignette
focusing eyes at the wizard, and softens the wizard SceneCard scrim from
"scrim" to "veil" so the world stays visible behind the ritual stage.
```

**Run gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "create"
# Manual: open /create, /werewolf/create, /mafia/create in both light/dark
# Expected: tavern art visible behind wizard; wizard "floats" on world
```

---

### Commit 2 — Step nav redesign: parchment chapter chips

**Goal**: replace generic Pill-based step indicators with custom **parchment chapter chips** featuring Roman numerals and wax seal stamps on completed steps.

**File**: `apps/web/components/lobby/StepNav.tsx` + new module `apps/web/components/lobby/StepNav.module.css`

**Replace current STEPS array logic**:

```diff
- const STEPS: { step: LobbyStep; label: string }[] = [
-   { step: 1, label: "Стая" },
-   { step: 2, label: "Роли" },
-   { step: 3, label: "Стил" },
-   { step: 4, label: "Преглед" },
- ];

+ const STEPS: { step: LobbyStep; numeral: string; label: string }[] = [
+   { step: 1, numeral: "I",   label: "Стая" },
+   { step: 2, numeral: "II",  label: "Роли" },
+   { step: 3, numeral: "III", label: "Стил" },
+   { step: 4, numeral: "IV",  label: "Преглед" },
+ ];
```

**Replace Pill-based rendering with custom chips**:

```tsx
import styles from "./StepNav.module.css";

// ... inside render:
<nav className={styles.stepNav} aria-label="Стъпки на лобито">
  <ol className={styles.stepList}>
    {STEPS.map(({ step, numeral, label }) => {
      const status: StepStatus =
        step === state.step ? "active" :
        step < state.step ? "visited" : "future";
      const disabled = status === "future";
      return (
        <li key={step} className={styles.stepItem}>
          <button
            type="button"
            className={styles.stepChip}
            data-status={status}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                transition(() => dispatch({ type: "GOTO_STEP", step }));
              }
            }}
            aria-current={status === "active" ? "step" : undefined}
          >
            <span className={styles.stepNumeral} aria-hidden>
              {status === "visited" ? "✓" : numeral}
            </span>
            <span className={styles.stepLabel}>{label}</span>
          </button>
        </li>
      );
    })}
  </ol>
</nav>
```

Note: `GOTO_STEP` may not exist in the reducer. Verify; if missing, use existing `PREVIOUS_STEP`/`NEXT_STEP` repeatedly or add `GOTO_STEP` as a small additive action. Prefer reusing existing actions if possible.

**StepNav.module.css** (new file):

```css
.stepNav {
  width: 100%;
}

.stepList {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  flex-wrap: wrap;
}

.stepItem {
  flex: 1 1 auto;
  min-width: 0;
}

.stepChip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid oklch(0.78 0.115 75 / 0.32);
  background: linear-gradient(
    120deg,
    oklch(0.94 0.022 78 / 0.82),
    oklch(0.94 0.022 78 / 0.62)
  );
  color: var(--ds-ink-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease,
    border-color 180ms ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.stepChip:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--ds-accent-gold);
}

.stepChip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stepChip[data-status="active"] {
  background: linear-gradient(
    120deg,
    oklch(0.94 0.022 78 / 0.92),
    oklch(0.91 0.028 78 / 0.78)
  );
  border-color: var(--ds-accent-faction, var(--ds-accent-gold));
  box-shadow:
    0 8px 24px -12px oklch(0 0 0 / 0.32),
    inset 0 1px 0 oklch(1 0 0 / 0.4);
}

.stepChip[data-status="visited"] .stepNumeral {
  background: var(--ds-accent-gold);
  color: var(--ds-surface-paper);
}

.stepNumeral {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, oklch(0.78 0.115 75), oklch(0.58 0.110 65));
  color: var(--ds-surface-paper-deep);
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-weight: 800;
  font-size: 0.85rem;
  flex-shrink: 0;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.5),
    0 2px 4px oklch(0 0 0 / 0.18);
}

.stepChip[data-status="active"] .stepNumeral {
  background: var(--ds-gradient-faction, linear-gradient(135deg, oklch(0.78 0.115 75), oklch(0.58 0.110 65)));
  color: oklch(0.96 0.02 80);
}

.stepLabel {
  font-family: "Noto Serif", serif;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
}

/* Dark theme: invert chip glass tone */
html[data-theme="dark"] .stepChip {
  background: linear-gradient(
    120deg,
    oklch(0.18 0.012 60 / 0.78),
    oklch(0.13 0.014 50 / 0.55)
  );
  border-color: oklch(0.45 0.02 60 / 0.45);
  color: var(--ds-ink-scene);
}

html[data-theme="dark"] .stepChip[data-status="active"] {
  background: linear-gradient(
    120deg,
    oklch(0.18 0.012 60 / 0.88),
    oklch(0.13 0.014 50 / 0.7)
  );
  border-color: var(--ds-accent-faction, var(--ds-accent-gold));
}

/* Mobile: stack with horizontal scroll fallback */
@media (max-width: 640px) {
  .stepList {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
    scroll-snap-type: x mandatory;
  }
  .stepItem {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
  .stepChip {
    min-width: max-content;
  }
}
```

**Architectural note**: this is a **page-local custom component**, NOT a primitive extension. The chips are unique to lobby wizard step navigation and don't generalize to other places yet. If a second consumer emerges later, promote to primitive.

**`@werewolf/ui` Pill is NOT removed** — it stays for use elsewhere. We just stop using it for THIS specific step nav case because we need richer per-step semantics (numeral, status, faction-aware seal).

**Commit message**:
```
refactor(lobby): redesign step nav as parchment chapter chips with Roman numerals

Step nav now reads as chapters of a ritual:
- I, II, III, IV serif numerals in gold roundels
- Active step chip has faction-color border and gradient numeral
- Visited steps get a ✓ wax-seal stamp
- Frosted parchment-glass background on chips, blur backdrop
- Mobile: chips stack horizontally with scroll-snap

Custom StepNav.module.css. Pill primitive untouched and still used
elsewhere; this is a page-local custom chip pattern for richer step
semantics (numeral + label + status seal).
```

**Run gates**:
```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "create"
# Manual: switch through steps via clicks, keyboard arrows, mobile drag
# Expected: chips feel like book chapters, not Pills
```

---

### Commit 3 — Faction-color hairline border on wizard frame

**Goal**: wizard SceneCard frame picks up subtle faction tint so chrome feels deeply themed, not just accent-colored.

**File**: `apps/web/components/lobby/LobbyWizard.module.css` (or whichever module owns `.wizardFrame`)

```css
/* Module-scoped wizard frame accent — wrapper context, NOT primitive override */
.wizardFrame [data-ds-scene-card] {
  border: 1px solid oklch(0.78 0.115 75 / 0.18);
  transition: border-color 240ms ease;
}

/* Faction-aware border tint */
:where([data-faction="werewolves"]) .wizardFrame [data-ds-scene-card] {
  border-color: oklch(0.55 0.10 145 / 0.35);
  box-shadow:
    0 24px 56px -28px oklch(0.20 0.05 60 / 0.5),
    inset 0 1px 0 oklch(1 0 0 / 0.06);
}

:where([data-faction="mafia"]) .wizardFrame [data-ds-scene-card] {
  border-color: oklch(0.50 0.155 25 / 0.35);
  box-shadow:
    0 24px 56px -28px oklch(0.20 0.05 60 / 0.5),
    inset 0 1px 0 oklch(1 0 0 / 0.06);
}
```

**Anti-pattern check**: `[data-ds-scene-card]` selector is **wrapper-context** under `.wizardFrame` — allowed per v2 §3.5. The selector targets a primitive's child via parent class context, not the primitive identity globally.

Verify with regression guard before commit:

```bash
pnpm regression  # must not trigger primitive-override guard
```

**Commit message**:
```
style(lobby): tint wizard frame with faction-color hairline border

SceneCard wrapping the wizard gets a thin faction-tinted border via
wrapper-context selector (not :global() override). Werewolves moss green
at 35% alpha, mafia blood red at 35% alpha. Deeper drop shadow gives
the wizard "stage" presence on the tavern backdrop.
```

---

### Commit 4 — Polish step pane transitions + faction-aware section dividers

**Goal**: small polish to step content transitions and any internal dividers in the wizard frame so the faction theming reads through.

**Files**:
- `apps/web/components/lobby/LobbyWizard.module.css` (or related)
- Any module containing `.lobby-form-error` styling

```css
/* Step pane fade is fine but add tiny faction tint to validation errors */
.wizardFrame :global(.lobby-form-error) {
  border-left: 2px solid var(--ds-accent-faction, var(--ds-accent-blood));
  padding-left: 12px;
}

/* If LobbyWizard has any horizontal dividers (look for hr or border-top in module),
   give them faction-tint */
.wizardFrame [class*="lobby-step-divider"] {
  border-color: var(--ds-accent-faction, oklch(0.45 0.02 60 / 0.18));
}
```

Skip this commit if no dividers / no error styling refresh needed. Move directly to Commit 5.

**Commit message**:
```
style(lobby): tint wizard internal accents with faction color for cohesion
```

---

### Commit 5 — Refresh visual baselines

```bash
# Inspect every diff manually before update
pnpm visual --grep "create|werewolf-create|mafia-create"

# Expected diffs per page × theme × viewport:
# - body backdrop showing tavern art
# - wizard SceneCard with veil overlay (lighter than before)
# - StepNav with parchment chapter chips
# - Faction-color hairline border on wizard
# - Vignette darkening viewport edges

# Only after manual sign-off:
pnpm visual --grep "create|werewolf-create|mafia-create" --update-snapshots
```

**Commit message**:
```
test(visual): refresh create wizard baselines after M13 atmospheric foundation
```

---

## Acceptance criteria

| Metric | Target |
|---|---|
| `--art-lobby-werewolves` token in globals.css | present (or alias to fallback) |
| `--art-lobby-mafia` token | present |
| Body `::before` tavern backdrop visible behind wizard | ✓ |
| Wizard SceneCard overlay | `veil` (lighter than previous `scrim`) |
| StepNav uses parchment chips with Roman numerals | ✓ |
| Pill primitive untouched | ✓ (Pill stays exported and used elsewhere) |
| Faction hairline border on wizard frame | ✓ wrapper-context selector |
| Page vignette focusing center | ✓ |
| Motion file count | 3 (unchanged) |
| `:global()` primitive overrides | 0 |
| `pnpm regression` | green |
| `pnpm visual` | green after manual baseline review |
| Mobile (375px) | step chips horizontally scrollable with snap |
| Dark + light theme | both visually intentional |

### Qualitative

- Opening /werewolf/create feels like "preparing a misty village night"
- Opening /mafia/create feels like "setting up a noir city case"
- StepNav reads as chapter markers, not pill chips
- Wizard frame floats as a stage on the tavern world
- Internal form bodies (StepRoom presets, role tiles, tempo cards) **unchanged**

---

## Failure modes

| Symptom | Fix |
|---|---|
| Tavern art not visible behind wizard | Verify `body:has(.lobby-shell)::before` rule positioned `z-index: -2` with negative inset; check overlay alpha not too high |
| Faction backdrop doesn't switch | `data-faction` not set on `<main>`; verify create page route component passes faction to `data-faction` attr |
| StepNav chips look unstyled | Module css not imported; verify `import styles from "./StepNav.module.css"` |
| Roman numerals look weird in BG cyrillic context | They should be Latin — that's intentional for tavern/ritual feel. If team prefers Cyrillic Roman alternative (I, II, III, IV in Cyrillic shapes), use the same characters — they are universal |
| Wizard border invisible | Check `.wizardFrame [data-ds-scene-card]` selector; if class on wrapper differs, adjust |
| Vignette feels too dark | Lower alpha values in radial-gradient stops |
| Mobile step chips overflow | Verify `flex-wrap: nowrap` + `overflow-x: auto` in mobile media query |
| `GOTO_STEP` reducer action missing | Either add as additive action, OR use existing actions repeatedly, OR drop step jumping for now (only forward/back via arrows + Next button) |
| Anti-pattern guard fires | A `:global(.scene-card)` snuck in; refactor to wrapper-context |

---

## Operator notes

- **This PR is foundation for M14-M16.** Form internals untouched — those come next.
- **Visual diff WILL change significantly.** That's intentional. Inspect each diff PNG manually.
- **Test mobile drag through step chips** — scroll-snap should hold each chip cleanly.
- **`bg-copy-reviewer` skip** unless you change Bulgarian text. Numerals (I-IV) are punctuation-equivalent.
- **`frontend-design` skill optional** at PR close-out — invoke if you want "tavern ritual stage" feedback after deploy.
- **Sacred files frozen.**
- **One PR open at a time.** Don't draft M14 while M13 reviews.

---

## After this PR lands

Production deploy → 1-2 day visual smoke → if create flow feels "deeper themed" → continue M14 (StepRoom presets refresh). If still feels generic → audit-driven M13.1 patch.

Sequence next:
- M13 (this PR) — wizard atmosphere foundation
- M14 — StepRoom preset cards + mode picker + slider visual identity
- M15 — StepRoles role tiles with portraits + StepStyle tempo cards as clock-faces
- M16 — Right StickyPreview as "invitation parchment" + StepPreview as final invocation

---

## TL;DR for handoff

> Execute M13 at `docs/frontend-audit-v3/codex-prompt-create-wizard-atmosphere-pr-m13.md`. 5 atomic CSS/JSX commits, ~2 hours. Foundation refresh for /create wizard — tavern backdrop visible, parchment chapter chips, faction-color borders. Internal form bodies (StepRoom/Roles/Style/Preview) untouched. Stop at PR boundary for visual review. Manual baseline approval before update.
