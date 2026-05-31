# Codex prompt — Redesign `/achievements` (Engraved Brass Plaques)

Целта: текущата `/achievements` страница е mixed 4+3 grid от обикновени cards, "иконите" са просто текст ("кръв", "маска"...), няма rarity йерархия, и empty-state-карта стои отгоре дори когато има unlocked items. Превръщаме страницата в **галерия от гравирани месингови плочи** — с tier system, locked/unlocked oxidized patina, family-aware frame shapes, и един generated brass texture asset.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4). Read `AGENTS.md` first — invariants:
- Всичкият user-facing copy на български. Без Latin words в UI.
- Не въвеждай нови npm dependencies (`sharp` вече е там за asset pipeline).
- Не пипай game-server, schemas, role-assignment.
- Без accessibility prompts извън стандартните ARIA attributes в JSX по-долу.

Имаш достъп до `/imagen` (gpt-image-2). Използвай го за единичния brass plate texture. След генериране `pnpm optimize:assets` автоматично прави WebP вариантите.

### Контекст

Текуща страница `/achievements`:
- Рендерира се от `apps/web/app/achievements/page.tsx` + `apps/web/components/achievements-client.tsx`.
- Achievements са дефинирани в `packages/shared/src/achievements.ts` (виж `ACHIEVEMENTS` array).
- Всеки `AchievementDefinition` има: `id`, `titleBg`, `descriptionBg`, `iconBg` (текст!), `predicate`.
- В момента `iconBg` се рендерира като текст в `<span>{achievement.iconBg}</span>` — затова виждаме думите "кръв", "маска", "щит" вместо реални икони.
- Текущ скрийншот: `audit-v3/desktop/09-achievements.png`.

Известни проблеми (от `docs/frontend-audit-v3/REPORT.md`):
- `iconBg` е текст, не визуал.
- Mixed 4+3 grid.
- Empty-state-карта стои горе дори когато има отключени achievements (двоен banner).
- "ВИЖ REPLAY ИСТОРИЯ" — Latin word "REPLAY" в БГ UI.
- `apps/web/app/achievements/page.tsx:7,17` — "replay" и "grind" Latin words в hero copy.

### Концепция: Engraved brass plaques (Гравирани месингови плочи)

Achievements изглеждат като **гравирани месингови плочи**, окачени на тъмна wood/stone wall:
- **Brass plate texture** като фон на всяка плоча (един generated asset).
- **Embossed double border** (CSS `box-shadow inset`) — раиран ефект.
- **Engraved text** (`text-shadow` с light/dark layers) — изпъкват/потъват букви.
- **Inline SVG icon** stroke-only (не filled) — изглежда като гравирана линия.
- **Tier system** чрез CSS `filter` върху brass texture-а: bronze (default), silver, gold.
- **Locked state** = oxidized зеленикав patina чрез CSS `filter` — без втори asset.
- **Family frame shape**: werewolf = gothic pointed-top, mafia = baroque scrollwork oval, universal = clean rectangle.
- **Hover** — плочата леко се накланя, light catches the metal.

---

## Стъпка 1 — Generate brass plate texture чрез `/imagen`

**Path:** `apps/web/public/game-art/textures/brass-plate.png`

**Imagen prompt:**
```
A close-up overhead photograph of an aged brass plate, smooth
polished surface with subtle horizontal brush-grain texture,
warm golden tone with hints of darker tarnish in the corners
and at the edges, gentle directional lighting from upper left
creating a soft highlight band that runs diagonally across the
upper third of the plate. Photographic realism. The entire
frame is uniform brass plate filling edge to edge, with rich
metallic depth. No text, no letters, no engravings, no symbols,
no numbers, no markings whatsoever anywhere on the surface.
Aspect ratio 3:2.
```

**Size:** 1536 × 1024 (3:2).

**Critical:** "no text, no letters, no engravings" повторено три пъти — imagen обича да halluciнира надписи върху метал. Ако генерирания PNG има stray writing/numbers, regenerate с по-силен emphasis.

### След генерация

1. Save PNG-то в горната пътека.
2. Стартирай `pnpm optimize:assets` — създава WebP + mobile варианти.
3. Verify:
   ```bash
   ls apps/web/public/game-art/textures/brass-plate.{png,webp}
   ```
   И двата файла трябва да съществуват.

