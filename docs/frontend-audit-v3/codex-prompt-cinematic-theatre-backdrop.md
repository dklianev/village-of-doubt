# Codex prompt — Cinematic theatre backdrop (3-layer depth stack)

Replace the current zoomed-in ambient backdrop on `/`, `/werewolf`, `/mafia` with a **3-layer cinematic theatre stack**: fixed-viewport ambient WebP (Layer 1) + radial spotlight vignette focusing on the hero card (Layer 2) + dramatic floor shadow on the hero card (Layer 3). Cover both dark and light themes.

**Working directly on `main`.** 5 atomic English commits. No new dependencies, no new imagen. ~25 минути Codex work.

---

## Pre-analysis

### Reproduction of the current issue

1. Open `/` on a desktop browser
2. Notice the **huge soft amber glow on the left** and **huge teal glow on the right** — these are the ambient composited WebP scaled drastically up by `background-size: cover` on `.landing-shell::before` (a tall pseudo box with `min-height: 100vh; bottom: 0`)
3. Same effect on `/werewolf` and `/mafia` (which use `.game-home-shell`, identical setup)

### Root cause

**File:** `apps/web/app/globals.css`

```css
/* Lines 1436–1454 — landing/game-home/lobby/history/rules shell pseudo */
.landing-shell::before,
.lobby-shell::before,
.history-shell::before,
.game-home-shell::before,
.rules-shell::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: -1;
  width: 100vw;
  min-height: 100vh;
  background:
    linear-gradient(115deg, rgba(8, 9, 9, 0.92) 0%, rgba(21, 12, 9, 0.7) 44%, rgba(8, 9, 9, 0.95) 100%),
    var(--page-art, var(--art-landing)) center / cover no-repeat;
  content: "";
  filter: saturate(0.95) contrast(1.08);
  transform: translateX(-50%);
}

/* Line 1474 — landing-specific override */
.landing-shell::before {
  background: var(--art-landing-ambient-composited) center / cover no-repeat;
  filter: none;
}
```

With `position: absolute; top: 0; bottom: 0` the pseudo's height = full landing-shell height (often 2000–3000px on a tall page), but its `width: 100vw` = viewport width. `background-size: cover` then scales the image to **fill the taller box** while preserving aspect ratio → image scales up massively, side glows get cropped off-screen → user sees only the central zoomed area of the ambient art.

There's also a duplicate of the ambient bg on `body` (line 258):

```css
html[data-theme="dark"] body {
  background: var(--art-landing-ambient-composited) center / cover no-repeat;
}
```

The two layers stack and reinforce each other, making the zoom feel even heavier.

### Why "Option A" (`100% auto`) isn't enough

`100% auto` fits the image to viewport width — but loses the ambient on long-scroll pages (image only covers top portion, leaving footer area with flat dark fill). For a homepage scrolled past the hero, this looks bare.

### The theatre stack solution

```
┌─────────────────────────────────────────────────┐
│ Layer 3 — hero card with cinematic floor shadow │   ← scrolls naturally
│   (lifts off backdrop with deep ground shadow)  │
├─────────────────────────────────────────────────┤
│ Layer 2 — radial spotlight vignette             │   ← fixed in viewport
│   centered on hero card (focuses attention)     │
├─────────────────────────────────────────────────┤
│ Layer 1 — fixed-viewport ambient WebP           │   ← fixed, slowly drifts
│   ultra-slow 48s drift, never zooms             │
└─────────────────────────────────────────────────┘
```

When the user scrolls, ambient stays put (cinematic). Spotlight stays focused on hero region. Hero card moves naturally with content, gaining a parallax-like depth illusion.

### Out of scope

