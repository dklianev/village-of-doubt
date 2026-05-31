# Codex prompt — Homepage (`/`) performance overhaul (INP + LCP + TTFB)

Homepage-а е визуално най-тежката страница в проекта: ~17 background gradient layers + 2 filter passes, `loadGameStats()` без timeout блокира RSC stream, theme toggle прави full-document style recalc, инфинитни background-position animations на quickstart-counters. Резултат: TTFB lag, FCP lag, INP проблеми на theme/scroll и continuous battery drain.

**Работа директно на `main`.** 14 atomic English commits. **2 нови imagen banners.** ~4–5 часа Codex work at high reasoning.

---

## Pre-analysis

### Метрики, които таргетираме

| Метрика | Текущо (оценка) | Цел |
|---|---|---|
| TTFB (cold, mid-3G) | 800–1500ms (game-server-bound) | <200ms |
| FCP | 1500–2200ms | <1200ms |
| LCP | 2500–3500ms | <2000ms |
| INP (theme toggle) | 100–150ms | <50ms |
| INP (CTA click) | varies | <100ms |
| CLS | ~0.05 (text swap) | <0.01 |
| Idle CPU (tab focused) | 2–5% (infinite animations) | <0.5% |
| JS bundle (landing) | ~120 KB gzipped (est.) | ~80 KB |

### Architectural map

- **Page entry:** `apps/web/app/page.tsx` → `<LandingExperience />`
- **Landing tree:** `apps/web/components/landing-experience.tsx` (server, async fetches stats)
  - `<ResourceHints />` (client) — `ReactDOM.preload` calls
  - `<ModeChoiceCards />` (client) — useSession + localStorage
  - `<QuickStartSection />` (client) — IntersectionObserver + 5-step grid + 2 mini cards с infinite animations
- **Layout chrome:** `apps/web/app/layout.tsx`
  - `<SiteChrome />` (client) — 15 lucide icons, drawer, dropdown, theme, sound
  - `<FeedbackWidget />` (client, hidden on `/` но bundle-ва)
  - `<WelcomeModal />`, `<ToastHost />`, `<CookieBanner />`, `<ServiceWorkerRegistration />`

### Issues (13 total)

| # | Issue | File:line | Impact |
|---|---|---|---|
| 1 | `loadGameStats()` блокира RSC stream без timeout | `landing-experience.tsx:30, 62–80` | 🔴 P0 TTFB |
| 2 | Hero card с 6 background layers + 2 pseudo layers | `globals.css:1482–1555` | 🔴 P0 Paint |
| 3 | Body `::before` с `filter: saturate contrast` | `globals.css:1455–1461` | 🔴 P0 GPU |
| 4 | `.game-choice-card::after` с `filter: blur(16px)` × 2 | `globals.css:1731–1744` | 🔴 P0 GPU |
| 5 | Theme toggle → full document style recalc | `site-chrome.tsx:193–199` | 🟠 P1 INP |
| 6 | Infinite `quickstart-pulse` + `quickstart-live-count` background-position animation | `globals.css:3517–3537` | 🟠 P1 CPU |
| 7 | `prefetch={false}` на secondary links + missing desktop image preloads | `ModeChoiceCards.tsx:51–55`, `landing-experience.tsx:41` | 🟠 P1 INP |
| 8 | `ModeChoiceCards` swap-ва CTA текст post-hydration → CLS | `ModeChoiceCards.tsx:48–49` | 🟠 P1 CLS |
| 9 | `FeedbackWidget` bundle ships на landing (където е hidden) | `layout.tsx:6, 85` | 🟠 P1 Bundle |
| 10 | SiteChrome ships 15 icons + drawer + dropdown eager | `site-chrome.tsx:7–24` | 🟡 P2 Bundle |
| 11 | `landing-logo-mark` background-image без preload | `globals.css:1561–1572` | 🟡 P2 LCP |
| 12 | `QuickStartSection` ползва IntersectionObserver вместо `content-visibility` | `QuickStartSection.tsx:66–84` | 🟡 P2 JS |
| 13 | `ResourceHints` е client component | `resource-hints.tsx:1` | 🟡 P2 Discovery |

### Out of scope

- Game-server `/stats` endpoint logic
- Better-auth `useSession` implementation
- Other pages (privacy, terms, faq, etc.)
- Tutorial / lobby / play / role-detail pages
- Imagen prompts to be drafted **inside this PR** (Stage 14 spec covers them)
- New npm dependencies — vanilla React + Next.js + CSS

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| `loadGameStats` cache | `next: { revalidate: 5 }` + `AbortSignal.timeout(800)` |
| Stats stream | Move stats fetch into separate `<Suspense>` boundary so hero renders immediately |
| Hero background flatten | Generate **single pre-composited WebP** combining art-landing-dual + 5 gradient layers, replace CSS stack |
| Body ambient bg flatten | Generate **single WebP** for body `::before` combining ambient art + saturate/contrast/gradients |
| Card aura blur | Keep blur but **only on hover** (idle = no filter); reduces continuous paint cost |
| Theme toggle | Wrap в `document.startViewTransition`; CSS vars вместо selectors където възможно (this PR ще migration-ира hero card + quickstart) |
| Quickstart animations | `prefers-reduced-motion` → off; quickstart-live-count → simple opacity pulse вместо background-position |
| Quickstart paint defer | Replace IntersectionObserver с `content-visibility: auto` + `contain-intrinsic-size` |
| Link prefetch | Remove `prefetch={false}` от game-choice secondary links (`/roles`, `/rules`) |
| Image preloads | Add desktop variants (мобилните вече preload-ват) |
| Session for ModeChoiceCards | Pass SSR session от layout → page → LandingExperience → ModeChoiceCards initialSession prop |
| FeedbackWidget | `next/dynamic` import с `ssr: false`; conditional на route чрез pathname check on client |
| SiteChrome split | Split MobileDrawer + NavDropdown в `next/dynamic` chunks; mount on first interaction |
| Logo mark | Convert от CSS background-image към `<Image priority fetchPriority="high">` |
| ResourceHints | Convert към server component с native `<link>` tags |
| Imagen | 2 нови backgrounds: `bg-landing-hero-composited.webp` + `bg-landing-ambient-composited.webp` (each `desktop + mobile` variants = 4 files) |
| Branch | Directly on `main` |
| Validation | After each commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert. |

---

## Stage 1 — Stats fetch resilience + streaming (P0)

### Step 1a: Add timeout + revalidate on stats fetch

**File:** `apps/web/components/landing-experience.tsx`

