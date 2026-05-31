# Codex prompt — `/privacy` complete overhaul as personal trust dashboard

Цялостен redesign на `/privacy` — от **brass-plaque legal text wall** към **personal trust dashboard** в духа на homepage и новата `/account` страница. Запазваме целия legal content, но го показваме като **modern interactive product page**, не като 1990s legal disclaimer.

**Уникалното за /privacy vs /terms**: страницата има **authenticated-aware "your data preview"** секция (real-time snapshot какво виждаме за теб) + **interactive promise wall** + **direct GDPR action buttons** (изтегли, изтрий, жалба). /terms ще използва същата chrome но без personal data sections.

~14 atomic English commits. Branch: `feat/privacy-trust-dashboard`. **2 нови imagen асета**.

---

## Pre-analysis (current state)

### Текуща структура

`/privacy` използва same `dossier`-style pattern като старото `/account`:
- Sticky painterly vault portrait art ляво (3:4, 320px)
- Heavy brass-textured cream card дясно с 9 секции (h2 + p + ul × 9)
- Cream-on-brass typography с text-shadow
- Footer с "Към началото" link

### Какво е лошото

| # | Issue | Severity |
|---|---|---|
| 1 | **Wall of legal text** на cream-on-brass — нечетим за дълга сесия | 🔴 |
| 2 | **Никаква personal connection** — потребителят чете generic policy, не вижда какво реално знаем за него | 🔴 |
| 3 | **Няма call-to-action** — потребителят чете "имаш право да изтриеш" но не вижда бутон | 🔴 |
| 4 | **9 идентични секции** — нула visual hierarchy, всичките еднакво важни | 🟠 |
| 5 | **Brass-plaque visual** не пасва с новата homepage / account aesthetics | 🟠 |
| 6 | **Няма промисса** — звучи like generic legal copy, не като commitment | 🟠 |
| 7 | **Static без интерактивност** — не reflects modern trust pattern (toggles, expandables) | 🟡 |
| 8 | **Sticky portrait art ляво** — заема 320px без функционална стойност | 🟡 |

### Modern privacy page patterns (Stripe, Linear, Vercel, Notion)

Топ tech companies третират privacy не като legal document а като **product page**:
- **Personal preview** — показват real data какво пазят за конкретния user
- **Promise cards** — visual commitments вместо paragraph 47.3.2
- **Action-oriented** — buttons за export, delete, опровергни inline
- **Plain + legal** — TL;DR на човешки + collapsible legal language
- **Trust indicators** — badges за hosting region, certifications, no-third-parties
- **Version history** — показват кога са правени промени и какво

---

## Pre-decisions (locked)

- **Design system**: `painterly-marketing` (same family като homepage, `/account`, `/history`, `/achievements`). NOT pure legal-modern dark reader.
- **Layout**: Cinematic banner full-width отгоре → 5 content sections под него с stacked card design.
- **Authenticated-aware**: Section "Какво виждаме за теб" се показва САМО за logged-in users. Server-side check.
- **Promise wall pattern**: 6-card grid с inline SVG icons + 1-line promise + collapsible "виж по-подробно" detail.
- **Numbered sections**: 9 sections от current copy се reorganize-ват в 5 thematic groups (по-малко, по-четими).
- **GDPR actions**: 3 prominent CTAs (изтегли данни / изтрий профил / жалба до КЗЛД) с direct links и descriptions.
- **Version history**: collapsible footer accordion show-вайки последни 3 промени с дати.
- **/terms ще follow-ва същата chrome** в **отделен PR** (не в този). Този PR pripares system който /terms after може to inherit.
- **Branch**: `feat/privacy-trust-dashboard`.

---

## Stage 1 — Generate imagen banner

### Asset: Privacy hero banner (NEW)

**Path:** `apps/web/public/game-art/legal/privacy-banner.png`

