# Codex prompt — Redesign `/history` (Evidence Wall) + generated art

Целта: текущата `/history` страница е една празна-state ивица в океан от тъмно. Body текстът е невидим (contrast bug). Превръщаме страницата в **"Стена с улики"** (Evidence Wall) с **two generated art assets** — aged paper texture за case-file cards и painterly empty-state hero illustration.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4, PostgreSQL via Drizzle). Read `AGENTS.md` first — invariants:
- Всичкият user-facing copy на български. Без Latin words в UI.
- Не въвеждай нови npm dependencies (`sharp` вече е там за asset pipeline).
- Не пипай game-server, schemas, role-assignment.
- Без accessibility prompts (focus rings, ARIA-live, focus traps) — user-ът изрично каза без тези.

Имаш достъп до `/imagen` (gpt-image-2). Използвай го за двата нови art asset-а. Imagen output е PNG; след това `pnpm optimize:assets` ще генерира WebP вариантите автоматично през `sharp` (виж `scripts/optimize-assets.mjs`).

### Контекст

Текуща страница `/history`:
- Рендерира се от `apps/web/app/history/page.tsx`.
- Дърпа `getRecentGameHistory(db, limit=20)` + `getGameTimeline(db, gameId, 6)` от `@werewolf/database`.
- Данни идват като `GameHistorySummary` (виж `packages/database/src/queries.ts:5-14`): `{ id, code, config, status, winnerTeam, startedAt, endedAt, eventCount }` + `timeline: GameTimelineEvent[]`.
- В empty state показва ribbon с heading "Архивът още е запечатан" + body text, който **е невидим** (contrast bug — body text inherits white-on-cream).
- В filled state показва вертикален list от cards с timeline inside.

Скрийншот baseline: `audit-v3/desktop/07-history.png`. Painterly background-ът вече показва **стена с прикачени листи** (`/game-art/bg-history-archive.webp`) — leаn into-то.

### Концепция: "Стена с улики" (Evidence Wall)

