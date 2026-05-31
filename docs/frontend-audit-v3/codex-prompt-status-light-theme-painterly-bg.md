# Codex prompt — `/status` overhaul + painterly atmospheric bg + light theme support

Три свързани pre-launch polish работи в **един coherent PR**:

1. **`/status` modernization** — от brass-plaque harbor-art-on-card към cinematic banner + service tiles + auto-refresh + last incident + subscribe section
2. **Painterly atmospheric bg** на всички utility pages (`/privacy`, `/terms`, `/report`, `/status`, `/faq`) — premium cohesion с homepage без to distract от content
3. **Light theme opt-in** за всички 6 utility pages (`/account`, `/privacy`, `/terms`, `/report`, `/status`, `/faq`) — global theme toggle вече работи на тях

**1 нова imagen banner** + extensive CSS variable work. ~13 atomic English commits.

**⚠ Работа директно върху main branch** (per user preference).

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Auto-refresh interval на /status | **30 секунди**, паузира когато tab е hidden (Page Visibility API) |
| Subscribe URLs (Discord/Telegram) | **Placeholders + env vars** (`NEXT_PUBLIC_DISCORD_URL`, `NEXT_PUBLIC_TELEGRAM_URL`) |
| Painterly bg theme switching | **Switches** със global theme toggle — light mode = parchment cream, dark mode = atmospheric ink |
| Branch policy | Directly on `main`, не feature branch. Validate с `pnpm regression && pnpm typecheck && pnpm build` след всеки commit. |

---

## Stage 1 — Generate imagen banner for /status

### Asset: Harbor at twilight banner

**Path:** `apps/web/public/game-art/legal/status-banner.png`

```
A wide cinematic banner illustration of a stone harbor at deep
twilight, viewed from a slight elevated angle. In the foreground:
a worn wooden pier extending toward calm dark water. In the
middle distance: a small stone lighthouse on a rocky headland,
its lamp glowing warm amber and casting a gentle directional beam
across light mist on the water. On the horizon: faint silhouettes
of distant ships at anchor, suggesting a watchful, working
harbor. The lower third of the frame gradient-fades to deep
indigo near-black for text overlay legibility. Mood: steady
vigilance, things running as they should, the comfort of a beam
sweeping in the dark. Painterly oil style with atmospheric
brushwork, cool blue-grey water and sky palette with warm ember
lighthouse accents, dramatic atmospheric perspective, vignetted
corners. No text, no readable letters, no numbers, no symbols
anywhere. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

После: `pnpm optimize:assets`. Verify both PNG + WebP exist.

**Note:** Запазете старите `status-harbor.png` + `.webp` за back-compat / OG fallback. Не изтривайте.

---

## Stage 2 — Add subscribe env vars

**File:** `.env.example`

Добави:
```
# Community links (optional). Display "soon" placeholders if unset.
NEXT_PUBLIC_DISCORD_URL=
NEXT_PUBLIC_TELEGRAM_URL=
```

Same in `.env.local.example`.

**Important:** Тези са `NEXT_PUBLIC_*` за достъп от client-side компонент. Не trябва да са в `apps/web/lib/env.ts` Zod schema (optional public). Verify Next.js bundles them в client bundle.

---

## Stage 3 — `/status` page complete rewrite

### Updated `apps/web/app/status/page.tsx`

Server component зарежда service health и passes до client wrapper.

```tsx
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { StatusDashboard, type ServiceHealth } from "@/components/status/StatusDashboard";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = routeMetadata({
  title: "Състояние | Върколак и Мафия",
  description: "Преглед на здравето на услугите ни. Колко бързо отговаряме, кога нещо се е счупило.",
  path: "/status",
  image: "/game-art/legal/status-banner.png",
  imageAlt: "Каменно пристанище в полумрак",
  robots: { index: false, follow: true },
  absoluteTitle: true,
});

async function checkService(url: string, timeoutMs = 3000): Promise<{ ok: boolean; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return { ok: response.ok, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, ms: Date.now() - start };
  }
}

function gameServerHealthUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (!configuredUrl) return null;
  return configuredUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "") + "/health";
}

async function loadServices(): Promise<ServiceHealth[]> {
  const services: ServiceHealth[] = [];

  services.push({
    id: "web",
    name: "Уеб приложение",
    description: "Този сайт и страниците.",
    status: "ok",
    detail: "Отговаря",
    icon: "web",
  });

  const healthUrl = gameServerHealthUrl();
  if (healthUrl) {
    const result = await checkService(healthUrl);
    services.push({
      id: "game-server",
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време.",
      status: result.ok ? "ok" : "down",
      detail: result.ok ? `${result.ms} ms` : "Не отговаря",
      icon: "game",
    });
  } else {
    services.push({
      id: "game-server",
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време.",
      status: "unknown",
      detail: "Не е конфигуриран",
      icon: "game",
    });
  }

  services.push({
    id: "database",
    name: "База данни",
    description: "Профили, история, постижения.",
    status: process.env.DATABASE_URL ? "ok" : "unknown",
    detail: process.env.DATABASE_URL ? "Конфигурирана" : "Не е достъпна",
    icon: "database",
  });

  services.push({
    id: "auth-google",
    name: "Вход с Google",
    description: "Външен OAuth провайдър.",
    status: process.env.GOOGLE_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.GOOGLE_CLIENT_ID ? "Активен" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "auth-discord",
    name: "Вход с Discord",
    description: "Външен OAuth провайдър.",
    status: process.env.DISCORD_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.DISCORD_CLIENT_ID ? "Активен" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "email",
    name: "Имейл услуга",
    description: "Потвърждения, нови пароли, сигнали.",
    status: process.env.RESEND_API_KEY ? "ok" : "unknown",
    detail: process.env.RESEND_API_KEY ? "Активна" : "Не е конфигурирана",
    icon: "email",
  });

  return services;
}