```
A wide cinematic banner illustration of an ornate brass-bound
mahogany strongbox sitting closed on dark velvet, captured from
a slight low angle to give it presence and authority. Soft
volumetric directional light from the upper-left creates rich
highlights on the brass fittings, embossed corner detail, and
the heavy lock mechanism. Deep shadows pool around the base and
in the upper-right corner. A few wax-sealed envelopes lie
neatly stacked beside the strongbox. The lower third of the
frame gradient-fades into near-black for legible text overlay.
Mood: protection, kept promises, quiet vigilance, the sense that
something valuable is safe. Painterly oil style with visible
brushwork, deep indigo and warm umber palette with brass accents
and ember candlelight glow, atmospheric depth, vignetted corners.
No text, no readable letters, no numbers, no visible markings
anywhere on the strongbox, envelopes, or scene. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

После: `pnpm optimize:assets`. Verify both PNG + WebP exist.

**Note**: Запазваме старите painterly assets `privacy-vault.png` + `.webp` (могат да служат за OG image fallback или future visual references). Не изтриваме в този PR.

### Optional second asset (recommended): Trust diagram

**Path:** `apps/web/public/game-art/legal/trust-flow-diagram.png`

```
A painterly cinematic illustration showing a horizontal visual
metaphor for data trust: at the left, a small lit candle
representing the user. In the middle, a sealed brass envelope
in transit, glowing slightly. At the right, a closed strongbox
with its lock visible. Above the entire scene, a faint solid
brass arc connects all three elements, suggesting a single
trusted path. NO outside arrows, NO branches going elsewhere,
NO additional figures or signs. The composition is symmetric
and intentional. The lower third gradient-fades to near-black.
Mood: simple, trusted path, nothing leaks. Painterly oil style,
warm amber and brass palette, deep navy-black background, dramatic
chiaroscuro. No text, no readable symbols anywhere. Aspect ratio
3:1 (wide inline banner).
```

**Size:** 1500 × 500.

Inline used в "Нашите обещания" section като decorative visual anchor. Ако imagen generation е expensive, this is optional — Codex може to skip и да rely на pure inline SVG promise badges.

---

## Stage 2 — Server-side data fetching

### Update `apps/web/app/privacy/page.tsx`

Privacy page вече трябва to bъде **conditionally personalized**. Authenticated users виждат "your data preview"; anonymous виждат explanation only.

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  createDatabase,
  getGameHistoryForUser,
  getAchievementsForUser,
} from "@werewolf/database";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { JsonLd } from "@/components/JsonLd";
import { PrivacyDashboard, type PrivacyUserSnapshot } from "@/components/privacy/PrivacyDashboard";
import { ResourceHints } from "@/components/resource-hints";
import { auth } from "@/lib/auth";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

const LAST_UPDATED = "17 май 2026";

export const metadata: Metadata = routeMetadata({
  title: "Поверителност | Върколак и Мафия",
  description: "Какви данни събираме, защо ги пазим и как можеш да упражниш правата си.",
  path: "/privacy",
  image: "/game-art/legal/privacy-banner.png",
  imageAlt: "Месингов сандък в светлина на свещ",
  robots: { index: true, follow: true },
  absoluteTitle: true,
});

export default async function PrivacyPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);

  let snapshot: PrivacyUserSnapshot | null = null;

  if (session?.user?.id && process.env.DATABASE_URL) {
    try {
      const db = createDatabase(process.env.DATABASE_URL);
      const [games, achievements] = await Promise.all([
        getGameHistoryForUser(db, session.user.id, 200),
        getAchievementsForUser(db, session.user.id),
      ]);
      snapshot = {
        userId: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email,
        emailVerified: session.user.emailVerified ?? false,
        memberSince: session.user.createdAt ? new Date(session.user.createdAt) : null,
        totalGames: games.length,
        totalAchievements: achievements.length,
        achievementTotal: ACHIEVEMENTS.length,
        providersUsed: 1, // placeholder; could query account table for accurate count
      };
    } catch (error) {
      console.error("[privacy-snapshot]", error);
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Поверителност",
    inLanguage: "bg-BG",
    dateModified: "2026-05-17",
    url: absoluteUrl("/privacy"),
  };

  return (
    <main className="shell privacy-shell">
      <ResourceHints images={["/game-art/legal/privacy-banner.webp"]} />
      <JsonLd data={jsonLd} />
      <PrivacyDashboard
        lastUpdated={LAST_UPDATED}
        userSnapshot={snapshot}
      />
    </main>
  );
}
```

---

## Stage 3 — `PrivacyDashboard` orchestrator

**File:** `apps/web/components/privacy/PrivacyDashboard.tsx`

```tsx
import { PrivacyHero } from "./PrivacyHero";
import { PrivacyDataPreview } from "./PrivacyDataPreview";
import { PrivacyPromiseWall } from "./PrivacyPromiseWall";
import { PrivacySections } from "./PrivacySections";
import { PrivacyRights } from "./PrivacyRights";
import { PrivacyVersionHistory } from "./PrivacyVersionHistory";

export interface PrivacyUserSnapshot {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  memberSince: Date | null;
  totalGames: number;
  totalAchievements: number;
  achievementTotal: number;
  providersUsed: number;
}

interface PrivacyDashboardProps {
  lastUpdated: string;
  userSnapshot: PrivacyUserSnapshot | null;
}

export function PrivacyDashboard({ lastUpdated, userSnapshot }: PrivacyDashboardProps) {
  return (
    <div className="privacy-page">
      <PrivacyHero lastUpdated={lastUpdated} hasSnapshot={Boolean(userSnapshot)} />

      <div className="privacy-content">
        {userSnapshot ? <PrivacyDataPreview snapshot={userSnapshot} /> : null}

        <PrivacyPromiseWall />

        <PrivacySections />

        <PrivacyRights />

        <PrivacyVersionHistory />
      </div>
    </div>
  );
}
```

---

## Stage 4 — `PrivacyHero` component

Cinematic banner с overlay copy. Server-friendly (no client interactivity needed).

```tsx
import Image from "next/image";

interface Props {
  lastUpdated: string;
  hasSnapshot: boolean;
}

export function PrivacyHero({ lastUpdated, hasSnapshot }: Props) {
  return (
    <header className="privacy-hero" aria-label="Политика за поверителност">
      <div className="privacy-hero-banner">
        <Image
          src="/game-art/legal/privacy-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="privacy-hero-img"
        />
        <div className="privacy-hero-scrim" aria-hidden />
      </div>

      <div className="privacy-hero-inner">
        <p className="privacy-hero-kicker">политика за поверителност</p>
        <h1 className="privacy-hero-title">Твоите тайни остават при теб.</h1>
        <p className="privacy-hero-subtitle">
          Какво събираме, защо го пазим и как си господар на твоите данни.
          {hasSnapshot ? " По-долу виждаш точно какво знаем за теб." : ""}
        </p>
        <p className="privacy-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </div>
    </header>
  );
}
```

---

## Stage 5 — `PrivacyDataPreview` — UNIQUE auth-only section

**File:** `apps/web/components/privacy/PrivacyDataPreview.tsx`

Показва **real data** за конкретния logged-in user. Това е the magic — потребителят вижда **точно** какво е в базата ни.