```diff
  async function loadGameStats() {
    const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/^ws/, "http") ?? "http://localhost:2567";
    try {
      const response = await fetch(`${gameServerUrl}/stats`, {
-       cache: "no-store",
-       next: { revalidate: 0 },
+       next: { revalidate: 5 },
+       signal: AbortSignal.timeout(800),
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as {
        activeRooms?: number;
        connectedPlayers?: number;
        byFamily?: Partial<Record<GameFamily, number>>;
        lastWinner?: LandingQuickStartLastWinner | null;
      };
    } catch {
      return null;
    }
  }
```

**Защо:**
- `revalidate: 5` → Next.js cache invalidate на 5 секунди → повтарящи се визити hit-ват edge cache, не game-server
- `AbortSignal.timeout(800)` → hard cap. Ако game-server е dead/слаб, page render-ва с `stats = null` за <1s, не виси за 30s.
- Изтрита беше `cache: "no-store"` — конфликтуваше с revalidate.

### Step 1b: Stream stats below the fold via Suspense

**File:** `apps/web/components/landing-experience.tsx`

```diff
- import type { GameFamily } from "@werewolf/shared";
+ import { Suspense } from "react";
+ import type { GameFamily } from "@werewolf/shared";
  import { ResourceHints } from "@/components/resource-hints";
  import { ModeChoiceCards, type ModeChoiceGame } from "@/components/landing/ModeChoiceCards";
  import { QuickStartSection, type LandingQuickStartLastWinner } from "@/components/landing/QuickStartSection";

  const GAMES = [/* … */] as const satisfies readonly ModeChoiceGame[];

- export async function LandingExperience() {
-   const stats = await loadGameStats();
-   const liveStats = stats ? { /* … */ } : null;
-
-   return (
-     <main className="shell landing-shell">
-       <ResourceHints images={…} />
-       <section className="card landing-hero-card rounded-[2rem] p-7">
-         <div className="landing-logo-mark" aria-hidden="true" />
-         <p className="section-kicker">избери игра</p>
-         <h1 …>Върколак или Мафия</h1>
-         <p className="landing-hero-copy …">Две отделни игри …</p>
-         <ModeChoiceCards games={GAMES} />
-         <QuickStartSection liveStats={liveStats} lastWinner={stats?.lastWinner ?? null} />
-       </section>
-     </main>
-   );
- }
+ export function LandingExperience({ initialSession }: { initialSession: LandingSession | null }) {
+   return (
+     <main className="shell landing-shell">
+       <ResourceHints
+         images={[
+           "/game-art/bg-landing-hero-composited.webp",
+           "/game-art/bg-landing-ambient-composited.webp",
+           "/game-art/mobile/bg-landing-hero-composited.webp",
+           "/game-art/mobile/bg-landing-ambient-composited.webp",
+         ]}
+       />
+       <section className="card landing-hero-card rounded-[2rem] p-7">
+         <LandingLogoMark />
+         <p className="section-kicker">избери игра</p>
+         <h1 className="mt-5 text-5xl font-black leading-none text-[#f4e8d1] md:text-7xl">
+           Върколак или Мафия
+         </h1>
+         <p className="landing-hero-copy mt-6 max-w-3xl text-lg leading-8 text-[#ead9ba]">
+           Две отделни игри, два отделни речника и два отделни набора роли. Влизаш с име, създаваш стая
+           или въвеждаш код и започваш веднага.
+         </p>
+         <ModeChoiceCards games={GAMES} initialSession={initialSession} />
+         <Suspense fallback={<QuickStartSkeleton />}>
+           <QuickStartWithStats />
+         </Suspense>
+       </section>
+     </main>
+   );
+ }
+
+ async function QuickStartWithStats() {
+   const stats = await loadGameStats();
+   const liveStats = stats
+     ? {
+         activeRooms: stats.activeRooms ?? 0,
+         connectedPlayers: stats.connectedPlayers ?? 0,
+         ...(stats.byFamily ? { byFamily: stats.byFamily } : {}),
+       }
+     : null;
+   return <QuickStartSection liveStats={liveStats} lastWinner={stats?.lastWinner ?? null} />;
+ }
+
+ function QuickStartSkeleton() {
+   return (
+     <section className="landing-quickstart" aria-hidden="true">
+       <div className="quickstart-surface quickstart-skeleton" />
+     </section>
+   );
+ }
+
+ export type LandingSession = { user: { id: string; name?: string | null } } | null;
```

CSS за skeleton (`globals.css`, около ред 3258):

```css
.quickstart-skeleton {
  min-height: 560px;
  opacity: 0.45;
}
```

### Step 1c: Pass SSR session от page

**File:** `apps/web/app/page.tsx`

```diff
+ import { headers } from "next/headers";
+ import { auth } from "@/lib/auth";
  import { JsonLd } from "@/components/JsonLd";
  import { LandingExperience } from "@/components/landing-experience";
  import { routeMetadata, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";

  /* … existing metadata + jsonLd … */

- export default function HomePage() {
+ export default async function HomePage() {
+   const session = await auth.api.getSession({ headers: await headers() });
+   const initialSession = session?.user?.id
+     ? { user: { id: session.user.id, name: session.user.name ?? null } }
+     : null;
+
    return (
      <>
        <JsonLd data={homeJsonLd} />
-       <LandingExperience />
+       <LandingExperience initialSession={initialSession} />
      </>
    );
  }
```

### Commit 1

```
perf(landing): timeout/revalidate stats fetch + stream below the fold via Suspense
```

---

## Stage 2 — Flatten hero card backgrounds (P0)

### Step 2a: Generate new imagen — `bg-landing-hero-composited.webp`

**Imagen prompt:**

```
A wide cinematic painterly oil banner (1920 × 1080, 16:9) for a Bulgarian
social deduction game homepage hero. Composition: dual-world split scene —
left half is a moonlit folkloric village at night (silhouettes of timber
houses with warm window glow, mist hanging low, faint silver moon),
right half is a 1920s rainy noir city street (glowing window of a smoky
bar, wet cobblestones reflecting amber light, faint silhouette of a hat).
The two worlds blend at the center via a deep ochre/amber gradient haze.

Pre-applied effects (do NOT render text, numbers or logos):
- Strong warm ambient glow concentrated at 22% horizontal × 34% vertical (golden #c89a55)
- Cool teal ambient glow at 82% × 38% (#2b5d69)
- Soft cream halo at 50% × 18% (subtle, like a candle bloom)
- 90deg horizontal vignette: dark edges, lighter center
- 180deg vertical gradient: lighter top, much darker bottom (deep crime-noir feel)
- Overall saturate(1.05) contrast(1.04) baked-in

Final treatment: cinematic painterly oil, visible brushwork, no photography.
Color palette: cream #f4e8d1, gold #c89a55, blood #842f2b, deep teal #2b5d69,
charcoal #0a0a0d. Bottom third has a scrim for text overlay.

Strictly no visible text, letters, numbers, logos, or watermarks.
```

