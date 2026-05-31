# Codex prompt — SEO, per-route OG, FAQ page, и code review fixes

Един голям implementation PR покриващ:
1. **4 code review findings** от ChatGPT high-reasoning analysis
2. **Per-route OG meta** + Twitter cards + JSON-LD structured data
3. **`/faq` страница** с уникален "library card catalog" cinematic theme
4. **SEO infrastructure**: sitemap.xml, robots.txt, canonical URLs
5. **Core Web Vitals полировка**: preload hints, font display, image sizes

**10 нови imagen assets** (9 OG images + 1 FAQ hero). ~12 atomic English commits.

---

## Stage 0 — Code review findings (embedded analysis от ChatGPT pre-pass)

Преди да започнеш SEO работата, fix-вай тези 4 проблема, които ChatGPT намери при четенето на recent merge-ове.

### CR-001 — TutorialFlipbook initial render flash

**File:** `apps/web/components/tutorial/TutorialFlipbook.tsx:20,22-35`

**Problem:** `useState(1)` initializes slide to 1, then a mount-time `useEffect` restores from URL or localStorage. Между двата render-а потребителят вижда briefly Slide 1, after which content jumps to actual slide. Visible flicker за директни links като `/tutorial?step=4`.

**Fix:** lazy initial state using URL hint (synchronous), then effect only for localStorage fallback:

```tsx
function readInitialSlide(searchParams: ReadonlyURLSearchParams): number {
  const fromUrl = Number(searchParams.get("step"));
  if (Number.isFinite(fromUrl) && fromUrl >= 1 && fromUrl <= TOTAL_SLIDES) {
    return fromUrl;
  }
  return 1;
}

export function TutorialFlipbook() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Synchronous read — no flash for URL-driven entry.
  const [current, setCurrent] = useState(() => readInitialSlide(searchParams));

  // Restore from localStorage ONLY if URL didn't specify a step.
  useEffect(() => {
    if (searchParams.get("step")) return;
    const stored = Number(window.localStorage.getItem(STORAGE_KEY_LAST_SLIDE));
    if (Number.isFinite(stored) && stored >= 1 && stored <= TOTAL_SLIDES) {
      setCurrent(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ...rest unchanged
}
```

**Acceptance:** Open `/tutorial?step=4` → page renders directly at Slide 4, no visible jump from Slide 1.

---

### CR-002 — TutorialFlipbook URL replace races with restore

**File:** `apps/web/components/tutorial/TutorialFlipbook.tsx:37-47`

**Problem:** На mount second effect веднага вика `router.replace("/tutorial?step=1")`, презаписвайки URL-а, даже когато потребителят е дошъл с `?step=4`. После първият effect restore-ва state-а към 4, и втория effect отново пише URL към `?step=4`. Двойно URL-write на mount.

**Fix:** условие в URL-write effect-а да skip-не докато initial mount restore не е завършил:

```tsx
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  // ... mount restore logic
  setHydrated(true);
}, []);

useEffect(() => {
  if (!hydrated) return;
  const params = new URLSearchParams(searchParams.toString());
  params.set("step", String(current));
  router.replace(`/tutorial?${params.toString()}`, { scroll: false });
  window.localStorage.setItem(STORAGE_KEY_LAST_SLIDE, String(current));
  if (current === TOTAL_SLIDES) {
    window.localStorage.setItem(STORAGE_KEY_COMPLETED, "1");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [current, hydrated, router]);
```

Alternatively, ако приемеш CR-001 fix-а с lazy init, проблемът отпада автоматично — `current` още от началото има правилната стойност. Choose whichever is cleaner. **Препоръчвам combo: CR-001 fix sufficient → CR-002 redundant**.

**Acceptance:** Mount при `/tutorial?step=4` → URL остава `?step=4` (no replace flicker visible в browser DevTools Network/Console).

---

### CR-003 — CookieBanner CLS (cumulative layout shift)

**File:** `apps/web/components/CookieBanner.tsx:9,11-15`

**Problem:** `useState(false)` → банерът е невидим в SSR + initial hydration. Mount-time effect чете localStorage → ако няма consent, `setVisible(true)`. Това е post-hydration state change, който премества content (banner appears at bottom, pushes layout up). Поне 1px CLS impact.

**Fix:** SSR-safe initial state с known-bottom-anchored container, не layout-disturbing:

Option 1 (preferred): The banner is fixed-position bottom. Use CSS to allocate space only when visible, OR keep banner always rendered but with CSS-driven hidden state:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const [state, setState] = useState<"unknown" | "visible" | "hidden">("unknown");

  useEffect(() => {
    setState(window.localStorage.getItem(STORAGE_KEY) ? "hidden" : "visible");
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setState("hidden");
  }

  // SSR + first paint: render nothing visible to avoid hydration mismatch.
  // After mount: show or stay hidden.
  if (state !== "visible") return null;

  return (
    <aside className="cookie-banner" role="dialog" aria-label="Бисквитки">
      <p>
        Използваме само необходими бисквитки за вход и сесия. Прочети{" "}
        <Link href="/privacy">политиката за поверителност</Link>.
      </p>
      <button type="button" className="btn btn-primary" onClick={accept}>
        Разбрах
      </button>
    </aside>
  );
}
```

И в CSS-а гарантирай `position: fixed; bottom: 0;` за `.cookie-banner` (or whatever it currently is) — fixed positioning не contribute-ва към CLS дори при динамично показване.

**Acceptance:** Open homepage in DevTools → check Performance tab. CLS metric остава < 0.05 (cookie banner appears via fixed positioning, не pushes content).

---

### CR-004 — `metadataBase` may produce `http://localhost:3000` OG URLs in production

**File:** `apps/web/app/layout.tsx:24`

**Problem:**

```ts
metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
```