Страницата изглежда като wall в стая на детектив:
- **Background** = painterly evidence wall (вече съществува).
- **Cards** = "досиета" / откъснати листи, "прикачени" с pushpins, върху **истинско aged paper texture** (generated asset #1).
- **Empty state** = центрирана **painted illustration** на празна корк-стена с една pushpin (generated asset #2) + БГ tag + CTAs + 3 ghost cards под него.
- **Filled state** = grid от case-files в естествен (не идеален) layout — leko ротирани, разпръснати, не равномерни.
- **Family color coding** = мафия-делата имат червен accent (пушпин + ribbon), върколак — амбърен.

---

## Стъпка 1 — Generate art assets чрез `/imagen`

Generate **два** PNG файла. След генериране ги save-ни в правилните пътеки, после стартирай `pnpm optimize:assets` за да се направят WebP вариантите.

### Asset #1: Aged paper texture

**Path:** `apps/web/public/game-art/textures/case-file-paper.png`

**Imagen prompt:**
```
A close-up overhead photograph of vintage cream parchment paper,
slightly aged with subtle fiber texture, faint water stains at
the edges, a few hairline creases visible on the surface, and
warm tonal variation from ivory to amber. Photographic realism,
soft directional lighting from upper left, no text whatsoever,
no symbols, no marks, no printed letters, no handwriting. The
paper fills the entire frame edge to edge as a flat surface
suitable for use as a seamless background texture. Aspect ratio
4:3.
```

**Size:** 1536 × 1152 (or whatever closest 4:3 imagen supports).

**Critical:** no text/letters/symbols in the image — we overlay all text via HTML. If the first generation has stray marks that look like writing, regenerate with stronger "no text, no symbols, no writing" emphasis.

### Asset #2: Empty-state hero illustration

**Path:** `apps/web/public/game-art/history-empty-hero.png`

**Imagen prompt:**
```
A painterly, cinematic illustration of a dimly lit detective's
investigation room. Center frame: a single red metal pushpin
pressed into a dark cork wall, with a small blank paper tag
dangling on a thin twine just below it. Volumetric warm lamplight
falls from the upper right, casting a long soft shadow across
the cork surface. Background: deeply blurred wood-paneled wall,
hints of brass fittings and aged copper. Mood: anticipation,
quiet beginning, the room is waiting for its first case. Oil-
paint style with visible brushwork, desaturated palette with
warm amber and ember-red accents, deep shadow falloff at the
edges (natural vignette). No text, no letters, no symbols, no
numbers anywhere in the image. Aspect ratio 3:2.
```

**Size:** 1536 × 1024 (или най-близкото 3:2 от imagen).

**Critical:** no text/letters/numbers — copy се поставя през HTML overlay. Single pushpin (not multiple), single paper tag, no other clutter — empty state-ът трябва да усеща празнотата, не да я запълни.

### След генерация

1. Save и двата PNG в горните пътеки.
2. Стартирай `pnpm optimize:assets` — това ще създаде `case-file-paper.webp` + `history-empty-hero.webp` + mobile варианти автоматично (виж `scripts/optimize-assets.mjs`).
3. Verify:
   ```bash
   ls apps/web/public/game-art/textures/case-file-paper.{png,webp}
   ls apps/web/public/game-art/history-empty-hero.{png,webp}
   ```
   Всичките 4 файла трябва да съществуват.

---

## Стъпка 2 — Code redesign

### Files to touch

1. `apps/web/app/history/page.tsx` — пълен redesign на JSX (server component layer).
2. `apps/web/components/history/EvidenceWall.tsx` — **нов** клиентски компонент за wall + filters (`"use client"`).
3. `apps/web/components/history/CaseFileCard.tsx` — **нов** компонент за едно дело.
4. `apps/web/components/history/EvidenceWallEmpty.tsx` — **нов** компонент за empty state с hero illustration.
5. `apps/web/lib/history-highlights.ts` — **нов** helper за extract на топ-моменти от timeline.
6. `apps/web/app/globals.css` — нови `.evidence-wall`, `.case-file`, `.pushpin`, `.evidence-empty` блокове. Първо премахни (или остави dormant) старите `.history-empty`, `.history-empty-mark`, `.history-game-card`, `.timeline-event`, `.history-ledger`.

Не пипай:
- `apps/web/app/history/[gameId]/replay/page.tsx` (replay viewer-ът — отделна страница).
- `packages/database/src/queries.ts` (data layer).
- `apps/web/components/skeleton.tsx` (но добави нов `EvidenceWallSkeleton` ако е нужно).

### Page layout

```
┌─────────────────────────────────────────────────────────┐
│ [navbar]                                                │
│                                                         │
│  Архив на масата                                        │
│  ─────────────────                                      │
│  [Всички] [Върколак] [Мафия] [Победи] [Загуби]         │
│                                                         │
│  📌                  📌              📌                 │
│   ╭──────────╮     ╭──────────╮    ╭──────────╮        │
│   │ дело 042 │     │ дело 041 │    │ дело 040 │        │
│   │ ...      │     │ ...      │    │ ...      │        │
│   ╰──────────╯     ╰──────────╯    ╰──────────╯        │
│                                                         │
│   ╭──────────╮     📌              📌                  │
│   │ дело 039 │   ╭──────────╮    ╭──────────╮          │
│   │          │   │ дело 038 │    │ дело 037 │          │
│   │          │   │          │    │          │          │
│   ╰──────────╯   ╰──────────╯    ╰──────────╯          │
└─────────────────────────────────────────────────────────┘
```

### Header

```tsx
<header className="evidence-wall-header">
  <p className="section-kicker">архив</p>
  <h1>Архив на масата</h1>
  <p className="evidence-wall-subtitle">
    Всяко дело носи дата, играчите, ролите и развръзката.
  </p>
</header>
```

### Filter chips

```tsx
<div className="evidence-filters" role="group" aria-label="Филтри по дело">
  <button data-active={filter === "all"} onClick={() => setFilter("all")}>Всички</button>
  <button data-active={filter === "werewolves"} onClick={() => setFilter("werewolves")}>Върколак</button>
  <button data-active={filter === "mafia"} onClick={() => setFilter("mafia")}>Мафия</button>
  <button data-active={filter === "wins"} onClick={() => setFilter("wins")}>Победи</button>
  <button data-active={filter === "losses"} onClick={() => setFilter("losses")}>Загуби</button>
</div>
```

Pill-style toggle buttons. Активният chip има по-силен border + filled background. Filter logic е клиентски, data вече е цялата (20 last games).

### Case file card

```tsx
<article
  className="case-file"
  data-family={modeFamily(game.mode)}
  data-outcome={outcomeFor(game, currentUserId)}
  style={{ "--tilt": `${tiltFor(game.id)}deg` } as CSSProperties}
>
  <span className="pushpin" aria-hidden />
  <header className="case-file-head">
    <span className="case-file-number">Дело №{game.code}</span>
    <span className="case-file-date">{shortDate(game.endedAt)}</span>
  </header>
  <h2 className="case-file-verdict">{winnerBg(game.winnerTeam)}</h2>
  <p className="case-file-mode">{modeBg(game.mode)} · {playerCountBg(game)} души</p>
  <ul className="case-file-highlights">
    {topMoments(game.timeline, 2).map((moment) => (
      <li key={moment.id}>
        <span className="case-file-bullet" aria-hidden />
        {moment.label}
      </li>
    ))}
  </ul>
  <footer className="case-file-foot">
    <Link href={`/history/${game.id}/replay`} className="case-file-cta">
      Отвори дело →
    </Link>
  </footer>
</article>
```

Логика:
- `tiltFor(id)` — детерминистичен hash → `-3°...+3°` стъпки 0.5°. Не може да трепери при rerender.
- `outcomeFor(game, userId)` — `"win"` ако userId е в победилия team's playerlist, `"loss"` ако е в губещия, `"unknown"` ако userId е празен или не в играта.
- `topMoments(timeline, n)` — извлича до n най-семантични събития (виж по-долу).

### CSS — case file card с paper texture

```css
.case-file {
  position: relative;
  padding: 24px 22px 20px;
  background-color: #f0e0c4;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.55), rgba(238,222,196,0.35)),
    image-set(
      url("/game-art/textures/case-file-paper.webp") type("image/webp"),
      url("/game-art/textures/case-file-paper.png") type("image/png")
    );
  background-size: cover, cover;
  background-position: center, center;
  background-blend-mode: normal, multiply;
  border: 1px solid rgba(83, 52, 31, 0.28);
  border-radius: 6px;
  box-shadow:
    0 2px 0 rgba(0,0,0,0.08),
    0 12px 28px rgba(0,0,0,0.32),
    inset 0 1px 0 rgba(255,255,255,0.55);
  transform: rotate(var(--tilt, 0deg));
  transition: transform 180ms ease, box-shadow 180ms ease;
  color: #2a1b10;
  min-height: 200px;
}
.case-file:hover {
  transform: rotate(0deg) translateY(-4px);
  box-shadow:
    0 2px 0 rgba(0,0,0,0.08),
    0 18px 38px rgba(0,0,0,0.44),
    inset 0 1px 0 rgba(255,255,255,0.55);
}
.case-file[data-outcome="win"] { border-left: 3px solid #2e6b2e; }
.case-file[data-outcome="loss"] { border-left: 3px solid #842f2b; }
.case-file[data-outcome="unknown"] { border-left: 3px solid rgba(83, 52, 31, 0.3); }

.case-file h2,
.case-file p,
.case-file li,
.case-file .case-file-number,
.case-file .case-file-date {
  color: #2a1b10;
}
```

`background-blend-mode: normal, multiply` слива cream/tan gradient-а с paper texture-а — гарантира, че текстът е винаги четим, дори paper-ът да е малко тъмен.

### CSS — pushpin (CSS-only, не PNG)

```css
.pushpin {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #d94a3d 0%, #842f2b 60%, #4a1a18 100%);
  box-shadow:
    0 2px 4px rgba(0,0,0,0.4),
    inset 0 1px 1px rgba(255,255,255,0.4);
  z-index: 2;
}
.case-file[data-family="werewolves"] .pushpin {
  background: radial-gradient(circle at 35% 35%, #d19a42 0%, #6b3f10 60%, #3a1e02 100%);
}
```

### CSS — Evidence wall grid

```css
.evidence-wall {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px 24px;
  padding: 56px 24px 64px;
}
@media (min-width: 640px) {
  .evidence-wall {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .evidence-wall {
    grid-template-columns: repeat(3, 1fr);
    gap: 56px 32px;
  }
}
@media (min-width: 1440px) {
  .evidence-wall {
    grid-template-columns: repeat(4, 1fr);
  }
}

.evidence-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0 32px;
}
.evidence-filters button {
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(34, 22, 17, 0.32);
  color: #e8d9bb;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.evidence-filters button[data-active="true"] {
  background: rgba(132, 47, 43, 0.78);
  border-color: #d94a3d;
  color: #fff5e0;
}
.evidence-filters button:hover:not([data-active="true"]) {
  background: rgba(34, 22, 17, 0.5);
}
```

### Empty state с hero illustration

```tsx
import Image from "next/image";

export function EvidenceWallEmpty() {
  return (
    <section className="evidence-empty">
      <figure className="evidence-empty-figure">
        <Image
          src="/game-art/history-empty-hero.webp"
          alt=""
          width={768}
          height={512}
          priority
          className="evidence-empty-art"
        />
        <figcaption className="evidence-empty-tag">
          Първата нощ ще остави следа тук.
        </figcaption>
      </figure>
      <div className="evidence-empty-cta">
        <Link href="/werewolf/create" className="btn btn-primary">
          Започни първото дело
        </Link>
        <Link href="/tutorial" className="btn btn-secondary">
          Виж как изглежда дело
        </Link>
      </div>
      <div className="evidence-ghost-row" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="case-file case-file-ghost"
            style={{ "--tilt": `${i === 1 ? -2 : i === 0 ? 1.5 : -1}deg` } as CSSProperties}
          >
            <span className="pushpin" />
            <div className="case-file-ghost-lines">
              <span style={{ width: "60%" }} />
              <span style={{ width: "85%" }} />
              <span style={{ width: "40%" }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### CSS — empty state

```css
.evidence-empty {
  display: grid;
  justify-items: center;
  gap: 24px;
  padding: 48px 24px 64px;
  text-align: center;
}
.evidence-empty-figure {
  max-width: 640px;
  margin: 0;
  position: relative;
}
.evidence-empty-art {
  width: 100%;
  height: auto;
  border-radius: 18px;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  /* Painterly fade на ръбовете към тъмния фон */
  mask-image: radial-gradient(ellipse 90% 80% at center, #000 65%, transparent 100%);
}
.evidence-empty-tag {
  margin-top: 18px;
  max-width: 28ch;
  font-style: italic;
  color: #ead8b8;
  font-size: 1.125rem;
  line-height: 1.6;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}
.evidence-empty-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}
.evidence-ghost-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  max-width: 920px;
  width: 100%;
  margin-top: 40px;
  padding: 0 24px;
}
.case-file-ghost {
  opacity: 0.32;
  filter: blur(0.4px);
  pointer-events: none;
  min-height: 160px;
}
.case-file-ghost-lines {
  margin-top: 16px;
}
.case-file-ghost-lines span {
  display: block;
  height: 10px;
  border-radius: 4px;
  background: rgba(83, 52, 31, 0.32);
  margin: 8px 0;
}
```

### Contrast bug fix

В `globals.css` намери `.utility-empty p` (line ~9030) и `.history-empty` (line ~4382). Премахни ги или override-ни на ниво `.evidence-*` като в CSS блоковете по-горе. Body текстът в `.evidence-empty` ползва `color: #ead8b8` (върху тъмен фон), а body текстът в `.case-file` ползва `color: #2a1b10` (върху paper texture).

### Highlight extraction logic

Нов файл `apps/web/lib/history-highlights.ts`:

```ts
import type { GameTimelineEvent } from "@werewolf/database";

export interface CaseFileHighlight {
  id: string;
  label: string;
}

const HIGH_VALUE_TYPES = new Set(["game_over", "death", "reveal", "personal_win", "night_action"]);

export function topMoments(timeline: GameTimelineEvent[], limit = 2): CaseFileHighlight[] {
  const candidates = timeline.filter((event) => HIGH_VALUE_TYPES.has(event.type));
  const taken = candidates.slice(0, limit);
  if (taken.length > 0) {
    return taken.map((event) => ({ id: event.id, label: formatHighlight(event) }));
  }
  return [{ id: "tihaNosht", label: "Тиха нощ — без явни обрати." }];
}

function formatHighlight(event: GameTimelineEvent): string {
  switch (event.type) {
    case "game_over": return "Развръзка на масата";
    case "death": return "Смърт в нощта";
    case "reveal": return "Разкрита роля";
    case "personal_win": return "Лична победа";
    case "night_action": return "Тежко нощно действие";
    default: return "Записано събитие";
  }
}
```

Codex може да обогати logiката (например parse-ва `event.payload` за по-конкретни labels), но запази **БГ-only** copy.

### Tilt helper

```ts
// apps/web/lib/history-tilt.ts
export function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const buckets = [-3, -2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3];
  return buckets[Math.abs(hash) % buckets.length];
}
```

---

## Acceptance criteria

1. **Generated assets съществуват**:
   - `apps/web/public/game-art/textures/case-file-paper.png` + `.webp`
   - `apps/web/public/game-art/history-empty-hero.png` + `.webp`
   - И двата без visible text/letters/symbols в изображението.
2. **Contrast bug е поправен** — body текстът в empty state-а е напълно четим.
3. **Empty state**:
   - Hero illustration центрирана (radial mask fade на ръбовете).
   - Tag "Първата нощ ще остави следа тук." видим под нея.
   - 2 CTAs ("Започни първото дело" / "Виж как изглежда дело").
   - 3 ghost case files под empty-state-а, всеки с pushpin + 3 blur lines.
4. **Filled state**:
   - Filter chips: Всички / Върколак / Мафия / Победи / Загуби — функционални.
   - Cards в grid: 1 кол под 640px, 2 над 640px, 3 над 1024px, 4 над 1440px.
   - Всяка карта има pushpin отгоре, тематичен accent (червен/амбърен), малък random tilt от `tiltFor(id)`.
   - Картата има aged paper texture като фон (визуално различимо от plain gradient).
   - На hover — карта се изправя (tilt → 0) + lift.
5. **Mobile 390×844**: всичко стек-ва се на 1 кол, pushpin-ите си стоят, padding е разумен, hero illustration попълва ширината с radial mask.
6. **БГ-only copy** — никакви Latin думи в UI.
7. **Никакви нови npm dependencies**.
8. `pnpm regression` минава.
9. `pnpm typecheck` минава.
10. `pnpm build` минава.
11. Screenshot-ите се записват в `audit-v3/after/history/` (поне 4: desktop empty + desktop filled + mobile empty + mobile filled).

---

## Не пипай

- Game-server, schemas, role-assignment.
- `/history/[gameId]/replay` страницата.
- `packages/database/src/queries.ts`.
- Без нови npm dependencies.
- Без accessibility prompts извън стандартните ARIA attributes в JSX по-горе.

---

## Verification

1. **Imagen verify**: file count + sizes — `case-file-paper.png` трябва да е > 200 KB (suggests real photo detail), `history-empty-hero.png` > 400 KB (suggests painterly detail). Ако са по-малки, regenerate с по-силен prompt.
2. `pnpm optimize:assets` — pass.
3. `pnpm regression` — pass.
4. `pnpm typecheck` — pass.
5. `pnpm build` — pass.
6. Playwright screenshots:
   - 1440 × 900 → `/history` empty (clear DB or mock loader to return []).
   - 1440 × 900 → `/history` filled (>5 fixture games).
   - 390 × 844 → `/history` empty + filled.

---

## Commit strategy

Препоръчителни commits на нов клон `feat/history-evidence-wall`:

All commit messages must be in English (project convention).

1. `chore(art): generated case-file paper + empty hero illustrations`
2. `fix(history): contrast bug in empty state body text`
3. `feat(history): new EvidenceWall layout with case files`
4. `feat(history): paper texture + pushpin + tilt + family theming`
5. `feat(history): filter chips + empty state hero + ghost cards`
6. `chore(history): screenshot baseline in audit-v3/after/history/`

PR title: `feat: redesign /history като Evidence Wall — case files, generated paper texture, painterly empty hero`.

---

(End of prompt)