**Saves to:** `apps/web/public/game-art/bg-landing-hero-composited.webp` (1920 × 1080)

Plus mobile variant (640 × 1280, portrait crop): `apps/web/public/game-art/mobile/bg-landing-hero-composited.webp`

### Step 2b: Replace hero card CSS

**File:** `apps/web/app/globals.css:1482–1555`

```diff
+ :root {
+   --art-landing-hero-composited: image-set(
+     url("/game-art/bg-landing-hero-composited.webp") type("image/webp"),
+     url("/game-art/bg-landing-hero-composited.png") type("image/png")
+   );
+ }
+
+ @media (max-width: 760px) {
+   :root {
+     --art-landing-hero-composited: image-set(
+       url("/game-art/mobile/bg-landing-hero-composited.webp") type("image/webp")
+     );
+   }
+ }

  .landing-hero-card {
    isolation: isolate;
    min-height: 520px;
    border-color: rgba(200, 154, 85, 0.28);
-   background:
-     radial-gradient(ellipse at 22% 34%, rgba(200, 154, 85, 0.15), transparent 24rem),
-     radial-gradient(ellipse at 82% 38%, rgba(43, 93, 105, 0.16), transparent 28rem),
-     radial-gradient(circle at 50% 18%, rgba(255, 247, 229, 0.08), transparent 22rem),
-     linear-gradient(90deg, rgba(10, 10, 9, 0.42) 0%, rgba(10, 13, 13, 0.16) 48%, rgba(10, 10, 9, 0.38) 100%),
-     linear-gradient(180deg, rgba(4, 7, 8, 0.18) 0%, rgba(4, 7, 8, 0.62) 100%),
-     var(--art-landing-dual) center top / 100% auto no-repeat;
+   background: var(--art-landing-hero-composited) center top / cover no-repeat;
    box-shadow: 0 32px 92px rgba(0, 0, 0, 0.46), inset 0 1px rgba(255, 247, 229, 0.1);
  }

  .landing-hero-card::before {
    position: absolute;
    inset: 1px;
    z-index: 0;
    border: 1px solid rgba(200, 154, 85, 0.22);
    border-radius: inherit;
-   background:
-     linear-gradient(115deg, transparent 0 38%, rgba(248, 236, 210, 0.04) 38% 39%, transparent 39%),
-     radial-gradient(ellipse at 21% 48%, rgba(209, 154, 66, 0.12), transparent 24rem),
-     radial-gradient(ellipse at 88% 44%, rgba(61, 103, 111, 0.16), transparent 25rem);
+   /* Keep only the diagonal seam — other glow layers are baked into the WebP */
+   background: linear-gradient(115deg, transparent 0 38%, rgba(248, 236, 210, 0.04) 38% 39%, transparent 39%);
    content: "";
    pointer-events: none;
  }

  .landing-hero-card::after {
-   background:
-     radial-gradient(circle at 50% 22%, rgba(248, 236, 210, 0.07), transparent 22rem),
-     radial-gradient(circle at 12% 98%, rgba(200, 154, 85, 0.1), transparent 18rem),
-     radial-gradient(circle at 94% 96%, rgba(43, 93, 105, 0.12), transparent 20rem),
-     repeating-linear-gradient(135deg, rgba(248, 236, 210, 0.026) 0 1px, transparent 1px 18px);
+   /* Keep only the parchment texture pinstripe — radials baked in */
+   background: repeating-linear-gradient(135deg, rgba(248, 236, 210, 0.026) 0 1px, transparent 1px 18px);
    opacity: 0.88;
  }
```

### Step 2c: Light theme override

```diff
  html[data-theme="light"] .landing-hero-card {
    border-color: rgba(169, 111, 34, 0.58);
-   background:
-     radial-gradient(ellipse at 22% 34%, rgba(200, 154, 85, 0.2), transparent 24rem),
-     radial-gradient(ellipse at 82% 38%, rgba(43, 93, 105, 0.14), transparent 28rem),
-     radial-gradient(circle at 50% 18%, rgba(255, 247, 229, 0.1), transparent 22rem),
-     linear-gradient(90deg, rgba(20, 12, 9, 0.48) 0%, rgba(12, 15, 15, 0.18) 48%, rgba(12, 14, 13, 0.42) 100%),
-     linear-gradient(180deg, rgba(7, 9, 9, 0.16) 0%, rgba(7, 9, 9, 0.58) 100%),
-     var(--art-landing-dual) center top / 100% auto no-repeat;
+   /* Light theme: lighter scrim layered onto same composited art */
+   background:
+     linear-gradient(180deg, rgba(252, 246, 236, 0.18) 0%, rgba(252, 246, 236, 0.32) 100%),
+     var(--art-landing-hero-composited) center top / cover no-repeat;
    box-shadow: 0 34px 92px rgba(67, 39, 24, 0.24), 0 0 0 1px rgba(169, 111, 34, 0.18), inset 0 1px rgba(255, 247, 229, 0.18);
  }
```

### Commit 2

```
perf(landing): flatten hero card backgrounds into single pre-composited WebP
```

---

## Stage 3 — Flatten body ambient backdrop (P0)

### Step 3a: Generate `bg-landing-ambient-composited.webp`

**Imagen prompt:**

```
A subtle painterly oil ambient backdrop (1920 × 1080, 16:9) intended to sit
behind a foreground content card. Composition: very dark cinematic
atmosphere with two soft glow pools — warm golden glow at 4% horizontal ×
50% vertical (large, ~34rem radius equivalent, color #c89a55 fading to
transparent), cool steel-teal glow at 96% × 48% (~38rem equivalent, color
#2b5d69). Diagonal 115deg vignette: slightly darker top-left, slightly
lighter at 47% diagonal, darker again at bottom-right.

Pre-applied effects (do NOT render text):
- saturate(1.14) contrast(1.04) baked-in
- Painterly oil texture overlay, very subtle
- Bottom third fades to deep charcoal #050708 for footer comfort

Color palette: charcoal #050708 to #060809, gold #c89a55, teal #2b5d69.
Mood: late-night village watchfire ambient. Strictly no text, numbers, logos.
```

**Saves to:** `apps/web/public/game-art/bg-landing-ambient-composited.webp` + mobile variant.

### Step 3b: Replace `.landing-shell::before` background

**File:** `apps/web/app/globals.css:1455–1462`