export default async function StatusPage() {
  const services = await loadServices();
  const lastCheckedAt = new Date().toISOString();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Състояние",
    inLanguage: "bg-BG",
    url: absoluteUrl("/status"),
  };

  return (
    <main className="shell status-shell">
      <ResourceHints images={["/game-art/legal/status-banner.webp"]} />
      <JsonLd data={jsonLd} />
      <StatusDashboard
        initialServices={services}
        initialLastCheckedAt={lastCheckedAt}
        discordUrl={process.env.NEXT_PUBLIC_DISCORD_URL ?? null}
        telegramUrl={process.env.NEXT_PUBLIC_TELEGRAM_URL ?? null}
      />
    </main>
  );
}
```

### `apps/web/components/status/StatusDashboard.tsx`

Client orchestrator с auto-refresh.

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusHero } from "./StatusHero";
import { StatusServiceTiles } from "./StatusServiceTiles";
import { StatusLegend } from "./StatusLegend";
import { StatusLastIncident } from "./StatusLastIncident";
import { StatusSubscribe } from "./StatusSubscribe";

export type ServiceStatusKind = "ok" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  status: ServiceStatusKind;
  detail?: string;
  icon: "web" | "game" | "database" | "auth" | "email";
}

interface Props {
  initialServices: ServiceHealth[];
  initialLastCheckedAt: string;
  discordUrl: string | null;
  telegramUrl: string | null;
}

const REFRESH_INTERVAL_MS = 30_000;

export function StatusDashboard({ initialServices, initialLastCheckedAt, discordUrl, telegramUrl }: Props) {
  const [services, setServices] = useState(initialServices);
  const [lastCheckedAt, setLastCheckedAt] = useState(initialLastCheckedAt);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { services: ServiceHealth[]; lastCheckedAt: string };
        setServices(data.services);
        setLastCheckedAt(data.lastCheckedAt);
      }
    } catch {
      // ignore — surface stays as last known good
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  // Auto-refresh every 30s, paused when tab is hidden
  useEffect(() => {
    let timer: number | undefined;

    function start() {
      stop();
      timer = window.setInterval(() => {
        if (!document.hidden) refresh();
      }, REFRESH_INTERVAL_MS);
    }

    function stop() {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        refresh(); // refresh immediately on tab focus
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const overall = computeOverall(services);

  return (
    <div className="status-page">
      <StatusHero
        overall={overall}
        lastCheckedAt={lastCheckedAt}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <div className="status-content">
        <StatusServiceTiles services={services} />
        <StatusLegend />
        <StatusLastIncident />
        <StatusSubscribe discordUrl={discordUrl} telegramUrl={telegramUrl} />
      </div>
    </div>
  );
}

function computeOverall(services: ServiceHealth[]): ServiceStatusKind {
  if (services.some((service) => service.status === "down")) return "down";
  const critical = services.filter((service) => service.id === "web" || service.id === "game-server" || service.id === "database");
  if (critical.every((service) => service.status === "ok")) return "ok";
  return "degraded";
}
```

### `apps/web/components/status/StatusHero.tsx`

```tsx
import Image from "next/image";
import type { ServiceStatusKind } from "./StatusDashboard";

interface Props {
  overall: ServiceStatusKind;
  lastCheckedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
}

const OVERALL_COPY: Record<ServiceStatusKind, { title: string; subtitle: string }> = {
  ok: {
    title: "Светилникът свети.",
    subtitle: "Всички основни услуги работят нормално.",
  },
  degraded: {
    title: "Леки вълни на хоризонта.",
    subtitle: "Една или повече услуги са в неизвестно или забавено състояние.",
  },
  down: {
    title: "Авария на хоризонта.",
    subtitle: "Засечено е прекъсване в основна услуга. Работим по решение.",
  },
  unknown: {
    title: "Светилникът се настройва.",
    subtitle: "Все още нямаме пълна видимост над услугите.",
  },
};

export function StatusHero({ overall, lastCheckedAt, refreshing, onRefresh }: Props) {
  const copy = OVERALL_COPY[overall];
  const formatted = new Intl.DateTimeFormat("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(lastCheckedAt));

  return (
    <header className="status-hero" aria-label="Състояние на услугите">
      <div className="status-hero-banner">
        <Image
          src="/game-art/legal/status-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="status-hero-img"
        />
        <div className="status-hero-scrim" aria-hidden />
      </div>

      <div className="status-hero-inner">
        <p className="status-hero-kicker">състояние на услугите</p>
        <h1 className="status-hero-title">{copy.title}</h1>
        <p className="status-hero-subtitle">{copy.subtitle}</p>

        <div className="status-hero-meta" data-overall={overall}>
          <span className="status-hero-dot" aria-hidden />
          <span className="status-hero-meta-label">
            Последна проверка в <time dateTime={lastCheckedAt}>{formatted}</time>
          </span>
          <button
            type="button"
            className="status-hero-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Опресни сега"
          >
            {refreshing ? "Проверяваме..." : "↻ Опресни"}
          </button>
        </div>
      </div>
    </header>
  );
}
```