- Hero card chrome itself (already polished)
- ModeChoiceCards / QuickStartSection / GameHomePage content
- Game-server / schemas
- New imagen — uses existing `--art-landing-ambient-composited`
- New npm dependencies
- Lobby/history/rules pages — only `/`, `/werewolf`, `/mafia` get the theatre stack

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Pages covered | `/` (`.landing-shell`) + `/werewolf` & `/mafia` (`.game-home-shell`) |
| Layer 1 positioning | `position: fixed; inset: 0` on `body:has(...)::before` — fits viewport exactly, no zoom |
| Layer 1 animation | 48s `ease-in-out alternate` infinite drift on `background-position` (4% horizontal) |
| Layer 2 positioning | `position: fixed; inset: 0` on `body:has(...)::after` — radial spotlight |
| Layer 2 vignette | Ellipse 60vw × 50vh at 50% 38% (hero card area), fades to dark edges |
| Layer 3 | Cinematic floor shadow added to `.landing-hero-card` and `.game-home-hero` (~80px below, ~120px blur, very soft) |
| Light theme | Layer 1 → soft cream gradient (NOT the WebP); Layer 2 → cream vignette; Layer 3 → softer brown floor shadow |
| Mobile | Layer 1 + 2 remain fixed (works on iOS); reduce vignette intensity at narrow widths to avoid darkening content |
| `prefers-reduced-motion` guards | **NONE** — ambient drift is barely perceptible and matches project convention |
| Old `.landing-shell::before` ambient | Disabled (replaced by body fixed pseudo) |
| Body redundant ambient bg | Disabled on landing/game-home shells (replaced by body fixed pseudo) |
| Other shells (lobby/history/rules) | Untouched — keep existing absolute pseudo |
| Branch | Directly on `main` |
| Validation | After each commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert immediately. |

---

## Stage 1 — Layer 1: Fixed-viewport ambient backdrop (dark + light)

### Step 1a: Replace zoomed pseudo with fixed body pseudo (dark theme)

**File:** `apps/web/app/globals.css`

Locate the body pseudo declaration (currently hidden — around line 273):

```css
body::before,
body::after {
  position: fixed;
  inset: 0;
  display: none;
  pointer-events: none;
  content: "";
}
```

Add right after it (still in body pseudo area):

```css
/* ============================== */
/* Cinematic theatre backdrop      */
/* Layer 1 — fixed ambient + drift */
/* ============================== */

body:has(.landing-shell)::before,
body:has(.game-home-shell)::before {
  display: block;
  z-index: -2;
  background: var(--art-landing-ambient-composited) center / cover no-repeat;
  animation: ambient-drift 48s ease-in-out infinite alternate;
}

@keyframes ambient-drift {
  0%   { background-position: 48% 50%; }
  50%  { background-position: 52% 48%; }
  100% { background-position: 48% 52%; }
}
```

### Step 1b: Family-specific ambient on /werewolf and /mafia

The `--art-landing-ambient-composited` is the landing's dual-world art. `/werewolf` and `/mafia` should use family-themed ambient. Override:

```css
body:has(.game-home-shell[data-family="werewolves"])::before {
  background-image: image-set(
    url("/game-art/werewolf/bg-hero-v2.webp") type("image/webp"),
    url("/game-art/werewolf/bg-hero-v2.png") type("image/png")
  );
}

body:has(.game-home-shell[data-family="mafia"])::before {
  background-image: image-set(
    url("/game-art/mafia/bg-hero-v2.webp") type("image/webp"),
    url("/game-art/mafia/bg-hero-v2.png") type("image/png")
  );
}

@media (max-width: 760px) {
  body:has(.game-home-shell[data-family="werewolves"])::before {
    background-image: image-set(
      url("/game-art/mobile/werewolf/bg-hero-v2.webp") type("image/webp")
    );
  }
  body:has(.game-home-shell[data-family="mafia"])::before {
    background-image: image-set(
      url("/game-art/mobile/mafia/bg-hero-v2.webp") type("image/webp")
    );
  }
}
```

### Step 1c: Light theme variant

In light theme, the ambient WebP often clashes with the cream paper aesthetic. Replace with a soft tinted gradient:

```css
html[data-theme="light"] body:has(.landing-shell)::before,
html[data-theme="light"] body:has(.game-home-shell)::before {
  background:
    radial-gradient(ellipse at 4% 50%, rgba(255, 230, 180, 0.42), transparent 38rem),
    radial-gradient(ellipse at 96% 48%, rgba(180, 200, 220, 0.38), transparent 42rem),
    linear-gradient(135deg, #f7ead0 0%, #e7d0a4 48%, #c6d0b2 100%);
  /* No drift on light — gradient doesn't drift well */
  animation: none;
}
```

### Step 1d: Disable old absolute pseudo on landing/game-home (avoid duplication)

```css
.landing-shell::before,
.game-home-shell::before {
  display: none;
}
```

(This keeps the rule structure intact for `.lobby-shell::before`, `.history-shell::before`, `.rules-shell::before`, which are NOT touched.)

### Step 1e: Disable body's redundant ambient bg

```css
html[data-theme="dark"] body:has(.landing-shell),
html[data-theme="dark"] body:has(.game-home-shell) {
  /* Body bg is now provided by the fixed pseudo */
  background: rgba(8, 9, 9, 0.95);
}

html[data-theme="light"] body:has(.landing-shell),
html[data-theme="light"] body:has(.game-home-shell) {
  background: rgba(252, 244, 230, 0.96);
}
```