```diff
+ :root {
+   --art-landing-ambient-composited: image-set(
+     url("/game-art/bg-landing-ambient-composited.webp") type("image/webp"),
+     url("/game-art/bg-landing-ambient-composited.png") type("image/png")
+   );
+ }
+
+ @media (max-width: 760px) {
+   :root {
+     --art-landing-ambient-composited: image-set(
+       url("/game-art/mobile/bg-landing-ambient-composited.webp") type("image/webp")
+     );
+   }
+ }

  .landing-shell::before {
-   background:
-     radial-gradient(ellipse at 4% 50%, rgba(200, 154, 85, 0.18), transparent 34rem),
-     radial-gradient(ellipse at 96% 48%, rgba(43, 93, 105, 0.18), transparent 38rem),
-     linear-gradient(115deg, rgba(5, 7, 8, 0.58) 0%, rgba(6, 8, 9, 0.34) 47%, rgba(5, 7, 8, 0.64) 100%),
-     var(--art-landing-ambient) center / cover no-repeat;
-   filter: saturate(1.14) contrast(1.04);
+   background: var(--art-landing-ambient-composited) center / cover no-repeat;
+   /* filter removed — saturate/contrast baked into composited WebP */
  }
```

**Защо:** Премахването на `filter` спестява **една composited layer + GPU pass** на всеки frame. На mobile = осезаемо при scroll и при INP.

### Commit 3

```
perf(landing): flatten body ambient backdrop into single composited WebP, drop filter pass
```

---

## Stage 4 — Card aura blur on hover only (P0)

### Step 4a: Reduce idle filter cost

**File:** `apps/web/app/globals.css:1731–1748`

```diff
  .landing-split-grid .game-choice-card::after {
    position: absolute;
    inset: auto -12% -18% -12%;
    z-index: 0;
    height: 42%;
    background:
      radial-gradient(ellipse at 50% 100%, rgba(209, 154, 66, 0.28), transparent 58%),
      linear-gradient(90deg, transparent, rgba(248, 236, 210, 0.14), transparent);
    content: "";
-   filter: blur(16px);
-   opacity: 0.72;
+   filter: none;
+   opacity: 0.52;
    transform: translateY(10px);
-   transition: opacity 260ms ease;
+   transition: opacity 260ms ease, filter 260ms ease;
  }

  .landing-split-grid .game-choice-card:hover::after {
-   opacity: 1;
+   opacity: 1;
+   filter: blur(16px);
  }
+
+ @media (hover: none) {
+   /* Touch devices: keep aura static (no hover state to trigger blur) */
+   .landing-split-grid .game-choice-card::after {
+     opacity: 0.6;
+   }
+ }
```

**Защо:** На idle landing (no hover), GPU не run-ва blur pass на 2 cards. Само при mouse hover (rare on mobile, where most perf complaints come from) → blur се активира. На touch devices с `hover: none` се skip-ва hover state изобщо.

### Commit 4

```
perf(landing): defer card aura blur to hover state only
```

---

## Stage 5 — Theme toggle in view-transition + CSS vars (P1)

### Step 5a: Wrap theme apply във view-transition

**File:** `apps/web/components/site-chrome.tsx:193–199`

```diff
  function cycleThemePreference() {
    const currentIndex = THEME_OPTIONS.indexOf(themePreference);
    const nextPreference = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length] ?? "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setThemePreference(nextPreference);
-   applyThemePreference(nextPreference);
+   if ("startViewTransition" in document) {
+     document.startViewTransition(() => applyThemePreference(nextPreference));
+   } else {
+     applyThemePreference(nextPreference);
+   }
  }
```

### Step 5b: Override default root crossfade duration for theme

**File:** `apps/web/app/globals.css` — добави в най-горната `::view-transition` секция:

```css
/* Theme toggle uses view-transition for INP win */
html[data-vt="theme"]::view-transition-old(root),
html[data-vt="theme"]::view-transition-new(root) {
  animation-duration: 280ms;
  animation-timing-function: ease;
}
```

И в `applyThemePreference`:

```diff
  function applyThemePreference(preference: ThemePreference) {
    if (typeof window === "undefined") {
      return;
    }
+
+   document.documentElement.dataset.vt = "theme";
    document.documentElement.dataset.theme = preference;
+   window.setTimeout(() => {
+     delete document.documentElement.dataset.vt;
+   }, 320);
  }
```

`data-vt="theme"` marker позволява scope-нат селектор за view-transition speed без да засегне други transitions.

### Step 5c: Migrate hero card colors to CSS variables

**File:** `apps/web/app/globals.css` — преди `.landing-hero-card`:

```diff
  :root {
    --art-landing-hero-composited: image-set(…);
+   --hero-card-border: rgba(200, 154, 85, 0.28);
+   --hero-card-shadow: 0 32px 92px rgba(0, 0, 0, 0.46), inset 0 1px rgba(255, 247, 229, 0.1);
+   --hero-card-scrim: linear-gradient(180deg, rgba(4, 7, 8, 0) 0%, rgba(4, 7, 8, 0.16) 100%);
  }

+ html[data-theme="light"] {
+   --hero-card-border: rgba(169, 111, 34, 0.58);
+   --hero-card-shadow: 0 34px 92px rgba(67, 39, 24, 0.24), 0 0 0 1px rgba(169, 111, 34, 0.18), inset 0 1px rgba(255, 247, 229, 0.18);
+   --hero-card-scrim: linear-gradient(180deg, rgba(252, 246, 236, 0.18) 0%, rgba(252, 246, 236, 0.32) 100%);
+ }

  .landing-hero-card {
    isolation: isolate;
    min-height: 520px;
-   border-color: rgba(200, 154, 85, 0.28);
+   border-color: var(--hero-card-border);
-   background: var(--art-landing-hero-composited) center top / cover no-repeat;
+   background:
+     var(--hero-card-scrim),
+     var(--art-landing-hero-composited) center top / cover no-repeat;
-   box-shadow: 0 32px 92px rgba(0, 0, 0, 0.46), inset 0 1px rgba(255, 247, 229, 0.1);
+   box-shadow: var(--hero-card-shadow);
  }

- html[data-theme="light"] .landing-hero-card {
-   border-color: rgba(169, 111, 34, 0.58);
-   background:
-     linear-gradient(180deg, rgba(252, 246, 236, 0.18) 0%, rgba(252, 246, 236, 0.32) 100%),
-     var(--art-landing-hero-composited) center top / cover no-repeat;
-   box-shadow: 0 34px 92px rgba(67, 39, 24, 0.24), 0 0 0 1px rgba(169, 111, 34, 0.18), inset 0 1px rgba(255, 247, 229, 0.18);
- }
```

**Защо:** CSS variable change → browser-ът update-ва **само** computed style на elements, които ползват variable-а. Без variable, browser-ът ре-evaluate-ва ВСИЧКИ селектори с `html[data-theme="light"] .landing-hero-card`. С variable → много по-малък scope на recalc.