### `apps/web/components/status/StatusServiceTiles.tsx`

```tsx
import type { ServiceHealth, ServiceStatusKind } from "./StatusDashboard";

const STATUS_LABEL: Record<ServiceStatusKind, string> = {
  ok: "Работи",
  degraded: "Забавено",
  down: "Прекъсване",
  unknown: "Не се проверява",
};

interface Props {
  services: ServiceHealth[];
}

export function StatusServiceTiles({ services }: Props) {
  return (
    <section className="status-section">
      <header className="status-section-head">
        <p className="status-section-kicker">услуги</p>
        <h2>Какво проверяваме точно сега.</h2>
      </header>

      <ul className="status-tile-grid">
        {services.map((service) => (
          <li key={service.id}>
            <article className="status-tile" data-status={service.status}>
              <div className="status-tile-head">
                <ServiceIcon name={service.icon} />
                <h3>{service.name}</h3>
                <span className="status-tile-badge">{STATUS_LABEL[service.status]}</span>
              </div>
              <p className="status-tile-description">{service.description}</p>
              {service.detail ? <p className="status-tile-detail">{service.detail}</p> : null}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ServiceIcon({ name }: { name: ServiceHealth["icon"] }) {
  const common = {
    className: "status-tile-icon",
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "web":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M5 16 L 27 16 M16 5 Q 22 16 16 27 M16 5 Q 10 16 16 27" />
        </svg>
      );
    case "game":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="24" height="14" rx="3" />
          <path d="M9 17 L 13 17 M11 15 L 11 19" />
          <circle cx="20" cy="15" r="1.5" fill="currentColor" />
          <circle cx="23" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="16" cy="8" rx="10" ry="3" />
          <path d="M6 8 L 6 24 Q 6 27 16 27 Q 26 27 26 24 L 26 8" />
          <path d="M6 16 Q 16 19 26 16" />
        </svg>
      );
    case "auth":
      return (
        <svg {...common}>
          <rect x="7" y="14" width="18" height="14" rx="2" />
          <path d="M11 14 L 11 10 Q 11 5 16 5 Q 21 5 21 10 L 21 14" />
          <circle cx="16" cy="21" r="1.5" fill="currentColor" />
        </svg>
      );
    case "email":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="24" height="16" rx="2" />
          <path d="M4 11 L 16 19 L 28 11" />
        </svg>
      );
  }
}
```

### `apps/web/components/status/StatusLegend.tsx`

```tsx
export function StatusLegend() {
  return (
    <section className="status-section status-section-legend">
      <header className="status-section-head">
        <p className="status-section-kicker">какво означават статусите</p>
        <h2>Речник на светлините.</h2>
      </header>

      <dl className="status-legend-grid">
        <div data-status="ok">
          <dt><span className="status-legend-dot" />Работи</dt>
          <dd>Услугата отговаря нормално.</dd>
        </div>
        <div data-status="degraded">
          <dt><span className="status-legend-dot" />Забавено</dt>
          <dd>Услугата отговаря, но е забавена или частично налична.</dd>
        </div>
        <div data-status="down">
          <dt><span className="status-legend-dot" />Прекъсване</dt>
          <dd>Услугата не отговаря. Работим по възстановяване.</dd>
        </div>
        <div data-status="unknown">
          <dt><span className="status-legend-dot" />Не се проверява</dt>
          <dd>Няма автоматична проверка; състоянието е условно.</dd>
        </div>
      </dl>
    </section>
  );
}
```

### `apps/web/components/status/StatusLastIncident.tsx`

Static "last incident" placeholder. User updates manually when incident occurs.