```tsx
"use client";

import Link from "next/link";
import type { PrivacyUserSnapshot } from "./PrivacyDashboard";

interface Props {
  snapshot: PrivacyUserSnapshot;
}

export function PrivacyDataPreview({ snapshot }: Props) {
  const memberSinceLabel = snapshot.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric" }).format(snapshot.memberSince)
    : "—";

  return (
    <section className="privacy-section privacy-section-preview">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">личен преглед</p>
        <h2>Какво виждаме за теб точно сега.</h2>
        <p className="privacy-section-lede">
          Това е целият списък с данни, които пазим за твоя профил. Нищо повече, нищо скрито.
        </p>
      </header>

      <dl className="privacy-data-list">
        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>✉</span>
            <span>Имейл адрес</span>
          </dt>
          <dd>
            <code>{snapshot.email}</code>
            {snapshot.emailVerified ? (
              <span className="privacy-data-badge privacy-data-badge-ok">потвърден</span>
            ) : (
              <Link href="/verify-email" className="privacy-data-badge privacy-data-badge-warn">
                непотвърден →
              </Link>
            )}
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>👤</span>
            <span>Име на масата</span>
          </dt>
          <dd>
            <code>{snapshot.name || "—"}</code>
            <Link href="/account" className="privacy-data-edit">Промени →</Link>
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>🎮</span>
            <span>Игрова история</span>
          </dt>
          <dd>
            <code>
              {snapshot.totalGames === 0 ? "още няма" : `${snapshot.totalGames} ${snapshot.totalGames === 1 ? "игра" : "игри"}`}
            </code>
            <Link href="/history" className="privacy-data-edit">Виж архива →</Link>
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>🏆</span>
            <span>Постижения</span>
          </dt>
          <dd>
            <code>
              {snapshot.totalAchievements} от {snapshot.achievementTotal} отключени
            </code>
            <Link href="/achievements" className="privacy-data-edit">Виж всички →</Link>
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>⏰</span>
            <span>Регистриран</span>
          </dt>
          <dd>
            <code>{memberSinceLabel}</code>
          </dd>
        </div>
      </dl>

      <div className="privacy-data-actions">
        <a href="/api/account/export" className="privacy-data-action privacy-data-action-primary">
          <span>Изтегли всичките данни</span>
          <span className="privacy-data-action-hint">JSON файл със всичко, което знаем</span>
        </a>
      </div>

      <p className="privacy-data-disclaimer">
        Не виждаме твоя IP адрес след сесия, не пазим клавишни последователности, не четем чат
        съобщенията извън стаите на играта. Всичко, което показваме тук, можеш да изтеглиш или
        изтриеш по всяко време.
      </p>
    </section>
  );
}
```

---

## Stage 6 — `PrivacyPromiseWall` component (6 promise cards)

**File:** `apps/web/components/privacy/PrivacyPromiseWall.tsx`

6 promise карти с inline SVG icons + collapsible "виж по-подробно" detail.