### Commit 5

```
perf(landing): theme toggle via view-transition + migrate hero to CSS vars for narrower recalc
```

---

## Stage 6 — Quickstart animations cleanup (P1)

### Step 6a: Replace background-position text animation

**File:** `apps/web/app/globals.css:3527–3537`

```diff
  .quickstart-live-count {
    display: inline-block;
-   color: transparent;
-   background: linear-gradient(100deg, var(--ink) 0%, var(--ink) 35%, #a65c30 48%, var(--ink) 62%, var(--ink) 100%);
-   background-size: 240% 100%;
-   background-clip: text;
-   -webkit-background-clip: text;
+   color: var(--ink);
    font-size: 1.3rem;
    font-weight: 950;
-   animation: quickstartDigits 3.8s ease-in-out infinite;
+   animation: quickstartLiveCountPulse 2.4s ease-in-out infinite;
  }
+
+ @keyframes quickstartLiveCountPulse {
+   0%, 100% { opacity: 0.92; }
+   50% { opacity: 1; }
+ }
```

**Защо:** Animating `background-position` на gradient-clipped text → browser **re-rasterize-ва glyph-овете на всеки frame**. Opacity-only animation е GPU compositor-only — нула paint cost.

### Step 6b: Reduced-motion guard

```diff
+ @media (prefers-reduced-motion: reduce) {
+   .quickstart-pulse,
+   .quickstart-live-count {
+     animation: none;
+   }
+ }
```

Добави след `.quickstart-pulse` definition (около ред 3525).

### Step 6c: Pause animations outside viewport via `content-visibility`

```diff
  .landing-quickstart {
    margin-top: 30px;
+   content-visibility: auto;
+   contain-intrinsic-size: 880px 980px;
  }
```

`content-visibility: auto` казва на browser-а да skip-ва paint + animation на section докато не влезе в viewport. Browser сам handle-ва без JS observer. Анимациите се pause-ват автоматично extra viewport.

### Commit 6

```
perf(landing): swap quickstart digit animation to opacity pulse + add content-visibility auto
```

---

## Stage 7 — Link prefetching + image preloads (P1)

### Step 7a: Remove `prefetch={false}` от secondary game choice links

**File:** `apps/web/components/landing/ModeChoiceCards.tsx:51–55`

```diff
  <div className="game-choice-actions">
    <Link href={primaryHref} className="btn btn-primary">
      {session ? "Избери игра" : "Влез и играй"}
    </Link>
-   <Link href={`${game.href}/roles`} className="btn btn-secondary" prefetch={false}>
+   <Link href={`${game.href}/roles`} className="btn btn-secondary">
      Роли
    </Link>
-   <Link href={`${game.href}/rules`} className="btn btn-secondary" prefetch={false}>
+   <Link href={`${game.href}/rules`} className="btn btn-secondary">
      Правила
    </Link>
  </div>
```

### Step 7b: Same for QuickStartSection internal links

**File:** `apps/web/components/landing/QuickStartSection.tsx`

```diff
- <Link href="/werewolf/rules" className="quickstart-rules-cta" prefetch={false}>
+ <Link href="/werewolf/rules" className="quickstart-rules-cta">
  /* … */
- <Link href="/werewolf/create" className="quickstart-card-cta" prefetch={false}>
+ <Link href="/werewolf/create" className="quickstart-card-cta">
```

### Step 7c: Expand preloads to desktop variants

Step 1b вече направи това, но потвърди че `LandingExperience` minimum преlоad-ва:

```tsx
<ResourceHints
  images={[
    "/game-art/bg-landing-hero-composited.webp",       // desktop hero
    "/game-art/bg-landing-ambient-composited.webp",     // desktop ambient
    "/game-art/mobile/bg-landing-hero-composited.webp", // mobile hero
    "/game-art/mobile/bg-landing-ambient-composited.webp", // mobile ambient
  ]}
/>
```

Browser-ът selectively използва WebP-а от image-set спрямо media query — но `<link rel="preload">` ще fire-не и двата. Това е приемливо защото browser cache-ва пър-mode стартираните преди да picks-не winner-а.

**Алтернатива (по-tight):** Media-query-scoped preloads чрез server component. Виж Stage 13 (ResourceHints refactor) — там добавяме media support.

### Commit 7

```
perf(landing): enable prefetch on secondary links and preload desktop background variants
```

---

## Stage 8 — SSR session для ModeChoiceCards (P1)

### Step 8a: Update ModeChoiceCards props

**File:** `apps/web/components/landing/ModeChoiceCards.tsx`

```diff
  "use client";

- import { useEffect, useState } from "react";
+ import { useEffect, useState } from "react";
  import Link from "next/link";
  import { authClient } from "@/lib/auth-client";

  type LastFamily = "werewolves" | "mafia";

  export type ModeChoiceGame = { /* … */ };

- export function ModeChoiceCards({ games }: { games: readonly ModeChoiceGame[] }) {
-   const { data: session } = authClient.useSession();
+ export function ModeChoiceCards({
+   games,
+   initialSession,
+ }: {
+   games: readonly ModeChoiceGame[];
+   initialSession: { user: { id: string; name?: string | null } } | null;
+ }) {
+   const sessionQuery = authClient.useSession();
+   const session = sessionQuery.data ?? initialSession;
    const [lastFamily, setLastFamily] = useState<LastFamily | null>(null);

    useEffect(() => {
      const saved = window.localStorage.getItem("last-family");
      if (saved === "werewolves" || saved === "mafia") {
        setLastFamily(saved);
      }
    }, []);

    return (
      <div className="game-choice-grid landing-split-grid mt-8">
        {games.map((game) => {
          const isLastPlayed = lastFamily === game.family;
          const primaryHref = session ? `${game.href}/create` : `/sign-in?redirect=${encodeURIComponent(`${game.href}/create`)}`;

          return (
            /* … rest unchanged … */
          );
        })}
      </div>
    );
  }
```

**Защо:** `initialSession` идва от SSR (Stage 1c — page.tsx → LandingExperience). Hydration-ът показва правилния CTA текст веднага. Когато `authClient.useSession()` resolve-не post-hydration, ако session-ът се промени междувременно (rare на landing), `sessionQuery.data` override-ва.

### Step 8b: Min-width на primary CTA за безопасност

В `globals.css` (около `.game-choice-actions`):

```diff
  .game-choice-actions {
    /* … */
+   --primary-cta-min-width: 11ch;
  }
+
+ .game-choice-actions .btn-primary {
+   min-width: var(--primary-cta-min-width);
+ }
```

Дори ако session resolves slowly, button-ът не shift-ва по width.

### Commit 8

```
perf(landing): pass SSR session to ModeChoiceCards to eliminate post-hydration CTA flicker
```