```tsx
import Link from "next/link";

// Codex: Update these constants manually after a real incident.
// Set INCIDENT to null when there's nothing recent worth surfacing.
const INCIDENT: {
  date: string; // ISO
  durationMinutes: number;
  summary: string;
  resolutionDetail: string;
} | null = null;

export function StatusLastIncident() {
  return (
    <section className="status-section">
      <header className="status-section-head">
        <p className="status-section-kicker">последен инцидент</p>
        <h2>Какво се е счупвало напоследък.</h2>
      </header>

      {INCIDENT ? (
        <article className="status-incident-card">
          <header className="status-incident-head">
            <time className="status-incident-date">
              {new Intl.DateTimeFormat("bg-BG", { dateStyle: "long", timeStyle: "short" }).format(new Date(INCIDENT.date))}
            </time>
            <span className="status-incident-duration">{INCIDENT.durationMinutes} мин. прекъсване</span>
          </header>
          <p className="status-incident-summary">{INCIDENT.summary}</p>
          <p className="status-incident-resolution">{INCIDENT.resolutionDetail}</p>
        </article>
      ) : (
        <p className="status-incident-empty">
          Няма скорошни инциденти, за които да си заслужава да говорим. Ако нещо ти изглежда счупено,{" "}
          <Link href="/report">подай сигнал</Link>.
        </p>
      )}
    </section>
  );
}
```

### `apps/web/components/status/StatusSubscribe.tsx`

```tsx
interface Props {
  discordUrl: string | null;
  telegramUrl: string | null;
}

export function StatusSubscribe({ discordUrl, telegramUrl }: Props) {
  return (
    <section className="status-section status-section-subscribe">
      <header className="status-section-head">
        <p className="status-section-kicker">получавай уведомления</p>
        <h2>Когато светлината мига.</h2>
        <p className="status-section-lede">
          За планирани прекъсвания и инциденти, които заслужават внимание.
        </p>
      </header>

      <div className="status-subscribe-grid">
        {discordUrl ? (
          <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="status-subscribe-card" data-channel="discord">
            <span className="status-subscribe-icon" aria-hidden>💬</span>
            <span className="status-subscribe-label">Discord канал</span>
            <span className="status-subscribe-hint">Анонси, инциденти, общност.</span>
          </a>
        ) : (
          <div className="status-subscribe-card status-subscribe-card-pending" aria-disabled>
            <span className="status-subscribe-icon" aria-hidden>💬</span>
            <span className="status-subscribe-label">Discord канал</span>
            <span className="status-subscribe-hint">Скоро отворен.</span>
          </div>
        )}

        {telegramUrl ? (
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="status-subscribe-card" data-channel="telegram">
            <span className="status-subscribe-icon" aria-hidden>📡</span>
            <span className="status-subscribe-label">Telegram канал</span>
            <span className="status-subscribe-hint">Кратки анонси без шум.</span>
          </a>
        ) : (
          <div className="status-subscribe-card status-subscribe-card-pending" aria-disabled>
            <span className="status-subscribe-icon" aria-hidden>📡</span>
            <span className="status-subscribe-label">Telegram канал</span>
            <span className="status-subscribe-hint">Скоро отворен.</span>
          </div>
        )}
      </div>
    </section>
  );
}
```

### New API route: `apps/web/app/api/status/route.ts`

For client-side auto-refresh polling.

```ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function checkService(url: string, timeoutMs = 3000): Promise<{ ok: boolean; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return { ok: response.ok, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, ms: Date.now() - start };
  }
}

function gameServerHealthUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (!configuredUrl) return null;
  return configuredUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "") + "/health";
}

export async function GET() {
  const services: Array<Record<string, unknown>> = [
    { id: "web", name: "Уеб приложение", description: "Този сайт и страниците.", status: "ok", detail: "Отговаря", icon: "web" },
  ];

  const healthUrl = gameServerHealthUrl();
  if (healthUrl) {
    const result = await checkService(healthUrl);
    services.push({
      id: "game-server",
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време.",
      status: result.ok ? "ok" : "down",
      detail: result.ok ? `${result.ms} ms` : "Не отговаря",
      icon: "game",
    });
  } else {
    services.push({
      id: "game-server",
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време.",
      status: "unknown",
      detail: "Не е конфигуриран",
      icon: "game",
    });
  }

  services.push({
    id: "database",
    name: "База данни",
    description: "Профили, история, постижения.",
    status: process.env.DATABASE_URL ? "ok" : "unknown",
    detail: process.env.DATABASE_URL ? "Конфигурирана" : "Не е достъпна",
    icon: "database",
  });

  services.push({
    id: "auth-google",
    name: "Вход с Google",
    description: "Външен OAuth провайдър.",
    status: process.env.GOOGLE_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.GOOGLE_CLIENT_ID ? "Активен" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "auth-discord",
    name: "Вход с Discord",
    description: "Външен OAuth провайдър.",
    status: process.env.DISCORD_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.DISCORD_CLIENT_ID ? "Активен" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "email",
    name: "Имейл услуга",
    description: "Потвърждения, нови пароли, сигнали.",
    status: process.env.RESEND_API_KEY ? "ok" : "unknown",
    detail: process.env.RESEND_API_KEY ? "Активна" : "Не е конфигурирана",
    icon: "email",
  });

  return NextResponse.json({
    services,
    lastCheckedAt: new Date().toISOString(),
  });
}
```

---

## Stage 4 — Painterly atmospheric bg for 5 utility pages

Add to `apps/web/app/globals.css`, в нов section (preferably above utility-specific blocks):

