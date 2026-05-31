# Codex prompt — Redesign `/leaderboard` (Vintage Newspaper)

Целта: текущата `/leaderboard` страница е plain ledger list — hero + 30-редов tabular списък. Превръщаме я в **винтидж вестник** — front-page headlines с halftone портрет за top-1, secondary stories за top 2-3, dense classified-style колони за rank 4-30. Един generated halftone silhouette portrait като визуален anchor.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4, PostgreSQL via Drizzle). Read `AGENTS.md` first — invariants:
- Всичкият user-facing copy на български. Без Latin words в UI.
- Не въвеждай нови npm dependencies (`sharp` вече е там за asset pipeline).
- Не пипай game-server, schemas, role-assignment.
- Без accessibility prompts извън стандартните ARIA attributes в JSX по-долу.

Имаш достъп до `/imagen` (gpt-image-2). Използвай го за единичния halftone silhouette portrait. След генериране `pnpm optimize:assets` автоматично прави WebP вариантите.

### Контекст

Текуща страница `/leaderboard`:
- Рендерира се от `apps/web/app/leaderboard/page.tsx`.
- Дърпа `getLeaderboardRows(db, limit=500)` от `@werewolf/database`.
- Aggregate-ва редовете по `displayName` → `{ displayName, games, wins, lastPlayed }`.
- Sort: `wins DESC, games DESC`, top 30.
- Win win/loss logic-ът минава през `getRoleTeam(role)` от `@werewolf/shared`.

Текущ скрийншот: `audit-v3/desktop/08-leaderboard.png` + `audit-v3/mobile/08-leaderboard.png`.

### Концепция: Vintage Newspaper (Винтидж вестник)

Цялата страница изглежда като **първа страница на вестник** — interwar tabloid естетика:
- **Masthead** отгоре: декоративен banner с "БРОЙ № NNN · дата · издание след игра".
- **Главна новина (top-1)**: голям заглавен banner + halftone silhouette portrait + flavor quote.
- **Вторични новини (top 2-3)**: 2-кол strip с по-малки headlines + stats.
- **Класирани (top 4-8)**: numbered list в 1 кол с разделителни линии.
- **Класифицирани (top 9-30)**: dense 3-кол layout (`column-count: 3`).
- **Newspaper paper feel**: cream-yellow gradient + subtle CSS noise, heavy black borders между колоните, vintage serif шрифтове.

---

## Стъпка 1 — Generate halftone portrait чрез `/imagen`

**Path:** `apps/web/public/game-art/leaderboard-headline-portrait.png`

**Imagen prompt:**
```
A moody black-and-white halftone newsprint photograph of a single
hooded figure in profile, facing left, looking off into the
distance. The figure wears a dark cloak with the hood partially
shadowing the face — only the outline of the jaw and shoulder
are visible, no facial features visible. Background is a deeply
blurred soft gradient suggesting a smoky room, with subtle warm
lamplight bleeding from off-frame. The image has the classic
high-contrast newsprint look: visible halftone dot pattern across
midtones, slight ink bleed at the edges, fine print grain.
Vignetted corners that fade to deep ink black. Mood: anticipation,
mystery, the survivor archetype. No text, no letters, no numbers,
no symbols anywhere in the image. Aspect ratio 3:4 (vertical
portrait orientation).
```

**Size:** 1024 × 1366 (3:4 vertical portrait).

**Critical:** Halftone dot pattern, profile-only (no full face), no text. Ако output-ът няма visible halftone dots или показва face details, regenerate с по-силен emphasis върху "halftone print dots", "hooded silhouette", "no facial features visible".

### След генерация

1. Save PNG-то в горната пътека.
2. Стартирай `pnpm optimize:assets` — създава WebP + mobile варианти.
3. Verify:
   ```bash
   ls apps/web/public/game-art/leaderboard-headline-portrait.{png,webp}
   ```

---

## Стъпка 2 — Code redesign

