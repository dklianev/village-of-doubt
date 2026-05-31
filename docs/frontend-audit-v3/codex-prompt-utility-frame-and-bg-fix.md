# Codex prompt — Fix utility pages: frame + painterly bg + cookie overlap + light theme

Малък focused **polish PR** който fix-ва **всички** проблеми открити в audit-а на 4-те utility страници (`/privacy`, `/terms`, `/report`, `/status`) — структурно (frame), визуално (painterly bg правилно), функционално (cookie banner overlap), и темно/светло theme.

**Без нови imagen асети** — само CSS + малки JSX корекции.

**⚠ Директно върху main branch** (без feature branch).

~8 atomic English commits.

---

## Pre-analysis (consolidated audit findings)

ChatGPT направи Playwright audit с screenshots на 5 страници (homepage reference + 4 utility) и читен `getComputedStyle` сравнение. Намерени:

### 🔴 P0 #1 — Painterly bg е невидим (over-tinted)

Hard data сравнение:

| Aspect | Homepage `.landing-shell::before` (correct) | Utility `.privacy-shell::before` etc (broken) |
|---|---|---|
| Linear gradient opacity stops | **0.58 / 0.34 / 0.64** | 0.94 / 0.88 / 0.96 |
| Filter | **saturate(1.14) contrast(1.04)** | saturate(0.55) contrast(1.02) blur(3px) |
| Radial accents (warm amber + cool teal) | ✅ Present | ❌ Missing |
| Painterly art asset | `var(--art-landing-ambient)` | `var(--art-landing-ambient)` |

Резултат: painterly art-ът е там, но dark overlay covers ~92% от него. Filter desaturates and blurs further. Looks like solid void.

### 🔴 P0 #2 — Няма outer frame на 4-те страници

Homepage визуално е "rounded page card в средата с painterly bg около него". Utility pages са edge-to-edge без frame, без rounded corners, без видими margins. Painterly bg (даже да беше с правилни opacity-та) няма къде да прозре.

### 🟠 P1 #3 — Cookie banner overlapping content

Bледа кутийка "Използваме само необходимите бисквитки..." с "Разбрах" бутон, position: fixed bottom-right. Припокрива съдържание на **всичките 4 страници**:
- /privacy → covers "Изтегли всичките данни" button
- /terms → covers "Уважение към масата" promise card
- /report → covers type cards row
- /status → covers service tile badges

### 🟡 P2 #4 — /report step 1 button wording

В wizard step 1 има button "← Назад към началото". На първата стъпка "Назад" е misleading (няма previous step). Трябва "Затвори" или "Прескочи".

### 🟢 P3 #5 — Light theme не работи на тези страници

`<html data-theme="light">` не променя нищо на utility pages (CSS variables локирани на dark hex codes без `[data-theme="light"]` overrides).

---

## Pre-decisions (locked)

1. **Frame approach**: модифицираме directly `.privacy-shell` / `.terms-shell` / `.report-shell` / `.status-shell` с frame styling (no new wrapper div needed — shell IS the frame). `<main>` element-ите остават unchanged.

2. **Painterly bg opacity**: match homepage **exactly** — `0.58 / 0.34 / 0.64` linear stops + warm amber + cool teal radial accents + `saturate(1.14) contrast(1.04)` no blur.

3. **Cookie banner**: increase z-index to 100; document already padded enough (frame margin-bottom + padding). No layout change to content — just stack banner above.

4. **Light theme**: add `[data-theme="light"]` overrides for всичките CSS variables на 4-те shells.

5. **Branch**: directly on `main`. Validate с `pnpm regression && pnpm typecheck && pnpm build` след всеки commit.

---

## Stage 1 — Fix painterly bg (match homepage exactly)

**File:** `apps/web/app/globals.css`

**Find** existing `::before` rules за utility shells. Те съществуват от предишен PR (`status-light-theme-painterly-bg.md`) с грешни стойности. Заменете ги с homepage-matched values.