---

## Стъпка 2 — Schema extension в `packages/shared/src/achievements.ts`

Добави **два optional полета** на `AchievementDefinition`:

```ts
export type AchievementTier = "bronze" | "silver" | "gold";
export type AchievementFamily = "werewolves" | "mafia" | "universal";

export interface AchievementDefinition {
  id: string;
  titleBg: string;
  descriptionBg: string;
  iconBg: string;            // Запази (back-compat)
  tier?: AchievementTier;    // НОВО — default "bronze"
  family?: AchievementFamily; // НОВО — default "universal"
  predicate: (context: AchievementGameContext) => string[];
}
```

После присвой стойности на 7-те съществуващи achievements:

| id | tier | family |
|---|---|---|
| `first_blood` | `bronze` | `universal` |
| `jester_win` | `silver` | `universal` |
| `guardian_save` | `silver` | `universal` |
| `hunter_revenge` | `gold` | `werewolves` |
| `silent_civilian` | `bronze` | `universal` |
| `perfect_record` | `bronze` | `universal` |
| `maniac_endgame` | `gold` | `mafia` |

### След schema промяната

Стартирай `pnpm build` на `packages/shared` за да се генерират новите types:
```bash
pnpm --filter @werewolf/shared build
```

---

## Стъпка 3 — Code redesign

### Files to touch

1. `apps/web/app/achievements/page.tsx` — оправяне на BG-only нарушения (виж по-долу) + минимални layout промени.
2. `apps/web/components/achievements-client.tsx` — пълен redesign.
3. `apps/web/components/achievements/AchievementPlaque.tsx` — **нов** компонент за една плоча.
4. `apps/web/components/achievements/AchievementProgressWreath.tsx` — **нов** компонент за header с laurel wreath.
5. `apps/web/components/achievements/AchievementIcon.tsx` — **нов** компонент с 7 inline SVG icons (по `id`).
6. `apps/web/app/globals.css` — нови `.plaque-wall`, `.achievement-plaque`, `.achievement-icon` блокове. Премахни (или остави dormant) старите `.achievement-card`, `.achievement-grid`, `.achievement-meta`, `.achievement-hero`.

Не пипай:
- `apps/web/app/api/achievements/route.ts`.
- `packages/database/src/queries.ts`.
- Game-server.

### BG-only fixes (преди design промените)

В `apps/web/app/achievements/page.tsx`:
- Line 7: `"Колекция от replay-базирани моменти..."` → `"Колекция от моменти, отключени от записите: първа кръв, спасени нощи, лични победи и финални обрати."`
- Line 17: `"Постиженията не са grind. Те се отключват от replay събитията..."` → `"Постиженията не са повтаряне. Те се отключват от събитията в записа и разказват какво се е случило на масата:"`
- Line 25: `"Виж replay история"` → `"Виж записаните игри"`

### Hero header

```tsx
<section className="paper-card utility-hero achievement-hero rounded-[2rem] p-8">
  <p className="section-kicker">постижения</p>
  <h1>Малките легенди след всяка игра</h1>
  <p className="achievement-hero-lede">
    Гравираните плочи разказват какво се е случило на масата: спасение,
    предателство, точен изстрел или самостоятелна победа.
  </p>
  <AchievementProgressWreath unlocked={unlockedCount} total={ACHIEVEMENTS.length} />
</section>
```

### Progress wreath component