Ако в production `NEXT_PUBLIC_APP_URL` и `BETTER_AUTH_URL` са missing → metadataBase = `http://localhost:3000` → OG image URLs резолват до `http://localhost:3000/game-art/og-preview.png` → Facebook/Twitter scrapers fetch-ват `localhost` от своя infrastructure → fail. Социалните preview-та чупят.

Това корелира с **DEPLOY-001** от audit-а (Docker compose missing `NEXT_PUBLIC_APP_URL`). DEPLOY-001 fix-ва env vars; CR-004 fix-ва fallback behavior — defense in depth.

**Fix:** Hard error в production когато env vars липсват:

```ts
function resolveMetadataBase(): URL {
  const candidate = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;

  if (process.env.NODE_ENV === "production" && !candidate) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL или BETTER_AUTH_URL трябва да са зададени в production среда. Иначе social media preview-та и абсолютните URLs ще сочат към localhost.",
    );
  }

  return new URL(candidate ?? "http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  // ... rest
};
```

**Acceptance:** Build на production env без `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` → fails с clear Bulgarian error. Local dev/test остава unchanged.

---

## Pre-decisions (no Codex clarifying questions needed)

- **OG image dimensions:** All 1200 × 630 (Twitter recommended 1.91:1, also works for Facebook/LinkedIn).
- **FAQ page theme:** "Library card catalog" (drawer-based, accordion expand).
- **JSON-LD strategy:** Schema.org types per route — `WebSite` + `Organization` + `SoftwareApplication` on homepage, `Game` on family pages, `HowTo` on /tutorial, `FAQPage` on /faq.
- **Sitemap priority:** Homepage 1.0, family pages 0.9, tutorial 0.8, rules 0.8, FAQ 0.7, leaderboard/history/achievements 0.5, account/privacy/terms 0.3.
- **Sitemap changefreq:** daily for leaderboard/history (live data), monthly for static content.
- **Robots:** Allow all crawlers on public routes. Disallow `/api/`, `/account`, `/play/`, `/lobby/`, `/forgot-password`, `/reset-password`, `/verify-email`.
- **Canonical URL:** Auto-set per route via metadata's `alternates.canonical`.
- **Branch:** `feat/seo-faq-polish`.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4). Read `AGENTS.md`, `CLAUDE.md`, `docs/regression-audit/REPORT.md` first.

Invariants:
- All commit messages in **English** (project convention).
- All user-facing copy in **Bulgarian** Cyrillic.
- Use `/imagen` (gpt-image-2) for 10 new art assets. `pnpm optimize:assets` produces WebP variants.
- No new npm dependencies.
- Branch: `feat/seo-faq-polish`.

This PR covers four interconnected initiatives:
1. **Code review fixes** (4 findings from ChatGPT pre-pass — see Stage 0 section above; treat as Stage 1 of execution).
2. **Per-route OG meta + Twitter cards + JSON-LD** for social sharing + search engine richness.
3. **`/faq` page** — new cinematic theme.
4. **SEO infrastructure** — sitemap.xml, robots.txt, canonical URLs, Core Web Vitals полировки.

---

## Stage 1 — Code review fixes (4 findings)

Implement CR-001 through CR-004 exactly as specified in Stage 0 above. One commit per finding:

1. `fix(tutorial): eliminate slide hydration flash via lazy initial state (CR-001)`
2. `fix(tutorial): gate URL replace effect on hydration completion (CR-002)` — skip if CR-001 fix makes it redundant
3. `fix(ui): cookie banner three-state to avoid CLS on mount (CR-003)`
4. `fix(metadata): fail-fast on missing APP_URL in production (CR-004)`

After Stage 1, run `pnpm test` + `pnpm visual` to verify no regressions in the tutorial visual baseline.

---

## Stage 2 — Generate 10 art assets via `/imagen`