---

## Stage 9 — Dynamic FeedbackWidget (P1)

### Step 9a: Convert layout import to dynamic

**File:** `apps/web/app/layout.tsx`

```diff
+ import dynamic from "next/dynamic";
  import type { Metadata } from "next";
  import { headers } from "next/headers";
  import { auth } from "@/lib/auth";
  import type { AuthSessionView } from "@/lib/use-auth-session";
  import { CookieBanner } from "@/components/CookieBanner";
- import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
  import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
  import { ResourceHints } from "@/components/resource-hints";
  import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
  import { SiteFooter } from "@/components/SiteFooter";
  import SiteChrome from "@/components/site-chrome";
  import { ToastHost } from "@/components/toast-host";
  import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
  import "./globals.css";

+ const FeedbackWidget = dynamic(
+   () => import("@/components/feedback/FeedbackWidget").then((m) => ({ default: m.FeedbackWidget })),
+   { ssr: false, loading: () => null },
+ );
```

**Защо:** `ssr: false` спира bundle inclusion в server response. `next/dynamic` ще defer-не loading-а до post-hydration (вече non-critical). На landing, където widget-а е skрит, се skip-ва entirely.

### Step 9b: Same pattern for WelcomeModal (rarely shown)

```diff
- import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
+ const WelcomeModal = dynamic(
+   () => import("@/components/onboarding/WelcomeModal").then((m) => ({ default: m.WelcomeModal })),
+   { ssr: false, loading: () => null },
+ );
```

WelcomeModal се показва само на първа визита (localStorage check). Lazy-load → нула cost за returning users.

### Step 9c: Same for CookieBanner

Cookie banner е visible само първо посещение (localStorage `cookies-accepted` flag).

```diff
- import { CookieBanner } from "@/components/CookieBanner";
+ const CookieBanner = dynamic(
+   () => import("@/components/CookieBanner").then((m) => ({ default: m.CookieBanner })),
+   { ssr: false, loading: () => null },
+ );
```

### Commit 9

```
perf(landing): dynamic-import non-critical widgets (Feedback, Welcome, CookieBanner)
```

---

## Stage 10 — SiteChrome split (P2)

### Step 10a: Extract MobileDrawer to lazy chunk

