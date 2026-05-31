# Codex prompt — Add bottom breathing room inside utility shells

Малък focused fix за visible bug: на 4-те utility страници (`/privacy`, `/terms`, `/report`, `/status`) последното съдържание touches долната граница на frame-а. Няма visible margin между last content row и frame border. Изглежда сбито.

**Причина:** В предишен PR (`codex-prompt-utility-frame-and-bg-fix.md`) задах `padding: 0` на shell-овете да override-ва `.shell` базовия `padding: 32px 0 56px`. Това махна и top padding (което е OK за banner flush) **и** bottom padding (което НЕ е OK — съдържанието е сбито).

**Работа директно на `main`.** ~2 commits.

---

## Pre-analysis

ChatGPT direkt audit с screenshots показа:
- `/privacy` "История на промените (2)" accordion touches frame bottom
- `/terms` "Формалните клаузи (6)" toggle touches frame bottom
- `/report` "Затвори" / "Напред →" wizard buttons touch frame bottom
- `/status` Discord / Telegram subscribe cards touch frame bottom (с ~4-8px gap)

На всички 4 страници — frame-ът е добре, painterly bg прозира правилно, hero banners са clipped правилно. Проблемът е **само bottom padding** на shell-овете.

Текущ CSS (от earlier fix prompt):

```css
.privacy-shell,
.terms-shell,
.report-shell,
.status-shell,
.faq-shell {
  position: relative;
  z-index: 0;
  isolation: isolate;
  margin: 24px auto 96px;
  padding: 0;                  /* ← THIS — overrides .shell's bottom padding */
  border-radius: 28px;
  border: 1px solid rgba(245, 232, 200, 0.14);
  background: rgba(17, 12, 10, 0.92);
  overflow: hidden;
  /* ... */
}
```

`padding: 0` беше нужно за banner flush-to-top, но премахна **bottom padding** също.

---

## Pre-decisions

- **Approach**: Сменям `padding: 0` → `padding: 0 0 56px` (запазвам padding-top: 0 за banner-а flush; добавям 56px padding-bottom за breathing room).
- **Mobile**: на narrow viewports (`<640px`) reduce-ваме до 40px bottom padding.
- **Branch**: directly on `main`. No feature branch.
- **No JSX changes**, no new assets — pure CSS.

---

## Stage 1 — Fix utility shells bottom padding

**File:** `apps/web/app/globals.css`

Find блок за utility shell-овете (likely вече содержа `padding: 0`):

```css
.privacy-shell,
.terms-shell,
.report-shell,
.status-shell,
.faq-shell {
  /* ... existing rules ... */
  padding: 0;
  /* ... */
}
```

**Replace с:**

```css
.privacy-shell,
.terms-shell,
.report-shell,
.status-shell,
.faq-shell {
  /* ... keep existing rules unchanged ... */
  padding: 0 0 56px;     /* CHANGED: was padding: 0 */
  /* ... */
}
```

**Find mobile breakpoint** (may exist as `@media (max-width: 640px)` block за utility shells):

```css
@media (max-width: 640px) {
  .privacy-shell,
  .terms-shell,
  .report-shell,
  .status-shell,
  .faq-shell {
    margin: 16px auto 64px;
    border-radius: 20px;
  }
}
```

**Replace с:**

```css
@media (max-width: 640px) {
  .privacy-shell,
  .terms-shell,
  .report-shell,
  .status-shell,
  .faq-shell {
    margin: 16px auto 64px;
    padding: 0 0 40px;     /* ADDED: tighter on mobile */
    border-radius: 20px;
  }
}
```

If mobile block doesn't exist, add it.

---

## Stage 2 — Visual regression baselines

Намалена е промяна, но visual baselines ще се отличават (frame-ът e с малко по-висок последен section gap). Regenerate:

```bash
pnpm visual:update
pnpm visual
```

Affected baselines:
- `/privacy` desktop + mobile (dark + light)
- `/terms` desktop + mobile (dark + light)
- `/report` desktop + mobile (wizard step 1)
- `/status` desktop + mobile
- `/faq` desktop + mobile

---

## Acceptance criteria

1. **/privacy** "История на промените" accordion има ≥ 48px visible space до bottom border.
2. **/terms** "Формалните клаузи" toggle същото.
3. **/report** wizard navigation buttons (Затвори / Напред) — същото.
4. **/status** Subscribe Discord/Telegram cards row — същото.
5. **Mobile** (<640px): ≥ 32px bottom space (tighter но still visible).
6. **No regression** в hero banner positioning (still flush at top).
7. **No regression** в content section spacing (sections already имат their own margins).
8. **БГ copy непроменена**, English commits.
9. **`pnpm verify` passes**.
10. **Работено директно на `main`**.

---

## Не пипай

- Hero banner positioning / clipping.
- Content section margins / gaps между sections.
- Cookie banner z-index.
- Light theme variables.
- Painterly bg opacity.
- All предишни prompts work остава inchanged.

---

## Verification

```bash
pnpm install
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm smoke
pnpm visual:update
pnpm visual
pnpm perf:budget
```

Manual:
1. Open `/privacy` → scroll to bottom → "История на промените" accordion имa visible ~56px space below it до frame bottom border. Painterly bg прозира malko между frame и viewport edge below.
2. Same check for `/terms`, `/report`, `/status`.
3. Mobile (390×844 viewport simulator) → tighter но still has ~40px breathing room.
4. Light theme toggle → spacing identical в двата режима.

---

## Commit strategy (2 atomic English commits, on `main`)

1. `fix(utility-shells): restore bottom padding for visible breathing room`
2. `chore(visual): regenerate baselines after utility bottom padding fix`

Workflow:
```bash
git status
git pull origin main --rebase

# Stage 1:
# Edit apps/web/app/globals.css — change padding: 0 → padding: 0 0 56px
git add apps/web/app/globals.css
git commit -m "fix(utility-shells): restore bottom padding for visible breathing room"
pnpm regression && pnpm typecheck && pnpm build
# Green → push. Red → fix.

# Stage 2:
pnpm visual:update
git add apps/web/__visual__/__baseline__/
git commit -m "chore(visual): regenerate baselines after utility bottom padding fix"
pnpm visual
# Green → push.
```

---

(End of prompt)