```tsx
"use client";

export function AchievementProgressWreath({ unlocked, total }: { unlocked: number; total: number }) {
  return (
    <div className="achievement-wreath" role="img" aria-label={`${unlocked} от ${total} легенди отключени`}>
      <svg className="achievement-wreath-branch achievement-wreath-branch-left" viewBox="0 0 60 80" aria-hidden>
        {/* 5-7 simple curved leaves радиращи от долната дясна точка */}
        <path d="M55 75 Q 40 55 35 30" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M50 65 Q 35 60 28 50" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M48 50 Q 32 45 25 32" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M45 35 Q 30 30 22 18" stroke="currentColor" strokeWidth="1" fill="none" />
        {/* Малки овални листа */}
        <ellipse cx="42" cy="58" rx="6" ry="2" transform="rotate(-50 42 58)" fill="currentColor" opacity="0.7" />
        <ellipse cx="36" cy="42" rx="5" ry="1.8" transform="rotate(-55 36 42)" fill="currentColor" opacity="0.7" />
        <ellipse cx="30" cy="26" rx="4.5" ry="1.6" transform="rotate(-60 30 26)" fill="currentColor" opacity="0.7" />
      </svg>
      <div className="achievement-wreath-count">
        <strong>{unlocked}</strong>
        <span>от {total} легенди</span>
      </div>
      <svg className="achievement-wreath-branch achievement-wreath-branch-right" viewBox="0 0 60 80" aria-hidden style={{ transform: "scaleX(-1)" }}>
        <path d="M55 75 Q 40 55 35 30" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M50 65 Q 35 60 28 50" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M48 50 Q 32 45 25 32" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M45 35 Q 30 30 22 18" stroke="currentColor" strokeWidth="1" fill="none" />
        <ellipse cx="42" cy="58" rx="6" ry="2" transform="rotate(-50 42 58)" fill="currentColor" opacity="0.7" />
        <ellipse cx="36" cy="42" rx="5" ry="1.8" transform="rotate(-55 36 42)" fill="currentColor" opacity="0.7" />
        <ellipse cx="30" cy="26" rx="4.5" ry="1.6" transform="rotate(-60 30 26)" fill="currentColor" opacity="0.7" />
      </svg>
    </div>
  );
}
```

### Achievement icon component (7 inline SVGs)

```tsx
type IconProps = { id: string; className?: string };

export function AchievementIcon({ id, className }: IconProps) {
  const common = {
    className: className ?? "achievement-icon",
    viewBox: "0 0 48 48",
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case "first_blood":
      // Drop / teardrop
      return (
        <svg {...common}>
          <path d="M24 6 C 16 18 12 26 12 32 a12 12 0 0 0 24 0 c0-6-4-14-12-26z" />
          <path d="M18 32 a6 6 0 0 0 8 4" />
        </svg>
      );
    case "jester_win":
      // Jester mask (with two bell points)
      return (
        <svg {...common}>
          <path d="M14 14 L 10 6 M34 14 L 38 6" />
          <circle cx="10" cy="6" r="2" />
          <circle cx="38" cy="6" r="2" />
          <path d="M10 18 Q 24 10 38 18 Q 36 36 24 40 Q 12 36 10 18 z" />
          <circle cx="19" cy="22" r="1.2" />
          <circle cx="29" cy="22" r="1.2" />
          <path d="M19 30 Q 24 33 29 30" />
        </svg>
      );
    case "guardian_save":
      // Shield with cross
      return (
        <svg {...common}>
          <path d="M24 6 L 38 12 L 38 24 Q 38 38 24 42 Q 10 38 10 24 L 10 12 z" />
          <path d="M24 18 L 24 32 M18 25 L 30 25" />
        </svg>
      );
    case "hunter_revenge":
      // Crossed crosshair / arrow
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="14" />
          <path d="M24 6 L 24 16 M24 32 L 24 42 M6 24 L 16 24 M32 24 L 42 24" />
          <circle cx="24" cy="24" r="2" fill="currentColor" />
        </svg>
      );
    case "silent_civilian":
      // Single candle flame
      return (
        <svg {...common}>
          <path d="M24 8 Q 28 16 26 22 Q 22 22 22 16 Q 24 12 24 8 z" />
          <rect x="20" y="24" width="8" height="14" rx="1" />
          <path d="M16 38 L 32 38" />
          <path d="M18 41 L 30 41" />
        </svg>
      );
    case "perfect_record":
      // Scroll with seal
      return (
        <svg {...common}>
          <path d="M10 12 Q 10 8 14 8 L 34 8 Q 38 8 38 12 L 38 36 Q 38 40 34 40 L 14 40 Q 10 40 10 36 z" />
          <path d="M14 16 L 32 16 M14 22 L 32 22 M14 28 L 26 28" />
          <circle cx="32" cy="33" r="3" />
        </svg>
      );
    case "maniac_endgame":
      // Dagger
      return (
        <svg {...common}>
          <path d="M24 6 L 28 28 L 24 32 L 20 28 z" />
          <path d="M16 32 L 32 32 L 32 36 L 16 36 z" />
          <path d="M24 36 L 24 42" />
        </svg>
      );
    default:
      // Fallback star
      return (
        <svg {...common}>
          <path d="M24 6 L 28 18 L 42 18 L 31 26 L 35 40 L 24 32 L 13 40 L 17 26 L 6 18 L 20 18 z" />
        </svg>
      );
  }
}
```