```css
/* ============================== */
/* Utility pages — atmospheric bg */
/* ============================== */

.privacy-shell,
.terms-shell,
.report-shell,
.status-shell,
.faq-shell {
  position: relative;
  z-index: 0;
  isolation: isolate;
}

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
    linear-gradient(115deg,
      rgba(13, 10, 8, 0.94) 0%,
      rgba(21, 12, 9, 0.88) 44%,
      rgba(13, 10, 8, 0.96) 100%),
    var(--art-landing-ambient) center / cover no-repeat;
  filter: saturate(0.55) contrast(1.02) blur(3px);
  pointer-events: none;
}

/* Light theme: parchment cream tint replaces ink overlay */

[data-theme="light"] .privacy-shell::before,
[data-theme="light"] .terms-shell::before,
[data-theme="light"] .report-shell::before,
[data-theme="light"] .status-shell::before,
[data-theme="light"] .faq-shell::before {
  background:
    linear-gradient(115deg,
      rgba(244, 236, 224, 0.96) 0%,
      rgba(240, 228, 208, 0.92) 44%,
      rgba(244, 236, 224, 0.97) 100%),
    var(--art-landing-ambient) center / cover no-repeat;
  filter: saturate(0.4) contrast(1.05) blur(3px);
}
```

`/account` вече има cinematic hero banner който запълва top — не нуждае от atmospheric bg (overlay-ът ще се сблъсква с banner-а). **Не** прилагай на `.account-shell`.

---

## Stage 5 — Light theme support за всички 6 utility pages

Append в края на `apps/web/app/globals.css`, в нов `Light theme overrides` block.

### Shared variables override pattern

```css
/* ============================== */
/* Utility pages — light theme    */
/* ============================== */

/* Privacy */
[data-theme="light"] .privacy-shell {
  --privacy-bg: #f4ece0;
  --privacy-surface: rgba(255, 250, 238, 0.85);
  --privacy-surface-strong: rgba(255, 250, 238, 0.98);
  --privacy-text: #2a1b10;
  --privacy-text-muted: rgba(42, 27, 16, 0.74);
  --privacy-text-soft: rgba(42, 27, 16, 0.5);
  --privacy-border: rgba(83, 52, 31, 0.16);
  --privacy-border-strong: rgba(83, 52, 31, 0.32);
  --privacy-accent: #2d3f66;
  --privacy-accent-warm: #842f2b;
  --privacy-accent-soft: rgba(45, 63, 102, 0.18);
  --privacy-accent-warm-soft: rgba(132, 47, 43, 0.12);
}

/* Terms + Report (shared `--legal-*`) */
[data-theme="light"] .terms-shell,
[data-theme="light"] .report-shell {
  --legal-bg: #f4ece0;
  --legal-surface: rgba(255, 250, 238, 0.85);
  --legal-surface-strong: rgba(255, 250, 238, 0.98);
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

/* Account */
[data-theme="light"] .account-shell {
  --account-bg: #f4ece0;
  --account-surface: rgba(255, 250, 238, 0.85);
  --account-surface-strong: rgba(255, 250, 238, 0.98);
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

/* Status */
[data-theme="light"] .status-shell {
  --status-bg: #f4ece0;
  --status-surface: rgba(255, 250, 238, 0.85);
  --status-surface-strong: rgba(255, 250, 238, 0.98);
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

/* FAQ */
[data-theme="light"] .faq-shell {
  /* If /faq uses --doc-* vars from earlier overhaul */
  --doc-bg: #f4ece0;
  --doc-surface: rgba(255, 250, 238, 0.85);
  --doc-surface-strong: rgba(255, 250, 238, 0.98);
  --doc-text: #2a1b10;
  --doc-text-muted: rgba(42, 27, 16, 0.74);
  --doc-text-soft: rgba(42, 27, 16, 0.5);
  --doc-border: rgba(83, 52, 31, 0.16);
  --doc-border-strong: rgba(83, 52, 31, 0.32);
  --doc-accent: #842f2b;
  --doc-accent-soft: rgba(132, 47, 43, 0.14);
}
```

### Hero banner contrast adjustments

Cinematic banner image-ите остават **dark в двата режима** (painterly oil art works in dark only). Тeкстът върху банера трябва да остане **cream/light** в light mode също, защото banner image е dark.

Verify в CSS-а че `.*-hero-title`, `.*-hero-subtitle`, `.*-hero-kicker` използват **hardcoded cream colors** (не CSS variables, които switch-ват):

```css
.privacy-hero-title,
.terms-hero-title,
.report-hero-title,
.status-hero-title {
  /* Stays cream in both themes — banner image is dark */
  color: #f5e8c8 !important;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
}

/* etc for kicker, subtitle, meta */
```

Hardcoded `!important` because we WANT this to override the theme variable. Banner е visual island; body adapts.

### Banner scrim adjustment

Banner scrim в момента fades to dark body color. В light mode body е cream — scrim ще fade to cream, което прави bottom of banner harshly cream→dark transition.