**File:** Създай нов `apps/web/components/site-chrome/MobileDrawer.tsx`. Move `function MobileDrawer(...)` и `function BrandMark(...)` (drawer's helper) от `site-chrome.tsx`.

В `site-chrome.tsx`:

```diff
+ import dynamic from "next/dynamic";
  import { useEffect, useMemo, useRef, useState } from "react";
  import { createPortal } from "react-dom";
  /* … */
+
+ const MobileDrawer = dynamic(() => import("@/components/site-chrome/MobileDrawer"), {
+   ssr: false,
+   loading: () => null,
+ });

  /* … */

  {mounted && drawerOpen
    ? createPortal(
        <MobileDrawer
          /* … */
        />,
        document.body,
      )
    : null}
```

### Step 10b: Extract NavDropdown to lazy chunk

Similar pattern — extract `nav-dropdown` JSX of `PrimaryBand` to separate component, dynamic-import.

```tsx
// apps/web/components/site-chrome/NavDropdown.tsx
"use client";
import Link from "next/link";
import { GROUP_LABELS, GROUP_ORDER, SECONDARY_LINKS } from "./constants";
// …
export default function NavDropdown({ onToggle }: { onToggle: () => void }) { /* … */ }
```

И в site-chrome.tsx:

```diff
+ const NavDropdown = dynamic(() => import("@/components/site-chrome/NavDropdown"), {
+   ssr: false,
+   loading: () => null,
+ });

  {dropdownOpen ? <NavDropdown onToggle={onToggleDropdown} /> : null}
```

### Step 10c: Reduce eager lucide imports

Move icons used ONLY in NavDropdown / MobileDrawer to their respective files. Site-chrome.tsx keeps **only**: `Menu, Moon, Play, Sun, Volume2, VolumeX, X, MoreHorizontal` (visible primary actions).

```diff
  import {
-   Activity,
-   Clock,
-   HelpCircle,
-   ListOrdered,
    Menu,
    Moon,
    MoreHorizontal,
    Play,
-   Sparkles,
    Sun,
-   Trophy,
-   Users,
    Volume2,
    VolumeX,
    X,
-   type LucideIcon,
  } from "lucide-react";
```

`Activity, Clock, HelpCircle, ListOrdered, Sparkles, Trophy, Users, type LucideIcon` се местят в `NavDropdown.tsx` и `MobileDrawer.tsx`.

### Commit 10

```
perf(site-chrome): split MobileDrawer and NavDropdown to lazy chunks
```

---

## Stage 11 — Logo mark as `<Image priority>` (P2)

### Step 11a: Create LandingLogoMark component

В `apps/web/components/landing-experience.tsx` (или нов файл):

```tsx
function LandingLogoMark() {
  return (
    <span className="landing-logo-mark" aria-hidden="true">
      <Image
        src="/game-art/logo-landing-mark.webp"
        alt=""
        width={118}
        height={118}
        priority
        fetchPriority="high"
        sizes="118px"
      />
    </span>
  );
}
```

И import:
```tsx
import Image from "next/image";
```

### Step 11b: Update CSS

**File:** `apps/web/app/globals.css:1561–1572`

```diff
  .landing-logo-mark {
+   display: inline-grid;
+   place-items: center;
    width: 118px;
    aspect-ratio: 1;
    margin-bottom: 28px;
    border: 1px solid rgba(209, 154, 66, 0.38);
    border-radius: 34px;
-   background:
-     radial-gradient(circle, rgba(248, 236, 210, 0.12), transparent 62%),
-     image-set(url("/game-art/logo-landing-mark.webp") type("image/webp"), url("/game-art/logo-landing-mark.png") type("image/png")) center / contain no-repeat;
+   background: radial-gradient(circle, rgba(248, 236, 210, 0.12), transparent 62%);
    box-shadow: 0 0 52px rgba(209, 154, 66, 0.24), inset 0 1px rgba(255, 255, 255, 0.08);
    transform: rotate(-3deg);
+   overflow: hidden;
+ }
+
+ .landing-logo-mark img {
+   width: 100%;
+   height: 100%;
+   object-fit: contain;
  }
```

**Защо:** `<Image priority>` генерира `<link rel="preload" as="image" fetchpriority="high">` в HTML head. Browser discover-ва image-а **paralelно с HTML/CSS parse**, не след CSS background-image discovery. Likely improves LCP с 100–250ms.

### Commit 11

```
perf(landing): convert logo-mark from CSS background to Image priority for early LCP discovery
```

---

## Stage 12 — Quickstart drop IntersectionObserver (P2)

### Step 12a: Always-on connectors (no observer)

**File:** `apps/web/components/landing/QuickStartSection.tsx`

```diff
- export function QuickStartSection({ liveStats, lastWinner }: QuickStartSectionProps) {
-   const stepsRef = useRef<HTMLOListElement>(null);
-   const [revealed, setRevealed] = useState(false);
-
-   useEffect(() => {
-     const node = stepsRef.current;
-     if (!node || revealed) {
-       return;
-     }
-
-     const observer = new IntersectionObserver(
-       ([entry]) => {
-         if (entry?.isIntersecting) {
-           setRevealed(true);
-           observer.disconnect();
-         }
-       },
-       { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
-     );
-
-     observer.observe(node);
-     return () => observer.disconnect();
-   }, [revealed]);
-
+ export function QuickStartSection({ liveStats, lastWinner }: QuickStartSectionProps) {
    return (
      <section className="landing-quickstart" aria-label="Първа игра за 30 секунди">
        /* … */
-       <ol ref={stepsRef} className="quickstart-steps" data-revealed={revealed ? "true" : "false"}>
+       <ol className="quickstart-steps" data-revealed="true">
```

Тъй като Stage 6c вече добавя `content-visibility: auto` на parent, browser-ът автоматично defer-ва paint извън viewport. Когато section влезе в viewport, browser-ът paint-ва **already-running** keyframe animations (CSS scheduler handles timing). Не е нужен JS observer.

### Step 12b: Simplify connector animation начало

```diff
  .quickstart-connector {
    position: absolute;
    top: 46px;
    right: calc(-50% + 36px);
    left: calc(50% + 36px);
    z-index: 1;
    border-top: 2px dotted rgba(34, 22, 17, 0.28);
    opacity: 0;
    transform: scaleX(0.2);
    transform-origin: left center;
+   animation: quickstartConnectorIn 520ms ease forwards;
+   animation-delay: calc(var(--connector-index) * 120ms);
  }

- .quickstart-steps[data-revealed="true"] .quickstart-connector {
-   animation: quickstartConnectorIn 520ms ease forwards;
-   animation-delay: calc(var(--connector-index) * 120ms);
- }
```

Анимацията играе on-mount. Поради `content-visibility: auto`, не consume-ва CPU/GPU докато section не е visible.

### Commit 12

```
perf(landing): drop IntersectionObserver in QuickStartSection (content-visibility handles defer)
```

---

## Stage 13 — ResourceHints as server component (P2)

### Step 13a: Convert to server component с native links

**File:** `apps/web/components/resource-hints.tsx`

```diff
- "use client";
-
- import ReactDOM from "react-dom";
-
- export function ResourceHints({
-   images = [],
-   preconnect = [],
- }: {
-   images?: readonly string[];
-   preconnect?: readonly string[];
- }) {
-   for (const origin of preconnect) {
-     ReactDOM.preconnect(origin);
-   }
-
-   for (const image of images) {
-     ReactDOM.preload(image, { as: "image" });
-   }
-
-   return null;
- }
+ type PreloadImage = string | { href: string; media?: string; type?: string };
+
+ export function ResourceHints({
+   images = [],
+   preconnect = [],
+ }: {
+   images?: readonly PreloadImage[];
+   preconnect?: readonly string[];
+ }) {
+   return (
+     <>
+       {preconnect.map((href) => (
+         <link key={href} rel="preconnect" href={href} />
+       ))}
+       {images.map((image) => {
+         const href = typeof image === "string" ? image : image.href;
+         const media = typeof image === "string" ? undefined : image.media;
+         const type = typeof image === "string" ? "image/webp" : (image.type ?? "image/webp");
+         return (
+           <link
+             key={`${href}|${media ?? ""}`}
+             rel="preload"
+             as="image"
+             href={href}
+             type={type}
+             {...(media ? { media } : {})}
+           />
+         );
+       })}
+     </>
+   );
+ }
```

### Step 13b: Update LandingExperience to use media-scoped preloads

```diff
  <ResourceHints
    images={[
-     "/game-art/bg-landing-hero-composited.webp",
-     "/game-art/bg-landing-ambient-composited.webp",
-     "/game-art/mobile/bg-landing-hero-composited.webp",
-     "/game-art/mobile/bg-landing-ambient-composited.webp",
+     { href: "/game-art/bg-landing-hero-composited.webp", media: "(min-width: 761px)" },
+     { href: "/game-art/bg-landing-ambient-composited.webp", media: "(min-width: 761px)" },
+     { href: "/game-art/mobile/bg-landing-hero-composited.webp", media: "(max-width: 760px)" },
+     { href: "/game-art/mobile/bg-landing-ambient-composited.webp", media: "(max-width: 760px)" },
    ]}
  />
```

**Защо:**
- Browser-ът получава `<link rel="preload" as="image">` в HTML head **преди CSS parse** → discovery е по-ранно с 50–200ms.
- `media` атрибут → browser fetch-ва само relevant size за device → spares mobile bandwidth.
- Не ships JS bundle (server-only component).

### Step 13c: Verify layout.tsx ResourceHints преconnect все още работи

```diff
  // layout.tsx (no change needed, but verify)
  <ResourceHints preconnect={["https://cdn.discordapp.com", "https://lh3.googleusercontent.com"]} />
```

Това все още работи с новата implementation.

### Commit 13

```
perf(landing): convert ResourceHints to server component with media-scoped preload links
```

---

## Stage 14 — Generate imagen assets (P0 dependency)

### Step 14a: Run imagen for hero composited (desktop)

Used in Stage 2a above. Spec:
- **Path:** `apps/web/public/game-art/bg-landing-hero-composited.webp` (1920 × 1080)
- **PNG fallback:** `apps/web/public/game-art/bg-landing-hero-composited.png`
- **Prompt:** see Stage 2a

### Step 14b: Mobile variant (portrait)

- **Path:** `apps/web/public/game-art/mobile/bg-landing-hero-composited.webp` (760 × 1280)
- Same scene + composition adapted to portrait crop.

### Step 14c: Ambient composited (desktop)

Used in Stage 3a above.
- **Path:** `apps/web/public/game-art/bg-landing-ambient-composited.webp` (1920 × 1080)
- **PNG fallback:** `apps/web/public/game-art/bg-landing-ambient-composited.png`

### Step 14d: Ambient mobile variant

- **Path:** `apps/web/public/game-art/mobile/bg-landing-ambient-composited.webp` (760 × 1280)

### Commit 14

```
chore(art): generate composited hero and ambient backgrounds for landing
```

---

## Acceptance criteria

### Functional

1. `/` renders successfully when game-server е offline (graceful `null` stats, no hang)
2. CTA текст на game choice cards е consistent от SSR — без post-hydration flash
3. Hero card визуално идентичен (или leko по-clean без видим banding от множеството gradients)
4. Body ambient backdrop визуално идентичен
5. Theme toggle работи; визуално smooth crossfade във view-transition-capable browsers
6. Mobile drawer + nav dropdown работят (lazy-loaded chunks)
7. Cookie banner + welcome modal + feedback widget работят (lazy-loaded)
8. Quickstart steps + live stats + last winner cards работят
9. Service worker registration все още активен

### Performance

10. Lighthouse Performance score:
    - Pre-fix baseline (от current `audit-v3/before/`): record number
    - Post-fix target: **>85 на mobile, >95 на desktop**
11. Lighthouse Core Web Vitals:
    - **LCP < 2.0s** на mid-3G mobile profile
    - **FCP < 1.2s**
    - **CLS < 0.01**
    - **TBT < 200ms**
12. WebPageTest scoring:
    - First Byte: Grade A
    - Compress Images: Grade A
    - Cache Static Content: Grade A
13. INP measurements (Chrome DevTools Performance, mid-tier mobile throttling):
    - Theme toggle: **<50ms** (view-transition-eligible)
    - Game choice CTA click: **<100ms**
    - Nav dropdown open: **<150ms** (first time, due to lazy chunk; subsequent <50ms)
14. Bundle size:
    - Landing page JS gzipped: **<90 KB** (down from estimated ~120 KB)
    - SiteChrome eager chunk: **<30 KB**

### Regression

15. `pnpm regression` ✓
16. `pnpm typecheck` ✓
17. `pnpm build` ✓
18. Existing tests pass (`pnpm --filter @werewolf/web test`)

---

## Verification

### Lighthouse runs

```bash
pnpm build
pnpm start
# In another terminal:
npx lighthouse http://localhost:3000 --output html --output-path audit-v3/after/landing-perf-baseline.html --preset desktop
npx lighthouse http://localhost:3000 --output html --output-path audit-v3/after/landing-perf-mobile.html --form-factor mobile --throttling-method devtools
```

Запиши screenshots на Lighthouse score panels в `audit-v3/after/landing-perf/`.

### Chrome DevTools Performance recording

1. Open DevTools → Performance panel
2. CPU throttle: **4× slowdown** (mid-range mobile)
3. Network: **Slow 3G**
4. Click Record → reload page → wait FCP → click theme toggle → click game choice card → stop record
5. Look for:
   - Long tasks (>50ms) — should be **0** post-hydration
   - Recalc Style events — should be **bounded** by view-transition during theme toggle
   - Paint events — flatter timeline, no continuous painting of `quickstart-live-count`
6. Save trace JSON → `audit-v3/after/landing-perf/trace-post-fix.json`

### React DevTools Profiler

1. Profile session: hover over a game choice card, click theme toggle, click game choice card
2. Expected re-renders:
   - `SiteChrome` ✓ (on theme toggle)
   - `LandingExperience` ✗ (server component, no re-render)
   - `ModeChoiceCards` ✓ (once on initial mount, then 0×)
   - `QuickStartSection` ✓ (once on Suspense resolve)

### Manual visual QA

1. Desktop 1920×1080 dark theme — hero card looks identical to before
2. Desktop 1920×1080 light theme — same
3. Mobile 390×844 dark — same
4. Mobile 390×844 light — same
5. Theme toggle 5×rapid — no flicker; view-transition crossfade smooth
6. Scroll from top to footer 3× — frame rate steady at 60fps (was dropping with body filter)
7. Hover over game choice cards on desktop — aura blur ramps up on hover
8. Tap a game choice card on mobile — no hover state (touch device); fast navigation

### Screenshots в `audit-v3/after/landing-perf/`

1. `landing-desktop-dark.png` — hero card + quickstart, dark theme
2. `landing-desktop-light.png` — same, light theme
3. `landing-mobile-dark.png` — 390×844 portrait
4. `landing-mobile-light.png`
5. `lighthouse-mobile.png` — Lighthouse mobile run screenshot
6. `lighthouse-desktop.png` — Lighthouse desktop run screenshot
7. `devtools-perf-trace.png` — DevTools Performance recording
8. `network-waterfall.png` — Network panel showing image preloads firing early (composited WebPs)
9. `bundle-analyzer.png` — Next.js bundle analyzer output

---

## Не пипай

- Game-server `/stats` HTTP endpoint
- Better-auth `useSession` / `authClient` internals
- Other pages — privacy, terms, status, faq, tutorial, lobby, play, role-detail все остават както са
- Imagen prompts за други страници — само landing assets са в scope
- Service worker registration logic
- WelcomeModal / CookieBanner / FeedbackWidget internal logic — само се lazy-load-ват
- Theme storage key / `werewolf-theme` localStorage
- `--art-landing-dual` CSS variable се **запазва** (other pages може все още да го ползват — провери чрез grep)
- `--art-landing-ambient` запазва се аналогично за други shells

---

## Commit summary

14 atomic English commits on `main`:

1. `perf(landing): timeout/revalidate stats fetch + stream below the fold via Suspense`
2. `perf(landing): flatten hero card backgrounds into single pre-composited WebP`
3. `perf(landing): flatten body ambient backdrop into single composited WebP, drop filter pass`
4. `perf(landing): defer card aura blur to hover state only`
5. `perf(landing): theme toggle via view-transition + migrate hero to CSS vars for narrower recalc`
6. `perf(landing): swap quickstart digit animation to opacity pulse + add content-visibility auto`
7. `perf(landing): enable prefetch on secondary links and preload desktop background variants`
8. `perf(landing): pass SSR session to ModeChoiceCards to eliminate post-hydration CTA flicker`
9. `perf(landing): dynamic-import non-critical widgets (Feedback, Welcome, CookieBanner)`
10. `perf(site-chrome): split MobileDrawer and NavDropdown to lazy chunks`
11. `perf(landing): convert logo-mark from CSS background to Image priority for early LCP discovery`
12. `perf(landing): drop IntersectionObserver in QuickStartSection (content-visibility handles defer)`
13. `perf(landing): convert ResourceHints to server component with media-scoped preload links`
14. `chore(art): generate composited hero and ambient backgrounds for landing`

**Recommended ordering note:** Commit 14 (imagen) трябва да landне **преди** Commits 2 + 3 (които използват новите WebP-ите). Останалите са независими и могат да се land-нат в произволен ред. P0 пак P1 → P2 е препоръчвана последователност за immediate visual + INP improvement.

PR title (if not direct push): `perf: landing page overhaul — INP, LCP, TTFB, bundle size`

---

(End of prompt)