```tsx
"use client";

import { useState } from "react";

interface Promise {
  id: string;
  icon: "no-sell" | "no-track" | "no-payment" | "eu-host" | "delete-anytime" | "export-anytime";
  title: string;
  summary: string;
  detail: string;
}

const PROMISES: readonly Promise[] = [
  {
    id: "no-sell",
    icon: "no-sell",
    title: "Не продаваме данните ти.",
    summary: "Никога не сме продавали и няма да продаваме лични данни на трети страни.",
    detail: "Не работим с data brokers. Не споделяме информация с рекламни мрежи. Не правим targeted ads. Финансираме се чрез евентуални доброволни дарения, не чрез монетизация на потребители.",
  },
  {
    id: "no-track",
    icon: "no-track",
    title: "Не те следим извън играта.",
    summary: "Никаква Google Analytics, Facebook Pixel или други tracking системи.",
    detail: "Не зареждаме трети party скриптове за поведенчески анализ. Не ползваме cross-site cookies. Не виждаме къде сте били преди да дойдете при нас или след като си тръгнете.",
  },
  {
    id: "no-payment",
    icon: "no-payment",
    title: "Не искаме платежни данни.",
    summary: "Играта е безплатна. Не искаме банкови карти, IBAN или подобни.",
    detail: "Няма paywall, няма premium tier, няма абонамент. Ако някога приемем дарения, ще се ползва external processor (Stripe / Revolut) — ние не виждаме номера на картата.",
  },
  {
    id: "eu-host",
    icon: "eu-host",
    title: "Сървърите ни са в Европа.",
    summary: "Хостинг в EU (DigitalOcean Frankfurt) — GDPR data residency.",
    detail: "Базата данни и игровият сървър са в DigitalOcean Frankfurt. Това означава GDPR jurisdiction, по-стриктни data protection правила и физически по-кратко разстояние до повечето български играчи.",
  },
  {
    id: "delete-anytime",
    icon: "delete-anytime",
    title: "Изтриваш профила по всяко време.",
    summary: "Бутон в твоя профил. Окончателно изтриване в рамките на 30 дни.",
    detail: "Профилът, постиженията и личните данни изчезват веднага. Имената от игрите ти се заменят с „Изтрит играч“, за да не се чупи историята на другите играчи на масата. Backup записи се изчистват в рамките на 30 дни.",
  },
  {
    id: "export-anytime",
    icon: "export-anytime",
    title: "Извличаш всичко по всяко време.",
    summary: "GDPR право на преносимост — JSON download с цялата ти история.",
    detail: "Един клик — получаваш JSON файл с целия си профил, игри, постижения, настройки. Файлът е structurиран и четим — можеш да го импортираш в друга платформа или просто да го запазиш за своите records.",
  },
];

export function PrivacyPromiseWall() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <section className="privacy-section">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">обещания</p>
        <h2>Какво гарантираме.</h2>
        <p className="privacy-section-lede">
          Шест обещания, които стоят зад всичко в детайлите по-долу.
        </p>
      </header>

      <ul className="privacy-promise-grid">
        {PROMISES.map((promise) => {
          const isOpen = expandedId === promise.id;
          return (
            <li key={promise.id}>
              <article className="privacy-promise-card" data-open={isOpen}>
                <PromiseIcon name={promise.icon} className="privacy-promise-icon" />
                <h3 className="privacy-promise-title">{promise.title}</h3>
                <p className="privacy-promise-summary">{promise.summary}</p>
                <button
                  type="button"
                  className="privacy-promise-toggle"
                  onClick={() => toggle(promise.id)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? "Скрий детайла" : "Виж по-подробно"}
                </button>
                {isOpen ? (
                  <p className="privacy-promise-detail">{promise.detail}</p>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PromiseIcon({ name, className }: { name: Promise["icon"]; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "no-sell":
      // Coin crossed out
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="9" />
          <path d="M12 16 L 20 16 M16 12 L 16 20" />
          <path d="M6 6 L 26 26" strokeWidth="2.2" />
        </svg>
      );
    case "no-track":
      // Eye crossed out
      return (
        <svg {...common}>
          <path d="M3 16 Q 16 6 29 16 Q 16 26 3 16 Z" />
          <circle cx="16" cy="16" r="3" />
          <path d="M5 5 L 27 27" strokeWidth="2.2" />
        </svg>
      );
    case "no-payment":
      // Credit card crossed out
      return (
        <svg {...common}>
          <rect x="4" y="9" width="24" height="14" rx="2" />
          <path d="M4 14 L 28 14" />
          <path d="M6 6 L 26 26" strokeWidth="2.2" />
        </svg>
      );
    case "eu-host":
      // EU star circle
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" />
          <circle cx="16" cy="7" r="1.2" fill="currentColor" />
          <circle cx="22" cy="10" r="1.2" fill="currentColor" />
          <circle cx="25" cy="16" r="1.2" fill="currentColor" />
          <circle cx="22" cy="22" r="1.2" fill="currentColor" />
          <circle cx="16" cy="25" r="1.2" fill="currentColor" />
          <circle cx="10" cy="22" r="1.2" fill="currentColor" />
          <circle cx="7" cy="16" r="1.2" fill="currentColor" />
          <circle cx="10" cy="10" r="1.2" fill="currentColor" />
        </svg>
      );
    case "delete-anytime":
      // Trash can
      return (
        <svg {...common}>
          <path d="M7 10 L 25 10" />
          <path d="M9 10 L 10 26 Q 10 27 11 27 L 21 27 Q 22 27 22 26 L 23 10" />
          <path d="M12 10 L 12 7 Q 12 6 13 6 L 19 6 Q 20 6 20 7 L 20 10" />
          <path d="M13 14 L 13 23 M16 14 L 16 23 M19 14 L 19 23" />
        </svg>
      );
    case "export-anytime":
      // Download arrow
      return (
        <svg {...common}>
          <path d="M16 4 L 16 20 M10 14 L 16 20 L 22 14" />
          <path d="M5 24 L 5 27 Q 5 28 6 28 L 26 28 Q 27 28 27 27 L 27 24" />
        </svg>
      );
  }
}
```

---

## Stage 7 — `PrivacySections` — 5 thematic sections (replaces flat 9-section list)

**File:** `apps/web/components/privacy/PrivacySections.tsx`

Reorganize старите 9 секции в 5 тематични. Всяка section има:
- Heading
- TL;DR callout
- Body content
- Optional collapsible "пълен правен текст" toggle (placeholder for future)

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

interface SectionData {
  id: string;
  number: number;
  title: string;
  tldr: string;
  body: React.ReactNode;
}