Fix: scrim stays dark gradient в двата режима. Bottom of banner ends in **hard border** до light body:

```css
.privacy-hero,
.terms-hero,
.report-hero,
.status-hero {
  /* Hard line at bottom — banner is its own visual island */
  border-bottom: 1px solid var(--privacy-border, var(--legal-border, var(--status-border)));
}
```

Banner = always cinematic dark. Body switches.

---

## Stage 6 — `/status` specific CSS

```css
/* ============================== */
/* Status — service tiles          */
/* ============================== */

.status-shell {
  --status-bg: #0d0a08;
  --status-surface: rgba(26, 20, 16, 0.72);
  --status-surface-strong: rgba(36, 28, 22, 0.9);
  --status-text: #f5e8c8;
  --status-text-muted: rgba(245, 232, 200, 0.74);
  --status-text-soft: rgba(245, 232, 200, 0.5);
  --status-border: rgba(245, 232, 200, 0.12);
  --status-border-strong: rgba(245, 232, 200, 0.22);
  --status-accent: #d19a42;
  --status-accent-soft: rgba(209, 154, 66, 0.18);
  --status-ok: #6fbf6f;
  --status-degraded: #d19a42;
  --status-down: #d94a3d;
  --status-unknown: #a8a39b;

  color: var(--status-text);
  font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  min-height: 100vh;
  padding: 0 0 64px;
}

.status-page {
  width: 100%;
}

/* Hero */

.status-hero {
  position: relative;
  width: 100%;
  min-height: clamp(260px, 32vw, 400px);
  overflow: hidden;
  border-bottom: 1px solid var(--status-border);
}

.status-hero-banner {
  position: absolute;
  inset: 0;
}

.status-hero-img {
  object-fit: cover;
  object-position: center 38%;
}

.status-hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(13, 10, 8, 0.22) 0%, rgba(13, 10, 8, 0.55) 50%, rgba(13, 10, 8, 0.95) 100%);
}

.status-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 24px 36px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.status-hero-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--status-accent) !important;
  margin: 0 0 10px;
}

.status-hero-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(2rem, 4.5vw, 3rem);
  font-weight: 900;
  letter-spacing: -0.015em;
  line-height: 1.05;
  color: #f5e8c8 !important;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
  margin: 0 0 12px;
}

.status-hero-subtitle {
  font-size: 1rem;
  line-height: 1.55;
  color: rgba(245, 232, 200, 0.85) !important;
  max-width: 56ch;
  margin: 0 0 18px;
}

.status-hero-meta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(13, 10, 8, 0.65);
  border: 1px solid var(--status-border-strong);
  border-radius: 999px;
  align-self: start;
  flex-wrap: wrap;
}

.status-hero-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--status-ok);
  box-shadow: 0 0 12px var(--status-ok);
}

.status-hero-meta[data-overall="degraded"] .status-hero-dot {
  background: var(--status-degraded);
  box-shadow: 0 0 12px var(--status-degraded);
}

.status-hero-meta[data-overall="down"] .status-hero-dot {
  background: var(--status-down);
  box-shadow: 0 0 12px var(--status-down);
  animation: status-pulse 1.4s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.18); }
}

.status-hero-meta-label {
  font-size: 0.88rem;
  color: #f5e8c8 !important;
}

.status-hero-refresh {
  background: transparent;
  border: 1px solid var(--status-border-strong);
  color: #f5e8c8 !important;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 4px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 160ms ease;
}

.status-hero-refresh:hover:not(:disabled) {
  border-color: var(--status-accent);
}

.status-hero-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Content */

.status-content {
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 24px 0;
  display: grid;
  gap: 24px;
}

.status-section {
  padding: 26px;
  background: var(--status-surface);
  border: 1px solid var(--status-border);
  border-radius: 16px;
}

.status-section-head {
  margin-bottom: 20px;
}

.status-section-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--status-accent);
  margin: 0 0 6px;
}

.status-section-head h2 {
  font-family: "Noto Serif Display", serif;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  color: var(--status-text);
  margin: 0 0 8px;
}

.status-section-lede {
  font-size: 0.95rem;
  color: var(--status-text-muted);
  line-height: 1.55;
  margin: 0;
}

/* Service tiles */

.status-tile-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 768px) {
  .status-tile-grid { grid-template-columns: 1fr 1fr; }
}

.status-tile {
  position: relative;
  padding: 18px 20px;
  background: var(--status-surface-strong);
  border: 1px solid var(--status-border);
  border-left: 3px solid var(--status-unknown);
  border-radius: 12px;
  transition: border-color 200ms ease;
}

.status-tile[data-status="ok"] { border-left-color: var(--status-ok); }
.status-tile[data-status="degraded"] { border-left-color: var(--status-degraded); }
.status-tile[data-status="down"] { border-left-color: var(--status-down); }

.status-tile-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 6px;
}

.status-tile-icon {
  width: 28px;
  height: 28px;
  color: var(--status-accent);
}

.status-tile-head h3 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--status-text);
  margin: 0;
}

.status-tile-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  background: rgba(168, 163, 155, 0.18);
  color: var(--status-unknown);
  border: 1px solid rgba(168, 163, 155, 0.4);
}

.status-tile[data-status="ok"] .status-tile-badge {
  background: rgba(111, 191, 111, 0.16);
  color: var(--status-ok);
  border-color: rgba(111, 191, 111, 0.4);
}

.status-tile[data-status="degraded"] .status-tile-badge {
  background: rgba(209, 154, 66, 0.18);
  color: var(--status-degraded);
  border-color: rgba(209, 154, 66, 0.45);
}

.status-tile[data-status="down"] .status-tile-badge {
  background: rgba(217, 74, 61, 0.18);
  color: var(--status-down);
  border-color: rgba(217, 74, 61, 0.5);
}

.status-tile-description {
  font-size: 0.88rem;
  color: var(--status-text-muted);
  margin: 0 0 4px;
}

.status-tile-detail {
  font-size: 0.82rem;
  color: var(--status-text-soft);
  margin: 0;
  font-variant-numeric: tabular-nums;
}

/* Legend */

.status-section-legend {
  background: linear-gradient(155deg, var(--status-accent-soft), var(--status-surface));
}

.status-legend-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin: 0;
}

@media (min-width: 640px) {
  .status-legend-grid { grid-template-columns: 1fr 1fr; }
}

.status-legend-grid > div {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  background: rgba(13, 10, 8, 0.4);
  border: 1px solid var(--status-border);
  border-radius: 10px;
}

.status-legend-grid dt {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: var(--status-text);
  margin: 0;
}

.status-legend-grid dd {
  margin: 0;
  font-size: 0.85rem;
  color: var(--status-text-muted);
  line-height: 1.45;
  padding-left: 18px;
}

.status-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-legend-grid div[data-status="ok"] .status-legend-dot { background: var(--status-ok); }
.status-legend-grid div[data-status="degraded"] .status-legend-dot { background: var(--status-degraded); }
.status-legend-grid div[data-status="down"] .status-legend-dot { background: var(--status-down); }
.status-legend-grid div[data-status="unknown"] .status-legend-dot { background: var(--status-unknown); }

/* Incident */

.status-incident-card {
  padding: 18px 20px;
  background: var(--status-surface-strong);
  border: 1px solid var(--status-border);
  border-radius: 12px;
}

.status-incident-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  gap: 12px;
  flex-wrap: wrap;
}

.status-incident-date {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--status-accent);
}

.status-incident-duration {
  font-size: 0.78rem;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(217, 74, 61, 0.18);
  color: var(--status-down);
  border: 1px solid rgba(217, 74, 61, 0.4);
  font-weight: 700;
}

.status-incident-summary {
  font-size: 0.95rem;
  color: var(--status-text);
  line-height: 1.55;
  margin: 0 0 6px;
}

.status-incident-resolution {
  font-size: 0.85rem;
  color: var(--status-text-muted);
  font-style: italic;
  margin: 0;
}

.status-incident-empty {
  padding: 18px 20px;
  background: rgba(245, 232, 200, 0.04);
  border: 1px dashed var(--status-border);
  border-radius: 10px;
  font-size: 0.92rem;
  color: var(--status-text-muted);
  font-style: italic;
  margin: 0;
}

.status-incident-empty a {
  color: var(--status-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Subscribe */

.status-subscribe-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 640px) {
  .status-subscribe-grid { grid-template-columns: 1fr 1fr; }
}

.status-subscribe-card {
  display: grid;
  gap: 4px;
  padding: 16px 18px;
  background: var(--status-surface-strong);
  border: 1px solid var(--status-border);
  border-radius: 12px;
  color: var(--status-text);
  text-decoration: none;
  transition: border-color 160ms ease, transform 160ms ease;
}

.status-subscribe-card:hover:not(.status-subscribe-card-pending) {
  border-color: var(--status-accent);
  transform: translateY(-2px);
}

.status-subscribe-card-pending {
  opacity: 0.55;
  cursor: not-allowed;
}

.status-subscribe-icon {
  font-size: 1.4rem;
}

.status-subscribe-label {
  font-weight: 700;
  font-size: 1rem;
}

.status-subscribe-hint {
  font-size: 0.82rem;
  color: var(--status-text-soft);
}

/* Mobile */

@media (max-width: 640px) {
  .status-section { padding: 22px 18px; }
  .status-tile { padding: 14px 16px; }
  .status-tile-head { grid-template-columns: auto 1fr; }
  .status-tile-badge { grid-column: 1 / -1; justify-self: start; }
}
```