### AchievementPlaque component

```tsx
"use client";

import type { AchievementDefinition } from "@werewolf/shared";
import { AchievementIcon } from "./AchievementIcon";

interface PlaqueProps {
  achievement: AchievementDefinition;
  unlockedAt: string | null;
}

export function AchievementPlaque({ achievement, unlockedAt }: PlaqueProps) {
  const tier = achievement.tier ?? "bronze";
  const family = achievement.family ?? "universal";
  const isUnlocked = unlockedAt !== null;

  return (
    <article
      className="achievement-plaque"
      data-tier={tier}
      data-family={family}
      data-locked={!isUnlocked}
    >
      <div className="achievement-plaque-inner">
        <AchievementIcon id={achievement.id} />
        <h3 className="achievement-plaque-title">{achievement.titleBg}</h3>
        <p className="achievement-plaque-desc">{achievement.descriptionBg}</p>
        <p className="achievement-plaque-meta">
          {isUnlocked ? `Отключено · ${formatDate(unlockedAt!)}` : "Заключено"}
        </p>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "няма дата";
  return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" }).format(date);
}
```

### AchievementsClient (refactored)

```tsx
"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { ANONYMOUS_USER_ID_KEY } from "@/lib/anonymous-player";
import { AchievementPlaque } from "./achievements/AchievementPlaque";
import { AchievementProgressWreath } from "./achievements/AchievementProgressWreath";

interface OwnedAchievement {
  achievementId: string;
  gameId: string | null;
  unlockedAt: string;
}

export function AchievementsClient() {
  const [owned, setOwned] = useState<OwnedAchievement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const userId = window.localStorage.getItem(ANONYMOUS_USER_ID_KEY) ?? "";
    if (!userId) {
      setLoaded(true);
      return;
    }

    fetch(`/api/achievements?userId=${encodeURIComponent(userId)}`)
      .then((response) => (response.ok ? response.json() : { achievements: [] }))
      .then((body: { achievements?: OwnedAchievement[] }) => setOwned(body.achievements ?? []))
      .catch(() => setOwned([]))
      .finally(() => setLoaded(true));
  }, []);

  const ownedById = new Map(owned.map((achievement) => [achievement.achievementId, achievement]));
  const unlockedCount = ownedById.size;

  return (
    <>
      <AchievementProgressWreath unlocked={unlockedCount} total={ACHIEVEMENTS.length} />

      <section className="plaque-wall mt-8">
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = ownedById.get(achievement.id);
          return (
            <AchievementPlaque
              key={achievement.id}
              achievement={achievement}
              unlockedAt={unlocked ? unlocked.unlockedAt : null}
            />
          );
        })}
      </section>

      {!loaded ? <p className="plaque-loading" aria-live="polite">Зареждам легенди...</p> : null}
    </>
  );
}
```

Забележи: **старата empty-state-карта изчезва** — wreath-ът показва "0 от 7" и това е достатъчна empty state-информация.

### CSS — Plaque wall layout

```css
.plaque-wall {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  padding: 24px 0 32px;
}
@media (min-width: 640px) {
  .plaque-wall {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .plaque-wall {
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }
}
```

### CSS — Achievement plaque (brass + tier + locked)