const SECTIONS: readonly SectionData[] = [
  {
    id: "what-and-why",
    number: 1,
    title: "Какво събираме и защо",
    tldr: "Имейл, име, OAuth ID, игрова история, постижения. Нищо повече.",
    body: (
      <>
        <p>
          Когато създаваш профил и играеш, ние обработваме само следните категории данни,
          и то само за конкретни цели:
        </p>
        <ul>
          <li><strong>Имейл адрес</strong> — за вход, потвърждение и нова парола.</li>
          <li><strong>Име на масата</strong> — видимо за другите играчи в стаите.</li>
          <li><strong>Данни от Google или Discord</strong> — само ако избереш вход през тях: публичен идентификатор, име и снимка.</li>
          <li><strong>Игрова история</strong> — стаи, роли, резултат, ходове, край на играта.</li>
          <li><strong>Постижения</strong> — кои са отключени и кога.</li>
          <li><strong>Сесийни данни</strong> — технически записи за вход, защита и предотвратяване на злоупотреби.</li>
        </ul>
        <p>
          <strong>Не</strong> събираме телефон, адрес, платежни данни или други чувствителни категории.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    number: 2,
    title: "С кого споделяме",
    tldr: "С никой. Малък списък технически партньори по необходимост.",
    body: (
      <>
        <p>
          Не продаваме данни и не показваме реклами. Технически партньори обработват ограничени
          данни <em>само</em> доколкото е необходимо за работата на услугата:
        </p>
        <ul>
          <li><strong>DigitalOcean</strong> — хостинг на сървърите и базата данни в европейска среда (Франкфурт).</li>
          <li><strong>Resend</strong> — системни имейли за потвърждение и нова парола.</li>
          <li><strong>Google и Discord</strong> — само ако използваш техния OAuth вход.</li>
          <li><strong>OpenAI</strong> — само за статични изображения преди старта, без лични данни на играчи.</li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    number: 3,
    title: "Колко дълго пазим",
    tldr: "Профил докато не го изтриеш. Сесии 30 дни. Игрова история до 24 месеца.",
    body: (
      <>
        <ul>
          <li><strong>Профил</strong> — докато го поддържаш или докато не поискаш изтриване.</li>
          <li><strong>Сесии</strong> — до 30 дни от последна активност.</li>
          <li><strong>Игрова история</strong> — до 24 месеца, след което може да бъде анонимизирана.</li>
          <li><strong>Служебни писма</strong> — доставчикът пази технически записи за доставка за ограничен срок (обикновено до 7 дни).</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    number: 4,
    title: "Бисквитки и памет на браузъра",
    tldr: "Само технически необходими. Без реклами, без проследяване.",
    body: (
      <>
        <p>Използваме само технически необходими бисквитки и локални настройки:</p>
        <ul>
          <li>сесийна бисквитка за вход;</li>
          <li>настройки за звук, тема и последно избрано семейство игри;</li>
          <li>маркер, че си видял въвеждащото съобщение;</li>
          <li>локални feedback оценки (👍/👎) във FAQ страницата.</li>
        </ul>
        <p>Не използваме рекламни или маркетингови бисквитки.</p>
      </>
    ),
  },
  {
    id: "children",
    number: 5,
    title: "Деца под 13 години",
    tldr: "Услугата не е за деца под 13. Родителите могат да поискат изтриване.",
    body: (
      <>
        <p>
          Платформата не е предназначена за деца под 13 години. Не събираме съзнателно данни от лица под тази възраст.
          Ако родител или настойник установи, че дете е създало профил, може да поиска изтриване чрез{" "}
          <Link href="/report">страницата за сигнал</Link>. Ще премахнем профила в рамките на 7 работни дни.
        </p>
      </>
    ),
  },
];

export function PrivacySections() {
  return (
    <section className="privacy-section">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">детайли</p>
        <h2>По-конкретно.</h2>
        <p className="privacy-section-lede">
          Детайлите зад обещанията — за тези, които искат пълен поглед.
        </p>
      </header>

      <ol className="privacy-section-list">
        {SECTIONS.map((section) => (
          <li key={section.id} id={section.id} className="privacy-section-item">
            <h3>
              <span className="privacy-section-num">{section.number}.</span>
              {section.title}
            </h3>
            <aside className="privacy-section-tldr">
              <span className="privacy-section-tldr-label">Накратко</span>
              <span>{section.tldr}</span>
            </aside>
            <div className="privacy-section-body">{section.body}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

---

## Stage 8 — `PrivacyRights` — action-oriented GDPR rights section

**File:** `apps/web/components/privacy/PrivacyRights.tsx`

Не просто текст "имаш право на" — а конкретни линкове и actions.

```tsx
import Link from "next/link";

interface RightAction {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  ctaLabel: string;
}

const RIGHTS: readonly RightAction[] = [
  {
    id: "access",
    title: "Право на достъп",
    description: "Виж точно какво пазим за теб — над секция „Какво виждаме за теб точно сега“.",
    href: "/account",
    ctaLabel: "Към профила →",
  },
  {
    id: "portability",
    title: "Право на преносимост",
    description: "Изтегли JSON файл с цялата си история, готов за импорт другаде.",
    href: "/api/account/export",
    ctaLabel: "Изтегли данни →",
  },
  {
    id: "rectification",
    title: "Право на корекция",
    description: "Промени име на масата или информация от профила.",
    href: "/account",
    ctaLabel: "Към профила →",
  },
  {
    id: "erasure",
    title: "Право на изтриване",
    description: "Изтрий профила окончателно. Заместваме името в игрите с „Изтрит играч“.",
    href: "/account",
    ctaLabel: "Към профила →",
  },
  {
    id: "objection",
    title: "Право на ограничаване и възражение",
    description: "Ако смяташ, че обработваме данните ти неправомерно — пиши ни.",
    href: "/report",
    ctaLabel: "Подай сигнал →",
  },
  {
    id: "complaint",
    title: "Право на жалба",
    description: "Можеш да подадеш жалба до Комисията за защита на личните данни (КЗЛД).",
    href: "https://www.cpdp.bg",
    external: true,
    ctaLabel: "Към КЗЛД ↗",
  },
];

export function PrivacyRights() {
  return (
    <section className="privacy-section privacy-section-rights">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">твоите права</p>
        <h2>Какво можеш да направиш.</h2>
        <p className="privacy-section-lede">
          Шест права по GDPR — всяко с конкретен начин да го упражниш.
        </p>
      </header>

      <ul className="privacy-rights-grid">
        {RIGHTS.map((right) => (
          <li key={right.id}>
            <article className="privacy-right-card">
              <h3>{right.title}</h3>
              <p>{right.description}</p>
              {right.external ? (
                <a href={right.href} target="_blank" rel="noopener noreferrer" className="privacy-right-cta">
                  {right.ctaLabel}
                </a>
              ) : (
                <Link href={right.href} className="privacy-right-cta">
                  {right.ctaLabel}
                </Link>
              )}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

---

## Stage 9 — `PrivacyVersionHistory` accordion

**File:** `apps/web/components/privacy/PrivacyVersionHistory.tsx`

```tsx
"use client";

import { useState } from "react";

interface Version {
  date: string;
  summary: string;
  details: string[];
}

const HISTORY: readonly Version[] = [
  {
    date: "17 май 2026",
    summary: "Цялостен redesign в стила на homepage. Добавена секция „Какво виждаме за теб“.",
    details: [
      "Преструктуриране от 9 секции в 5 тематични.",
      "Добавена promise wall с 6 ключови обещания.",
      "Добавени action-oriented GDPR rights с директни CTA-та.",
      "Без съществени промени в правилата за обработка.",
    ],
  },
  {
    date: "14 май 2026",
    summary: "Публикуване на първоначалната политика преди публично пускане.",
    details: [
      "Дефинирани категории събирани данни.",
      "Технически партньори (DigitalOcean, Resend, Google, Discord, OpenAI).",
      "Срокове за съхранение.",
      "Права по GDPR.",
    ],
  },
];

export function PrivacyVersionHistory() {
  const [open, setOpen] = useState(false);

  return (
    <section className="privacy-section privacy-section-history">
      <button
        type="button"
        className="privacy-history-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="privacy-history-icon" aria-hidden>{open ? "−" : "+"}</span>
        <span>История на промените ({HISTORY.length})</span>
      </button>

      {open ? (
        <ol className="privacy-history-list">
          {HISTORY.map((entry, index) => (
            <li key={index}>
              <article>
                <header>
                  <time className="privacy-history-date">{entry.date}</time>
                  <p className="privacy-history-summary">{entry.summary}</p>
                </header>
                <ul>
                  {entry.details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
```

---

## Stage 10 — CSS overhaul

Премахни напълно `.vault-*` правила в globals.css (всичко свързано с privacy stария style — около ред ~11600-11900). Добави нов `.privacy-*` блок.

```css
/* ============================== */
/* Privacy — trust dashboard       */
/* ============================== */

.privacy-shell {
  --privacy-bg: #0d0a08;
  --privacy-surface: rgba(26, 20, 16, 0.72);
  --privacy-surface-strong: rgba(36, 28, 22, 0.9);
  --privacy-text: #f5e8c8;
  --privacy-text-muted: rgba(245, 232, 200, 0.74);
  --privacy-text-soft: rgba(245, 232, 200, 0.5);
  --privacy-border: rgba(245, 232, 200, 0.12);
  --privacy-border-strong: rgba(245, 232, 200, 0.22);
  --privacy-accent: #3a4f7a;
  --privacy-accent-warm: #d19a42;
  --privacy-accent-soft: rgba(58, 79, 122, 0.22);
  --privacy-accent-warm-soft: rgba(209, 154, 66, 0.18);

  background: var(--privacy-bg);
  color: var(--privacy-text);
  font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  min-height: 100vh;
  padding: 0 0 64px;
}

.privacy-page {
  width: 100%;
}

.privacy-content {
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 24px 0;
  display: grid;
  gap: 28px;
}

/* Hero */

.privacy-hero {
  position: relative;
  width: 100%;
  min-height: clamp(280px, 38vw, 460px);
  border-bottom: 1px solid var(--privacy-border);
}

.privacy-hero-banner {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.privacy-hero-img {
  object-fit: cover;
  object-position: center 35%;
}

.privacy-hero-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(13, 10, 8, 0.22) 0%, rgba(13, 10, 8, 0.55) 50%, rgba(13, 10, 8, 0.95) 100%);
}

.privacy-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 24px 40px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.privacy-hero-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--privacy-accent-warm);
  margin: 0 0 10px;
}

.privacy-hero-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(2rem, 5vw, 3.4rem);
  font-weight: 900;
  letter-spacing: -0.015em;
  line-height: 1.05;
  color: var(--privacy-text);
  text-wrap: balance;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
  margin: 0 0 14px;
  max-width: 22ch;
}

.privacy-hero-subtitle {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--privacy-text-muted);
  max-width: 60ch;
  margin: 0 0 12px;
}

.privacy-hero-meta {
  font-size: 0.85rem;
  color: var(--privacy-text-soft);
  letter-spacing: 0.04em;
  margin: 0;
}

/* Section base */

.privacy-section {
  padding: 28px;
  background: var(--privacy-surface);
  border: 1px solid var(--privacy-border);
  border-radius: 18px;
}

.privacy-section-head {
  margin-bottom: 22px;
}

.privacy-section-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--privacy-accent-warm);
  margin: 0 0 6px;
}

.privacy-section-head h2 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.5rem, 3.2vw, 2rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: var(--privacy-text);
  margin: 0 0 8px;
}

.privacy-section-lede {
  font-size: 0.98rem;
  color: var(--privacy-text-muted);
  line-height: 1.55;
  margin: 0;
  max-width: 60ch;
}

/* Data preview section (unique to /privacy) */

.privacy-section-preview {
  background: linear-gradient(155deg, var(--privacy-accent-soft), var(--privacy-surface));
  border-color: rgba(58, 79, 122, 0.45);
}

.privacy-data-list {
  display: grid;
  gap: 8px;
  margin: 0 0 22px;
}

.privacy-data-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  background: rgba(13, 10, 8, 0.45);
  border: 1px solid var(--privacy-border);
  border-radius: 12px;
}

.privacy-data-row dt {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: var(--privacy-text-muted);
  font-weight: 600;
}

.privacy-data-icon {
  font-size: 1.1rem;
}

.privacy-data-row dd {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 0.95rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.privacy-data-row code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88rem;
  color: var(--privacy-text);
  background: rgba(245, 232, 200, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
}

.privacy-data-badge {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  font-weight: 700;
  text-transform: uppercase;
  text-decoration: none;
}

.privacy-data-badge-ok {
  background: rgba(111, 191, 111, 0.18);
  color: #6fbf6f;
  border: 1px solid rgba(111, 191, 111, 0.4);
}

.privacy-data-badge-warn {
  background: rgba(217, 74, 61, 0.18);
  color: #d94a3d;
  border: 1px solid rgba(217, 74, 61, 0.45);
}

.privacy-data-edit {
  font-size: 0.82rem;
  color: var(--privacy-accent-warm);
  text-decoration: underline;
  text-underline-offset: 3px;
  font-weight: 600;
}

.privacy-data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.privacy-data-action {
  display: grid;
  gap: 4px;
  padding: 14px 20px;
  border-radius: 12px;
  text-decoration: none;
  transition: transform 160ms ease, filter 160ms ease, border-color 160ms ease;
}

.privacy-data-action-primary {
  background: var(--privacy-accent-warm);
  border: 1px solid var(--privacy-accent-warm);
  color: #1a1410;
}

.privacy-data-action-primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.privacy-data-action span:first-child {
  font-weight: 700;
  font-size: 0.95rem;
}

.privacy-data-action-hint {
  font-size: 0.78rem;
  opacity: 0.78;
}

.privacy-data-disclaimer {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--privacy-text-muted);
  font-style: italic;
  margin: 0;
  padding: 14px 16px;
  background: rgba(245, 232, 200, 0.04);
  border-left: 2px solid var(--privacy-border-strong);
  border-radius: 0 10px 10px 0;
}

/* Promise wall */

.privacy-promise-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
}

@media (min-width: 640px) {
  .privacy-promise-grid { grid-template-columns: 1fr 1fr; }
}

@media (min-width: 980px) {
  .privacy-promise-grid { grid-template-columns: repeat(3, 1fr); }
}

.privacy-promise-card {
  padding: 18px;
  background: var(--privacy-surface-strong);
  border: 1px solid var(--privacy-border);
  border-radius: 14px;
  display: grid;
  gap: 8px;
  transition: border-color 160ms ease;
}

.privacy-promise-card[data-open="true"] {
  border-color: var(--privacy-accent-warm);
}

.privacy-promise-icon {
  width: 28px;
  height: 28px;
  color: var(--privacy-accent-warm);
}

.privacy-promise-title {
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--privacy-text);
  line-height: 1.25;
  margin: 0;
}

.privacy-promise-summary {
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--privacy-text-muted);
  margin: 0;
}

.privacy-promise-toggle {
  align-self: start;
  background: transparent;
  border: none;
  color: var(--privacy-accent-warm);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.privacy-promise-detail {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--privacy-text-muted);
  margin: 6px 0 0;
  padding: 12px 14px;
  background: rgba(13, 10, 8, 0.4);
  border-left: 2px solid var(--privacy-accent-warm);
  border-radius: 0 10px 10px 0;
}

/* Numbered sections (details) */

.privacy-section-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 24px;
}

.privacy-section-item {
  scroll-margin-top: 80px;
}

.privacy-section-item h3 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.005em;
  color: var(--privacy-text);
  margin: 0 0 12px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.privacy-section-num {
  font-size: 0.8em;
  color: var(--privacy-text-soft);
  font-variant-numeric: tabular-nums;
}

.privacy-section-tldr {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
  margin: 0 0 14px;
  padding: 12px 16px;
  background: var(--privacy-accent-warm-soft);
  border-left: 3px solid var(--privacy-accent-warm);
  border-radius: 0 10px 10px 0;
}

.privacy-section-tldr-label {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--privacy-accent-warm);
  white-space: nowrap;
}

.privacy-section-tldr span:last-child {
  font-size: 0.94rem;
  line-height: 1.5;
  color: var(--privacy-text);
}

.privacy-section-body {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--privacy-text-muted);
}

.privacy-section-body p {
  margin: 0 0 12px;
}

.privacy-section-body p:last-child { margin-bottom: 0; }

.privacy-section-body ul {
  margin: 0 0 12px;
  padding-left: 1.25em;
}

.privacy-section-body li {
  margin: 6px 0;
}

.privacy-section-body strong {
  color: var(--privacy-text);
  font-weight: 700;
}

.privacy-section-body a {
  color: var(--privacy-accent-warm);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Rights section */

.privacy-section-rights {
  background: linear-gradient(155deg, var(--privacy-surface-strong), var(--privacy-surface));
}

.privacy-rights-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
}

@media (min-width: 768px) {
  .privacy-rights-grid { grid-template-columns: 1fr 1fr; }
}

.privacy-right-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  background: rgba(13, 10, 8, 0.5);
  border: 1px solid var(--privacy-border);
  border-radius: 12px;
  transition: border-color 160ms ease;
}