### Files to touch

1. `apps/web/app/leaderboard/page.tsx` — пълен redesign на server component layer.
2. `apps/web/components/leaderboard/NewspaperPage.tsx` — **нов** wrapper layout.
3. `apps/web/components/leaderboard/Masthead.tsx` — **нов** date+issue banner.
4. `apps/web/components/leaderboard/MainHeadline.tsx` — **нов** top-1 с portrait.
5. `apps/web/components/leaderboard/SecondaryStories.tsx` — **нов** top 2-3 strip.
6. `apps/web/components/leaderboard/RanksColumn.tsx` — **нов** top 4-8 numbered list.
7. `apps/web/components/leaderboard/ClassifiedsList.tsx` — **нов** top 9-30 dense 3-кол.
8. `apps/web/components/leaderboard/NewspaperEmpty.tsx` — **нов** empty state.
9. `apps/web/lib/leaderboard-headlines.ts` — **нов** copy-generation helper.
10. `apps/web/app/globals.css` — нови `.newspaper-page`, `.masthead`, `.headline-*`, `.classifieds-*` блокове. Премахни (или остави dormant) старите `.leaderboard-list`, `.leaderboard-row`, `.leaderboard-rank`.

Не пипай:
- `packages/database/src/queries.ts` (data layer).
- `packages/shared` — не въвеждай нови shared types ако не са нужни.

### Headline generation logic

```ts
// apps/web/lib/leaderboard-headlines.ts

export interface LeaderboardEntry {
  displayName: string;
  games: number;
  wins: number;
  lastPlayed: Date | null;
}

export function headlineFor(entry: LeaderboardEntry, rank: number): string {
  const { wins, games, displayName } = entry;
  const winRate = wins / Math.max(1, games);

  if (rank === 1) {
    if (games >= 5 && wins === games) return `${displayName} още не познава поражение`;
    if (winRate >= 0.75 && wins >= 4) return `${displayName} отново оцеля`;
    if (winRate >= 0.5 && wins >= 3) return `${displayName} остава прав в нощите`;
    if (games === 1 && wins === 1) return `Първа победа: ${displayName} взе вечерта`;
    return `${displayName} оцелява най-често`;
  }

  if (rank === 2) {
    if (wins >= 5) return `${displayName} остава в сянка`;
    if (winRate >= 0.5) return `${displayName} се държи близо до върха`;
    return `${displayName} е втора фигура`;
  }

  if (rank === 3) {
    if (winRate >= 0.5) return `${displayName} се движи внимателно`;
    if (wins >= 2) return `${displayName} вече има две победи`;
    return `${displayName} още събира памет`;
  }

  return displayName;
}

export function flavorQuoteFor(entry: LeaderboardEntry, rank: number): string | null {
  if (rank !== 1) return null;
  const { wins, games } = entry;
  const winRate = wins / Math.max(1, games);

  if (winRate >= 0.85 && games >= 5) {
    return `${wins} победи от ${games} вечери. Селото знае кого да гледа.`;
  }
  if (wins >= 5) {
    return `${wins} победи събрани под различни роли. Всяка нощ — нова маска.`;
  }
  if (games === 1 && wins === 1) {
    return `Една игра, една победа. Дебютът става легенда.`;
  }
  if (winRate >= 0.5) {
    return `${wins} оцеляли вечери от ${games}. По-малко гласове отиват в сянка.`;
  }
  return `${wins} оцеляли вечери от ${games}. Масата помни.`;
}

export function shortMeta(entry: LeaderboardEntry): string {
  return `${entry.games} вечери · ${entry.wins} победи`;
}

export function winRatePercent(entry: LeaderboardEntry): number {
  return Math.round((entry.wins / Math.max(1, entry.games)) * 100);
}

export function formatNewspaperDate(date: Date): string {
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function issueNumber(seed: number): string {
  // Issue номер базиран на брой total games или брой last_played, не криптографски стабилен.
  // Прост deterministic format: pad до 3 цифри.
  return String(seed).padStart(3, "0");
}
```