```css
.achievement-plaque {
  --plaque-bg-color: #c8a366;
  --plaque-fg-color: #2a1b10;
  --plaque-edge-light: rgba(255, 240, 200, 0.55);
  --plaque-edge-dark: rgba(50, 30, 10, 0.6);
  position: relative;
  min-height: 240px;
  padding: 28px 24px;
  background-color: var(--plaque-bg-color);
  background-image:
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  background-blend-mode: multiply;
  color: var(--plaque-fg-color);
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 1px var(--plaque-edge-light),
    inset 0 0 0 5px var(--plaque-edge-dark),
    inset 0 0 0 7px var(--plaque-edge-light),
    0 8px 24px rgba(0, 0, 0, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.4);
  transition: transform 220ms ease, box-shadow 220ms ease, filter 220ms ease;
  text-align: center;
}

.achievement-plaque:hover {
  transform: perspective(800px) rotateX(2deg) translateY(-3px);
  box-shadow:
    inset 0 0 0 1px var(--plaque-edge-light),
    inset 0 0 0 5px var(--plaque-edge-dark),
    inset 0 0 0 7px var(--plaque-edge-light),
    0 14px 36px rgba(0, 0, 0, 0.65),
    0 4px 6px rgba(0, 0, 0, 0.5);
}

.achievement-plaque-inner {
  display: grid;
  justify-items: center;
  gap: 12px;
}

.achievement-icon {
  width: 56px;
  height: 56px;
  color: var(--plaque-fg-color);
  filter: drop-shadow(0 1px 0 rgba(255, 240, 200, 0.6));
}

.achievement-plaque-title {
  font-family: "Noto Serif", serif;
  font-weight: 800;
  font-size: 1.25rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--plaque-fg-color);
  text-shadow:
    0 1px 0 rgba(255, 240, 200, 0.45),
    0 -1px 0 rgba(50, 30, 10, 0.5);
}

.achievement-plaque-desc {
  font-size: 0.875rem;
  line-height: 1.55;
  color: rgba(42, 27, 16, 0.85);
  max-width: 24ch;
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.3);
}

.achievement-plaque-meta {
  margin-top: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(42, 27, 16, 0.7);
}

/* TIER variants */
.achievement-plaque[data-tier="silver"] {
  --plaque-bg-color: #b8b8b8;
  filter: hue-rotate(180deg) saturate(0.25);
}
.achievement-plaque[data-tier="silver"] .achievement-plaque-title,
.achievement-plaque[data-tier="silver"] .achievement-plaque-desc,
.achievement-plaque[data-tier="silver"] .achievement-plaque-meta,
.achievement-plaque[data-tier="silver"] .achievement-icon {
  filter: hue-rotate(-180deg) saturate(4); /* counter-rotate, за да си върне естествения цвят */
}

.achievement-plaque[data-tier="gold"] {
  --plaque-bg-color: #e6c25e;
  filter: saturate(1.35) brightness(1.08);
}

/* FAMILY frame shapes */
.achievement-plaque[data-family="werewolves"] {
  /* Gothic pointed top — clip-path с 5-pt polygon */
  clip-path: polygon(
    0% 12%, 50% 0%, 100% 12%, 100% 100%, 0% 100%
  );
  border-radius: 0;
}
.achievement-plaque[data-family="mafia"] {
  /* Baroque oval/scrollwork — leko по-силно овално */
  border-radius: 32px 32px 24px 24px / 48px 48px 24px 24px;
}
/* universal — default rectangular, нищо допълнително */

/* LOCKED state — oxidized green/dark patina */
.achievement-plaque[data-locked="true"] {
  filter: grayscale(0.55) sepia(0.45) hue-rotate(50deg) brightness(0.62) contrast(0.95);
}
.achievement-plaque[data-locked="true"] .achievement-plaque-title {
  text-shadow:
    0 1px 0 rgba(140, 200, 140, 0.18),
    0 -1px 0 rgba(20, 40, 20, 0.55);
}
.achievement-plaque[data-locked="true"]:hover {
  filter: grayscale(0.45) sepia(0.35) hue-rotate(40deg) brightness(0.75);
}
```

**Забележка за tier-силва filter combo**: hue-rotate(180deg) + saturate(0.25) дава неутрален сребрист тон, но обръща и color-а на текста. Counter-rotate-ваме само текст/icon-а с обратен filter, за да си върне естествения цвят. Ако този подход прави текста странен, alternative: задавай `--plaque-bg-color` ръчно и **не използвай** filter, само background blend mode. Codex да избере по-чистия подход след visual check.

### CSS — Progress wreath

```css
.achievement-wreath {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 24px;
  color: #842f2b;
}

.achievement-wreath-branch {
  width: 64px;
  height: 80px;
}

.achievement-wreath-count {
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}

.achievement-wreath-count strong {
  font-family: "Noto Serif", serif;
  font-size: 2.75rem;
  font-weight: 900;
  line-height: 1;
  color: #842f2b;
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.4);
}

.achievement-wreath-count span {
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(132, 47, 43, 0.85);
}
```