.privacy-right-card:hover {
  border-color: var(--privacy-accent-warm);
}

.privacy-right-card h3 {
  font-family: "Noto Serif Display", serif;
  font-size: 1rem;
  font-weight: 800;
  color: var(--privacy-text);
  margin: 0;
}

.privacy-right-card p {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--privacy-text-muted);
  margin: 0;
}

.privacy-right-cta {
  align-self: start;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--privacy-accent-warm);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Version history */

.privacy-section-history {
  padding: 0;
  background: transparent;
  border: none;
}

.privacy-history-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: var(--privacy-surface);
  border: 1px solid var(--privacy-border);
  border-radius: 12px;
  color: var(--privacy-text-muted);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 160ms ease;
}

.privacy-history-toggle:hover {
  border-color: var(--privacy-accent-warm);
}

.privacy-history-icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--privacy-accent-warm-soft);
  color: var(--privacy-accent-warm);
  font-weight: 800;
}

.privacy-history-list {
  list-style: none;
  padding: 18px 0 0;
  margin: 0;
  display: grid;
  gap: 14px;
}

.privacy-history-list li article {
  padding: 14px 18px;
  background: var(--privacy-surface);
  border: 1px solid var(--privacy-border);
  border-radius: 12px;
}

.privacy-history-date {
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  color: var(--privacy-accent-warm);
  font-weight: 700;
  text-transform: uppercase;
}

