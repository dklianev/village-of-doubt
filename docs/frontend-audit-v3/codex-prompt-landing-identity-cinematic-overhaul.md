# Codex prompt — Landing identity & cinematic depth overhaul

**Master prompt covering 3 phases:** premium card chrome, page-level identity split between `/`, `/werewolf`, `/mafia`, and cinematic illustrated panels for atmospheric night-timelines per family.

**Working directly on `main`.** Approximate scope: ~22 atomic English commits, 10 new imagen banners, ~5–7 hours Codex work at high reasoning. No new npm dependencies.

> **Optimised for ChatGPT 5.5 x-high / Codex** — every stage is self-contained with diffs, CSS specs, copy, acceptance criteria, and verification steps. The model should not need to ask clarifying questions; if it must, abort and reread the locked decisions.

---

## Why this PR exists

Commit `600e5bf style(home): open quickstart sections without outer frame` removed the outer `.quickstart-surface` chrome on the homepage. It solved a "box-in-box" problem but introduced two new ones:

1. **The two `.quickstart-mini-card`-s now feel weightless.** Box-shadow alpha dropped from `rgba(0,0,0,0.45)` to `rgba(80,50,24,0.14)` — a 3× reduction. The signature gold rule lines (`::before`/`::after` on the surface) disappeared entirely. The cards look like generic web-1.0 panels.
2. **`/werewolf` and `/mafia` use the same `QuickStartSection` component (5 generic steps + live ticker + last winner) as `/`.** Visiting any of the three pages feels identical, defeating the purpose of dedicated game pages.

This PR fixes both by:
- Phase 1 — Premium 3-layer cinematic shadow, hand-placed table rotation, restored gold rules, subtle candle-breath glow, inner brass hairline.
- Phase 2 — Split `QuickStartSection` into 3 distinct components: `UniversalHowToPlay` (only on `/`), `WerewolfNightTimeline` (only on `/werewolf`), `MafiaNightTimeline` (only on `/mafia`). Filter live stats per family. Add family-specific role spotlight, game variants chips, and recent-endings feed.
- Phase 3 — Generate 10 illustrated night-phase panel banners (5 per family) so each timeline feels like a cinematic storyboard, not generic medallions.

---

## Skills, agents, MCPs Codex should invoke

| Tool | When | Purpose |
|---|---|---|
| `frontend-design` skill | Phase 1 + Phase 2 component design | Generate distinctive, production-grade CSS/JSX without falling into generic AI aesthetics |
| `bg-copy-reviewer` agent | After every commit that touches user-facing strings | Verify all copy stays in Bulgarian and reads naturally |
| `role-mechanics-reviewer` agent | After Phase 2.4 game-server endpoint changes | Ensure family-filtered stats endpoint doesn't leak secret state |
| `context7` MCP | If unsure about modern CSS support (`@scope`, `color-mix`, `view-transition-name`, `content-visibility`) | Pull up latest browser support data |
| Postgres MCP | Phase 2.4 if "recent endings" needs DB query | Inspect schema for `games`, `game_results` tables |

---

## Pre-decisions (locked — no clarifying questions)

| Decision | Choice | Reason |
|---|---|---|
| Branch | Directly on `main`, atomic English commits | Matches existing audit-v3 PR style |
| Card chrome direction | "Cards on tavern table" + candle-breath + brass hairline (A + E + B combo from analysis) | Most thematic, premium, restores parchment+brass identity |
| Number of card rotations | 2 variants (–1.4° / +0.8°) via `:nth-child` | Subtle but visibly hand-placed |
| Shadow stack | 3-layer: contact + ambient + cinematic deep | Production-grade depth without fake parallax |
| Gold rule lines | Restored on `.quickstart-mini-card` (not on the absent surface) | Keeps signature parchment detail |
| Candle-breath animation | Box-shadow opacity only (6.4s cycle), **no reduced-motion guard** | Compositor-only, zero reflow; project convention skips motion overrides on ambient candle effects |
| Per-page architecture | Split into 3 page-specific timeline components | Each game gets its own narrative identity |
| Universal 5-step generic | Stays **only on `/`** | First-touch onboarding |
| Werewolf identity content | Atmospheric night-phase timeline + role spotlight (5 classic roles) + variants chips + werewolf-only live ticker + recent werewolf endings | Folklore immersion |
| Mafia identity content | Noir night-phase timeline + role hierarchy (5 roles) + mechanics deep dive + Sport Mafia callout + mafia-only live ticker + crime headlines | Noir immersion |
| Stats family filter | Update game-server `/stats` to include `byFamily.werewolves` and `byFamily.mafia` counts + `recentEndings` array per family | One endpoint, family-tagged data, minimal client churn |
| Recent endings feed | Server-side `lastWinner` extended to `recentEndings: Array<{family, code, winnerTeam, endedAt, ...}>` length up to 3 per family | Replaces single last winner; richer storytelling |
| Imagen banners | 10 new painterly oil panels (5 werewolf + 5 mafia), 1024×768 each, no visible text | Matches existing art system |
| Bulgarian-only copy | All user-facing strings; English only in commits + code identifiers | Project invariant |
| Validation | After each commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert immediately. | Matches project workflow |

---

# PHASE 1 — Brutally cool quickstart-mini-card chrome

**Target:** Restore visual weight to the two mini-cards without bringing back the heavy outer surface. Make them feel placed-by-hand on a wooden table, lit by candle, framed with fine brass.

**Files touched:**
- `apps/web/app/globals.css` (single file, `.quickstart-mini-card` selectors)
- No JSX changes in this phase

> **No `prefers-reduced-motion` guards in Phase 1.** Project convention: keep ambient effects (candle breath, hover lift, slight rotation) always-on. Do not add `@media (prefers-reduced-motion: reduce)` blocks anywhere in this phase.

## Stage 1.1 — Three-layer cinematic shadow stack

Replace single shadow with contact + ambient + cinematic deep + paper top sheen.

**File:** `apps/web/app/globals.css` — locate `.quickstart-mini-card` light theme (line ~3275) and replace box-shadow:

```diff
  .quickstart-mini-card {
    position: relative;
    overflow: hidden;
    color: var(--ink);
    background:
      radial-gradient(circle at 16% 0%, rgba(255, 255, 255, 0.52), transparent 18rem),
      linear-gradient(145deg, rgba(255, 247, 229, 0.94), rgba(223, 193, 137, 0.9)),
      var(--texture-paper) center / 540px 540px;
-   box-shadow:
-     0 18px 44px rgba(80, 50, 24, 0.14),
-     inset 1px 1px rgba(255, 255, 255, 0.32);
+   box-shadow:
+     0 2px 4px rgba(70, 38, 18, 0.18),         /* contact — tight, close */
+     0 12px 32px rgba(70, 38, 18, 0.22),       /* ambient — mid distance */
+     0 28px 64px rgba(70, 38, 18, 0.16),       /* cinematic — far, soft */
+     inset 0 1px 0 rgba(255, 255, 255, 0.6),   /* paper top sheen */
+     inset 1px 1px rgba(255, 255, 255, 0.32);  /* preserved corner highlight */
  }
```

And dark theme override (line ~3580):

```diff
  html[data-theme="dark"] .quickstart-mini-card {
    color: #fff7e5;
    background:
      radial-gradient(circle at 18% 0%, rgba(248, 236, 210, 0.14), transparent 18rem),
      linear-gradient(145deg, rgba(34, 22, 17, 0.94), rgba(13, 9, 8, 0.9)),
      var(--texture-paper) center / 540px 540px;
-   box-shadow:
-     0 18px 48px rgba(0, 0, 0, 0.34),
-     inset 1px 1px rgba(248, 236, 210, 0.1);
+   box-shadow:
+     0 2px 4px rgba(0, 0, 0, 0.42),
+     0 12px 32px rgba(0, 0, 0, 0.48),
+     0 28px 64px rgba(0, 0, 0, 0.36),
+     inset 0 1px 0 rgba(248, 236, 210, 0.14),
+     inset 1px 1px rgba(248, 236, 210, 0.1);
  }
```

Same pattern for `.landing-quickstart .quickstart-mini-card` (line ~3823) and its dark variant (line ~3917). Use the same 3-layer recipe — these are the landing-page-specific overrides.

**Why:** A single shadow looks flat. Three layered shadows simulate real lighting (contact + ambient + cinematic distance). The `inset 0 1px` adds a "paper top edge" highlight that makes the card feel like a physical object.

**Commit:**
```
style(quickstart): three-layer cinematic shadow stack for mini-cards
```

## Stage 1.2 — Hand-placed rotations + hover lift

Each card sits at a slight rotation, as if placed by hand. On hover, it straightens and lifts.

**File:** `apps/web/app/globals.css` — after existing `.quickstart-mini-card` block:

```css
.quickstart-mini-card {
  /* Add transition for transform */
  transition: transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.quickstart-row .quickstart-mini-card:nth-child(1) {
  transform: rotate(-1.4deg);
}

.quickstart-row .quickstart-mini-card:nth-child(2) {
  transform: rotate(0.8deg) translateY(6px);
}

.quickstart-row .quickstart-mini-card:hover,
.quickstart-row .quickstart-mini-card:focus-within {
  transform: rotate(0deg) translateY(-2px);
}
```

**Commit:**
```
style(quickstart): hand-placed rotations and hover straighten for mini-cards
```

## Stage 1.3 — Restore gold rule lines on mini-cards

Commit `600e5bf` removed the gold rules via `.quickstart-surface::before/::after { display: none }`. Now those rules need to live on the mini-cards themselves.

**File:** `apps/web/app/globals.css` — `.quickstart-surface::before/::after { display: none }` rule (line ~3317) — restrict it ONLY to surface, NOT mini-cards:

```diff
- .quickstart-surface::before,
- .quickstart-surface::after {
+ .quickstart-surface::before,
+ .quickstart-surface::after {
    display: none;
  }
```

(Already correct in current state — verify no `.quickstart-mini-card::before/::after { display: none }` rules exist that would break the next step.)

The existing gold rule definition (line ~3267):

```css
.quickstart-surface::before,
.quickstart-surface::after,
.quickstart-mini-card::before,
.quickstart-mini-card::after {
  position: absolute;
  right: 24px;
  left: 24px;
  height: 1px;
  content: "";
  background: linear-gradient(90deg, transparent, rgba(200, 154, 85, 0.9) 30%, rgba(200, 154, 85, 0.9) 70%, transparent);
  pointer-events: none;
}

.quickstart-surface::before,
.quickstart-mini-card::before {
  top: 0;
}

.quickstart-surface::after,
.quickstart-mini-card::after {
  bottom: 0;
}
```

This already covers `.quickstart-mini-card::before/::after`. But since commit `600e5bf` removed `.quickstart-surface` chrome entirely, the `::before/::after` on surface are hidden by the explicit `display: none` rule. The mini-card rules should still apply.

**Verify on /:** Two mini-cards (live + winner) should show gold rule lines at top and bottom. If they don't, the `display: none` rule is too broad. Inspect with DevTools and confirm. If broken, scope the `display: none` more tightly:

```css
.quickstart-surface::before,
.quickstart-surface::after {
  display: none;
}
/* mini-cards keep their gold rules */
```

**Commit:**
```
style(quickstart): keep gold rule lines visible on mini-cards (scope surface hide)
```

## Stage 1.4 — Candle-breath glow animation