### Page layout (page.tsx минимални промени)

```tsx
export default function AchievementsPage() {
  return (
    <main className="shell utility-shell">
      <section className="paper-card utility-hero achievement-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">постижения</p>
        <h1 className="mt-3 text-5xl font-black">Малките легенди след всяка игра</h1>
        <p className="mt-4 max-w-3xl text-[#4f3829]">
          Гравираните плочи разказват какво се е случило на масата: спасение, предателство, точен изстрел или самостоятелна победа.
        </p>
      </section>

      <AchievementsClient />

      <Link className="btn btn-secondary mt-6" href="/history">
        Виж записаните игри
      </Link>
    </main>
  );
}
```

Забележи: `<AchievementsClient />` сега рендерира wreath-а сам, така че hero блока не я съдържа.

---

## Acceptance criteria

1. **Generated brass texture съществува**:
   - `apps/web/public/game-art/textures/brass-plate.png` + `.webp`
   - Без видими letters/numbers/engravings в изображението.
2. **Schema extension** в `packages/shared/src/achievements.ts` приет:
   - `AchievementDefinition` има optional `tier` + `family`.
   - 7-те съществуващи achievement-и имат assigned стойности (виж таблицата).
   - `pnpm --filter @werewolf/shared build` минава.
3. **BG-only нарушения поправени** в `apps/web/app/achievements/page.tsx` (3 текста).
4. **Layout**:
   - Единен 3-кол grid (1/2/3 responsive), не повече mixed 4+3.
   - Progress wreath с laurel branches показва `{unlocked}/{total} легенди`.
   - Старата empty-state-карта изчезва.
5. **Plaque visual**:
   - Brass texture фон с embossed double border (CSS box-shadow).
   - Engraved text effect (text-shadow с light + dark).
   - Inline SVG icon (stroke-only) — НЕ текст думи "кръв" / "маска".
   - Tier визуално различим: bronze (топъл златен), silver (студен сив), gold (по-наситен жълт).
   - Family frame: werewolf gothic top, mafia baroque oval, universal clean rectangle.
6. **Locked state**:
   - Oxidized зеленикав patina чрез filter (без втори asset).
   - Icon + текст остават четими но визуално "приглушени".
7. **Hover**: лек 3D tilt с perspective rotate + lift.
8. **Mobile 390×844**: 1 кол, plaque-ите се стек-ват, frame shape оцелява.
9. **БГ-only copy**, никакви Latin words.
10. `pnpm regression` + `pnpm typecheck` + `pnpm build` минават.
11. Screenshot-ите в `audit-v3/after/achievements/`.

---

## Не пипай

- Game-server / schemas (играта) / role-assignment.
- `apps/web/app/api/achievements/route.ts`.
- `packages/database/src/queries.ts`.
- `evaluateAchievementUnlocks` / `deriveAchievementsFromEvents` функции — само добавяй полета на `AchievementDefinition`.
- Без нови npm dependencies.

---

## Verification

1. `pnpm --filter @werewolf/shared build` — pass.
2. `pnpm optimize:assets` — pass.
3. `pnpm regression` — pass.
4. `pnpm typecheck` — pass.
5. `pnpm build` — pass.
6. Playwright screenshots:
   - 1440 × 900 → `/achievements` без localStorage userId (no fetch → all locked).
   - 1440 × 900 → `/achievements` с mock localStorage userId + fixture unlocks (~4 от 7).
   - 390 × 844 → `/achievements` mobile, locked + partially unlocked.
7. Запиши screenshot-и в `audit-v3/after/achievements/`.

---

## Commit strategy

Препоръчителни commits на нов клон `feat/achievements-brass-plaques`:

All commit messages must be in English (project convention).

1. `chore(art): generated brass plate texture`
2. `feat(shared): add tier + family fields to AchievementDefinition`
3. `fix(achievements): remove Latin words "replay" + "grind" from UI copy`
4. `feat(achievements): AchievementPlaque + AchievementIcon + brass texture`
5. `feat(achievements): tier + family theming + locked patina`
6. `feat(achievements): AchievementProgressWreath header`
7. `chore(achievements): screenshot baseline in audit-v3/after/achievements/`

PR title: `feat: redesign /achievements като engraved brass plaques — tier, family theming, generated brass texture`.

---

(End of prompt)