.privacy-history-summary {
  font-size: 1rem;
  color: var(--privacy-text);
  margin: 4px 0 8px;
}

.privacy-history-list ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 4px;
  font-size: 0.88rem;
  color: var(--privacy-text-muted);
}

.privacy-history-list ul li::before {
  content: "·";
  margin-right: 8px;
  color: var(--privacy-accent-warm);
}

/* Mobile tweaks */

@media (max-width: 640px) {
  .privacy-section { padding: 22px 18px; }
  .privacy-data-row { grid-template-columns: 1fr; }
  .privacy-data-row dd { justify-content: flex-start; }
}
```

---

## Stage 11 — Remove obsolete `.vault-*` CSS

В globals.css, намери и **изтрий** всичките `.vault-*` правила (свързани с старата privacy/terms vault aesthetic — vault-shell, vault-stage, vault-art, vault-card, vault-section и т.н.).

Запазете `.handshake-*` правила (terms използва тях все още — ще се рефакторира в отделен PR).

---

## Stage 12 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected: `/privacy` desktop + mobile. Generate baselines за:
- Anonymous state (no "Какво виждаме за теб" section)
- Authenticated state с реален data

---

## Acceptance criteria

1. **1-2 new imagen assets**: `apps/web/public/game-art/legal/privacy-banner.png` (mandatory) + optional `trust-flow-diagram.png`. Both без visible text.
2. **Cinematic hero banner** (full-width, 16:9, gradient scrim) с overlay copy.
3. **"Какво виждаме за теб" section** показва се само за authenticated users с real-time snapshot.
4. **Promise wall**: 6 cards с inline SVG icons, всяка с collapsible "Виж по-подробно" detail.
5. **5 thematic sections** (вместо старите 9): What/Sharing/Retention/Cookies/Children. TL;DR callout на всяка.
6. **6 GDPR rights** с direct action links (`/account`, `/api/account/export`, `/report`, КЗЛД).
7. **Version history** accordion footer показва последни 2 промени с дати.
8. **Old `.vault-*` CSS removed**.
9. **Mobile responsive**: hero stack-ва, promise wall 1-col, rights 1-col, data rows stack vertically.
10. **JSON-LD WebPage** updated с `dateModified`.
11. **Anonymous users** не виждат personal preview; виждат promise wall + sections + rights direct.
12. **БГ-only copy**, всички commit messages English.
13. `pnpm verify` passes.

---

## Не пипай

- `/terms` страница — отделен PR ще я приведе в нов style (this PR подготвя system).
- `/account` — вече redesigned в предишен PR; стои.
- `/report` — отделна структура.
- Game-server, schemas, Better Auth.
- Стария `privacy-vault.png` asset — остава за back-compat.

---

## Verification

```bash
pnpm install
pnpm optimize:assets
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