---

## Stage 7 — Remove obsolete `.harbor-*` CSS

В globals.css намери и **изтрий** всичките `.harbor-*` правила. Запазете `status-harbor.png` за back-compat (различен path от новия `legal/status-banner.png`).

---

## Stage 8 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected (× 2 за dark + light theme):
- /privacy desktop + mobile
- /terms desktop + mobile
- /report desktop + mobile
- /status desktop + mobile (включително overall status states ok/degraded/down)
- /faq desktop + mobile
- /account desktop + mobile

Total: 24 нови baselines (12 страница × 2 теми).

В Playwright config-а, ако light theme test-овете не съществуват, add fixture:

```ts
test("privacy light theme", async ({ page }) => {
  await page.goto("/privacy");
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  await expect(page).toHaveScreenshot("privacy-light-desktop.png", { fullPage: true });
});
```

---

## Acceptance criteria

1. **1 imagen asset**: `apps/web/public/game-art/legal/status-banner.png` + WebP. No visible text.
2. **2 env vars** in `.env.example` and `.env.local.example`: `NEXT_PUBLIC_DISCORD_URL`, `NEXT_PUBLIC_TELEGRAM_URL`.
3. **/status rewrite**:
   - Cinematic hero banner с overall state dot (pulsing red при `down`)
   - 6 service tiles с color-coded left border + icon + badge
   - Status legend (4 statuses explained)
   - Last incident section (placeholder; configurable via constant)
   - Subscribe section (Discord + Telegram cards with env-driven enabled/disabled state)
   - Auto-refresh every 30s, paused when tab hidden, resumed on focus
   - "↻ Опресни" manual refresh button
   - New `/api/status` route for client polling