Search for current block (may be combined or separate):
```css
.privacy-shell::before,
.terms-shell::before,
.report-shell::before,
.status-shell::before,
.faq-shell::before {
  /* current values: rgba(13,10,8,0.94)... etc */
}
```

**Replace with:**

```css
/* ============================== */
/* Utility pages — atmospheric bg */
/* (matches homepage .landing-shell::before exactly) */

.privacy-shell::before,
.terms-shell::before,
.report-shell::before,
.status-shell::before,
.faq-shell::before {
  position: fixed;
  inset: 0;
  z-index: -1;
  content: "";
  background:
    radial-gradient(ellipse at 4% 50%, rgba(200, 154, 85, 0.18), transparent 34rem),
    radial-gradient(ellipse at 96% 48%, rgba(43, 93, 105, 0.18), transparent 38rem),
    linear-gradient(115deg,
      rgba(5, 7, 8, 0.58) 0%,
      rgba(6, 8, 9, 0.34) 47%,
      rgba(5, 7, 8, 0.64) 100%),
    var(--art-landing-ambient) center / cover no-repeat;
  filter: saturate(1.14) contrast(1.04);
  pointer-events: none;
}

/* Light theme — parchment cream replaces ink overlay */

[data-theme="light"] .privacy-shell::before,
[data-theme="light"] .terms-shell::before,
[data-theme="light"] .report-shell::before,
[data-theme="light"] .status-shell::before,
[data-theme="light"] .faq-shell::before {
  background:
    radial-gradient(ellipse at 4% 50%, rgba(255, 230, 180, 0.32), transparent 34rem),
    radial-gradient(ellipse at 96% 48%, rgba(180, 200, 220, 0.28), transparent 38rem),
    linear-gradient(115deg,
      rgba(252, 244, 230, 0.58) 0%,
      rgba(252, 244, 230, 0.34) 47%,
      rgba(252, 244, 230, 0.64) 100%),
    var(--art-landing-ambient) center / cover no-repeat;
  filter: saturate(0.95) contrast(1.06);
}
```

**Verify** chrez DevTools после deploy:
- Painterly art трябва да е visible at the edges
- Warm amber glow в левия long edge
- Cool teal glow в десния long edge
- Колоритен boost (не desaturated)

---

## Stage 2 — Add frame styling to utility shells

**File:** `apps/web/app/globals.css`

Add след atmospheric bg block:

```css
/* ============================== */
/* Utility shells — rounded frame */

.privacy-shell,
.terms-shell,
.report-shell,
.status-shell,
.faq-shell {
  position: relative;
  z-index: 0;
  isolation: isolate;
  margin: 24px auto 96px;     /* override .shell's margin: 0 auto */
  padding: 0;                  /* override .shell's padding: 32px 0 56px */
  border-radius: 28px;
  border: 1px solid rgba(245, 232, 200, 0.14);
  background: rgba(17, 12, 10, 0.92);
  overflow: hidden;            /* clip banner top corners */
  box-shadow:
    0 32px 60px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(245, 232, 200, 0.06);
}

[data-theme="light"] .privacy-shell,
[data-theme="light"] .terms-shell,
[data-theme="light"] .report-shell,
[data-theme="light"] .status-shell,
[data-theme="light"] .faq-shell {
  background: rgba(252, 246, 236, 0.94);
  border-color: rgba(83, 52, 31, 0.18);
  box-shadow:
    0 32px 60px rgba(40, 26, 16, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

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

`.shell` базовият клас вече задава `width: min(1180px, calc(100vw - 32px))` — НЕ override-вай това. Само добавяме visual frame.

---

## Stage 3 — Remove banner edge-to-edge behavior

Banner-ите се "хвaнaт" автоматично в новата frame чрез `overflow: hidden` на shell-овете. Но трябва да премахнем `border-bottom` на `.privacy-hero` / `.terms-hero` / `.report-hero` / `.status-hero` ако съществува — frame border-ът сам ще direct-ва ръба.

Search для `.privacy-hero { ... border-bottom: 1px solid var(--privacy-border); ... }` (or similar per page) и **премахни** `border-bottom`. Frame parent has its own border + overflow:hidden, no need.

---

## Stage 4 — Cookie banner z-index fix

**File:** `apps/web/app/globals.css`

Find `.cookie-banner` (or whatever class). Update:

```css
.cookie-banner {
  /* keep existing position + sizing */
  position: fixed;
  bottom: 16px;
  right: 16px;
  max-width: 360px;
  /* ... existing styles ... */
  z-index: 100;                   /* CHANGE: above content + frame */
}
```

If z-index is already set lower, bump to 100. The frame uses `z-index: 0`, painterly bg uses `z-index: -1`, navbar likely uses ~50. Banner needs to be on top.

**Optional UX polish:** add slight hover state to draw eye:

```css
.cookie-banner:hover {
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(245, 232, 200, 0.08);
}
```

---

## Stage 5 — /report step 1 button wording

**File:** `apps/web/components/report/ReportWizard.tsx`

Find the back button rendering logic:

```tsx
{stepIndex > 0 ? (
  <button type="button" className="report-wizard-back" onClick={goBack}>
    ← Назад
  </button>
) : (
  <Link href="/" className="report-wizard-back">
    ← Към началото
  </Link>
)}
```

Change first-step Link label to **"Затвори"** (the user is just leaving the report flow, not "going back" anywhere):

```tsx
{stepIndex > 0 ? (
  <button type="button" className="report-wizard-back" onClick={goBack}>
    ← Назад
  </button>
) : (
  <Link href="/" className="report-wizard-back">
    Затвори
  </Link>
)}
```

Без `←` arrow за close action (arrow implies "back to something").

---

## Stage 6 — Light theme variable overrides for 6 utility shells

**File:** `apps/web/app/globals.css`

Append в края (или там където CSS variables за utility shells живеят). Cover **всичките 6** utility/legal pages including `/account`.

```css
/* ============================== */
/* Utility pages — light theme    */
/* ============================== */

/* Privacy */
[data-theme="light"] .privacy-shell {
  --privacy-bg: transparent;
  --privacy-surface: rgba(255, 250, 238, 0.55);
  --privacy-surface-strong: rgba(255, 250, 238, 0.85);
  --privacy-text: #2a1b10;
  --privacy-text-muted: rgba(42, 27, 16, 0.74);
  --privacy-text-soft: rgba(42, 27, 16, 0.5);
  --privacy-border: rgba(83, 52, 31, 0.16);
  --privacy-border-strong: rgba(83, 52, 31, 0.32);
  --privacy-accent: #2d3f66;
  --privacy-accent-warm: #842f2b;
  --privacy-accent-soft: rgba(45, 63, 102, 0.16);
  --privacy-accent-warm-soft: rgba(132, 47, 43, 0.12);
}

/* Terms + Report (share --legal-* vars) */
[data-theme="light"] .terms-shell,
[data-theme="light"] .report-shell {
  --legal-bg: transparent;
  --legal-surface: rgba(255, 250, 238, 0.55);
  --legal-surface-strong: rgba(255, 250, 238, 0.85);
  --legal-text: #2a1b10;
  --legal-text-muted: rgba(42, 27, 16, 0.74);
  --legal-text-soft: rgba(42, 27, 16, 0.5);
  --legal-border: rgba(83, 52, 31, 0.16);
  --legal-border-strong: rgba(83, 52, 31, 0.32);
  --legal-accent-warm: #842f2b;
  --legal-accent-warm-soft: rgba(132, 47, 43, 0.12);
  --legal-ok: #3a7a3a;
  --legal-ok-soft: rgba(58, 122, 58, 0.14);
  --legal-not-ok: #a02a22;
  --legal-not-ok-soft: rgba(160, 42, 34, 0.14);
}