1. **Anonymous user → `/privacy`**:
   - Hero visible
   - "Какво виждаме за теб" section HIDDEN
   - Promise wall visible с 6 cards
   - Sections + rights visible

2. **Authenticated user → `/privacy`**:
   - Hero + subtitle includes "По-долу виждаш точно какво знаем за теб."
   - "Какво виждаме за теб" section VISIBLE с real data
   - Email, име, игри, постижения, регистриран date all populated
   - "Изтегли всичките данни" button works (downloads JSON)

3. **Promise wall interaction**:
   - Click "Виж по-подробно" → detail expands
   - Click отново → detail collapses
   - Active card border-color changes to amber

4. **Rights section**:
   - All 6 cards visible
   - External КЗЛД link opens in new tab
   - Internal links navigate within app

5. **Version history**:
   - Collapsed by default
   - Click toggle → expands и показва 2 entries
   - Toggle again → collapses

6. **Mobile (390×844)**:
   - Banner readable, copy not cut off
   - Promise wall: 1-col stack
   - Data preview rows: stack vertically
   - Rights cards: 1-col

---

## Commit strategy (14 atomic English commits)

Branch: `feat/privacy-trust-dashboard`

1. `chore(art): generate cinematic privacy banner`
2. `feat(privacy): server-side user snapshot for authenticated visitors`
3. `feat(privacy): cinematic hero banner with overlay copy`
4. `feat(privacy): personal data preview section for logged-in users`
5. `feat(privacy): promise wall with 6 cards and inline SVG icons`
6. `feat(privacy): collapsible legal detail behind each promise`
7. `feat(privacy): reorganize 9 sections into 5 thematic groups`
8. `feat(privacy): TL;DR callout per section`
9. `feat(privacy): GDPR rights with direct action links`
10. `feat(privacy): version history accordion footer`
11. `feat(privacy): orchestrator PrivacyDashboard component`
12. `style(privacy): painterly-marketing card system with indigo accent`
13. `chore(css): remove obsolete vault brass-plaque styles`
14. `chore(visual): regenerate baseline for privacy dashboard`

PR title: `feat: privacy page overhaul as personal trust dashboard`

PR body should:
- Link to before/after screenshots showing the shift from brass-plaque legal wall to cinematic trust dashboard.
- Note that `/terms` will follow in separate PR using the same chrome but без personal sections.
- Reviewer hint: test authenticated и anonymous flows separately to verify conditional rendering.

---

(End of prompt)