All OG images: 1200 × 630 pixels (1.91:1 ratio). Each prompt explicitly forbids text/letters/symbols (overlay copy via HTML and OG image rendering doesn't include text — keeps visuals language-agnostic).

After all generations, run `pnpm optimize:assets` to produce WebP variants.

### Asset 1: Homepage OG — dual world

**Path:** `apps/web/public/game-art/og/og-home.png`

```
A painterly cinematic banner illustration showing a split-frame
composition: on the left half, a moonlit Bulgarian village with
a forested hill and a wooden tavern silhouetted against starry
sky; on the right half, a rain-slicked dark city street with
brass street lamps and shuttered shop fronts. Where the two
halves meet, a faint diagonal seam of mist blurs them together.
A pair of weathered playing cards lies face-down in the
foreground center, bridging both worlds. Mood: dual mystery,
both folkloric and noir. Oil-paint style with visible brushwork,
deep amber and slate-blue palette, dramatic vignetting at the
edges. No text, no letters, no numbers, no symbols anywhere.
Aspect ratio 1.91:1 (wide horizontal).
```

### Asset 2: Werewolf family OG

**Path:** `apps/web/public/game-art/og/og-werewolf.png`

```
A painterly cinematic banner of a moonlit Bulgarian mountain
village seen from a slight elevated angle. Wooden houses with
warm window-light clustered along a winding cobblestone path,
tall pines silhouetted against a starry indigo sky. In the
middle distance, two glowing eyes peer between tree trunks,
suggesting a wolf's presence without being obvious. Foreground:
a small hand-carved wooden cup of mulled wine resting on a
weathered wooden fence post. Mood: folkloric, secretive,
ancient. Oil-paint style, deep blue-indigo with warm ember
window glow, atmospheric haze. No text, no letters, no numbers,
no symbols anywhere. Aspect ratio 1.91:1.
```

### Asset 3: Mafia family OG

**Path:** `apps/web/public/game-art/og/og-mafia.png`

```
A painterly cinematic banner of a rain-soaked city street at
night, viewed from an alley mouth. Wet cobblestones reflect
warm amber gas-lamp light. In the middle distance, three
silhouetted figures stand under a single overhead lantern outside
a closed barber shop with a brass nameplate (no text on it).
A discarded fedora lies near a manhole cover in the foreground.
Mood: 1940s film noir, suspicion, the moment after something
has happened. Oil-paint style, rain-streaked atmosphere, deep
teal-green and amber palette, dramatic chiaroscuro. No text, no
letters, no numbers, no symbols anywhere. Aspect ratio 1.91:1.
```

### Asset 4: Tutorial OG

**Path:** `apps/web/public/game-art/og/og-tutorial.png`

```
A painterly cinematic banner of a candlelit oak study table
covered with the artifacts of a story being prepared: an open
leather-bound book, a small handheld mirror, a pewter mug, a
quill resting in an inkwell, and six face-down playing cards
fanned at the edge. Soft amber candlelight from the upper right
casts long warm shadows. Mood: the patient teacher, the moment
before the first lesson. Oil-paint style, warm cream and amber
palette, atmospheric depth, vignetted corners. No text, no
letters, no numbers, no symbols anywhere. Aspect ratio 1.91:1.
```

### Asset 5: Achievements OG

**Path:** `apps/web/public/game-art/og/og-achievements.png`

```
A painterly cinematic banner of a darkly-lit display wall of
brass plaques mounted on aged oak paneling. Soft directional
lighting from the upper left creates warm metallic highlights
across the plaques and rich shadows below. Three of the plaques
catch the light more brightly than others (representing
unlocked achievements vs locked). Decorative laurel branches
flank the central plaque group. Mood: hall of honor, accumulated
victories. Oil-paint style, warm gold and umber palette. No
text, no letters, no numbers, no engravings, no symbols anywhere
on the plaques or wall. Aspect ratio 1.91:1.
```

### Asset 6: History OG

**Path:** `apps/web/public/game-art/og/og-history.png`

```
A painterly cinematic banner of a detective's evidence cork
board mounted on a dim study wall, photographed slightly
angled. Several blank manila case-file cards are pinned to the
board with red and brass pushpins, some connected by thin red
twine. A brass desk lamp throws warm directional light from the
lower left, casting strong shadows across the corkboard texture.
Mood: archive, investigation, accumulated story. Oil-paint
style, warm brown and amber palette with brass accents. No
text, no letters, no numbers, no readable markings on the
cards. Aspect ratio 1.91:1.
```

### Asset 7: Leaderboard OG

**Path:** `apps/web/public/game-art/og/og-leaderboard.png`

```
A painterly cinematic banner of a vintage interwar Bulgarian
newspaper masthead lying on a dark wooden table, flanked by a
brass typewriter on the left and a stack of older issues on the
right. A half-empty porcelain coffee cup with steam rises in
the upper right. The newspaper itself is angled toward the
viewer but the headline area is rendered as abstract halftone-
dot texture (NOT readable text). Mood: weekly issue, accumulated
record, the table's collective memory. Oil-paint style with
intentional halftone-dot suggestion, sepia cream and warm brown
palette. No readable text, no letters, no numbers, no symbols
anywhere — even the newspaper area must be visual texture only.
Aspect ratio 1.91:1.
```

### Asset 8: Sign-in OG

**Path:** `apps/web/public/game-art/og/og-sign-in.png`

```
A painterly cinematic banner viewed straight down onto an oak
tavern table at twilight. Six face-down playing cards arranged
in a wide fan at center, a brass candlestick with flickering
flame at the upper left corner, a half-finished glass of dark
red wine at the lower right. Two weathered hands reach in from
opposite edges, one about to touch a card, the other holding a
brass key. Mood: the moment of choosing to sit at the table,
ceremony of entry. Oil-paint style, warm amber and ember palette
with deep wood-brown surface, vignetted corners. No text, no
letters, no numbers, no symbols anywhere on the cards or
surroundings. Aspect ratio 1.91:1.
```

### Asset 9: FAQ OG

**Path:** `apps/web/public/game-art/og/og-faq.png`

```
A painterly cinematic banner of an old library card catalog
cabinet, photographed at a slight angle. Multiple small wooden
drawers with brass label holders and pull-rings, arranged in a
grid. One drawer is partially pulled open, revealing a stack of
blank index cards inside. A brass desk lamp glows warmly on the
upper left, casting golden light across the wooden cabinet face.
Mood: organized knowledge, ready answers, the moment before
learning. Oil-paint style, warm umber and brass palette with
deep wood tones. No text, no letters, no numbers, no readable
labels on the drawers or cards. Aspect ratio 1.91:1.
```

### Asset 10: FAQ page hero art (portrait)

**Path:** `apps/web/public/game-art/faq/library-catalog-hero.png`

```
A painterly cinematic close-up of an antique brass-fitted oak
library card catalog drawer pulled fully open, viewed from a
slight three-quarter angle. The drawer is filled with cream-
colored index cards arranged densely, with a single card
slightly lifted between the user's two fingers as if being
read. Warm directional candlelight from the upper left casts
soft golden highlights across the wood and brass; deep shadows
collect in the drawer's interior. Mood: discovery, the answer
you are about to find. Oil-paint style with rich detailed
metalwork, warm umber and brass palette, vignetted corners. No
text, no letters, no numbers, no readable markings on the cards
or drawer. Aspect ratio 3:4 (vertical portrait).
```

### Post-generation verification

After all 10 assets exist:
```bash
ls apps/web/public/game-art/og/*.png  # should list 8 OG files
ls apps/web/public/game-art/faq/*.png # should list 1 FAQ file
pnpm optimize:assets
ls apps/web/public/game-art/og/*.webp # WebP variants created
```

If any asset has stray visible text/numbers/symbols, regenerate that single asset with stronger emphasis on the "no text" clauses.

---

## Stage 3 — Per-route OG meta + Twitter cards + JSON-LD structured data

### Strategy

Each major route gets its own `metadata` export with:
- Unique `title` (BG, max 60 chars for SERP truncation safety)
- Unique `description` (BG, ~155 chars sweet spot)
- Per-route OG image (1200×630 generated asset)
- Twitter card `summary_large_image` with same image
- `alternates.canonical` to its own absolute URL
- JSON-LD structured data via `<script type="application/ld+json">` injected per-page

### Site-wide constants

Create `apps/web/lib/seo.ts`:

```ts
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
export const SITE_NAME = "Върколак и Мафия";
export const SITE_TAGLINE = "Социална игра на сенки";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export interface JsonLdScript {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

export function jsonLdScriptTag(data: JsonLdScript): string {
  // Render server-side as JSON; trust input is structured (no XSS risk from user content).
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
```

### Route-by-route metadata

For each route below, update the page's `export const metadata` and add JSON-LD via a `<script>` tag rendered in the page body.

#### Homepage `/` — apps/web/app/page.tsx

```ts
import type { Metadata } from "next";
import { absoluteUrl, jsonLdScriptTag, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Върколак и Мафия — социална игра на сенки",
  description: "Онлайн Върколак и Мафия с тайни роли, частни стаи, авторитетен игрови сървър и истории, които се помнят между приятели.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Върколак и Мафия — социална игра на сенки",
    description: "Тайни роли, частни стаи, една вечер на масата. Играй с приятели без бот игра.",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: "/game-art/og/og-home.png", width: 1200, height: 630, alt: "Върколак и Мафия — нощно село и нощен град" }],
    locale: "bg_BG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Върколак и Мафия — социална игра на сенки",
    description: "Тайни роли, частни стаи, една вечер на масата.",
    images: ["/game-art/og/og-home.png"],
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": ["WebSite", "SoftwareApplication"],
  name: SITE_NAME,
  alternateName: "Werewolf and Mafia BG",
  url: SITE_URL,
  description: "Онлайн социална игра с тайни роли. Поддържа Върколак (фолклорен вариант) и Мафия (ноар вариант).",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  inLanguage: "bg-BG",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BGN",
    availability: "https://schema.org/InStock",
  },
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptTag(homeJsonLd) }}
      />
      {/* existing homepage JSX */}
    </>
  );
}
```

#### Werewolf family `/werewolf` — apps/web/app/werewolf/page.tsx

```ts
export const metadata: Metadata = {
  title: "Върколак — фолклорна нощ на масата | Върколак и Мафия",
  description: "Български фолклорен Върколак с тайни роли, нощно гласуване, разказвач или автоматичен сървър. Играй частни стаи с приятели.",
  alternates: { canonical: absoluteUrl("/werewolf") },
  openGraph: {
    title: "Върколак — фолклорна нощ на масата",
    description: "Тайни роли, лунна нощ, селото срещу върколаците.",
    url: absoluteUrl("/werewolf"),
    images: [{ url: "/game-art/og/og-werewolf.png", width: 1200, height: 630, alt: "Лунна нощ над българско село" }],
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Върколак — фолклорна нощ на масата",
    description: "Тайни роли, лунна нощ, селото срещу върколаците.",
    images: ["/game-art/og/og-werewolf.png"],
  },
};

const werewolfJsonLd = {
  "@context": "https://schema.org",
  "@type": "Game",
  name: "Върколак",
  alternateName: "Werewolf BG",
  description: "Фолклорен Върколак с тайни роли и нощно гласуване. Поддържа 5-30 играчи.",
  url: absoluteUrl("/werewolf"),
  genre: "Social deduction",
  inLanguage: "bg-BG",
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 5, maxValue: 30 },
  playMode: "MultiPlayer",
};
```

#### Mafia family `/mafia` — same pattern with crime-noir description and og-mafia.png.

```ts
export const metadata: Metadata = {
  title: "Мафия — криминална нощ в града | Върколак и Мафия",
  description: "Криминална Мафия с алибита, Дон, Шериф и оцеляване в подозрителен град. Частни стаи без реклами.",
  alternates: { canonical: absoluteUrl("/mafia") },
  openGraph: {
    title: "Мафия — криминална нощ в града",
    description: "Алибита, Шериф, Дон. Кой говори истината?",
    url: absoluteUrl("/mafia"),
    images: [{ url: "/game-art/og/og-mafia.png", width: 1200, height: 630, alt: "Дъждовна градска улица под фенер" }],
    type: "article",
  },
  twitter: { /* same */ },
};

const mafiaJsonLd = { /* analogous to werewolf */ };
```

#### Tutorial `/tutorial` — apps/web/app/tutorial/page.tsx

```ts
export const metadata: Metadata = {
  title: "Първа игра — наръчник в шест сцени | Върколак и Мафия",
  description: "Кинематографичен наръчник за първа игра след вход. Шест сцени, един интерактивен момент, готов си за първата стая.",
  alternates: { canonical: absoluteUrl("/tutorial") },
  openGraph: {
    title: "Първа игра — наръчник в шест сцени",
    description: "Една вечер, шест сцени. Научи масата преди първата нощ.",
    url: absoluteUrl("/tutorial"),
    images: [{ url: "/game-art/og/og-tutorial.png", width: 1200, height: 630, alt: "Маса с книга, свещ и карти" }],
    type: "article",
  },
  twitter: { /* same */ },
};

const tutorialJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Как започва добра игра на Върколак или Мафия",
  description: "Шест сцени, които те водят през една вечер на масата.",
  totalTime: "PT15M",
  inLanguage: "bg-BG",
  step: [
    { "@type": "HowToStep", name: "Преди нощта", text: "Седем-осем приятели сядат на маса. Споделят код, влизат в стая.", position: 1 },
    { "@type": "HowToStep", name: "Нощта", text: "Активните роли действат тайно — Върколаци избират цел, Лечител пази един.", position: 2 },
    { "@type": "HowToStep", name: "Денят", text: "Денят се събужда. Един от вас вече го няма. Денят е за четене на масата.", position: 3 },
    { "@type": "HowToStep", name: "Гласът", text: "Гласът оставя следа. Записва се кой кого посочи и кога е сменил мнение.", position: 4 },
    { "@type": "HowToStep", name: "Развръзката", text: "Една роля се разкрива, една група научава дали играта продължава.", position: 5 },
    { "@type": "HowToStep", name: "Готов?", text: "Шест сцени, една вечер. Сега си готов да отвориш първа стая.", position: 6 },
  ],
};
```

#### Roles `/roles`, `/werewolf/roles`, `/mafia/roles` — three pages, each with unique meta + family-specific copy

Use og-werewolf for /werewolf/roles, og-mafia for /mafia/roles, og-home for combined /roles. Add JSON-LD `ItemList` of role names.

#### Rules `/werewolf/rules`, `/mafia/rules` — similar pattern

JSON-LD `HowTo` describing phases (Лоби → Нощ → Ден → Глас → Развръзка).

#### Sign-in `/sign-in` — apps/web/app/sign-in/page.tsx

Use og-sign-in. Description: "Влез с Google, Discord или имейл. Един профил пази историята и поканите."

#### History `/history`, Leaderboard `/leaderboard`, Achievements `/achievements` — three pages

Each with its OG image (og-history, og-leaderboard, og-achievements). Static descriptions (no per-user dynamic).

#### Privacy `/privacy`, Terms `/terms` — minimal meta, low priority

Use og-home as fallback. `robots: "noindex, follow"` — these are legal pages, no SEO juice needed.

#### Account `/account` — `robots: "noindex, nofollow"`. Personal page; should never be in search results.

#### Verify-email, Forgot-password, Reset-password — same: `robots: "noindex, nofollow"`.

### Per-page JSON-LD injection helper

Create a tiny helper `apps/web/components/JsonLd.tsx`:

```tsx
import { jsonLdScriptTag, type JsonLdScript } from "@/lib/seo";

export function JsonLd({ data }: { data: JsonLdScript }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScriptTag(data) }}
    />
  );
}
```

Use as:
```tsx
import { JsonLd } from "@/components/JsonLd";
// ...
<JsonLd data={homeJsonLd} />
```

---

## Stage 4 — `/faq` page with library card catalog theme

### Concept

Cinematic library card catalog vibe. The page itself looks like a wooden cabinet with multiple drawers (one per FAQ section). Each drawer has its own accordion expansion. The hero art (Asset 10) sits at the top.

### Categories + Questions (15 questions total, prepare in BG)

Pre-write the 15 questions and answers in this file. Codex translates them into the JSX exactly as written.

#### 1. Геймплей (5 questions)

**Q1: Каква е разликата между Върколак и Мафия?**
> Двете игри ползват едни и същи механики на тайно гласуване и нощни действия. Върколак върви по фолклорен сценарий — лунна нощ, селяни, върколаци, гадатели. Мафия е градски ноар — Дон, Комисар, алибита и подозрение по улицата. Различен tone, същия инстинкт за лъжа и оцеляване.

**Q2: С колко души се играе?**
> Минимум 5, оптимално 8-12. Поддържаме до 30 в една стая. За първа игра препоръчваме 8 души — достатъчно за интересна динамика, но не толкова много, че да се изгубите в обсъжданията.

**Q3: Колко трае една игра?**
> Една стандартна стая на 8-10 души приключва за 15-25 минути. С повече играчи и опитни групи — 30-40 минути. На живо може да отнеме повече, защото няма таймер върху обсъжданията.

**Q4: Мога ли да играя сам?**
> Не. Това е социална игра — нужни са поне 5 души. Препоръчваме покана към група приятели или приобщаване към публична стая.

**Q5: Какво е "паритет" и кога приключва играта?**
> Селяните печелят, ако елиминират всички Върколаци/Вампири. Върколаците печелят, ако техният брой стане равен или по-голям от живите Селяни — този момент се нарича "паритет". Същото правило важи за Вампири и Мафия.

#### 2. Профил и достъп (4 questions)

**Q6: Защо ми трябва акаунт?**
> Акаунтът пази историята, постиженията и поканите ти. Без него не можем да съхраним кои стаи си посетил или какви победи си натрупал. Освен това спира bot-овете и спама в публичните стаи.

**Q7: Мога ли да играя без акаунт?**
> На този момент — не. Преди публичното пускане поддържахме временна "anonymous" идентичност, но за стабилност и за защита от злоупотреби, влизането е задължително. Можеш да влезеш с Google, Discord или имейл за под 30 секунди.

**Q8: Как да изтрия профила си?**
> Отиди в "Моят профил" (от менюто горе вдясно), долу има секция "Изтрий профила". Изтриването е окончателно. Имената от твоите игри ще бъдат заменени с "Изтрит играч", за да остане честна история на масата, но всички лични данни и постижения изчезват.

**Q9: Загубих си паролата. Какво да направя?**
> На страницата за вход кликни "Забравена парола?". Въведи имейла си — изпращаме линк за нова парола, валиден за един час. Ако не получаваш писмото, провери в "Спам" / "Промоции".

#### 3. Технически (4 questions)

**Q10: На какви устройства работи играта?**
> Браузър на всяко устройство — Windows, Mac, Android, iOS. Препоръчваме съвременен браузър (Chrome, Firefox, Safari, Edge). За мобилно играта работи добре, но за стая на живо с 8+ души настолен компютър или таблет дава по-комфортно изживяване.

**Q11: Защо губя връзка по средата на играта?**
> Това обикновено е мрежов проблем, не на играта. Сървърът пази твоя state — при reconnect ще се върнеш в същата фаза с твоята роля. Ако често прекъсваш, провери Wi-Fi сигнала или превключи на 4G.

**Q12: Защо не чувам звук?**
> По подразбиране звукът е изключен (заради browser autoplay policy). Кликни иконата с високоговорителя в горната дясна част на навигацията — звукът се включва от следващата фаза нататък.

**Q13: Играта работи ли офлайн?**
> Отчасти — менюто и правилата се зареждат от cache, ако вече си посетил сайта. Но играта изисква активна интернет връзка за свързване със сървъра.

#### 4. Поверителност и контакт (2 questions)

**Q14: Какви данни събирате за мен?**
> Имейл, име на масата, OAuth ID (ако влизаш с Google/Discord), профилна снимка от OAuth, игрова история и постижения. Не събираме телефон, адрес, банкови данни. Прочети пълната <Link href="/privacy">политика за поверителност</Link>.

**Q15: Как да докладвам бъг или нарушение?**
> За технически бъг — ползвай малкия плаващ бутон долу вдясно ("Дай ни бележка"). За нарушение или съмнително поведение — отиди на <Link href="/report">/report</Link>. Преглеждаме сигнали в рамките на 48 часа.

### Implementation

**File:** `apps/web/app/faq/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { FaqClient } from "@/components/faq/FaqClient";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Често задавани въпроси | Върколак и Мафия",
  description: "Отговори за геймплея, профила, техническите детайли и поверителността на Върколак и Мафия.",
  alternates: { canonical: absoluteUrl("/faq") },
  openGraph: {
    title: "Често задавани въпроси",
    description: "Геймплей, профил, техника, поверителност — отговорите на масата.",
    url: absoluteUrl("/faq"),
    images: [{ url: "/game-art/og/og-faq.png", width: 1200, height: 630, alt: "Стар библиотечен каталог" }],
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Често задавани въпроси | Върколак и Мафия",
    description: "Геймплей, профил, техника, поверителност.",
    images: ["/game-art/og/og-faq.png"],
  },
};

const FAQ_DATA = [
  // ... (copy from "Categories + Questions" section above)
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_DATA.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <main className="shell faq-shell">
      <JsonLd data={faqJsonLd} />
      <FaqClient items={FAQ_DATA} />
    </main>
  );
}
```

**File:** `apps/web/components/faq/FaqClient.tsx`

Cinematic library card catalog UI. Hero art at top + category sections, each rendered as a wooden drawer with the questions inside.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

interface FaqItem {
  question: string;
  answer: React.ReactNode;
  category: "gameplay" | "account" | "tech" | "privacy";
}

const CATEGORY_LABELS: Record<FaqItem["category"], string> = {
  gameplay: "Геймплей",
  account: "Профил и достъп",
  tech: "Технически",
  privacy: "Поверителност и контакт",
};

export function FaqClient({ items }: { items: ReadonlyArray<FaqItem> }) {
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const grouped = items.reduce((acc, item, index) => {
    const list = acc.get(item.category) ?? [];
    list.push({ item, index });
    acc.set(item.category, list);
    return acc;
  }, new Map<FaqItem["category"], Array<{ item: FaqItem; index: number }>>());

  return (
    <section className="faq-stage">
      <figure className="faq-hero-art" aria-hidden />

      <article className="faq-cabinet">
        <header className="faq-head">
          <p className="faq-kicker">библиотека на масата</p>
          <h1>Често задавани въпроси.</h1>
          <p className="faq-subtitle">
            Шкаф с малки чекмеджета. Всяко с по една карта — отвори, прочети, върни обратно.
          </p>
        </header>

        {Array.from(grouped.entries()).map(([category, entries]) => (
          <section key={category} className="faq-drawer-row">
            <h2 className="faq-drawer-label">{CATEGORY_LABELS[category]}</h2>
            <div className="faq-drawer-stack">
              {entries.map(({ item, index }) => {
                const isOpen = openIds.has(index);
                return (
                  <article key={index} className="faq-drawer" data-open={isOpen}>
                    <button
                      type="button"
                      className="faq-drawer-handle"
                      onClick={() => toggle(index)}
                      aria-expanded={isOpen}
                    >
                      <span className="faq-drawer-pull" aria-hidden />
                      <span className="faq-drawer-title">{item.question}</span>
                      <span className="faq-drawer-chevron" aria-hidden>{isOpen ? "−" : "+"}</span>
                    </button>

                    {isOpen ? (
                      <div className="faq-drawer-card">
                        <div className="faq-drawer-card-inner">{item.answer}</div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <footer className="faq-foot">
          <p>Имаш въпрос, който не е тук?</p>
          <div className="faq-foot-actions">
            <Link href="/report" className="btn btn-secondary">Дай ни бележка</Link>
            <Link href="/" className="btn btn-secondary">Към началото</Link>
          </div>
        </footer>
      </article>
    </section>
  );
}
```

### FAQ CSS

```css
/* ============================== */
/* FAQ — library catalog          */
/* ============================== */

.faq-shell {
  display: grid;
  place-items: start center;
  padding: 32px 16px 64px;
  min-height: 100vh;
}

.faq-stage {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 1100px;
  width: 100%;
  gap: 32px;
}

@media (min-width: 980px) {
  .faq-stage {
    grid-template-columns: 360px 1fr;
    align-items: start;
  }
}

.faq-hero-art {
  margin: 0;
  border-radius: 18px;
  aspect-ratio: 3 / 4;
  background-image:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(20,10,5,0.55) 100%),
    image-set(
      url("/game-art/faq/library-catalog-hero.webp") type("image/webp"),
      url("/game-art/faq/library-catalog-hero.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  position: sticky;
  top: 96px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.5);
}

@media (max-width: 979px) {
  .faq-hero-art {
    position: relative;
    top: 0;
    aspect-ratio: 16 / 9;
  }
}

.faq-cabinet {
  background-color: #4a3422;
  background-image:
    linear-gradient(180deg, rgba(74,52,34,0.4), rgba(28,18,10,0.6)),
    repeating-linear-gradient(180deg, rgba(60,40,20,0.18) 0 2px, transparent 2px 8px);
  padding: 32px;
  border-radius: 18px;
  border: 1px solid rgba(217, 154, 66, 0.22);
  box-shadow:
    inset 0 0 0 1px rgba(217, 154, 66, 0.15),
    0 20px 50px rgba(0,0,0,0.55);
  color: #f5e8c8;
  display: grid;
  gap: 28px;
}

.faq-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d19a42;
}

.faq-head h1 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.875rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  margin: 4px 0 8px;
}

.faq-subtitle {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(245, 232, 200, 0.78);
}

.faq-drawer-row {
  display: grid;
  gap: 12px;
}

.faq-drawer-label {
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #d19a42;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(217, 154, 66, 0.3);
}

.faq-drawer-stack {
  display: grid;
  gap: 8px;
}

.faq-drawer {
  background: #c8a366;
  background-image:
    linear-gradient(180deg, rgba(255, 240, 200, 0.18), transparent 30%, rgba(50,30,10,0.18) 100%),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: multiply;
  border-radius: 4px;
  border: 1px solid rgba(50, 30, 10, 0.45);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.45),
    inset 0 -1px 0 rgba(50, 30, 10, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.faq-drawer[data-open="true"] {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.55),
    inset 0 -1px 0 rgba(50, 30, 10, 0.5),
    0 8px 20px rgba(0, 0, 0, 0.45);
}

.faq-drawer-handle {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 14px 18px;
  background: transparent;
  border: none;
  color: #1a1410;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.faq-drawer-pull {
  width: 36px;
  height: 12px;
  background:
    radial-gradient(ellipse at center, rgba(50, 30, 10, 0.65), rgba(50, 30, 10, 0.2)),
    linear-gradient(180deg, rgba(255, 240, 200, 0.35), transparent 50%);
  border-radius: 4px;
  border: 1px solid rgba(50, 30, 10, 0.5);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.3);
  flex-shrink: 0;
}

.faq-drawer-title {
  flex: 1;
  font-family: "Noto Serif", serif;
  font-weight: 700;
  font-size: 1rem;
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.4);
}

.faq-drawer-chevron {
  font-family: "Noto Serif Display", serif;
  font-weight: 900;
  font-size: 1.4rem;
  color: #842f2b;
}

.faq-drawer-card {
  padding: 0 18px 18px 70px;
  background: linear-gradient(180deg, rgba(255, 250, 235, 0.92), rgba(245, 235, 215, 0.85));
  border-top: 1px dashed rgba(50, 30, 10, 0.35);
}

.faq-drawer-card-inner {
  padding-top: 14px;
  color: #2a1b10;
  font-size: 0.95rem;
  line-height: 1.65;
}

.faq-drawer-card-inner a {
  color: #842f2b;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.faq-foot {
  margin-top: 12px;
  padding-top: 20px;
  border-top: 1px solid rgba(217, 154, 66, 0.22);
  display: grid;
  gap: 12px;
  text-align: center;
}

.faq-foot p {
  font-size: 0.95rem;
  color: rgba(245, 232, 200, 0.78);
}

.faq-foot-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
```

### Wire `/faq` into navigation

In `apps/web/components/site-chrome.tsx`, add to `SECONDARY_LINKS` array (after "Първа игра"):

```ts
{ href: "/faq", label: "Въпроси" },
```

And in `SiteFooter` (from earlier pre-launch prompt), add `/faq` link:

```tsx
<Link href="/faq">Въпроси</Link>
<span aria-hidden>·</span>
```

---

## Stage 5 — sitemap.xml, robots.txt, canonical URLs

### `apps/web/app/sitemap.ts`

Next.js auto-generates `sitemap.xml` from this file.

```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/werewolf`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/mafia`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/werewolf/roles`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/mafia/roles`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/roles`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/werewolf/rules`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/mafia/rules`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/tutorial`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/history`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/achievements`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/sign-in`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/status`,
      lastModified,
      changeFrequency: "always",
      priority: 0.3,
    },
  ];
}
```

### `apps/web/app/robots.ts`

```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/account",
          "/account/",
          "/play/",
          "/lobby/",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
```

### Verify

After build:
- `curl http://localhost:3000/sitemap.xml` returns XML with all routes.
- `curl http://localhost:3000/robots.txt` returns text content with proper Allow/Disallow lines + Sitemap reference.

---

## Stage 6 — Core Web Vitals polish

### 6.1 Preload hero images per route

In each major page's metadata, add `other` block with preload hints:

```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  // ...
  other: {
    "link:preload": "</game-art/og/og-werewolf.webp>; rel=preload; as=image; fetchpriority=high",
  },
};
```

Or use `<link rel="preload">` in the page JSX directly via the metadata API.

### 6.2 Font display: swap

In `apps/web/app/globals.css`, ensure `@font-face` rules (if any custom fonts are loaded) include `font-display: swap`. Since the project uses system "Noto Serif" stack, this is likely auto-handled.

Search for `@font-face` in globals.css and add `font-display: swap;` to any that don't have it.

### 6.3 Image `sizes` attribute audit

For Next `<Image>` components used as hero / above-fold images, ensure `sizes` attribute is set correctly to avoid bandwidth waste:

```tsx
<Image
  src="/game-art/og/og-werewolf.webp"
  alt=""
  width={1200}
  height={630}
  sizes="(max-width: 768px) 100vw, 1200px"
  priority
/>
```

Audit `<Image>` usages in:
- Hero sections (`game-home-page.tsx`)
- Sign-in stage
- Tutorial slides
- FAQ hero

### 6.4 Preconnect to external origins

If we use external resources (Resend, Discord CDN for avatars, Google CDN for avatars), add `<link rel="preconnect">` in layout:

```tsx
<head>
  <link rel="preconnect" href="https://cdn.discordapp.com" />
  <link rel="preconnect" href="https://lh3.googleusercontent.com" />
  {/* ... */}
</head>
```

### 6.5 Resource hints for game-art domain

If serving art from same origin: no preconnect needed.
If from CDN: add preconnect to that CDN.

---

## Stage 7 — Verification

After all stages:

```bash
pnpm install
pnpm optimize:assets   # confirm all OG + FAQ assets have webp variants
pnpm typecheck
pnpm regression
pnpm test
pnpm smoke
pnpm frontend:e2e
E2E_LOCAL_ONLY=true pnpm e2e:auth
pnpm playtest
pnpm visual:update     # add new /faq baseline + updated OG-modified pages
pnpm visual
pnpm perf:budget
pnpm build
```

### Manual SEO verification

1. **Sitemap check:** `curl http://localhost:3000/sitemap.xml | head -40` — sees all 17 routes with priority and lastModified.
2. **Robots check:** `curl http://localhost:3000/robots.txt` — sees Allow / Disallow / Sitemap lines.
3. **OG card preview** (use Twitter Card Validator OR Facebook Sharing Debugger OR open page source):
   ```bash
   curl -s http://localhost:3000/werewolf | grep -E 'og:|twitter:'
   ```
   Should output unique OG title/description/image per route.
4. **JSON-LD validity:** Open `/`, `/werewolf`, `/tutorial`, `/faq` in browser. Copy page source. Paste any `<script type="application/ld+json">` content into https://search.google.com/test/rich-results — should validate without errors.
5. **FAQ accordion**: Open `/faq`, click any drawer handle, content expands. Re-click, collapses. Multiple can be open at once (independent state).
6. **Tutorial flash test (CR-001):** Open `/tutorial?step=4` in fresh tab → renders Slide 4 immediately. No flash from Slide 1.
7. **Cookie banner CLS test (CR-003):** Open homepage in DevTools → Performance tab → record → reload → check CLS metric. Should be < 0.05.
8. **Production env safety (CR-004):** `NODE_ENV=production NEXT_PUBLIC_APP_URL="" pnpm build` → must fail with clear Bulgarian error.

### Visual regression baselines

Run `pnpm visual:update` ONCE to add baselines for:
- `/faq` desktop + mobile
- Other pages re-baseline if metadata changes affect rendering (most don't)

Commit the new baseline screenshots.

---

## Acceptance criteria

1. **CR-001 through CR-004** fixed; tutorial loads without flash, cookie banner has no CLS, production build fails fast on missing APP_URL.
2. **10 new art assets** exist in `apps/web/public/game-art/og/` and `apps/web/public/game-art/faq/` with WebP variants.
3. **Per-route metadata** set for: `/`, `/werewolf`, `/mafia`, `/werewolf/roles`, `/mafia/roles`, `/roles`, `/werewolf/rules`, `/mafia/rules`, `/tutorial`, `/faq`, `/sign-in`, `/history`, `/leaderboard`, `/achievements`. Each has unique title, description, canonical, OG image, Twitter card.
4. **JSON-LD scripts** rendered per route: `WebSite+SoftwareApplication` on `/`, `Game` on `/werewolf` + `/mafia`, `HowTo` on `/tutorial`, `FAQPage` on `/faq`, etc.
5. **Personal/transactional pages** have `robots: "noindex, nofollow"`: `/account`, `/forgot-password`, `/reset-password`, `/verify-email`. Legal pages: `noindex, follow`.
6. **`/faq` page** exists with library card catalog theme, 15 questions in 4 categories, accordion behavior, JSON-LD FAQPage.
7. **`sitemap.xml`** lists 17 public routes with priorities. **`robots.txt`** disallows private routes.
8. **`/faq` link** in site-chrome SECONDARY_LINKS and site footer.
9. **All commit messages in English**.
10. **All copy in Bulgarian** (except brand names Google/Discord).
11. **`pnpm verify`** chain passes end to end.
12. **No new npm dependencies**.

---

## Не пипай

- Game-server logic / schemas / role-assignment.
- Existing redesigns (history, achievements, leaderboard, tutorial visual baselines beyond CR-001).
- Better Auth core internals.
- Bulgarian rules text in `docs/rules-bg.md` (already source of truth).
- `apps/web/app/api/**` routes (no SEO impact).
- TTS / audio narrator (separate PR).

---

## Commit strategy (12 atomic commits, all English)

Branch: `feat/seo-faq-polish`

1. `fix(tutorial): eliminate slide hydration flash via lazy initial state (CR-001)`
2. `fix(ui): cookie banner three-state to prevent CLS on mount (CR-003)`
3. `fix(metadata): fail-fast on missing APP_URL in production (CR-004)`
4. `chore(art): generate 10 cinematic OG and FAQ assets`
5. `feat(seo): seo helper module + per-route OG metadata + Twitter cards`
6. `feat(seo): JsonLd component + structured data for homepage and game families`
7. `feat(seo): structured data for tutorial, rules, achievements, leaderboard, history`
8. `feat(seo): noindex on personal and transactional routes`
9. `feat(faq): library card catalog page with 15 questions across 4 categories`
10. `feat(faq): wire /faq into site chrome and footer navigation`
11. `feat(seo): sitemap.xml + robots.txt via Next.js MetadataRoute`
12. `perf(web): preload hero images + preconnect to OAuth avatar CDNs`

(CR-002 may be merged into CR-001's commit if redundant per analysis above.)

PR title: `feat: SEO infrastructure, per-route OG, FAQ page, tutorial polish (CR-001..004)`

PR body should include:
- Link to `docs/regression-audit/REPORT.md` for context.
- Note: CR-001 through CR-004 are ChatGPT pre-pass findings, not from automated audit.
- Note: Twitter Card / Facebook Open Graph debuggers should be re-run after deploy with real public URL (localhost OG previews won't work in those tools).
- Reviewer hint: validate JSON-LD on https://search.google.com/test/rich-results with deployed URL before merging.

---

(End of prompt)