### NewspaperPage layout

```tsx
import { Suspense } from "react";
import { createDatabase, getLeaderboardRows } from "@werewolf/database";
import { Masthead } from "@/components/leaderboard/Masthead";
import { MainHeadline } from "@/components/leaderboard/MainHeadline";
import { SecondaryStories } from "@/components/leaderboard/SecondaryStories";
import { RanksColumn } from "@/components/leaderboard/RanksColumn";
import { ClassifiedsList } from "@/components/leaderboard/ClassifiedsList";
import { NewspaperEmpty } from "@/components/leaderboard/NewspaperEmpty";
import { LeaderboardSkeleton } from "@/components/skeleton";

export default function LeaderboardPage() {
  return (
    <main className="shell newspaper-shell">
      <Suspense fallback={<LeaderboardSkeleton />}>
        <NewspaperContent />
      </Suspense>
    </main>
  );
}

async function NewspaperContent() {
  const entries = await loadLeaderboard();
  const totalGames = entries.reduce((sum, entry) => sum + entry.games, 0);

  if (entries.length === 0) {
    return <NewspaperEmpty />;
  }

  const [top1, top2, top3, ...rest] = entries;
  const ranksColumn = rest.slice(0, 5);
  const classifieds = rest.slice(5);

  return (
    <article className="newspaper-page" aria-label="Вечерен брой на класацията">
      <Masthead totalGames={totalGames} />
      <MainHeadline entry={top1} />
      <SecondaryStories second={top2} third={top3} />
      {ranksColumn.length > 0 ? <RanksColumn entries={ranksColumn} startRank={4} /> : null}
      {classifieds.length > 0 ? <ClassifiedsList entries={classifieds} startRank={9} /> : null}
    </article>
  );
}
```

### Masthead

```tsx
import { formatNewspaperDate, issueNumber } from "@/lib/leaderboard-headlines";

export function Masthead({ totalGames }: { totalGames: number }) {
  const today = new Date();
  return (
    <header className="masthead">
      <div className="masthead-ornament" aria-hidden>
        <svg viewBox="0 0 60 14" width="60" height="14">
          <path d="M0 7 L 25 7 M35 7 L 60 7" stroke="currentColor" strokeWidth="1" />
          <circle cx="30" cy="7" r="2" fill="currentColor" />
        </svg>
      </div>
      <h1 className="masthead-title">Вечерен Брой на Масата</h1>
      <p className="masthead-meta">
        Брой № {issueNumber(totalGames)} · {formatNewspaperDate(today)} · Издание след игра
      </p>
      <div className="masthead-ornament" aria-hidden>
        <svg viewBox="0 0 60 14" width="60" height="14">
          <path d="M0 7 L 25 7 M35 7 L 60 7" stroke="currentColor" strokeWidth="1" />
          <circle cx="30" cy="7" r="2" fill="currentColor" />
        </svg>
      </div>
    </header>
  );
}
```

### MainHeadline (top-1 с portrait)

```tsx
import Image from "next/image";
import { headlineFor, flavorQuoteFor, winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function MainHeadline({ entry }: { entry: LeaderboardEntry }) {
  const headline = headlineFor(entry, 1);
  const quote = flavorQuoteFor(entry, 1);

  return (
    <section className="headline-main" aria-label="Главна новина">
      <p className="headline-kicker">главна новина</p>
      <h2 className="headline-main-title">{headline}</h2>

      <div className="headline-main-grid">
        <figure className="headline-portrait">
          <Image
            src="/game-art/leaderboard-headline-portrait.webp"
            alt=""
            width={512}
            height={683}
            priority
            className="headline-portrait-img"
          />
          <figcaption className="headline-portrait-caption">
            «Силуетът, който маса вече разпознава.»
          </figcaption>
        </figure>

        <div className="headline-body">
          {quote ? <p className="headline-lede"><span className="headline-dropcap">{quote.charAt(0)}</span>{quote.slice(1)}</p> : null}

          <dl className="headline-stats">
            <div>
              <dt>Вечери</dt>
              <dd>{entry.games}</dd>
            </div>
            <div>
              <dt>Победи</dt>
              <dd>{entry.wins}</dd>
            </div>
            <div>
              <dt>Процент</dt>
              <dd>{winRatePercent(entry)}%</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
```