4. **Painterly atmospheric bg** на `.privacy-shell`, `.terms-shell`, `.report-shell`, `.status-shell`, `.faq-shell` чрез `::before` с painterly art + heavy overlay + blur. `/account` НЕ получава (has cinematic hero вече).
5. **Light theme support** for `.privacy-shell`, `.terms-shell`, `.report-shell`, `.status-shell`, `.faq-shell`, `.account-shell`:
   - Cream parchment surfaces, dark text
   - Banner art stays dark (cinematic visual island)
   - Banner overlay text stays cream (hardcoded with `!important`)
   - Painterly atmospheric bg switches to parchment-tinted gradient
6. **Old `.harbor-*` CSS removed**.
7. **БГ-only copy**, English commits.
8. **Visual baselines updated** for both themes.
9. **`pnpm verify` passes**.
10. **Working directly on `main`** — no feature branch.

---

## Не пипай

- Game-server, schemas, Better Auth.
- `/privacy`, `/terms`, `/report`, `/faq`, `/account` page logic — само CSS overrides за light theme.
- Theme toggle infrastructure в site-chrome (it already works; we're just opting these pages into it).
- Old painterly portrait assets (`status-harbor.png`, etc.) — остават в repo.

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

1. **`/status`**:
   - Banner shows harbor scene с overall state pill
   - 6 service tiles visible с correct color-coded borders
   - Click "↻ Опресни" → button shows "Проверяваме..." → refreshes
   - Wait 30s on focused tab → auto-refresh fires
   - Switch tabs for 1 min → no requests in network tab → switch back → immediate refresh
   - Discord/Telegram cards show "Скоро отворен" if env vars unset

2. **Light theme toggle**:
   - Open `/privacy` in dark mode → painterly atmospheric ink bg
   - Click theme toggle → cream parchment atmospheric bg, dark text on cream cards
   - Banner stays cinematic dark in both modes
   - Visit `/terms`, `/report`, `/status`, `/faq`, `/account` in light mode → all consistent cream theme
   - Visit homepage in light mode → unchanged (utility-only opt-in)

3. **Auto-refresh battery friendliness**:
   - Open `/status` → DevTools Network tab
   - Wait 60s with tab focused → 2 polling requests visible
   - Switch to another tab for 60s → no new requests
   - Switch back → 1 immediate request, then resume 30s cadence

4. **Mobile (390×844)** for both themes:
   - Service tiles stack 1-column
   - Legend stacks 1-column
   - Subscribe cards stack 1-column
   - Painterly bg readable but not distracting

---

## Commit strategy (13 atomic English commits, working directly on `main`)

**Working directly on `main` — no feature branch. Validate after each commit.**

1. `chore(art): generate cinematic harbor banner for status page`
2. `chore(env): add NEXT_PUBLIC_DISCORD_URL and NEXT_PUBLIC_TELEGRAM_URL placeholders`
3. `feat(status): cinematic hero with overall state pill and manual refresh`
4. `feat(status): six service tiles with color-coded status badges`
5. `feat(status): four-status legend section`
6. `feat(status): last incident placeholder with configurable constant`
7. `feat(status): subscribe section with env-gated Discord and Telegram cards`
8. `feat(api): GET /api/status for client-side polling`
9. `feat(status): auto-refresh every 30s with Page Visibility pause`
10. `style(utility): painterly atmospheric bg for privacy terms report status faq`
11. `style(utility): light theme variable overrides for six utility pages`
12. `chore(css): remove obsolete harbor brass-plaque styles`
13. `chore(visual): regenerate baselines for utility pages in both themes`

After each commit:
```bash
pnpm regression && pnpm typecheck && pnpm build
# If green → push. If red → fix or revert immediately.
```

---

(End of prompt)