### Commit 1

```
fix(landing): replace zoomed absolute ambient with fixed-viewport pseudo on body
```

---

## Stage 2 — Layer 2: Radial spotlight vignette

### Step 2a: Add spotlight via body::after

In the same theatre section of `globals.css`:

```css
/* Layer 2 — radial spotlight vignette */

body:has(.landing-shell)::after,
body:has(.game-home-shell)::after {
  display: block;
  z-index: -1;
  background:
    radial-gradient(
      ellipse 65vw 55vh at 50% 36%,
      transparent 0%,
      rgba(8, 9, 12, 0.18) 55%,
      rgba(8, 9, 12, 0.58) 100%
    );
}
```

**Why ellipse 65vw 55vh at 50% 36%:** The hero card sits at roughly viewport center horizontally, 36% from top (top of the card). An ellipse 65vw wide × 55vh tall covers the hero card area with clear glass, then fades to darkness at the viewport edges. The deep edge tint (`rgba(8,9,12,0.58)`) frames the content like a stage spotlight.

### Step 2b: Light theme spotlight

```css
html[data-theme="light"] body:has(.landing-shell)::after,
html[data-theme="light"] body:has(.game-home-shell)::after {
  background:
    radial-gradient(
      ellipse 65vw 55vh at 50% 36%,
      transparent 0%,
      rgba(252, 244, 230, 0.22) 55%,
      rgba(252, 244, 230, 0.62) 100%
    );
}
```

### Step 2c: Mobile — soften vignette to avoid darkening content

On narrow screens, hero card fills more viewport area. Vignette should be less aggressive.

```css
@media (max-width: 760px) {
  body:has(.landing-shell)::after,
  body:has(.game-home-shell)::after {
    background:
      radial-gradient(
        ellipse 110vw 70vh at 50% 32%,
        transparent 0%,
        rgba(8, 9, 12, 0.12) 60%,
        rgba(8, 9, 12, 0.42) 100%
      );
  }

  html[data-theme="light"] body:has(.landing-shell)::after,
  html[data-theme="light"] body:has(.game-home-shell)::after {
    background:
      radial-gradient(
        ellipse 110vw 70vh at 50% 32%,
        transparent 0%,
        rgba(252, 244, 230, 0.18) 60%,
        rgba(252, 244, 230, 0.46) 100%
      );
  }
}
```

### Commit 2

```
feat(landing): radial spotlight vignette focuses backdrop on hero region
```

---

## Stage 3 — Layer 3: Hero card cinematic floor shadow

### Step 3a: Extend landing hero card shadow

**File:** `apps/web/app/globals.css` — find `.landing-hero-card` (around line 1497):

```diff
  .landing-hero-card {
    isolation: isolate;
    min-height: 520px;
    border-color: var(--hero-card-border);
    background:
      var(--hero-card-scrim),
      var(--art-landing-hero-composited) center top / 100% auto no-repeat,
      linear-gradient(145deg, rgba(8, 11, 12, 0.96), rgba(17, 12, 10, 0.92));
-   box-shadow: var(--hero-card-shadow);
+   box-shadow:
+     var(--hero-card-shadow),
+     /* Cinematic floor shadow — long, soft, deep — lifts card off backdrop */
+     0 80px 120px -40px rgba(0, 0, 0, 0.7);
  }
```

### Step 3b: Light theme floor shadow

Find the light theme override (around line 1530):

```diff
  html[data-theme="light"] .landing-hero-card {
    border-color: var(--hero-card-border);
-   box-shadow: var(--hero-card-shadow);
+   box-shadow:
+     var(--hero-card-shadow),
+     /* Lighter brown floor shadow — still cinematic but warmer */
+     0 80px 120px -40px rgba(67, 39, 24, 0.42);
  }
```

### Step 3c: Game-home hero floor shadow

Find `.game-home-hero` (around line 2578) and add the same treatment:

```diff
  .game-home-hero {
    /* … existing properties … */
-   box-shadow: 0 32px 92px rgba(0, 0, 0, 0.46), inset 0 1px rgba(255, 247, 229, 0.1);
+   box-shadow:
+     0 32px 92px rgba(0, 0, 0, 0.46),
+     0 80px 120px -40px rgba(0, 0, 0, 0.7),
+     inset 0 1px rgba(255, 247, 229, 0.1);
  }
```

And light theme:

```css
html[data-theme="light"] .game-home-hero {
  box-shadow:
    0 32px 92px rgba(67, 39, 24, 0.24),
    0 80px 120px -40px rgba(67, 39, 24, 0.42),
    inset 0 1px rgba(255, 247, 229, 0.18);
}
```

(If a light theme `.game-home-hero` override doesn't exist yet, add it after the dark variant.)

### Commit 3

```
style(landing): cinematic floor shadow on hero card lifts it off backdrop
```

---

## Stage 4 — Polish: hero card pop on scroll (optional but worth it)

### Step 4a: Subtle parallax via background-attachment

The hero card's painterly art (`--art-landing-hero-composited`) currently scrolls with content. Add `background-attachment: scroll` explicitly (already default, but let's make hero art fixed on the card while card scrolls — creating a "frame holding a still painting" effect):

**Skip this** if the result is jarring. The fixed-pseudo backdrop already provides parallax depth between Layer 1 (fixed) and Layer 3 (scrolling card). Adding more parallax can feel too busy.

### Step 4b: Hero card edge highlight (premium touch)

Add an inner top edge highlight to make the hero card feel even more "lifted":

```diff
  .landing-hero-card {
    /* … */
    box-shadow:
      var(--hero-card-shadow),
      0 80px 120px -40px rgba(0, 0, 0, 0.7),
+     inset 0 1px 0 rgba(255, 247, 229, 0.18),    /* top edge highlight */
+     inset 0 -1px 0 rgba(0, 0, 0, 0.32);          /* bottom edge darken */
  }
```

Same for `.game-home-hero` and their light theme variants (use warmer tones in light).

### Commit 4

```
style(landing): inner edge highlights for hero card pop
```

---

## Stage 5 — Verify and clean leftover

### Step 5a: Grep for stale references

```bash
grep -n "art-landing-ambient" apps/web/app/globals.css
```

Make sure no stray `.landing-shell::before { background: var(--art-landing-ambient-composited) ... }` rules remain (Stage 1d should have removed/overridden them).

### Step 5b: Verify body bg matches

Body solid bg should kick in only when `:has(.landing-shell)` or `:has(.game-home-shell)`. Lobby/history/rules pages still use the original absolute-pseudo system — verify by visiting `/lobby/ABC123` (mock code) and confirming the backdrop hasn't changed.

### Step 5c: Run regression

```bash
pnpm regression
pnpm typecheck
pnpm build
```

### Commit 5

```
chore(landing): verify theatre backdrop scope (lobby/history/rules untouched)
```

---

## Acceptance criteria

1. **No more zoomed-in ambient** on `/`, `/werewolf`, `/mafia` (both desktop + mobile, dark + light)
2. **Ambient stays fixed** in viewport during scroll — visible at every scroll position
3. **Subtle drift** detectable but not distracting (48s cycle, ~4% horizontal/vertical movement)
4. **Spotlight vignette** softly darkens viewport edges, brightens hero card region — focuses attention without darkening hero content
5. **Hero card lifts** visibly from backdrop — distinct floor shadow at the bottom
6. **`/werewolf`** uses werewolf-themed ambient (forest hero art)
7. **`/mafia`** uses mafia-themed ambient (city street hero art)
8. **Mobile** — vignette is softer (110vw 70vh ellipse), content not darkened
9. **Light theme** — soft cream gradient + cream vignette + warmer brown floor shadow, no WebP ambient on body
10. **Lobby/history/rules pages untouched** — `/lobby/CODE`, `/history`, `/werewolf/rules` look exactly as before
11. **No new Paint events** on idle (Performance recording 5s — drift is compositor-only)
12. **No "no `prefers-reduced-motion` guards added"** anywhere (matches project convention)
13. **Regression + typecheck + build green** after every commit
14. **Bulgarian copy untouched** (this PR is CSS-only)

---

## Verification

### Functional

```bash
pnpm regression
pnpm typecheck
pnpm build
```

### Manual visual QA

1. `/` desktop dark — ambient fills viewport, drifts slowly, spotlight focuses on hero, hero card has visible floor shadow
2. `/` desktop light — soft cream backdrop, no WebP zoom, warm floor shadow
3. `/` scroll to bottom — ambient stays in view at top; spotlight still visible
4. `/werewolf` desktop dark — forest hero ambient fixed, focused on hero
5. `/werewolf` desktop light — soft cream backdrop
6. `/mafia` desktop dark — city street hero ambient fixed
7. `/mafia` desktop light — soft cream backdrop
8. `/` mobile 390×844 — softer vignette, ambient fits viewport
9. `/lobby/ABC123` (mock code) — original backdrop unchanged
10. `/werewolf/rules` — original backdrop unchanged