### SecondaryStories (top 2-3 strip)

```tsx
import { headlineFor, shortMeta, winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function SecondaryStories({ second, third }: { second?: LeaderboardEntry; third?: LeaderboardEntry }) {
  if (!second && !third) return null;
  return (
    <section className="secondary-stories" aria-label="Вторични новини">
      {second ? (
        <article className="secondary-story">
          <p className="secondary-rank">№ 2</p>
          <h3 className="secondary-title">{headlineFor(second, 2)}</h3>
          <p className="secondary-meta">{shortMeta(second)} · {winRatePercent(second)}%</p>
        </article>
      ) : null}
      {third ? (
        <article className="secondary-story">
          <p className="secondary-rank">№ 3</p>
          <h3 className="secondary-title">{headlineFor(third, 3)}</h3>
          <p className="secondary-meta">{shortMeta(third)} · {winRatePercent(third)}%</p>
        </article>
      ) : null}
    </section>
  );
}
```

### RanksColumn (top 4-8)

```tsx
import { shortMeta, winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function RanksColumn({ entries, startRank }: { entries: LeaderboardEntry[]; startRank: number }) {
  return (
    <section className="ranks-column" aria-label="Класирани играчи">
      <h3 className="ranks-column-title">Класирани</h3>
      <ol className="ranks-column-list" start={startRank}>
        {entries.map((entry, index) => (
          <li key={entry.displayName} className="ranks-column-item">
            <span className="ranks-column-num">№ {startRank + index}</span>
            <span className="ranks-column-name">{entry.displayName}</span>
            <span className="ranks-column-meta">{shortMeta(entry)} · {winRatePercent(entry)}%</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

### ClassifiedsList (top 9-30, dense 3-кол)

```tsx
import { winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function ClassifiedsList({ entries, startRank }: { entries: LeaderboardEntry[]; startRank: number }) {
  return (
    <section className="classifieds" aria-label="Класифицирани играчи">
      <h3 className="classifieds-title">Класифицирани · рангове {startRank}–{startRank + entries.length - 1}</h3>
      <ul className="classifieds-list">
        {entries.map((entry, index) => (
          <li key={entry.displayName} className="classifieds-item">
            <strong>№ {startRank + index} · {entry.displayName}</strong>
            <span>
              {entry.games}/{entry.wins} · {winRatePercent(entry)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### NewspaperEmpty

```tsx
import Link from "next/link";

export function NewspaperEmpty() {
  return (
    <article className="newspaper-page newspaper-page-empty" aria-label="Бъдещ брой">
      <header className="masthead">
        <h1 className="masthead-title">Вечерен Брой на Масата</h1>
        <p className="masthead-meta">Брой № 001 · очаква името си</p>
      </header>

      <div className="empty-headline">
        <p className="headline-kicker">главна новина</p>
        <h2 className="headline-main-title">Изданието още не е тиражирано</h2>
        <p className="empty-lede">
          Утрешният брой ще носи първото име. Завърши една игра и редакцията се събужда.
        </p>
        <div className="empty-cta">
          <Link href="/werewolf/create" className="btn btn-primary">Започни първото издание</Link>
          <Link href="/tutorial" className="btn btn-secondary">Виж как изглежда вечер</Link>
        </div>
      </div>
    </article>
  );
}
```

### page.tsx (минимални промени към server-side data layer)

```tsx
async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const rows = await getLeaderboardRows(db);
    const byName = new Map<string, LeaderboardEntry>();
    for (const row of rows) {
      const current = byName.get(row.displayName) ?? {
        displayName: row.displayName,
        games: 0,
        wins: 0,
        lastPlayed: row.endedAt,
      };
      current.games += 1;
      current.wins += didRoleWin(row.role, row.winnerTeam) ? 1 : 0;
      current.lastPlayed = latestDate(current.lastPlayed, row.endedAt);
      byName.set(row.displayName, current);
    }

    return [...byName.values()]
      .sort((left, right) => right.wins - left.wins || right.games - left.games)
      .slice(0, 30);
  } catch (error) {
    console.error("[leaderboard]", error);
    return [];
  }
}
```

(Запази `didRoleWin` и `latestDate` както са, само сменяй render-а.)

---

## CSS — newspaper styles

В `apps/web/app/globals.css`:

```css
/* ============================== */
/* Newspaper shell                */
/* ============================== */

.newspaper-shell {
  display: grid;
  place-items: start center;
  padding: 32px 16px 64px;
  min-height: 100vh;
}

.newspaper-page {
  position: relative;
  max-width: 1100px;
  width: 100%;
  padding: 48px 56px 56px;
  background-color: #f6e6c4;
  /* Pure-CSS newsprint paper: subtle noise via inline SVG data URI */
  background-image:
    radial-gradient(ellipse 80% 60% at 30% 20%, rgba(255, 250, 230, 0.55), transparent 70%),
    radial-gradient(ellipse 70% 50% at 80% 80%, rgba(180, 140, 80, 0.18), transparent 70%),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0 0.05  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.4'/></svg>");
  background-blend-mode: multiply, normal, multiply;
  color: #1a1410;
  border-radius: 4px;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(60, 40, 20, 0.35);
  font-family: "Noto Serif", "Times New Roman", serif;
}

@media (max-width: 768px) {
  .newspaper-page {
    padding: 32px 22px 40px;
  }
}

/* ============================== */
/* Masthead                       */
/* ============================== */

.masthead {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-bottom: 24px;
  border-bottom: 4px double #1a1410;
  margin-bottom: 32px;
  color: #1a1410;
}

.masthead-ornament {
  color: #842f2b;
}

.masthead-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-weight: 900;
  font-size: clamp(2rem, 5vw, 3.25rem);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.05;
}

.masthead-meta {
  font-size: 0.875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(26, 20, 16, 0.78);
}

/* ============================== */
/* Main headline                  */
/* ============================== */

.headline-main {
  margin-bottom: 36px;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(26, 20, 16, 0.25);
}

.headline-kicker {
  font-size: 0.75rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
  margin-bottom: 8px;
}

.headline-main-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-weight: 900;
  font-size: clamp(2.25rem, 5vw, 3.75rem);
  line-height: 1.05;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  color: #1a1410;
  margin-bottom: 24px;
}

.headline-main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 768px) {
  .headline-main-grid {
    grid-template-columns: 280px 1fr;
    gap: 32px;
  }
}

.headline-portrait {
  margin: 0;
  position: relative;
}

.headline-portrait-img {
  width: 100%;
  height: auto;
  display: block;
  /* Halftone-усилващ filter — изостря newsprint look-а */
  filter: grayscale(1) contrast(1.25) brightness(0.95);
  border: 1px solid rgba(26, 20, 16, 0.6);
  box-shadow:
    0 2px 0 rgba(0, 0, 0, 0.4),
    0 12px 28px rgba(0, 0, 0, 0.35);
}

.headline-portrait-caption {
  margin-top: 8px;
  font-size: 0.75rem;
  font-style: italic;
  color: rgba(26, 20, 16, 0.7);
  letter-spacing: 0.04em;
  text-align: center;
}

.headline-body {
  display: grid;
  gap: 20px;
  align-content: start;
}

.headline-lede {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #1a1410;
}

.headline-dropcap {
  float: left;
  font-family: "Noto Serif Display", serif;
  font-size: 4rem;
  line-height: 0.85;
  font-weight: 900;
  margin-right: 8px;
  color: #842f2b;
}

.headline-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  border-top: 1px solid rgba(26, 20, 16, 0.3);
  border-bottom: 1px solid rgba(26, 20, 16, 0.3);
  padding: 16px 0;
}

.headline-stats div {
  display: grid;
  gap: 4px;
  text-align: center;
}

.headline-stats dt {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(26, 20, 16, 0.7);
}

.headline-stats dd {
  font-family: "Noto Serif Display", serif;
  font-size: 2rem;
  font-weight: 900;
  color: #1a1410;
}

/* ============================== */
/* Secondary stories              */
/* ============================== */

.secondary-stories {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  padding-bottom: 32px;
  margin-bottom: 32px;
  border-bottom: 1px solid rgba(26, 20, 16, 0.25);
}
@media (min-width: 640px) {
  .secondary-stories {
    grid-template-columns: 1fr 1px 1fr;
  }
  .secondary-stories::after {
    content: "";
    grid-column: 2;
    background: rgba(26, 20, 16, 0.3);
  }
}

.secondary-story {
  display: grid;
  gap: 8px;
}

.secondary-rank {
  font-size: 0.75rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.secondary-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-weight: 900;
  font-size: 1.5rem;
  line-height: 1.15;
  text-transform: uppercase;
  color: #1a1410;
}

.secondary-meta {
  font-size: 0.875rem;
  color: rgba(26, 20, 16, 0.78);
  letter-spacing: 0.04em;
}

/* ============================== */
/* Ranks column                   */
/* ============================== */

.ranks-column {
  margin-bottom: 32px;
  padding-bottom: 28px;
  border-bottom: 1px solid rgba(26, 20, 16, 0.25);
}

.ranks-column-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 1.125rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  margin-bottom: 16px;
  color: #1a1410;
}

.ranks-column-list {
  display: grid;
  gap: 12px;
  list-style: none;
  padding: 0;
}

.ranks-column-item {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  align-items: baseline;
  gap: 16px;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(26, 20, 16, 0.25);
}

.ranks-column-num {
  font-family: "Noto Serif Display", serif;
  font-weight: 900;
  font-size: 1.25rem;
  color: #842f2b;
}

.ranks-column-name {
  font-weight: 700;
  font-size: 1.125rem;
  color: #1a1410;
}

.ranks-column-meta {
  font-size: 0.875rem;
  color: rgba(26, 20, 16, 0.7);
  letter-spacing: 0.03em;
}

/* ============================== */
/* Classifieds                    */
/* ============================== */

.classifieds-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 1rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 14px;
  color: #1a1410;
}

.classifieds-list {
  column-count: 1;
  column-gap: 28px;
  column-rule: 1px solid rgba(26, 20, 16, 0.25);
  list-style: none;
  padding: 0;
}
@media (min-width: 640px) {
  .classifieds-list { column-count: 2; }
}
@media (min-width: 1024px) {
  .classifieds-list { column-count: 3; }
}

.classifieds-item {
  break-inside: avoid;
  display: grid;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(26, 20, 16, 0.18);
  font-size: 0.875rem;
}

.classifieds-item strong {
  font-weight: 700;
  color: #1a1410;
}

.classifieds-item span {
  font-size: 0.8rem;
  color: rgba(26, 20, 16, 0.7);
  letter-spacing: 0.04em;
}

/* ============================== */
/* Empty state                    */
/* ============================== */

.newspaper-page-empty .empty-headline {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 18px;
  padding: 48px 16px 24px;
}

.empty-lede {
  max-width: 38ch;
  font-size: 1.05rem;
  line-height: 1.7;
  color: rgba(26, 20, 16, 0.85);
  font-style: italic;
}

.empty-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 12px;
}
```

### Шрифтови съображения

Проектът използва системни шрифтове + `Noto Serif`. Ако `Noto Serif Display` не е в shipping fonts, fallback chain-ът `"Noto Serif Display", "Noto Serif", serif` ще degrade gracefully към текущия Noto Serif. **Не добавяй нови font imports** (не сваляй WOFF файлове, не въвеждай Google Fonts ако вече не са там — провери `apps/web/app/layout.tsx`).

Ако в layout-а няма font preconnect/loader за serif fonts, остави `Noto Serif Display` като пожелателен fallback — стилистично serif chain-ът пак ще работи.

---

## Acceptance criteria

1. **Generated halftone portrait съществува**:
   - `apps/web/public/game-art/leaderboard-headline-portrait.png` + `.webp`
   - Профил на качулата фигура, halftone dot pattern visible, no facial features, no text/letters/numbers.
2. **Newspaper layout**:
   - Masthead с дата + issue номер + decorative SVG ornaments
   - Main headline (top-1) с goлямо заглавие + halftone portrait отляво + drop-cap lede отдясно + 3-кол stats grid
   - Secondary stories (top 2-3) в 2-кол strip с вертикална разделителна линия
   - Ranks column (top 4-8) numbered list с dashed разделители
   - Classifieds (top 9-30) в 3-кол dense layout с solid column rules
3. **Headline copy logic**:
   - `headlineFor(entry, rank)` генерира BG narrative headlines зависещи от wins/games/winRate
   - `flavorQuoteFor(entry, 1)` връща quote-style lede за top-1
4. **Empty state**:
   - Цялата newspaper page форма се запазва (не plain card)
   - "Брой № 001 · очаква името си" + "Изданието още не е тиражирано"
   - 2 CTAs: Започни първото издание / Виж как изглежда вечер
5. **Responsive**:
   - Desktop ≥1024px: 3-кол classifieds
   - Tablet 640-1024px: 2-кол classifieds
   - Mobile <640px: 1-кол всичко, padding намалява
   - Portrait + lede grid stack-ва вертикално под 768px
6. **БГ-only copy** — никакви Latin words в UI.
7. **Никакви нови npm dependencies** (вкл. font packages).
8. `pnpm regression` минава.
9. `pnpm typecheck` минава.
10. `pnpm build` минава.
11. Screenshot-ите в `audit-v3/after/leaderboard/`.

---

## Не пипай

- Game-server, schemas, role-assignment.
- `apps/web/app/api/leaderboard/**` (ако има).
- `packages/database/src/queries.ts`.
- `didRoleWin` и `latestDate` функциите в `page.tsx` — само сменяй render-а.
- Без нови npm dependencies или font imports.

---

## Verification

1. `pnpm optimize:assets` — pass.
2. `pnpm regression` — pass.
3. `pnpm typecheck` — pass.
4. `pnpm build` — pass.
5. Playwright screenshots:
   - 1440 × 900 → `/leaderboard` empty (без data — clear DB or mock empty result).
   - 1440 × 900 → `/leaderboard` filled (>10 fixture players).
   - 390 × 844 → `/leaderboard` empty + filled.
6. Запиши в `audit-v3/after/leaderboard/`.

---

## Commit strategy

Препоръчителни commits на нов клон `feat/leaderboard-newspaper`:

All commit messages must be in English (project convention).

1. `chore(art): generated halftone silhouette portrait`
2. `feat(leaderboard): headline + quote generation helpers`
3. `feat(leaderboard): newspaper layout with masthead and main headline`
4. `feat(leaderboard): secondary stories + ranks column + classifieds`
5. `feat(leaderboard): empty state newspaper variant`
6. `style(leaderboard): newsprint paper background + vintage typography`
7. `chore(leaderboard): screenshot baseline in audit-v3/after/leaderboard/`

PR title: `feat: redesign /leaderboard като vintage newspaper — halftone portrait, masthead, headlines`.

---

(End of prompt)
