# Codex prompt — Match hero title prominence on /terms, /report, /status to /privacy

Малък focused visual fix: hero титлите на `/terms`, `/report`, `/status` визуално изглеждат **по-малки и "супер нагоре"** в banner-а, докато `/privacy` title запълва пространството добре. Причината е, че Privacy title-ът wrap-ва до 2 реда (по-дълъг content), а другите остават 1 ред.

**Работа директно на `main`.** ~2 commits. Само CSS.

---

## Pre-analysis

Title content lengths:

| Page | Title | Length | Lines @ current font-size | Visual fill |
|---|---|---|---|---|
| `/privacy` | "Твоите тайни остават при теб." | 29 ch | 2 | ✅ Good |
| `/terms` | "Сядаме на една маса." | 20 ch | 1 | ❌ Sparse |
| `/report` | "Светим за тебе." | 15 ch | 1 | ❌ Sparse |
| `/status` | "Светилникът свети." | 17 ch | 1 | ❌ Sparse |

Текущи `font-size` стойности:

| Page | Title `font-size` clamp | Min `min-height` clamp |
|---|---|---|
| `/privacy` | `clamp(2rem, 5vw, 3.4rem)` | `clamp(280px, 38vw, 460px)` |
| `/terms` | `clamp(2rem, 5vw, 3.4rem)` | `clamp(280px, 38vw, 460px)` |
| `/report` | `clamp(2rem, 5vw, 3.4rem)` | `clamp(280px, 38vw, 460px)` |
| `/status` | `clamp(2rem, 4.5vw, 3rem)` | `clamp(260px, 32vw, 400px)` |

Privacy и Terms/Report имат **същия font-size**, но Privacy wrap-ва защото е по-дълъг. Status има още по-малък font + по-нисък banner.

---

## Pre-decisions

- **Bump font-size** на Terms/Report/Status titles до `clamp(2.4rem, 6vw, 4rem)` — visually larger, дава "weight" даже когато е 1 ред.
- **Tighten max-width** до `18ch` — encourage natural wrap when content allows.
- **Match min-height** на Status hero до Privacy's `clamp(280px, 38vw, 460px)` — consistent banner height.
- **Add `text-wrap: balance`** — CSS balanced wrapping за по-elegant 2-line shapes.
- Branch: directly on `main`, ~2 commits, no JSX changes.

---

## Stage 1 — Bump hero title font sizes

**File:** `apps/web/app/globals.css`

### Step 1a: Terms + Report hero titles

Find existing rules:

```css
.terms-hero-title,
.report-hero-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(2rem, 5vw, 3.4rem);
  /* ... */
  max-width: 22ch;
  /* ... */
}
```

(May be one shared rule или separate. Search for `.terms-hero-title` and `.report-hero-title` definitions.)

**Replace font-size + max-width:**

```css
.terms-hero-title,
.report-hero-title {
  /* keep font-family, color, text-shadow, line-height as-is */
  font-size: clamp(2.4rem, 6vw, 4rem);     /* WAS clamp(2rem, 5vw, 3.4rem) */
  max-width: 18ch;                          /* WAS 22ch — tighter encourages wrap */
  text-wrap: balance;                       /* ADD — balanced line shapes */
}
```

### Step 1b: Status hero title

Find:

```css
.status-hero-title {
  font-size: clamp(2rem, 4.5vw, 3rem);
  /* ... */
}
```

**Replace:**

```css
.status-hero-title {
  font-size: clamp(2.4rem, 6vw, 4rem);     /* match Terms/Report/Privacy */
  max-width: 18ch;
  text-wrap: balance;
}
```

### Step 1c: Match Status banner min-height

Find:

```css
.status-hero {
  /* ... */
  min-height: clamp(260px, 32vw, 400px);
  /* ... */
}
```

**Replace:**

```css
.status-hero {
  min-height: clamp(280px, 38vw, 460px);   /* match privacy/terms/report */
}
```

---

## Stage 2 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected baselines (× 2 за dark + light theme):
- `/terms` desktop + mobile
- `/report` desktop + mobile (wizard step 1)
- `/status` desktop + mobile

Privacy НЕ се променя — само Terms/Report/Status получават bumped typography.

---

## Acceptance criteria

1. **`/terms` title** "Сядаме на една маса." визуално доминира hero-то, similar weight като `/privacy`. Може да wrap-не до 2 реда на standard desktop viewport (≈1200px) ако max-width: 18ch е достатъчно тесен.
2. **`/report` title** "Светим за тебе." — bigger, по-prominent. Probably still 1 line (short content), но физически по-голям.
3. **`/status` title** "Светилникът свети." — bigger, status banner now same height като другите.
4. **`/privacy` НЕ се променя** — baseline reference.
5. **Mobile** (`<640px`): font-size scales down via clamp `min` (2.4rem = 38.4px), still legible.
6. **`text-wrap: balance`** дава равни редове at 2-line wrap (не "8 + 12" chars but "10 + 10").
7. **No layout shift** в content sections под hero — само hero typography се променя.
8. **БГ copy непроменена**, English commits.
9. **`pnpm verify` passes**.

---

## Не пипай

- `/privacy` — baseline reference, остава както е.
- Banner image assets, banner positioning, hero subtitle, kicker, meta.
- Frame styling, painterly bg, cookie banner z-index.
- Content sections under hero.
- Light theme overrides.
- Component JSX.

---

## Verification

```bash
pnpm install
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm visual:update
pnpm visual
```

Manual:
1. Open `/terms` в desktop browser → title "Сядаме на една маса." визуално dominira left half на hero-а. Banner art (handshake + candle) дясно — все още видим но не overpower-ва.
2. Open `/report` → "Светим за тебе." същото prominence.
3. Open `/status` → "Светилникът свети." същото. Banner area вече е същия height като Privacy.
4. Open `/privacy` → still looks great (unchanged baseline).
5. Compare side-by-side с `/privacy` — typography weight чувства се consistent across all 4 pages.
6. Resize browser to 600px width → titles scale down gracefully via clamp.
7. Light theme toggle → text remains cream (banner overlay), title sizes остават bumped.

---

## Commit strategy (2 atomic English commits, on `main`)

1. `style(utility-heroes): match terms report status title prominence to privacy`
2. `chore(visual): regenerate baselines for utility hero typography bump`

Workflow:
```bash
git status
git pull origin main --rebase

# Edit apps/web/app/globals.css — bump font-sizes + max-widths + min-height
git add apps/web/app/globals.css
git commit -m "style(utility-heroes): match terms report status title prominence to privacy"
pnpm regression && pnpm typecheck && pnpm build

# Update visuals
pnpm visual:update
git add apps/web/__visual__/__baseline__/
git commit -m "chore(visual): regenerate baselines for utility hero typography bump"
pnpm visual
```

---

(End of prompt)