### Chrome DevTools Performance

1. Open DevTools → Performance
2. CPU throttle 4×, Network Slow 3G
3. Record 5 seconds of idle on `/`
4. **Expect:**
   - No Paint events on body pseudos (drift is compositor-only via `background-position`)
   - No layout/recalc events
5. Save trace JSON to `audit-v3/after/cinematic-backdrop/idle-trace.json`

### Lighthouse

```bash
pnpm build && pnpm start
npx lighthouse http://localhost:3000 --output html --output-path audit-v3/after/cinematic-backdrop/landing.html --form-factor mobile --throttling-method devtools
npx lighthouse http://localhost:3000/werewolf --output html --output-path audit-v3/after/cinematic-backdrop/werewolf.html --form-factor mobile --throttling-method devtools
npx lighthouse http://localhost:3000/mafia --output html --output-path audit-v3/after/cinematic-backdrop/mafia.html --form-factor mobile --throttling-method devtools
```

Expect: Performance ≥ 85 mobile, ≥ 95 desktop. LCP < 2.0s mobile.

### Screenshots in `audit-v3/after/cinematic-backdrop/`

1. `landing-desktop-dark.png` — hero card with theatre stack visible
2. `landing-desktop-light.png`
3. `landing-mobile-dark.png`
4. `landing-mobile-light.png`
5. `werewolf-desktop-dark.png`
6. `werewolf-desktop-light.png`
7. `mafia-desktop-dark.png`
8. `mafia-desktop-light.png`
9. `lobby-desktop-dark.png` — sanity check: lobby backdrop unchanged
10. `landing-scrolled-bottom.png` — confirms ambient stays fixed during scroll

### Required GIF

`landing-theatre-scroll.gif` — 6-second video of scrolling from top to bottom on `/`. Should show:
- Ambient backdrop **stays put**
- Hero card and content **scroll over it**
- Vignette + drift create subtle living atmosphere

---

## Не пипай

- `apps/web/components/landing-experience.tsx` — JSX unchanged
- `apps/web/components/games/game-home-page.tsx` — JSX unchanged
- `apps/web/components/games/QuickStartSection*.tsx` — unchanged
- `apps/web/lib/seo.ts`, metadata, SEO config
- `.lobby-shell::before`, `.history-shell::before`, `.rules-shell::before` — keep original absolute pseudo
- Body pseudo on FAQ/privacy/terms/status (`body:has(.faq-shell)::before` etc.) — already handled separately
- Game-server / schemas / role-assignment
- Imagen — uses existing WebP files only

---

## Commit summary

5 atomic English commits on `main`:

1. `fix(landing): replace zoomed absolute ambient with fixed-viewport pseudo on body`
2. `feat(landing): radial spotlight vignette focuses backdrop on hero region`
3. `style(landing): cinematic floor shadow on hero card lifts it off backdrop`
4. `style(landing): inner edge highlights for hero card pop`
5. `chore(landing): verify theatre backdrop scope (lobby/history/rules untouched)`

PR title (if not direct push): `feat(landing): cinematic theatre backdrop — fixed ambient, spotlight, floor shadow`

---

## Notes for ChatGPT 5.5 x-high / Codex

- **Phase ordering matters:** Stage 1 (the disable-of-old-pseudo) must land before or together with the new body pseudo enable — otherwise during the transition the old backdrop will overlap with the new one. Apply 1a → 1d in the same commit.
- **`:has()` selector support:** Required for body to react to landing-shell descendant. All target browsers (Chrome 105+, Safari 15.4+, Firefox 121+) support it. If targeting older browsers, fall back to adding a class on `<body>` server-side via headers/middleware — but **don't** do this in this PR.
- **`image-set()` with `type()`:** Existing pattern in codebase. No changes needed.
- **Family attribute selector:** `body:has(.game-home-shell[data-family="werewolves"])` requires `data-family` attribute to be on `.game-home-shell` element. Verify by reading `apps/web/components/games/game-home-page.tsx`:
  ```tsx
  <main className="shell game-home-shell" data-theme={family} data-family={family}>
  ```
  ✓ Confirmed.
- **No motion-reduce guards:** Per project convention. Drift is barely perceptible (~4% over 48s) and matches ambient candle-breath pattern used elsewhere.
- **No new dependencies:** All CSS-only. No npm changes, no imagen, no JS edits.

---

(End of prompt)