[data-theme="light"] .terms-shell { --legal-accent: #6a4a30; }
[data-theme="light"] .report-shell { --legal-accent: #a02a22; }

/* Status */
[data-theme="light"] .status-shell {
  --status-bg: transparent;
  --status-surface: rgba(255, 250, 238, 0.55);
  --status-surface-strong: rgba(255, 250, 238, 0.85);
  --status-text: #2a1b10;
  --status-text-muted: rgba(42, 27, 16, 0.74);
  --status-text-soft: rgba(42, 27, 16, 0.5);
  --status-border: rgba(83, 52, 31, 0.16);
  --status-border-strong: rgba(83, 52, 31, 0.32);
  --status-accent: #842f2b;
  --status-accent-soft: rgba(132, 47, 43, 0.14);
  --status-ok: #3a7a3a;
  --status-degraded: #c47a20;
  --status-down: #a02a22;
  --status-unknown: #7a6a55;
}

/* FAQ (uses --doc-* from earlier overhaul if present) */
[data-theme="light"] .faq-shell {
  --doc-bg: transparent;
  --doc-surface: rgba(255, 250, 238, 0.55);
  --doc-surface-strong: rgba(255, 250, 238, 0.85);
  --doc-text: #2a1b10;
  --doc-text-muted: rgba(42, 27, 16, 0.74);
  --doc-text-soft: rgba(42, 27, 16, 0.5);
  --doc-border: rgba(83, 52, 31, 0.16);
  --doc-border-strong: rgba(83, 52, 31, 0.32);
  --doc-accent: #842f2b;
  --doc-accent-soft: rgba(132, 47, 43, 0.14);
}

/* Account */
[data-theme="light"] .account-shell {
  --account-bg: transparent;
  --account-surface: rgba(255, 250, 238, 0.55);
  --account-surface-strong: rgba(255, 250, 238, 0.85);
  --account-text: #2a1b10;
  --account-text-muted: rgba(42, 27, 16, 0.74);
  --account-text-soft: rgba(42, 27, 16, 0.5);
  --account-border: rgba(83, 52, 31, 0.16);
  --account-border-strong: rgba(83, 52, 31, 0.32);
  --account-accent: #842f2b;
  --account-accent-soft: rgba(132, 47, 43, 0.14);
  --account-danger: #a02a22;
  --account-danger-soft: rgba(160, 42, 34, 0.12);
}
```

**Important:** Banner image overlay text (hero titles, kickers) трябва да остане **cream/light** в двата режима, защото banner image е dark cinematic. Verify че these properties не зависят от theme variables:

Search for `.privacy-hero-title`, `.terms-hero-title`, `.report-hero-title`, `.status-hero-title` и confirm че используват **hardcoded `#f5e8c8`** (not CSS var that switches). Same за `.*-hero-kicker`, `.*-hero-subtitle`.

Ако някоя hero text стои на CSS variable който се switch-ва в light mode, override с `!important`:

```css
[data-theme="light"] .privacy-hero-title,
[data-theme="light"] .terms-hero-title,
[data-theme="light"] .report-hero-title,
[data-theme="light"] .status-hero-title {
  color: #f5e8c8 !important;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
}
```

---

## Stage 7 — Investigate optional /privacy ribbon

В screenshot-а на /privacy се вижда странна horizontal "ribbon" / arrow decoration около "Какво гарантираме" section header. Codex: чети `apps/web/components/privacy/PrivacyPromiseWall.tsx` и `apps/web/components/privacy/PrivacyDashboard.tsx`. Ако виждаш ribbon/arrow декорация която не пасва на дизайна:

- Махни ribbon-а
- Запази section header чрез `.privacy-section-head` стандартен kicker + h2

Ако няма такава декорация — skip Stage 7. Това е discovery task, not blocker.

---

## Stage 8 — Visual regression baselines (dark + light)

```bash
pnpm visual:update
pnpm visual
```

Affected baselines (regenerate за двете theme states):

| Page | Dark | Light |
|---|---|---|
| /privacy desktop | ✓ | ✓ |
| /privacy mobile | ✓ | ✓ |
| /terms desktop | ✓ | ✓ |
| /terms mobile | ✓ | ✓ |
| /report desktop (wizard step 1) | ✓ | ✓ |
| /report mobile | ✓ | ✓ |
| /status desktop | ✓ | ✓ |
| /status mobile | ✓ | ✓ |
| /faq desktop | ✓ | ✓ |
| /account desktop | ✓ | ✓ |

При визуален review verify:
- Painterly bg е visible в margins около frame
- Warm amber glow в long edge на frame
- Cool teal glow в дясната strana
- Banner отгоре с правилно clipped rounded corners
- Cookie banner НЕ overlap-ва content (or e на стек above)

---

## Acceptance criteria

1. **Painterly bg matches homepage**: ::before rules за всичките 5 utility shells (`.privacy-shell`, `.terms-shell`, `.report-shell`, `.status-shell`, `.faq-shell`) използват **точно** homepage's opacity stops + radial accents + saturate(1.14) filter.

2. **Frame applied**: shell-овете имат `border-radius: 28px`, `border: 1px solid`, `background: rgba(17,12,10,0.92)`, `overflow: hidden`, margin top+bottom.

3. **Banner edges clipped**: banners на 4-те страници получават rounded top corners автоматично чрез parent overflow:hidden.

4. **Cookie banner z-index: 100** — над content и frame.

5. **/report step 1 back button**: показва "Затвори" (no arrow), не "Назад към началото".

6. **Light theme variables** override-нати за всичките 6 shells (`.privacy-shell`, `.terms-shell`, `.report-shell`, `.status-shell`, `.faq-shell`, `.account-shell`).

7. **Hero banner text** остава cream в двата theme states (banner image is dark cinematic).

8. **Light theme painterly bg** също switches — parchment cream replace на ink overlay.

9. **Visual baselines updated** за двата theme states.

10. **БГ copy остава**, English commits.

11. **Работено директно на `main`** branch.

12. **`pnpm verify` passes** end to end.

13. **No new dependencies, no new imagen assets**.

---

## Не пипай

- Server-side data fetching, API routes, Better Auth, schemas, role assignment.
- Homepage CSS (already correct — we're matching it, not changing it).
- Painterly art assets (`bg-landing-ambient.png/webp`) — used as-is.
- Hero banner art assets (status-banner, terms-banner, report-banner, etc.) — used as-is.
- Component logic (PrivacyDashboard, ReportWizard etc) — only the small back-button copy change в /report.

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

**Manual visual checks** (open localhost:3000):

### Dark theme (default)
1. `/privacy` → painterly bg visible в left+right margins around the rounded frame. Banner image fits within frame with rounded top corners. Cookie banner sits above content без overlap.
2. `/terms` → same: frame visible, painterly margins, banner clipped. Promise cards inside frame look properly contained.
3. `/report` → frame, painterly margins, lighthouse banner clipped. Step 1 shows "Затвори" not "Назад към началото". Cookie banner above type cards.
4. `/status` → frame, painterly margins, harbor banner clipped. Service tiles inside frame. Auto-refresh works.

### Light theme (click theme toggle)
5. Visit each page → painterly bg becomes parchment-cream tinted. Frame background becomes cream. Cards inside become light cream. Text becomes dark brown. Banner stays dark cinematic.

### Mobile (390×844)
6. Frame margin reduces to 16px each side, border-radius drops to 20px. Painterly bg still visible at narrow margins.

---

## Commit strategy (8 atomic English commits, directly on `main`)

**Working directly on `main` — validate after each commit.**

1. `fix(utility-bg): match homepage opacity stops and radial accents`
2. `style(utility-shells): add rounded frame border and overflow clipping`
3. `style(utility-banners): remove redundant border-bottom replaced by frame`
4. `fix(cookie-banner): raise z-index above utility frame`
5. `fix(report): change first-step back button to clearer Затвори copy`
6. `style(utility): add light theme variable overrides for six shells`
7. `style(utility): force cream hero overlay text in light theme`
8. `chore(visual): regenerate baselines for utility pages dark and light`

Workflow:
```bash
git status                # ensure clean
git pull origin main --rebase

# After each commit:
git add <specific files>
git commit -m "English message"
pnpm regression && pnpm typecheck && pnpm build
# If green → push. If red → fix or revert.
```

---

(End of prompt)