Add a subtle 6.4-second box-shadow opacity pulse — barely visible but adds "alive, lit by candlelight" feel. **No `prefers-reduced-motion` guard** — project convention skips motion overrides for ambient candle/breath effects (they're decorative and low-amplitude).

**File:** `apps/web/app/globals.css` — after `.quickstart-mini-card` block:

```css
@keyframes candleBreath {
  0%, 100% {
    box-shadow:
      0 2px 4px rgba(70, 38, 18, 0.18),
      0 12px 32px rgba(70, 38, 18, 0.22),
      0 28px 64px rgba(70, 38, 18, 0.16),
      0 0 0 rgba(209, 154, 66, 0),
      inset 0 1px 0 rgba(255, 255, 255, 0.6),
      inset 1px 1px rgba(255, 255, 255, 0.32);
  }
  50% {
    box-shadow:
      0 2px 4px rgba(70, 38, 18, 0.18),
      0 14px 36px rgba(70, 38, 18, 0.26),
      0 32px 72px rgba(70, 38, 18, 0.2),
      0 0 36px rgba(209, 154, 66, 0.1),         /* warm halo bloom */
      inset 0 1px 0 rgba(255, 255, 255, 0.6),
      inset 1px 1px rgba(255, 255, 255, 0.32);
  }
}

@keyframes candleBreathDark {
  0%, 100% {
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.42),
      0 12px 32px rgba(0, 0, 0, 0.48),
      0 28px 64px rgba(0, 0, 0, 0.36),
      0 0 0 rgba(209, 154, 66, 0),
      inset 0 1px 0 rgba(248, 236, 210, 0.14),
      inset 1px 1px rgba(248, 236, 210, 0.1);
  }
  50% {
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.42),
      0 14px 36px rgba(0, 0, 0, 0.54),
      0 32px 72px rgba(0, 0, 0, 0.42),
      0 0 42px rgba(209, 154, 66, 0.16),
      inset 0 1px 0 rgba(248, 236, 210, 0.14),
      inset 1px 1px rgba(248, 236, 210, 0.1);
  }
}

.quickstart-mini-card {
  animation: candleBreath 6.4s ease-in-out infinite;
}

html[data-theme="dark"] .quickstart-mini-card {
  animation: candleBreathDark 6.4s ease-in-out infinite;
}

/* Stagger the second card so they don't pulse in sync */
.quickstart-row .quickstart-mini-card:nth-child(2) {
  animation-delay: 1.6s;
}
```

**Note:** Putting the animation on `box-shadow` is compositor-only on modern browsers when no other paint change occurs. Verify in DevTools Performance: no `Paint` events on cards during idle.

**Commit:**
```
style(quickstart): candle-breath glow animation with reduced-motion guard
```

## Stage 1.5 — Inner brass hairline detail

Add a fine inset brass line just inside the card border — premium magazine-chrome touch.

**File:** `apps/web/app/globals.css` — in `.quickstart-mini-card`:

```diff
  .quickstart-mini-card {
-   border: 1px solid rgba(132, 92, 48, 0.22);  /* or whatever current border */
+   border: 1px solid rgba(132, 92, 48, 0.28);
    /* ... */
  }

+ .quickstart-mini-card {
+   /* Inner brass hairline via outline (avoids extra pseudo-element) */
+   outline: 1px solid rgba(209, 154, 66, 0.16);
+   outline-offset: -5px;
+ }

+ html[data-theme="dark"] .quickstart-mini-card {
+   outline-color: rgba(209, 154, 66, 0.22);
+ }
```

**Why outline + offset:** Avoids adding another pseudo-element (we'd be over budget with rules + corners), avoids border-stacking trickery. Outline doesn't affect layout.

**Commit:**
```
style(quickstart): inner brass hairline via inset outline
```

## Stage 1.6 — Verify with frontend-design skill

After committing 1.1–1.5, invoke the `frontend-design` skill with this brief:

```
Review .quickstart-mini-card visual quality on / homepage (dark + light).
Goal: production-grade premium feel, parchment + brass aesthetic, hand-placed cards lit by candlelight.
Confirm: shadow depth feels right (not too soft, not theatrical), rotations feel deliberate, gold rule lines preserve identity, hairline brass detail visible but subtle.
If anything feels off, propose precise CSS tweaks in numeric terms (opacity, blur, offset).
```

Apply the skill's recommendations as a final polish commit:

**Commit:**
```
style(quickstart): polish pass per frontend-design skill review
```

---

# PHASE 2 — Page identity split

**Target:** Make `/`, `/werewolf`, `/mafia` feel like three different destinations. Each game page gets atmospheric, family-specific content that goes deeper than generic onboarding.

## Stage 2.1 — Audit & component map

Before code changes, document the new architecture in `apps/web/components/landing/README.md` (create if missing):

```md
# Landing & game-home components

## Page → component map

### `/` (homepage)
- `LandingExperience` (server) — hero card + ModeChoiceCards
- `<UniversalHowToPlay />` — 5-step generic onboarding (was QuickStartSection)
- `<LiveTickerCard family={null} />` — combined werewolf + mafia stats
- `<RecentEndingsCard family={null} />` — last 3 endings from any family

### `/werewolf`
- `GameHomePage(family="werewolves")` — hero (existing)
- `<WerewolfNightTimeline />` — 5 atmospheric night phases with painterly panels
- `<RoleSpotlight family="werewolves" />` — 5 classic werewolf roles with art
- `<VariantsChips family="werewolves" />` — Classic / Lovers / Vampires / Madman
- `<LiveTickerCard family="werewolves" />` — werewolf-only stats
- `<RecentEndingsCard family="werewolves" />` — last 3 werewolf endings

### `/mafia`
- `GameHomePage(family="mafia")` — hero (existing)
- `<MafiaNightTimeline />` — 5 noir night phases with painterly panels
- `<RoleSpotlight family="mafia" />` — 5 mafia roles (Town/Mafia/Sheriff/Don/Doctor)
- `<MafiaMechanicsCallouts />` — alibis, signal, investigation explainer
- `<SportMafiaCallout />` — Sport Mafia mode highlight
- `<LiveTickerCard family="mafia" />` — mafia-only stats
- `<RecentEndingsCard family="mafia" />` — last 3 mafia endings

## Shared chrome
- `.quickstart-mini-card` styles still apply to `<LiveTickerCard />` and `<RecentEndingsCard />` across all 3 pages.
```

**Commit:**
```
docs(landing): page-component map for identity-split refactor
```

## Stage 2.2 — Extract `UniversalHowToPlay` (`/` only)

Rename existing landing `QuickStartSection` to clarify purpose.

**File:** Move `apps/web/components/landing/QuickStartSection.tsx` content into:
- `apps/web/components/landing/UniversalHowToPlay.tsx` — keep the 5 STEPS array + JSX, drop the `<LiveTickerCard>`/`<LastWinnerCard>` block (those move to the shared cards below)
- `apps/web/components/landing/LiveTickerCard.tsx` — extract & make `family` prop nullable
- `apps/web/components/landing/RecentEndingsCard.tsx` — extract & extend to take an array of endings

**File:** `apps/web/components/landing/UniversalHowToPlay.tsx` (new):

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  BallotIcon,
  HouseIcon,
  KeyIcon,
  MaskIcon,
  MoonIcon,
} from "@/components/landing/quickstart-icons";

const STEPS = [
  { label: "Вход",  body: "Влизаш с Google, Discord или имейл.",                icon: <KeyIcon /> },
  { label: "Стая",  body: "Създаваш код или се присъединяваш към приятел.",     icon: <HouseIcon /> },
  { label: "Роля",  body: "Сървърът ти показва само твоята карта.",             icon: <MaskIcon /> },
  { label: "Нощ",   body: "Действаш тихо, ако ролята ти го позволява.",         icon: <MoonIcon /> },
  { label: "Глас",  body: "Денят решава кой ще напусне играта.",                icon: <BallotIcon /> },
] as const;

export function UniversalHowToPlay() {
  return (
    <section className="landing-quickstart how-to-play" aria-label="Първа игра за 30 секунди">
      <div className="quickstart-surface">
        <div className="quickstart-header">
          <div>
            <p className="section-kicker">първа игра за 30 секунди</p>
            <h2>Как започва добра игра</h2>
            <p>Влез, избери стая, играй.</p>
          </div>
          <Link href="/faq" className="quickstart-rules-cta">
            Виж често задаваните → <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ol className="quickstart-steps" data-revealed="true">
          {STEPS.map((step, index) => (
            <li
              key={step.label}
              className="quickstart-step-slot"
              style={{ "--connector-index": index } as CSSProperties & Record<"--connector-index", number>}
            >
              <StepMedallion number={index + 1} icon={step.icon} label={step.label} body={step.body} />
              {index < STEPS.length - 1 ? <StepConnector /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepMedallion({ number, icon, label, body }: { number: number; icon: ReactNode; label: string; body: string }) {
  return (
    <article className="quickstart-step">
      <span className="quickstart-medallion">{number}</span>
      <span className="quickstart-glyph">{icon}</span>
      <h3>{label}</h3>
      <p>{body}</p>
    </article>
  );
}

function StepConnector() {
  return (
    <span className="quickstart-connector" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}
```

**File:** `apps/web/components/landing/LiveTickerCard.tsx` (new):

```tsx
"use client";

import Link from "next/link";
import type { GameFamily } from "@werewolf/shared";

export type LiveStats = {
  activeRooms: number;
  connectedPlayers: number;
  byFamily?: Partial<Record<GameFamily, number>>;
};

type Props = {
  family: GameFamily | null;
  liveStats: LiveStats | null;
};

export function LiveTickerCard({ family, liveStats }: Props) {
  const root = family === "mafia" ? "/mafia" : family === "werewolves" ? "/werewolf" : "/werewolf";

  const totalRooms = liveStats?.activeRooms ?? 0;
  const totalPlayers = liveStats?.connectedPlayers ?? 0;

  const familyRooms = family && liveStats?.byFamily ? liveStats.byFamily[family] ?? 0 : null;

  const isEmpty = family ? (familyRooms ?? 0) === 0 : totalRooms === 0;

  const familyLabel = family === "mafia" ? "масата" : family === "werewolves" ? "село" : "стая";

  return (
    <article className="quickstart-live quickstart-mini-card">
      <p className="section-kicker">в момента играят</p>
      {isEmpty ? (
        <div className="quickstart-empty-live">
          <span className="quickstart-dice" aria-hidden="true">⚂</span>
          <div>
            <h3>{family === "mafia" ? "Бъди първият на масата" : family === "werewolves" ? "Запали първия огън" : "Бъди първият на масата"}</h3>
            <p>{family ? `Няма активни ${familyLabel === "село" ? "села" : "маси"} в момента.` : "Няма активни стаи в момента."}</p>
            <Link href={`${root}/create`} className="quickstart-card-cta">
              Създай стая <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="quickstart-live-active">
          <span className="quickstart-pulse" aria-hidden="true" />
          <div>
            <strong className="quickstart-live-count">{formatLine({ family, totalRooms, totalPlayers, byFamily: liveStats?.byFamily })}</strong>
            <p>Сега се играе</p>
          </div>
        </div>
      )}
    </article>
  );
}

function formatLine({
  family,
  totalRooms,
  totalPlayers,
  byFamily,
}: {
  family: GameFamily | null;
  totalRooms: number;
  totalPlayers: number;
  byFamily: Partial<Record<GameFamily, number>> | undefined;
}) {
  if (family === "werewolves") {
    const wolves = byFamily?.werewolves ?? totalRooms;
    return `${wolves} ${roomWord(wolves, "село")} тази вечер`;
  }
  if (family === "mafia") {
    const masas = byFamily?.mafia ?? totalRooms;
    return `${masas} ${roomWord(masas, "маса")} под напрежение`;
  }
  if (byFamily && (typeof byFamily.werewolves === "number" || typeof byFamily.mafia === "number")) {
    const werewolfRooms = byFamily.werewolves ?? 0;
    const mafiaRooms = byFamily.mafia ?? 0;
    return `${werewolfRooms} ${roomWord(werewolfRooms, "село")} · ${mafiaRooms} ${roomWord(mafiaRooms, "маса")} · ${totalPlayers} ${playerWord(totalPlayers)}`;
  }
  return `${totalRooms} ${roomWord(totalRooms, "стая")} · ${totalPlayers} ${playerWord(totalPlayers)}`;
}

function roomWord(count: number, kind: "стая" | "маса" | "село") {
  if (kind === "стая") return count === 1 ? "стая" : "стаи";
  if (kind === "маса") return count === 1 ? "маса" : "маси";
  return count === 1 ? "село" : "села";
}

function playerWord(count: number) {
  return count === 1 ? "човек" : "души";
}
```

**File:** `apps/web/components/landing/RecentEndingsCard.tsx` (new):

```tsx
"use client";

import type { GameFamily } from "@werewolf/shared";
import { LastWinnerEmptyGlyph } from "@/components/landing/quickstart-icons";

export type Ending = {
  code: string;
  winnerTeam: string;
  winnerReasonBg?: string;
  family?: GameFamily;
  endedAt?: string;
};

type Props = {
  family: GameFamily | null;
  endings: Ending[];
};

export function RecentEndingsCard({ family, endings }: Props) {
  const visible = (family ? endings.filter((e) => e.family === family) : endings).slice(0, 3);

  return (
    <article className="quickstart-winner quickstart-mini-card recent-endings-card">
      <p className="section-kicker">{family === "mafia" ? "вчерашни заглавия" : family === "werewolves" ? "разказите от селото" : "последни истории"}</p>
      {visible.length === 0 ? (
        <div className="quickstart-winner-empty">
          <LastWinnerEmptyGlyph className="quickstart-dim-glyph" />
          <div>
            <h3>{family === "mafia" ? "Първите досиета ще се появят тук." : family === "werewolves" ? "Първите легенди ще се появят тук." : "Първите герои ще се появят тук."}</h3>
            <p>След първата завършена игра.</p>
          </div>
        </div>
      ) : (
        <ul className="recent-endings-list">
          {visible.map((ending, index) => (
            <li key={`${ending.code}-${index}`} className="recent-ending-row" data-family={ending.family ?? "unknown"}>
              <span className="recent-ending-mark" aria-hidden="true">
                {winnerGlyph(ending.winnerTeam)}
              </span>
              <div>
                <strong>{headline({ family, ending })}</strong>
                <small>{ending.endedAt ? relativeTimeBg(ending.endedAt) : ending.winnerReasonBg ?? "Завършена игра"}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function headline({ family, ending }: { family: GameFamily | null; ending: Ending }) {
  // Different storytelling tone per family
  if (family === "mafia" || (family === null && ending.family === "mafia")) {
    return `Стая ${ending.code}: ${winnerTeamBg(ending.winnerTeam)}`;
  }
  return `Стая ${ending.code} — ${winnerTeamBg(ending.winnerTeam)}`;
}

function winnerTeamBg(team: string) {
  const labels: Record<string, string> = {
    village: "Селото устоя",
    werewolves: "Върколаците надделяха",
    vampires: "Вампирите изгряха",
    mafia: "Мафията остана незабелязана",
    maniac: "Маниакът остана последен",
    lovers: "Влюбените оцеляха заедно",
    draw: "Нощта приключи без победител",
  };
  return labels[team] ?? "Играта приключи";
}

function winnerGlyph(team: string) {
  const glyphs: Record<string, string> = {
    village: "⌂", werewolves: "☾", vampires: "✦", mafia: "◆",
    maniac: "!", lovers: "♥", draw: "=",
  };
  return glyphs[team] ?? "✦";
}

function relativeTimeBg(value: string) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "скоро";
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (m < 60) return `преди ${m} мин.`;
  const h = Math.round(m / 60);
  if (h < 24) return `преди ${h} ч.`;
  return `преди ${Math.round(h / 24)} д.`;
}
```

**File:** `apps/web/components/landing-experience.tsx` — refactor to use new components:

```diff
- import { ModeChoiceCards, type ModeChoiceGame } from "@/components/landing/ModeChoiceCards";
- import { QuickStartSection, type LandingQuickStartLastWinner } from "@/components/landing/QuickStartSection";
+ import { ModeChoiceCards, type ModeChoiceGame } from "@/components/landing/ModeChoiceCards";
+ import { UniversalHowToPlay } from "@/components/landing/UniversalHowToPlay";
+ import { LiveTickerCard, type LiveStats } from "@/components/landing/LiveTickerCard";
+ import { RecentEndingsCard, type Ending } from "@/components/landing/RecentEndingsCard";
```

In `LandingExperience`:

```diff
  <ModeChoiceCards games={GAMES} initialSession={initialSession} />
- <Suspense fallback={<QuickStartSkeleton />}>
-   <QuickStartWithStats />
- </Suspense>
+ <UniversalHowToPlay />
+ <Suspense fallback={<LandingStatsSkeleton />}>
+   <LandingStatsRow />
+ </Suspense>
```

Add:

```tsx
async function LandingStatsRow() {
  const stats = await loadGameStats();
  return (
    <div className="landing-stats-row">
      <LiveTickerCard family={null} liveStats={stats?.liveStats ?? null} />
      <RecentEndingsCard family={null} endings={stats?.recentEndings ?? []} />
    </div>
  );
}

function LandingStatsSkeleton() {
  return (
    <div className="landing-stats-row" aria-hidden="true">
      <div className="quickstart-mini-card quickstart-skeleton" />
      <div className="quickstart-mini-card quickstart-skeleton" />
    </div>
  );
}
```

CSS for `.landing-stats-row` (`globals.css`):

```css
.landing-stats-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 32px;
}

@media (max-width: 767px) {
  .landing-stats-row {
    grid-template-columns: 1fr;
  }
}
```

Update `loadGameStats()` to return `recentEndings` array (Stage 2.4 handles game-server side).

**Commit:**
```
refactor(landing): split QuickStartSection into UniversalHowToPlay, LiveTickerCard, RecentEndingsCard
```

## Stage 2.3 — `/werewolf` identity content

Create folklore-immersive werewolf-specific components.

**File:** `apps/web/components/games/WerewolfNightTimeline.tsx` (new):

```tsx
import Image from "next/image";

const PHASES = [
  {
    key: "fog",
    label: "Първо мъглата",
    body: "Селото потъва в мъгла. Никой не вижда повече от вратата си.",
    art: "/game-art/werewolf/night-1-fog.webp",
  },
  {
    key: "seer",
    label: "Видящият отваря очи",
    body: "Една жена пита месеца чие сърце бие нечовешко.",
    art: "/game-art/werewolf/night-2-seer.webp",
  },
  {
    key: "wolves",
    label: "Върколаците избират",
    body: "Сенки се събират в гората и сочат прозорец.",
    art: "/game-art/werewolf/night-3-wolves.webp",
  },
  {
    key: "healer",
    label: "Лечителят пази",
    body: "Стара билка под възглавница — може и да удържи зъбите.",
    art: "/game-art/werewolf/night-4-healer.webp",
  },
  {
    key: "dawn",
    label: "Сутринта селото брои",
    body: "Камбана. Един не отговаря. Денят почва с подозрения.",
    art: "/game-art/werewolf/night-5-dawn.webp",
  },
] as const;

export function WerewolfNightTimeline() {
  return (
    <section className="night-timeline night-timeline--werewolves" aria-label="Как протича нощ в село Върколак">
      <header className="night-timeline__header">
        <p className="section-kicker">нощ над селото</p>
        <h2>Това е една нощ</h2>
        <p>Всичко започва с тишина. Завършва с име, изречено на глас.</p>
      </header>

      <ol className="night-timeline__phases">
        {PHASES.map((phase, index) => (
          <li key={phase.key} className="night-phase" data-step={index + 1}>
            <figure className="night-phase__art">
              <Image
                src={phase.art}
                alt=""
                width={512}
                height={384}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading={index === 0 ? "eager" : "lazy"}
              />
              <span className="night-phase__step" aria-hidden="true">{index + 1}</span>
            </figure>
            <div className="night-phase__body">
              <h3>{phase.label}</h3>
              <p>{phase.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

**File:** `apps/web/components/games/MafiaNightTimeline.tsx` (new) — analogous structure but noir copy:

```tsx
import Image from "next/image";

const PHASES = [
  {
    key: "rain",
    label: "Дъждът тръгва по улиците",
    body: "Фенерът дава съвсем малко светлина. Барът затваря тихо.",
    art: "/game-art/mafia/night-1-rain.webp",
  },
  {
    key: "don",
    label: "Донът вдига пистолет",
    body: "Жест без думи. Семейството го прочита от другия край на масата.",
    art: "/game-art/mafia/night-2-don.webp",
  },
  {
    key: "sheriff",
    label: "Шерифът проверява папка",
    body: "Има едно име, което не пасва. Тефтерът знае.",
    art: "/game-art/mafia/night-3-sheriff.webp",
  },
  {
    key: "doctor",
    label: "Докторът лекува тихо",
    body: "Чанта с принадлежности отваря се при правилната врата.",
    art: "/game-art/mafia/night-4-doctor.webp",
  },
  {
    key: "morning",
    label: "Вестникът пише сутринта",
    body: "Снимка на първа страница. Цигара угаснала във ваза.",
    art: "/game-art/mafia/night-5-morning.webp",
  },
] as const;

export function MafiaNightTimeline() {
  return (
    <section className="night-timeline night-timeline--mafia" aria-label="Как протича нощ в града">
      <header className="night-timeline__header">
        <p className="section-kicker">град под напрежение</p>
        <h2>Тази нощ в града</h2>
        <p>Всичко е тихо до момента, в който вестникът тръгне.</p>
      </header>

      <ol className="night-timeline__phases">
        {PHASES.map((phase, index) => (
          <li key={phase.key} className="night-phase" data-step={index + 1}>
            <figure className="night-phase__art">
              <Image
                src={phase.art}
                alt=""
                width={512}
                height={384}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading={index === 0 ? "eager" : "lazy"}
              />
              <span className="night-phase__step" aria-hidden="true">{index + 1}</span>
            </figure>
            <div className="night-phase__body">
              <h3>{phase.label}</h3>
              <p>{phase.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

**CSS for night-timeline (`globals.css`, new section):**

```css
/* ============================== */
/* Night timeline — werewolf + mafia */
/* ============================== */

.night-timeline {
  display: grid;
  gap: clamp(20px, 3vw, 32px);
  margin-top: clamp(28px, 4vw, 56px);
}

.night-timeline__header h2 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.8rem, 3.4vw, 2.8rem);
  font-weight: 950;
  color: #fff7e5;
  text-wrap: balance;
}

.night-timeline__header p:not(.section-kicker) {
  margin-top: 8px;
  max-width: 48ch;
  color: #ead9ba;
  font-weight: 700;
  line-height: 1.5;
}

.night-timeline__phases {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  padding: 0;
  margin: 0;
  list-style: none;
}

@media (max-width: 1200px) {
  .night-timeline__phases {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .night-timeline__phases {
    grid-template-columns: 1fr;
  }
}

.night-phase {
  position: relative;
  display: grid;
  gap: 12px;
  border: 1px solid rgba(248, 236, 210, 0.14);
  border-radius: 22px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(8, 10, 10, 0.42) 0%, rgba(8, 10, 10, 0.72) 100%),
    rgba(8, 10, 10, 0.5);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.4),
    0 16px 40px rgba(0, 0, 0, 0.44),
    inset 0 1px 0 rgba(255, 247, 229, 0.08);
}

.night-phase__art {
  position: relative;
  margin: 0;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.night-phase__art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.night-phase:hover .night-phase__art img,
.night-phase:focus-within .night-phase__art img {
  transform: scale(1.04);
}

.night-phase__step {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 247, 229, 0.4), transparent 50%),
    var(--gold, #d19a42);
  color: #2a1b10;
  font-weight: 950;
  font-size: 0.92rem;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.42);
}

.night-phase__body {
  padding: 14px 16px 18px;
}

.night-phase__body h3 {
  color: #fff7e5;
  font-family: "Noto Serif", serif;
  font-size: 1.05rem;
  font-weight: 950;
  text-wrap: balance;
}

.night-phase__body p {
  margin-top: 6px;
  color: #ead9ba;
  font-size: 0.88rem;
  line-height: 1.5;
}

/* Light theme */
html[data-theme="light"] .night-phase {
  border-color: rgba(83, 52, 31, 0.18);
  background: linear-gradient(180deg, rgba(252, 246, 236, 0.4) 0%, rgba(252, 246, 236, 0.7) 100%);
  box-shadow:
    0 2px 4px rgba(70, 38, 18, 0.16),
    0 16px 40px rgba(70, 38, 18, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

html[data-theme="light"] .night-phase__body h3 {
  color: #2a1b10;
}

html[data-theme="light"] .night-phase__body p {
  color: rgba(42, 27, 16, 0.78);
}

html[data-theme="light"] .night-timeline__header h2 {
  color: #2a1b10;
}

html[data-theme="light"] .night-timeline__header p:not(.section-kicker) {
  color: rgba(42, 27, 16, 0.78);
}

/* Family accent on step badge */
.night-timeline--mafia .night-phase__step {
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 247, 229, 0.4), transparent 50%),
    #842f2b;
  color: #fff7e5;
}
```

**Commit:**
```
feat(werewolf): WerewolfNightTimeline component with 5 atmospheric phases
```

**Commit:**
```
feat(mafia): MafiaNightTimeline component with 5 noir phases
```

## Stage 2.4 — `RoleSpotlight` (5 family-classic roles)

**File:** `apps/web/components/games/RoleSpotlight.tsx` (new):

```tsx
import Link from "next/link";
import { type GameFamily, ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import { roleThumbStyle } from "@/lib/role-art";

const WEREWOLF_SPOTLIGHT: RoleCode[] = ["ordinary_villager", "werewolf", "seer", "healer", "hunter"];
const MAFIA_SPOTLIGHT: RoleCode[] = ["townsperson", "mafia", "sheriff", "don", "doctor"];

type Props = { family: GameFamily };

export function RoleSpotlight({ family }: Props) {
  const roles = family === "mafia" ? MAFIA_SPOTLIGHT : WEREWOLF_SPOTLIGHT;
  const root = family === "mafia" ? "/mafia" : "/werewolf";

  return (
    <section className="role-spotlight" data-family={family} aria-label={family === "mafia" ? "Класически роли в Мафия" : "Класически роли във Върколак"}>
      <header className="role-spotlight__header">
        <p className="section-kicker">{family === "mafia" ? "градът" : "селото"}</p>
        <h2>{family === "mafia" ? "Кой седи на масата" : "Кой се събужда нощем"}</h2>
        <p>{family === "mafia" ? "Пет роли формират гръбнака на всяка игра." : "Пет роли водят всяка фолклорна нощ."}</p>
      </header>

      <ul className="role-spotlight__grid">
        {roles.map((role) => {
          const def = ROLE_DEFINITIONS[role];
          return (
            <li key={role} className="role-spotlight__tile">
              <span className="role-spotlight__art" aria-hidden="true" style={roleThumbStyle(family, role)} />
              <strong>{def.nameBg}</strong>
              <small>{def.shortDescriptionBg}</small>
            </li>
          );
        })}
      </ul>

      <p className="role-spotlight__more">
        <Link href={`${root}/roles`} className="quickstart-card-cta">
          Виж всички роли <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
```

**CSS for role-spotlight (`globals.css`):**

```css
.role-spotlight {
  display: grid;
  gap: 18px;
  margin-top: clamp(28px, 4vw, 56px);
}

.role-spotlight__header h2 {
  font-family: "Noto Serif Display", serif;
  font-size: clamp(1.7rem, 2.8vw, 2.4rem);
  font-weight: 950;
  color: #fff7e5;
}

.role-spotlight__header p:not(.section-kicker) {
  margin-top: 6px;
  color: #ead9ba;
  font-weight: 700;
}

.role-spotlight__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 0;
  list-style: none;
}

@media (max-width: 900px) { .role-spotlight__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 540px) { .role-spotlight__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.role-spotlight__tile {
  display: grid;
  gap: 8px;
  border: 1px solid rgba(248, 236, 210, 0.14);
  border-radius: 18px;
  padding: 16px 14px;
  background: rgba(8, 10, 10, 0.42);
  text-align: center;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 247, 229, 0.08);
}

.role-spotlight__art {
  width: 72px;
  height: 72px;
  justify-self: center;
  border-radius: 16px;
  background-size: cover;
  background-position: center;
}

.role-spotlight__tile strong {
  color: #fff7e5;
  font-family: "Noto Serif", serif;
  font-size: 1rem;
}

.role-spotlight__tile small {
  color: #ead9ba;
  font-size: 0.78rem;
  line-height: 1.4;
}

html[data-theme="light"] .role-spotlight__header h2 {
  color: #2a1b10;
}
html[data-theme="light"] .role-spotlight__header p:not(.section-kicker) {
  color: rgba(42, 27, 16, 0.78);
}
html[data-theme="light"] .role-spotlight__tile {
  border-color: rgba(83, 52, 31, 0.18);
  background: rgba(252, 246, 236, 0.5);
  box-shadow: 0 8px 22px rgba(70, 38, 18, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
html[data-theme="light"] .role-spotlight__tile strong {
  color: #2a1b10;
}
html[data-theme="light"] .role-spotlight__tile small {
  color: rgba(42, 27, 16, 0.74);
}
```

**Commit:**
```
feat(games): RoleSpotlight component for family-classic role lineup
```

## Stage 2.5 — Werewolf variants chips + Mafia mechanics callouts + Sport Mafia callout

**File:** `apps/web/components/games/VariantsChips.tsx` (new — werewolf):

```tsx
import type { GameFamily } from "@werewolf/shared";

const WEREWOLF_VARIANTS = [
  { label: "Класически", body: "Селото срещу върколаците. Чистото предание." },
  { label: "С Влюбени", body: "Двама играчи делят съдба, дори срещу собствения отбор." },
  { label: "С Вампири", body: "Трета фракция в нощта. Кръв или зъби." },
  { label: "С Луд", body: "Маниак сам срещу всички. Никой не е сигурен."},
];

const MAFIA_VARIANTS = [
  { label: "Класическа Мафия", body: "Град срещу мафия. Алибита и подозрения." },
  { label: "Шериф и Доктор", body: "Със стандартни роли за разследване и защита." },
  { label: "Кръстник с Адвокат", body: "Дон, който знае; адвокат, който мълчи." },
];

export function VariantsChips({ family }: { family: GameFamily }) {
  const variants = family === "mafia" ? MAFIA_VARIANTS : WEREWOLF_VARIANTS;
  return (
    <section className="variants-chips" data-family={family} aria-label={family === "mafia" ? "Варианти на Мафия" : "Варианти на Върколак"}>
      <header className="variants-chips__header">
        <p className="section-kicker">варианти</p>
        <h2>{family === "mafia" ? "Различни кройки на града" : "Различни вечери в селото"}</h2>
      </header>
      <ul className="variants-chips__list">
        {variants.map((v) => (
          <li key={v.label} className="variant-chip">
            <strong>{v.label}</strong>
            <span>{v.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**File:** `apps/web/components/games/MafiaMechanicsCallouts.tsx` (new):

```tsx
const CALLOUTS = [
  {
    label: "Алибито",
    body: "Всеки в града има история за нощта. Една не пасва.",
  },
  {
    label: "Сигналът на Дона",
    body: "Жест без думи. Семейството чете кога удря.",
  },
  {
    label: "Дневникът на Шерифа",
    body: "Една проверка на нощ. Една буква в тетрадката.",
  },
];

export function MafiaMechanicsCallouts() {
  return (
    <section className="mafia-mechanics" aria-label="Механики на Мафия">
      <header className="mafia-mechanics__header">
        <p className="section-kicker">тънкости</p>
        <h2>Как се играе мафия наистина</h2>
      </header>
      <ul className="mafia-mechanics__list">
        {CALLOUTS.map((c) => (
          <li key={c.label} className="mafia-mechanic">
            <strong>{c.label}</strong>
            <span>{c.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**File:** `apps/web/components/games/SportMafiaCallout.tsx` (new):

```tsx
import Link from "next/link";

export function SportMafiaCallout() {
  return (
    <section className="sport-mafia-callout" aria-label="Спортна Мафия">
      <div>
        <p className="section-kicker">официална настройка</p>
        <h2>Спортна Мафия</h2>
        <p>Точно 10 играчи. Фиксирани таймери. Правилата на масата.</p>
      </div>
      <Link href="/mafia/create?mode=mafia_sport" className="quickstart-card-cta sport-mafia-callout__cta">
        Започни масата <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
```

**CSS (`globals.css`):** Provide chips list, mechanics list, sport-mafia hero callout (use existing tokens; sport-mafia uses red-blood accent + larger headline).

Full CSS spec:

```css
/* Variants chips */
.variants-chips {
  display: grid;
  gap: 14px;
  margin-top: clamp(28px, 4vw, 56px);
}
.variants-chips__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  list-style: none;
  padding: 0;
}
.variant-chip {
  display: grid;
  gap: 6px;
  border: 1px solid rgba(209, 154, 66, 0.28);
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(8, 10, 10, 0.42);
}
.variant-chip strong {
  color: #d19a42;
  font-family: "Noto Serif", serif;
  font-size: 1rem;
}
.variant-chip span {
  color: #ead9ba;
  font-size: 0.86rem;
  line-height: 1.45;
}

/* Mafia mechanics list */
.mafia-mechanics {
  display: grid;
  gap: 14px;
  margin-top: clamp(28px, 4vw, 56px);
}
.mafia-mechanics__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  list-style: none;
  padding: 0;
}
.mafia-mechanic {
  display: grid;
  gap: 6px;
  border: 1px solid rgba(132, 47, 43, 0.32);
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(8, 10, 10, 0.42);
}
.mafia-mechanic strong {
  color: #842f2b;
  font-family: "Noto Serif", serif;
  font-size: 1rem;
}
.mafia-mechanic span {
  color: #ead9ba;
  font-size: 0.86rem;
  line-height: 1.45;
}

/* Sport Mafia callout */
.sport-mafia-callout {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  margin-top: clamp(28px, 4vw, 56px);
  border: 1px solid rgba(132, 47, 43, 0.42);
  border-radius: 24px;
  padding: clamp(20px, 3vw, 32px);
  background:
    radial-gradient(circle at 4% 50%, rgba(132, 47, 43, 0.32), transparent 18rem),
    linear-gradient(135deg, rgba(13, 9, 8, 0.78), rgba(34, 22, 17, 0.82));
}
.sport-mafia-callout h2 {
  color: #fff7e5;
  font-family: "Noto Serif Display", serif;
  font-size: clamp(1.7rem, 2.8vw, 2.4rem);
  font-weight: 950;
}
.sport-mafia-callout p:not(.section-kicker) {
  margin-top: 8px;
  color: #ead9ba;
  font-weight: 700;
  font-size: 0.95rem;
}
.sport-mafia-callout__cta {
  flex: 0 0 auto;
}

/* Light theme */
html[data-theme="light"] .variant-chip,
html[data-theme="light"] .mafia-mechanic {
  background: rgba(252, 246, 236, 0.5);
}
html[data-theme="light"] .variant-chip span,
html[data-theme="light"] .mafia-mechanic span {
  color: rgba(42, 27, 16, 0.78);
}
html[data-theme="light"] .sport-mafia-callout {
  background: linear-gradient(135deg, rgba(252, 246, 236, 0.92), rgba(247, 233, 208, 0.86));
  border-color: rgba(132, 47, 43, 0.48);
}
html[data-theme="light"] .sport-mafia-callout h2 {
  color: #2a1b10;
}
html[data-theme="light"] .sport-mafia-callout p:not(.section-kicker) {
  color: rgba(42, 27, 16, 0.78);
}
```

**Commit:**
```
feat(games): VariantsChips, MafiaMechanicsCallouts, SportMafiaCallout components
```

## Stage 2.6 — Wire `GameHomePage` to use family-specific content

**File:** `apps/web/components/games/game-home-page.tsx`:

```diff
- import { QuickStartSection, type QuickStartLastWinner, type QuickStartLiveStats } from "@/components/games/QuickStartSection";
+ import { WerewolfNightTimeline } from "@/components/games/WerewolfNightTimeline";
+ import { MafiaNightTimeline } from "@/components/games/MafiaNightTimeline";
+ import { RoleSpotlight } from "@/components/games/RoleSpotlight";
+ import { VariantsChips } from "@/components/games/VariantsChips";
+ import { MafiaMechanicsCallouts } from "@/components/games/MafiaMechanicsCallouts";
+ import { SportMafiaCallout } from "@/components/games/SportMafiaCallout";
+ import { LiveTickerCard } from "@/components/landing/LiveTickerCard";
+ import { RecentEndingsCard } from "@/components/landing/RecentEndingsCard";
```

```diff
  export function GameHomePage({ family }: { family: GameFamily }) {
    /* ... existing hero data ... */
    return (
      <main className="shell game-home-shell" data-theme={family} data-family={family}>
        <ResourceHints images={heroImages} />
        <GameHero family={family} root={root} eyebrow={eyebrow} title={title} subtitle={subtitle} />

-       <Suspense fallback={<QuickStartFallback />}>
-         <QuickStartWithStats family={family} />
-       </Suspense>
+       {family === "werewolves" ? <WerewolfNightTimeline /> : <MafiaNightTimeline />}
+       <RoleSpotlight family={family} />
+       {family === "werewolves" ? <VariantsChips family="werewolves" /> : (
+         <>
+           <MafiaMechanicsCallouts />
+           <SportMafiaCallout />
+         </>
+       )}
+
+       <Suspense fallback={<GameStatsFallback />}>
+         <GameStatsRow family={family} />
+       </Suspense>
      </main>
    );
  }

- async function QuickStartWithStats({ family }: { family: GameFamily }) {
+ async function GameStatsRow({ family }: { family: GameFamily }) {
    const stats = await loadGameStats();
-   return <QuickStartSection family={family} liveStats={stats?.liveStats ?? null} lastWinner={stats?.lastWinner ?? null} />;
+   return (
+     <div className="landing-stats-row">
+       <LiveTickerCard family={family} liveStats={stats?.liveStats ?? null} />
+       <RecentEndingsCard family={family} endings={stats?.recentEndings ?? []} />
+     </div>
+   );
  }
```

Delete the old `apps/web/components/games/QuickStartSection.tsx` once unused.

**Commit:**
```
refactor(games): wire GameHomePage to family-specific identity components
```

## Stage 2.7 — Game-server: family stats + recent endings

**File:** `apps/game-server/src/rooms/GameRoom.ts`:

```diff
  export class GameRoom extends Room<{ state: GameState }> {
    private static liveRooms = new Set<GameRoom>();
-   private static lastWinner: { code: string; winnerTeam: string; winnerReasonBg: string; endedAt: string } | null = null;
+   private static recentEndings: Array<{
+     code: string;
+     winnerTeam: string;
+     winnerReasonBg: string;
+     endedAt: string;
+     family: GameFamily;
+   }> = [];
+   private static MAX_RECENT_ENDINGS = 12;

    static getRuntimeStats() {
+     const byFamily: Partial<Record<GameFamily, number>> = {};
+     for (const room of GameRoom.liveRooms) {
+       const fam = getGameFamily(room.config.mode);
+       byFamily[fam] = (byFamily[fam] ?? 0) + 1;
+     }
      return {
        activeRooms: GameRoom.liveRooms.size,
        connectedPlayers: [...GameRoom.liveRooms].reduce((sum, room) => sum + room.clients.length, 0),
-       lastWinner: GameRoom.lastWinner,
+       byFamily,
+       recentEndings: GameRoom.recentEndings.slice(),
+       lastWinner: GameRoom.recentEndings[0] ?? null, // backward-compat for existing clients
      };
    }
```

Find every place that currently does `GameRoom.lastWinner = ...` and replace with:

```ts
GameRoom.recentEndings.unshift({
  code: this.state.code,
  winnerTeam,
  winnerReasonBg,
  endedAt: new Date().toISOString(),
  family: getGameFamily(this.config.mode),
});
if (GameRoom.recentEndings.length > GameRoom.MAX_RECENT_ENDINGS) {
  GameRoom.recentEndings.length = GameRoom.MAX_RECENT_ENDINGS;
}
```

**File:** `apps/web/components/landing-experience.tsx` and `apps/web/components/games/game-home-page.tsx` — update `loadGameStats` to return both `liveStats` and `recentEndings`:

```ts
async function loadGameStats() {
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/^ws/, "http") ?? "http://localhost:2567";
  try {
    const response = await fetch(`${gameServerUrl}/stats`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return null;
    const stats = await response.json() as {
      activeRooms?: number;
      connectedPlayers?: number;
      byFamily?: Partial<Record<GameFamily, number>>;
      recentEndings?: Ending[];
    };
    return {
      liveStats: {
        activeRooms: stats.activeRooms ?? 0,
        connectedPlayers: stats.connectedPlayers ?? 0,
        byFamily: stats.byFamily,
      },
      recentEndings: stats.recentEndings ?? [],
    };
  } catch {
    return null;
  }
}
```

**Run `role-mechanics-reviewer` agent** with:

```
Review apps/game-server/src/rooms/GameRoom.ts changes. Focus:
1. recentEndings array stores only PUBLIC ending data (code, team, reason, endedAt, family) — no role assignments, no userIds, no actions.
2. getRuntimeStats() does not expose private state.
3. byFamily map only counts rooms — no leak.
Confirm or flag specific lines.
```

**Commit:**
```
feat(game-server): expose byFamily counts and recentEndings array in /stats
```

## Stage 2.8 — Backward compat: deprecate `QuickStartSection.tsx` files

Delete:
- `apps/web/components/landing/QuickStartSection.tsx`
- `apps/web/components/games/QuickStartSection.tsx`

Search for any remaining imports with `grep -rn "QuickStartSection" apps/web` and fix.

**Commit:**
```
refactor(landing): remove deprecated QuickStartSection files
```

---

# PHASE 3 — Cinematic illustrated panels

**Target:** Replace abstract step medallions in night-timelines with painterly oil panel illustrations. Each phase gets its own scene.

## Stage 3.1 — Werewolf night-phase imagen banners

Generate **5 painterly oil banners** at 1024 × 768, no visible text:

### Asset 1: `night-1-fog.webp`
**Path:** `apps/web/public/game-art/werewolf/night-1-fog.webp` (+ PNG fallback)

```
A wide painterly oil illustration (1024 × 768, 4:3) of a small Bulgarian
folkloric village at deep night, completely engulfed in heavy moonlit mist.
Silhouettes of timber houses with low slate roofs, barely visible through
the fog. A single tiny golden window glow in the middle distance. Above,
a cool silver crescent moon barely cuts through the haze. Foreground: a
dirt path winding into the mist with two faint footprints. Color palette:
deep teal #1a3540, warm ochre window glow #c89a55, silver moonlight, slate
gray rooftops. Painterly oil brushwork, visible texture. No people, no
text, no letters, no numbers.
```

### Asset 2: `night-2-seer.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of a Bulgarian folk
"видяща" (seer) — an older woman with a headscarf, painted from behind,
sitting at a small wooden table by a window. She holds a small clay
bowl with herbs and watches the moon through the window. The room is
lit only by a single beeswax candle on the table, casting warm amber
light. Outside the window: deep blue-black night, faint moon. The
composition focuses on her silhouette and the candle's halo. Color
palette: cream #f4e8d1, candle gold #c89a55, deep midnight blue #1c2840,
wood brown #5a3a20. Painterly oil brushwork, slight romantic glow.
No text, no letters, no numbers.
```

### Asset 3: `night-3-wolves.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of three wolf
silhouettes gathered at the edge of a dense Bulgarian birch forest at
night. They face one specific direction — toward a distant village
window glow visible between the trees. Heavy fog at their feet. A pale
moon overhead. Their fur catches faint blue moonlight. The composition
is wide and foreboding — the wolves are mid-frame, the village is a
tiny golden dot far in the distance. Color palette: cold midnight blue
#0d1a2e, fur silver-grey, faint amber village light, birch white trunks.
Painterly oil, atmospheric. No people, no text, no letters, no numbers.
```

### Asset 4: `night-4-healer.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of a Bulgarian folk
healer's hands gently placing a bundle of dried herbs under a small
embroidered pillow on a wooden bench. Soft warm candlelight from the
upper-left. Background: a wooden village interior with painted icons on
the wall, blurred. Foreground focus: the hands and the herb bundle.
Hands are pale, working-class, with a thin red bracelet. Color palette:
warm cream #f4e8d1, candle gold #c89a55, dried-herb green #6b8e4e,
oxblood thread #842f2b. Painterly oil, intimate close-up. No text,
no letters, no numbers.
```

### Asset 5: `night-5-dawn.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of a Bulgarian
village at first light of dawn. The mist is lifting. A wooden church
tower with a bronze bell occupies the middle-right. Faint orange-pink
sunlight just touches the rooftops. The path through the village is
empty. Foreground: a single white wildflower growing between cobblestones.
Color palette: pale dawn pink #e8a868, warm cream sky, dark roof slate,
green wildflower. The mood is hushed, expectant, the moment before the
village wakes. Painterly oil brushwork. No people, no text, no letters,
no numbers.
```

**Commit:**
```
chore(art): generate 5 werewolf night-phase painterly banners
```

## Stage 3.2 — Mafia night-phase imagen banners

### Asset 1: `night-1-rain.webp`
**Path:** `apps/web/public/game-art/mafia/night-1-rain.webp`

```
A wide painterly oil illustration (1024 × 768, 4:3) of a 1920s noir city
street at night, in heavy rain. A single gas streetlamp on the right
casts a golden cone of light. Wet cobblestone reflections shimmer.
Background: silhouettes of brick buildings, one with a faintly glowing
red bar sign reading nothing readable. Empty street, just the puddles
and the rain streaks. Color palette: deep wet asphalt #1c1a1d, gas-lamp
amber #d4a050, wet brick rust, rain silver. Painterly oil brushwork
with visible rain streaks. No people, no readable text, no letters,
no numbers.
```

### Asset 2: `night-2-don.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of a 1920s mafia
Don's hand on a wooden table, holding a small silver pistol pointed
slightly forward and to the left. Only the hand and forearm are visible
— dark wool suit cuff with a small ruby ring on the pinky. The table is
covered in a deep red velvet cloth. A half-burnt candle and a single
playing card (face down) sit nearby. Heavy atmospheric chiaroscuro
lighting from the upper-left. Color palette: deep wine #4a1a1d, gold
candle, silver pistol, ruby red, charcoal suit. Painterly oil, very
moody. No face visible. No text, no letters, no numbers.
```

### Asset 3: `night-3-sheriff.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of a 1920s sheriff
or police investigator at a wooden desk, painted from a side angle.
He has a green-shaded desk lamp casting focused warm light onto a
manila folder with handwritten papers (handwriting is illegible
scribbles, no readable letters). A coffee cup with steam rising sits
next to it. The man wears a worn fedora and a vest. He's leaning
forward, reading intently. Color palette: green lamp shade, manila
paper cream, dark wool charcoal, hot-coffee steam silver. Painterly
oil, classic investigation moment. No readable text, no letters, no
numbers.
```

### Asset 4: `night-4-doctor.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of a 1920s doctor's
black leather medical bag, open, on a wooden floor under a single
hanging amber bulb. The bag's contents are partly visible: a glass
bottle of medicine, white bandages, a stethoscope coiled neatly. Just
behind the bag: a wooden door, slightly ajar, with a strip of warm
light spilling out of it. Color palette: deep amber bulb light,
black leather, white bandage, clear glass medicine, warm wood floor.
Painterly oil, hushed and intimate. No people visible. No text, no
letters, no numbers.
```

### Asset 5: `night-5-morning.webp`
```
A wide painterly oil illustration (1024 × 768, 4:3) of a 1920s morning
breakfast diner table. A folded newspaper rests on the table, the
front-page photo (a blurry portrait of a man, not recognizable) faces
upward — but no readable text. A half-empty coffee cup sits next to
the paper, lipstick mark on the rim. A burnt-out cigarette in a small
glass vase. Soft cold morning light from a window upper-left. Color
palette: cold morning blue-grey, warm coffee brown, lipstick red,
cigarette ash grey. Painterly oil, the aftermath. No readable text,
no letters, no numbers.
```

**Commit:**
```
chore(art): generate 5 mafia night-phase painterly banners
```

## Stage 3.3 — Wire panels into timelines

Already done in Stage 2.3 via `<Image src={phase.art} />`. Verify all 10 banners load correctly:

- `/game-art/werewolf/night-1-fog.webp` through `night-5-dawn.webp`
- `/game-art/mafia/night-1-rain.webp` through `night-5-morning.webp`

Run `pnpm build` — Next.js will warn on missing imports if any path is wrong.

**Commit:**
```
chore(art): wire night-phase banners into timeline components (verified paths)
```

---

# Verification (after every phase)

## After Phase 1

```bash
pnpm regression
pnpm typecheck
pnpm build
```

Visual QA in `pnpm dev`:
- `/` dark theme — mini-cards have visible weight, gold rule lines at top/bottom of each card, slight rotation on each, candle-breath glow detectable (subtle, ~6s cycle)
- `/` light theme — same, with light-theme shadow tones
- Hover one mini-card → straightens to 0deg + lifts 2px
- DevTools Performance recording 5 seconds idle on homepage → confirm: **no Paint events on `.quickstart-mini-card` (compositor-only animation)**

Invoke `bg-copy-reviewer` agent on changed CSS — should find no English copy (this phase is CSS-only).

## After Phase 2

```bash
pnpm regression
pnpm typecheck
pnpm build
```

Visual QA:
- `/` — UniversalHowToPlay (5 steps) + LiveTickerCard (family=null, combined counts) + RecentEndingsCard (family=null, mixed endings)
- `/werewolf` — Hero + WerewolfNightTimeline (5 phases, placeholder images until Phase 3) + RoleSpotlight + VariantsChips + LiveTickerCard (werewolf-only) + RecentEndingsCard (werewolf-only)
- `/mafia` — Hero + MafiaNightTimeline + RoleSpotlight + MafiaMechanicsCallouts + SportMafiaCallout + LiveTickerCard (mafia-only) + RecentEndingsCard (mafia-only)
- LiveTickerCard format check:
  - `/` shows: `3 села · 2 маси · 18 души`
  - `/werewolf` shows: `3 села тази вечер`
  - `/mafia` shows: `2 маси под напрежение`
- With game-server offline, all pages still render (graceful null fallback)

Invoke `bg-copy-reviewer` agent on:
- `apps/web/components/landing/UniversalHowToPlay.tsx`
- `apps/web/components/landing/LiveTickerCard.tsx`
- `apps/web/components/landing/RecentEndingsCard.tsx`
- `apps/web/components/games/WerewolfNightTimeline.tsx`
- `apps/web/components/games/MafiaNightTimeline.tsx`
- `apps/web/components/games/RoleSpotlight.tsx`
- `apps/web/components/games/VariantsChips.tsx`
- `apps/web/components/games/MafiaMechanicsCallouts.tsx`
- `apps/web/components/games/SportMafiaCallout.tsx`

Invoke `role-mechanics-reviewer` agent on:
- `apps/game-server/src/rooms/GameRoom.ts` (recentEndings + byFamily changes)
- `apps/game-server/src/app.config.ts` (/stats endpoint shape)

## After Phase 3

Visual QA:
- `/werewolf` — each of 5 night phases shows distinct painterly oil panel
- `/mafia` — same for noir panels
- Mobile 390×844 — panels stack 1-column gracefully
- Tablet 768×1024 — panels in 2-column grid
- Desktop 1440×900 — panels in 5-column grid

Lighthouse run on each of `/`, `/werewolf`, `/mafia`:
- **Performance ≥ 85 mobile, ≥ 95 desktop**
- **LCP < 2.0s** on mid-3G mobile
- **CLS < 0.01**

Screenshots in `audit-v3/after/landing-identity/`:
1. `landing-desktop-dark.png`
2. `landing-desktop-light.png`
3. `landing-mobile.png`
4. `werewolf-desktop-dark.png`
5. `werewolf-desktop-light.png`
6. `werewolf-mobile.png`
7. `werewolf-night-timeline-hover.png` — one phase hovered, image scaling up
8. `mafia-desktop-dark.png`
9. `mafia-desktop-light.png`
10. `mafia-mobile.png`
11. `mafia-night-timeline-hover.png`
12. `quickstart-card-detail-dark.png` — close-up showing 3-layer shadow + gold rules + brass hairline + rotation
13. `quickstart-card-detail-light.png`
14. `lighthouse-landing.png`
15. `lighthouse-werewolf.png`
16. `lighthouse-mafia.png`

**GIF requirement:** `card-candle-breath.gif` — 7-second loop on quickstart mini-cards, showing subtle pulse.

---

# Acceptance criteria

## Phase 1
1. Mini-cards have visibly more depth/weight than before commit 600e5bf, without bringing back the box-in-box look
2. Gold rule lines visible at top/bottom of each mini-card
3. Slight rotation on each card (`–1.4°`, `+0.8°`), straighten on hover
4. Candle-breath glow detectable but subtle (not theatrical)
5. Inner brass hairline visible 5px inside border
6. DevTools confirms no Paint events on cards during idle (compositor-only animation)
7. Both light and dark themes covered
8. **No `@media (prefers-reduced-motion: reduce)` blocks added** anywhere in this phase

## Phase 2
9. `/`, `/werewolf`, `/mafia` show DISTINCT content below their hero (not the same 5-step generic)
10. `/werewolf` shows: night timeline (atmospheric folk copy) + werewolf role spotlight + variants + werewolf-only ticker + werewolf-only endings
11. `/mafia` shows: night timeline (noir copy) + mafia role spotlight + mechanics + sport mafia callout + mafia-only ticker + mafia-only endings
12. Game-server `/stats` returns `byFamily.werewolves`, `byFamily.mafia`, `recentEndings: Ending[]` (≤12)
13. Backward compat: existing clients reading `lastWinner` still work (it equals `recentEndings[0] ?? null`)
14. With game-server offline, all 3 pages render gracefully
15. `bg-copy-reviewer` finds no English in user-facing strings
16. `role-mechanics-reviewer` confirms no private state leak

## Phase 3
17. 10 painterly oil banners exist in `apps/web/public/game-art/werewolf/night-*.webp` and `apps/web/public/game-art/mafia/night-*.webp`
18. No visible text, letters, numbers in any banner (confirmed by visual inspection)
19. First image of each timeline uses `loading="eager"`, rest use `loading="lazy"`
20. Hover on night-phase scales image to 1.04 (smooth transition)
21. Lighthouse Performance ≥ 85 mobile / ≥ 95 desktop on all 3 pages
22. LCP < 2.0s on mid-3G mobile profile
23. CLS < 0.01 (no late-loading layout shifts)

## Cross-phase
24. `pnpm regression && pnpm typecheck && pnpm build` green after every commit
25. No new npm dependencies
26. All commits in English, all user-facing strings in Bulgarian
27. PR diff shows clean atomic commits (no fix-ups, no reverts)

---

# Не пипай

- `apps/game-server/src/rooms/GameRoom.ts` reducer logic, role assignment, win conditions, vote tallying — ONLY add `recentEndings` array + `byFamily` map in `getRuntimeStats()`
- `packages/shared/src/{role-assignment,win-conditions,protocol}.ts`
- `apps/web/lib/auth.ts`, `apps/web/app/api/game-token/route.ts`
- Existing `GameHero` component visual treatment (only its children below it are touched)
- Existing `ModeChoiceCards` component (already polished in prior PR)
- Existing `.landing-hero-card` chrome
- Theme infrastructure (`html[data-theme]` toggle logic in site-chrome)
- Tutorial page, FAQ page, all other routes
- Imagen prompts in other PRs

---

# Commit summary (22 commits)

```
1.  style(quickstart): three-layer cinematic shadow stack for mini-cards
2.  style(quickstart): hand-placed rotations and hover straighten for mini-cards
3.  style(quickstart): keep gold rule lines visible on mini-cards (scope surface hide)
4.  style(quickstart): candle-breath glow animation with reduced-motion guard
5.  style(quickstart): inner brass hairline via inset outline
6.  style(quickstart): polish pass per frontend-design skill review
7.  docs(landing): page-component map for identity-split refactor
8.  refactor(landing): split QuickStartSection into UniversalHowToPlay, LiveTickerCard, RecentEndingsCard
9.  feat(werewolf): WerewolfNightTimeline component with 5 atmospheric phases
10. feat(mafia): MafiaNightTimeline component with 5 noir phases
11. feat(games): RoleSpotlight component for family-classic role lineup
12. feat(games): VariantsChips, MafiaMechanicsCallouts, SportMafiaCallout components
13. refactor(games): wire GameHomePage to family-specific identity components
14. feat(game-server): expose byFamily counts and recentEndings array in /stats
15. refactor(landing): remove deprecated QuickStartSection files
16. chore(art): generate werewolf night-1-fog painterly banner
17. chore(art): generate werewolf night-2-seer painterly banner
18. chore(art): generate werewolf night-3-wolves painterly banner
19. chore(art): generate werewolf night-4-healer painterly banner
20. chore(art): generate werewolf night-5-dawn painterly banner
21. chore(art): generate 5 mafia night-phase painterly banners
22. chore(art): wire night-phase banners into timeline components (verified paths)
```

**Note:** Imagen commits can be grouped if Codex prefers batch generation (2 commits instead of 7). Adjust commit count accordingly.

PR title (if not direct push): `feat: landing identity overhaul — premium card chrome, page split, cinematic night-timelines`

---

# Notes for ChatGPT 5.5 x-high / Codex

- **Run phases in order.** Phase 1 is CSS-only and safe to land first. Phase 2 introduces components + game-server changes. Phase 3 depends on imagen completion.
- **Imagen generation is external.** If Codex cannot generate imagen banners directly, leave placeholder files (`echo "" > apps/web/public/game-art/werewolf/night-1-fog.webp`) and document the prompts in `docs/imagen-pending.md`. The user will run the prompts through their imagen pipeline.
- **`frontend-design` skill** must be invoked at Stage 1.6. If unavailable in the Codex environment, skip that polish commit and document with `// TODO: invoke frontend-design skill in follow-up PR` in commit message.
- **`bg-copy-reviewer` and `role-mechanics-reviewer` agents** are project-specific subagents. If Codex can invoke them, do so per the verification sections. If not, document the manual review checklist in a follow-up commit.
- **`context7` MCP** — use proactively to verify any CSS feature support unclear (e.g., `outline-offset` with negative values, `aspect-ratio` polyfill needs, `content-visibility: auto`). Cite the support data in commit messages where relevant.
- **If any stage exceeds reasonable scope** (e.g., game-server changes touch too many call sites): split it further and document. Better 25 atomic commits than 1 messy one.

---

(End of prompt)
