# Codex prompt — Final polish pass (everything still outdated)

**Един coherent comprehensive PR покриващ ВСИЧКИ останали outdated pages + cleanup items от audit-а.** Това е финалният polish pass преди публично пускане — след него цялото frontend трябва да изглежда cohesive, modern, и cinematic.

**Working directly on `main` branch с incremental commits.** Codex validate-ва след всеки commit; ако нещо счупи build-а — revert и поправи преди следващия commit.

**Scope:** 12 distinct improvements + 4-5 imagen banners + visual baselines.

~30 atomic English commits. ~5-6 часа Codex work at high reasoning.

---

## Pre-analysis — какво е outdated

Audit findings от code-level inspection на 35 page files:

### 🔴 P0 — Стар brass-plaque pattern (complete redesign needed)

| Page | Current pattern | Problem |
|---|---|---|
| `/play/[code]` | `play-room-client.tsx` mosaic | Largest UX surface, audit found 4+ visible bugs (asymmetric layout, duplicate "Започни игра", mobile players panel at bottom) |
| `/lobby/[code]` | `.card .lobby-invite-card` brass | Code seal "ABC123" tiny top-right, not the focal point |
| `/history/[gameId]/replay` | `.paper-card .replay-hero` | Brass plaque pattern, dense data table |
| `/friends` | `.paper-card .utility-hero` | Brass plaque, half-empty 2-col, misleading copy |
| `/offline` | inline hex colors, no design system | Basic placeholder, no painterly atmosphere |

### 🟠 P1 — Theme present but not in frame system

| Page | Theme |
|---|---|
| `/forgot-password` | `.locksmith-shell` painterly portrait pattern |
| `/reset-password` | `.forge-shell` painterly portrait pattern |
| `/verify-email` | `.seal-shell` painterly portrait pattern |

Плюс: **phase timeline loop arrow** на `/werewolf/rules` + `/mafia/rules` все още е 3 disconnected pieces (badge + arc + arrowhead).

### 🟡 P2 — Cleanup / migration leftovers

- **Navbar utility icons** (Menu, X, MoreHorizontal, Play, Volume2/VolumeX, Sun/Moon) — still custom SVG (lucide migration not completed)
- **Toast notifications** — basic styling
- **Loading skeletons** — inconsistent across pages
- **Sign-out** — no confirmation step
- **Welcome flow** — `?welcome=1` redirect не активиран при first sign-in
- **Brand mark + footer** — could use subtle polish

---

## Pre-decisions (locked, no clarifying questions)

| Decision | Choice |
|---|---|
| Branch | Directly on `main`, atomic incremental commits |
| Imagen scope | 4 new banners (lobby, replay, friends, offline). Keep existing auth portraits (locksmith/forge/seal) but modernize their wrappers |
| Frame system | Apply `framed-shell` pattern uniformly to all redesigned pages |
| Lucide migration | Complete navbar utility icons (Menu, X, MoreHorizontal, Play, Volume2/VolumeX, Sun/Moon) |
| Phase arrow | Single continuous SVG path (badge + arc + arrowhead в едно `<path>`) |
| Toast styling | Modern slide-in, amber accent on success, red on error |
| Skeleton system | Shared `<PageSkeleton>` family with shimmer animation |
| Sign-out confirmation | Inline modal с "Изход / Отказ" buttons |
| Welcome flow | Redirect `/sign-in` success → `/tutorial?welcome=1` if `tutorial-completed` localStorage missing |
| Brand mark | Subtle hover scale + faint glow on logo |
| Footer | Add small painterly motif + version stamp |
| Light theme | All redesigned components include `[data-theme="light"]` overrides |
| Validation | After each commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert immediately. |

---

## Stage 1 — Generate 4 imagen banners

All wide cinematic 16:9 painterly oil banners with gradient scrim в долната трета. No visible text/letters/numbers anywhere.

### Asset 1: Lobby invite banner

**Path:** `apps/web/public/game-art/legal/lobby-banner.png` (1920 × 1080)

```
A wide cinematic banner illustration of a single wax-sealed
parchment scroll resting on dark velvet, captured at a slight
upper three-quarter angle. The red wax seal is prominent and
unbroken, gleaming faintly under warm candlelight from the upper
left. A brass key with an ornate bow lies diagonally across the
scroll. The parchment is partially unrolled but no readable text
on its surface — just the implication of a folded letter waiting
to be opened. A few small ornamental flourishes (curled paper
edges, faint inkblot) at the corners. The lower third of the
frame gradient-fades to deep ink-black for text overlay. Mood:
invitation, the moment before guests arrive, secret about to be
shared. Painterly oil style with rich impasto brushwork, warm
amber and ember-red palette against deep velvet shadows,
vignetted corners. No text, no readable letters, no numbers, no
symbols anywhere on parchment, seal, or surfaces. Aspect ratio
16:9.
```

### Asset 2: Replay viewer banner

**Path:** `apps/web/public/game-art/legal/replay-banner.png` (1920 × 1080)

```
A wide cinematic banner illustration of an open leather-bound
journal on an oak desk under warm oil-lamp light, viewed from a
slight overhead angle. Visible pages contain abstract painterly
brushwork that suggests handwriting and small sketches but is
not actually readable — only the impression of recent entries. A
quill pen rests in a brass inkwell to the right; a half-burned
candle on the left; faint cigarette smoke wisp rising from a
brass ashtray. Dark wood-paneled wall blurred behind. The lower
third gradient-fades to near-black. Mood: revisiting, the night's
events recalled, a chronicle being read by lamplight. Painterly
oil style with visible impasto, warm amber and umber palette
with brass accents, deep shadow falloff, vignetted corners. No
readable text, no letters, no numbers, no symbols on pages or
surfaces. Aspect ratio 16:9.
```

### Asset 3: Friends companions banner

**Path:** `apps/web/public/game-art/legal/friends-banner.png` (1920 × 1080)

```
A wide cinematic banner illustration of several silhouetted
figures gathered around a long wooden tavern table, viewed from
behind their shoulders. Their faces are obscured or turned away —
only the suggestion of company. A central candelabra with three
lit candles dominates the table center. Empty chairs frame the
scene, suggesting more seats waiting to be filled. A faint
hearth fire glows warmly in the background, casting amber light
across stone walls and wooden beams. The lower third gradient-
fades to deep ink-black for text overlay. Mood: expected company,
gathered around the table, hospitality and shared anticipation.
Painterly oil style with rich brushwork, warm amber-firelight
palette against deep tavern-brown shadows, vignetted corners. No
visible faces in detail, no text, no readable letters, no numbers,
no symbols anywhere. Aspect ratio 16:9.
```

### Asset 4: Offline disconnect banner

**Path:** `apps/web/public/game-art/legal/offline-banner.png` (1920 × 1080)

```
A wide cinematic banner illustration of a solitary brass-fitted
oil lantern hanging from a wooden post in dense rolling fog. In
the distance, barely visible through the mist, the faint outline
of a stone lighthouse with its beam diffused into soft amber
glow. The foreground is a wet cobblestone or wood-plank path
fading into the fog. A few tendrils of mist drift across the
lantern light. The lower third gradient-fades to deep ink-black.
Mood: waiting, disconnected from the lighthouse but the
lighthouse is still there, the storm will pass. Painterly oil
style with atmospheric brushwork, cool blue-grey fog with warm
amber lantern glow accents, dramatic atmospheric perspective,
vignetted corners. No text, no readable letters, no numbers, no
symbols anywhere. Aspect ratio 16:9.
```

### After generation

```bash
ls apps/web/public/game-art/legal/lobby-banner.png
ls apps/web/public/game-art/legal/replay-banner.png
ls apps/web/public/game-art/legal/friends-banner.png
ls apps/web/public/game-art/legal/offline-banner.png
pnpm optimize:assets
```

Verify все 4 PNG + WebP. Регенерирай ако имат stray text/letters.

---

## Stage 2 — `/play/[code]` redesign

**Largest single redesign.** File: `apps/web/components/play-room-client.tsx` + CSS.

### Goals

1. **Apply framed-shell pattern** — `<main className="shell play-shell framed-shell">` + content в `<div className="framed-shell-inner">`
2. **Asymmetric layout fix**: players panel desktop = `position: sticky; top: 96px` (визира заедно с right column, не зависи)
3. **Remove duplicate "Започни игра"** — keep only в Лоби панела, премахни от Контрол на водещия
4. **Mobile players panel** — move to TOP of vertical stack (immediately after Лоби header)
5. **Remove brass-plaque cream styling** — players panel becomes dark glass surface с amber accents (matches frame system)
6. **Unify section cards** — Лоби / Лични сигнали / Настройка / Контрол на водещия / Чат лог all share `.play-section` styling
7. **Phase indicator** — visible "Фаза: НОЩ" pill с pulsing dot
8. **Action buttons consistency** — all primary/secondary buttons from same design tokens
9. **Light theme variants** for all play-room components
10. **Lucide icons** for play controls (Play, Pause, SkipForward, Plus, MessageSquare, Users, Settings, Keyboard, EyeOff, Volume2)

### Component breakdown

PlayRoomClient е голям. Refactor може to split:
- `PlayShell.tsx` — outer framed wrapper, theme, phase context
- `PlayHero.tsx` — phase indicator + room code + timer
- `PlayPlayersPanel.tsx` — sticky list of players с avatars + status badges
- `PlayLobby.tsx` — pre-game host controls (start, narrator selection)
- `PlayNarratorControls.tsx` — runtime host/narrator controls (pause, advance, time)
- `PlayChatPanel.tsx` — chat + events log
- `PlayPersonalCues.tsx` — vibration/sound settings
- `PlayRoomSetup.tsx` — read-only config display

Codex може to keep PlayRoomClient as single file ако refactor extract-ва прекалено много state. Decision: extract само components without much state (PlayPlayersPanel, PlayHero) — keep core state в PlayRoomClient.

### CSS namespace

Premахни всичките `.cream*` / `.brass*` references за play room. Add `.play-shell-*` + `.play-section` + `.play-players-panel` + `.play-phase-pill` + similar tokens. Use shared `--frame-*` and `--legal-*` variables.

### Acceptance hint

After change:
- /play/[code] има същата rounded frame като homepage
- Painterly atmospheric bg прозира в margins
- Players panel sticky на desktop, top на mobile
- Само ONE "Започни игра" CTA visible
- Phase pill с pulsing dot
- Light theme works
- Mobile responsive

---

## Stage 3 — `/lobby/[code]` invite redesign

**File:** `apps/web/app/lobby/[code]/page.tsx`

### Goals

1. **Make code the focal point** — huge monospace, copy button, optional QR code
2. **Cinematic banner** with `lobby-banner.png` (wax-sealed parchment)
3. **Single primary CTA** "Към играта"
4. **Secondary CTAs** — "Наблюдавай" + "Сподели" + "Назад"
5. **Native share** — `navigator.share()` ако supported, fallback to copy link
6. **Player preview** — show first 3 players if already joined
7. **Frame system + light theme**

### Layout sketch

```
┌──────────────────────────────────────────────────────────────┐
│ [Banner: wax-sealed parchment]                               │
│ ЧАСТНА СТАЯ · ВЪРКОЛАК                                       │
│ Покана за масата.                                            │
└──────────────────────────────────────────────────────────────┘

╔══════════════════ КОДЕТЪ НА СТАЯТА ══════════════════════════╗
║                                                              ║
║                    ╔═══════════════════════╗                ║
║                    ║      A B C 1 2 3      ║   [Копирай]    ║
║                    ╚═══════════════════════╝                ║
║                                                              ║
║                    Сподели със играчи →                      ║
║          [Сподели]  [Копирай линка]  [QR код]              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

[Към играта]   [Наблюдавай]   [Назад към лобито]

──────────────────────────────────────────────────────────────
Маршрут до площада / Досие към задната стая
(family-specific blurb)

──────────────────────────────────────────────────────────────
Първи играчи в стаята:
[Player chip] [Player chip] [Player chip] [+2 още]
```

### New component: `LobbyInviteClient.tsx`

Client component с copy state, share API, QR generation.

```tsx
"use client";

import { useState } from "react";
import { Copy, Share2, QrCode } from "lucide-react";
// ...

async function copyCode(code: string) {
  await navigator.clipboard.writeText(code);
}

async function shareInvite(code: string, url: string) {
  if (navigator.share) {
    await navigator.share({
      title: "Покана за частна стая",
      text: `Влез в моята стая с код ${code}`,
      url,
    });
  } else {
    await copyCode(url);
  }
}
```

QR code: use inline SVG QR generator OR skip QR (defer to follow-up). Recommend **skip QR в този PR** — focus на core invite UX. Note as P3 follow-up.

### Acceptance hint

- Code е HUGE, monospace, centered, в decorative frame
- Copy button visible, успешно копира с toast feedback
- Share button works on mobile (native share sheet)
- Player preview shows current joined players

---

## Stage 4 — `/history/[gameId]/replay` viewer

**File:** `apps/web/app/history/[gameId]/replay/page.tsx`

### Goals

1. **Cinematic banner** (replay-banner.png — open journal)
2. **Replay timeline view** — chronological events grouped by phase
3. **Key moments highlighted** — death, reveal, vote outcome
4. **Player chips** with final roles revealed
5. **Final verdict card** — winner team, reason, summary stats
6. **Frame system + light theme**

### Layout

```
[Banner: open journal с oil-lamp]
ПРЕГЛЕД СЛЕД ИГРА
Запис на стая ABC123.
Финал: Селото оцеля · 18:32 минути · 8 играчи

╔══ ИГРАЧИ ══════════════════════════════════════════════════╗
║ [Анна — Гадател ✓ оцеля] [Борис — Върколак † ден 2]       ║
║ [Виктор — Лечител ✓ оцеля] [Галя — Селянин † нощ 1]       ║
║ ... 4 more                                                  ║
╚════════════════════════════════════════════════════════════╝

╔══ ХРОНОЛОГИЯ ══════════════════════════════════════════════╗
║                                                              ║
║ ▼ НОЩ 1                                                     ║
║   ⓘ Върколаците избраха Галя.                              ║
║   ⓘ Лечителят защити Анна.                                 ║
║   ⓘ Гадателят провери Борис → "Върколак".                  ║
║                                                              ║
║ ▼ ДЕН 1                                                     ║
║   ⚠ Галя загина. Беше Селянин.                             ║
║   💬 Обсъждане: 12 съобщения                                ║
║   ✋ Гласуване: Борис елиминиран (5 от 7 гласа)            ║
║   ⚰ Борис разкрит като Върколак.                           ║
║                                                              ║
║ ▼ НОЩ 2                                                     ║
║ ...                                                         ║
╚════════════════════════════════════════════════════════════╝

╔══ ПОБЕДАТА ══════════════════════════════════════════════════╗
║ Селото оцеля.                                                ║
║ 2 паднаха от селото, всички 2 върколака бяха разкрити.       ║
║ [Виж пълните събития]                                        ║
╚══════════════════════════════════════════════════════════════╝
```

### Component: `ReplayViewer.tsx`

Server-rendered с event grouping logic. Premахни стар `.paper-card .replay-hero` brass pattern.

### Acceptance hint

- Banner cinematic
- Timeline visually scannable (phase headers + event icons)
- Player chips show final role + outcome
- Winner verdict card prominent
- Light theme works

---

## Stage 5 — `/friends` redesign

**File:** `apps/web/app/friends/page.tsx`

### Goals

1. **Cinematic banner** (friends-banner.png)
2. **Replace brass plaque with frame system**
3. **Better invite form** — input + tag + notes
4. **Friend chips** with painterly mini-portraits OR initials в circles
5. **Bulk invite** — multi-select + "Покани за следваща стая" button
6. **Better empty state** with example chips (ghosted preview)

### Layout

```
[Banner: companions at table]
ПРИЯТЕЛИ
Покани групата за следваща маса.
Локален списък — пази се само в твоя браузър.

╔══ ДОБАВИ ПРИЯТЕЛ ═══════════════════════════════════════════╗
║ Име [_____________]  Бележка [___________]    [Добави]     ║
╚═════════════════════════════════════════════════════════════╝

╔══ ТВОЯТА ГРУПА (5) ═════════════════════════════════════════╗
║                                                              ║
║ [М] Мила   "обича Свещеник"     [Редактирай] [Махни]        ║
║ [П] Петко  "ентусиазиран Шут"   [Редактирай] [Махни]        ║
║ ...                                                          ║
║                                                              ║
║ ─── или ───                                                 ║
║ [Покани цялата група в нова стая →]                         ║
╚═════════════════════════════════════════════════════════════╝
```

### Acceptance hint

- Banner cinematic
- Friends list dense но readable
- Empty state с 3-4 ghosted preview chips ("Така ще изглежда списъкът ти")
- Bulk action visible

---

## Stage 6 — `/offline` PWA page redesign

**File:** `apps/web/app/offline/page.tsx`

### Goals

1. **Cinematic banner** (offline-banner.png — lantern in fog)
2. **Replace inline hex colors** with design system
3. **Network status indicator** — small chip showing "Очакваме връзка..." с pulsing dot
4. **Auto-retry** — retry every 5s, increment counter
5. **Quick links** — Към началото / Прочети правилата / Cached страници
6. **Frame system + light theme**

### Implementation

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  const [retryCount, setRetryCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    function check() {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (isOnline) {
        window.location.reload();
      }
    }

    function tick() {
      setRetryCount((n) => n + 1);
      check();
    }

    const handler = () => check();
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    const interval = window.setInterval(tick, 5000);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="shell offline-shell framed-shell">
      <div className="framed-shell-inner">
        <header className="offline-hero">
          <div className="offline-hero-banner">
            <Image src="/game-art/legal/offline-banner.webp" alt="" fill priority sizes="100vw" className="offline-hero-img" />
            <div className="offline-hero-scrim" aria-hidden />
          </div>
          <div className="offline-hero-inner">
            <p className="offline-hero-kicker">
              <WifiOff className="offline-hero-icon" aria-hidden strokeWidth={2} />
              <span>връзката прекъсна</span>
            </p>
            <h1 className="offline-hero-title">Лампата свети, чакаме теб.</h1>
            <p className="offline-hero-subtitle">
              Ако си бил в активна стая, не затваряй страницата. Когато връзката се върне, ще те върнем към същото място.
            </p>
            <div className="offline-status" data-state={online ? "online" : "offline"}>
              <span className="offline-status-dot" aria-hidden />
              <span>
                {online ? "Възстановяваме връзката..." : `Очакваме връзка... (опит ${retryCount + 1})`}
              </span>
              <button
                type="button"
                className="offline-status-retry"
                onClick={() => window.location.reload()}
                aria-label="Опитай отново сега"
              >
                <RefreshCw aria-hidden strokeWidth={2} />
              </button>
            </div>
          </div>
        </header>

        <section className="offline-actions">
          <Link className="btn btn-primary" href="/">Към началото</Link>
          <Link className="btn btn-secondary" href="/werewolf/rules">Прочети правилата</Link>
          <Link className="btn btn-secondary" href="/faq">Често задавани въпроси</Link>
        </section>
      </div>
    </main>
  );
}
```

CSS добавя `.offline-*` rules в design system. Light theme variants included.

---

## Stage 7 — Auth trio polish (forgot/reset/verify)

**Files:**
- `apps/web/components/auth/ForgotPasswordClient.tsx`
- `apps/web/components/auth/ResetPasswordClient.tsx`
- `apps/web/components/auth/VerifyEmailClient.tsx`

### Goals

1. **Bring into framed-shell system** — wrap content в `<div className="framed-shell-inner">`
2. **Keep existing painterly portrait assets** (locksmith, forge, seal) but **modernize body styling**
3. **Replace brass-textured form inputs** with modern dark glass inputs (like sign-in)
4. **Consistent button styling** — primary/secondary buttons from shared tokens
5. **Light theme** variants
6. **Success states** — modern checkmark animations consistent with sign-in success
7. **Lucide icons** — KeyRound (forgot), KeySquare (reset), MailCheck (verify)

### Implementation pattern (per file)

```tsx
<main className="shell {existing-shell-class} framed-shell">
  <div className="framed-shell-inner">
    <ForgotPasswordHero /> {/* compact hero with banner art + title */}
    <ForgotPasswordForm /> {/* modern form в дark surface */}
  </div>
</main>
```

CSS: extend existing `.locksmith-shell` / `.forge-shell` / `.seal-shell` rules with frame compatibility. Add `[data-theme="light"]` overrides.

### Acceptance hint

- All 3 pages share visual rhythm with /sign-in
- Frame visible с painterly bg around
- Forms modern dark glass с amber focus rings
- Light theme works

---

## Stage 8 — Phase timeline arrow fix

**File:** `apps/web/components/games/game-rules-page.tsx` (search for phase timeline SVG)

### Current bug

3 disconnected pieces:
- Badge label "ПОВТАРЯ СЕ"
- Curved arc SVG
- Arrowhead chevron

### Fix

Single continuous SVG `<path>` от node 06 центъра, дъга нагоре, връща до node 03 център, с marker arrowhead на края. Badge text floats centered above arc (option B) OR rendered inside SVG as `<text>` element (option A).

```tsx
function PhaseLoopArrow() {
  return (
    <svg
      className="phase-loop-arrow"
      viewBox="0 0 600 80"
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="phase-loop-arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="6"
          refY="5"
          orient="auto"
        >
          <path d="M0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <path
        d="M 520 50 Q 300 -40 80 50"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="6 5"
        strokeLinecap="round"
        markerEnd="url(#phase-loop-arrowhead)"
      />
      <rect
        x="240"
        y="0"
        width="120"
        height="22"
        rx="11"
        fill="var(--bg-strong, #1a1410)"
        stroke="currentColor"
        strokeWidth="1"
      />
      <text
        x="300"
        y="15"
        textAnchor="middle"
        fill="currentColor"
        fontSize="10"
        fontWeight="700"
        letterSpacing="2"
        style={{ textTransform: "uppercase" }}
      >
        ПОВТАРЯ СЕ
      </text>
    </svg>
  );
}
```

Premахни стария 3-element approach. Position arrow с absolute over phase timeline node row.

### Acceptance hint

- Single continuous dashed arc visible
- Arrow tip clearly points to node 03
- Badge integrated as part of arc, not floating

---

## Stage 9 — Navbar utility icons → lucide migration

**File:** `apps/web/components/site-chrome.tsx`

### Replace custom SVG with lucide imports

```tsx
import { Menu, X, MoreHorizontal, Play, Volume2, VolumeX, Sun, Moon } from "lucide-react";
```

### Map per icon

| Function | Old custom | New lucide |
|---|---|---|
| `MenuIcon()` | path d="M4 7h16..." | `<Menu />` |
| `CloseIcon()` | path d="M6 6l12 12..." | `<X />` |
| `DotsIcon()` | 3 circles | `<MoreHorizontal />` |
| `PlayIcon()` | triangle path | `<Play />` |
| `SpeakerWaveIcon()` | speaker waves | `<Volume2 />` |
| `SpeakerXIcon()` | speaker x | `<VolumeX />` |
| `ThemeIcon dark` | moon | `<Moon />` |
| `ThemeIcon light` | sun rays | `<Sun />` |

### Implementation

Замени всеки SVG component с inline lucide:

```tsx
// Before:
function MenuIcon() {
  return (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

// After: delete the function, use lucide inline where needed.

<button className="site-mobile-menu" type="button" aria-label="Отвори менюто" onClick={openDrawer}>
  <Menu className="site-icon" aria-hidden strokeWidth={1.8} />
</button>
```

Add CSS:
```css
.site-icon {
  width: 22px;
  height: 22px;
}
```

Delete old `Icon`, `MenuIcon`, `CloseIcon`, `DotsIcon`, `PlayIcon`, `SpeakerWaveIcon`, `SpeakerXIcon`, `ThemeIcon` functions.

### Acceptance hint

- All navbar icons consistent stroke-width
- Theme toggle correctly switches Sun ↔ Moon
- Sound toggle correctly switches Volume2 ↔ VolumeX
- Bundle size grows ~3-5KB (8 more icons, tree-shaken)

---

## Stage 10 — Toast notifications polish

**File:** `apps/web/components/toast-host.tsx`

### Goals

1. **Modern slide-in animation** from top-right (or bottom-right depending on placement)
2. **Type-aware styling** — success (amber), error (red), info (blue), warning (amber-darker)
3. **Stack management** — newer toasts push older down, max 3 visible
4. **Auto-dismiss** with subtle countdown indicator (animated underline)
5. **Manual dismiss** — X icon top-right of toast
6. **Light theme variant**

### Implementation suggestion

If using sonner or react-hot-toast: configure styling. Otherwise rewrite ToastHost.

```tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
// ...

interface ToastItem {
  id: string;
  kind: "success" | "error" | "info" | "warning";
  message: string;
  duration: number;
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handler(event: CustomEvent<ToastItem>) {
      setToasts((prev) => [...prev.slice(-2), event.detail]); // keep max 3
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== event.detail.id));
      }, event.detail.duration);
    }
    window.addEventListener("app:toast" as never, handler as never);
    return () => window.removeEventListener("app:toast" as never, handler as never);
  }, []);

  return (
    <aside className="toast-host" aria-live="polite" aria-atomic={false}>
      {toasts.map((toast) => (
        <article key={toast.id} className="toast" data-kind={toast.kind}>
          <span className="toast-icon" aria-hidden>
            {toast.kind === "success" && <CheckCircle2 strokeWidth={2} />}
            {toast.kind === "error" && <AlertCircle strokeWidth={2} />}
            {toast.kind === "info" && <Info strokeWidth={2} />}
            {toast.kind === "warning" && <AlertCircle strokeWidth={2} />}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            aria-label="Затвори"
          >
            <X strokeWidth={2} />
          </button>
          <span className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} />
        </article>
      ))}
    </aside>
  );
}
```

CSS добавя `.toast-host` + `.toast` + animations. Light theme variants.

### Acceptance hint

- Toasts slide in from right, fade out
- Stack ограничен на 3
- Auto-dismiss countdown visible as subtle progress bar
- Manual X dismisses immediately

---

## Stage 11 — Loading skeletons unification

**File:** `apps/web/components/skeleton.tsx`

### Goals

1. **Shared shimmer animation** keyframe
2. **Component family**: `<SkeletonCard>`, `<SkeletonText>`, `<SkeletonAvatar>`, `<SkeletonHero>`, `<PageSkeleton>`
3. **Dark + light theme variants**
4. **Replace existing inline skeletons** в /history, /achievements, /leaderboard etc

### CSS

```css
@keyframes skeleton-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.skeleton {
  background-color: rgba(245, 232, 200, 0.08);
  background-image: linear-gradient(
    90deg,
    transparent 0,
    rgba(245, 232, 200, 0.16) 50%,
    transparent 100%
  );
  background-size: 200px 100%;
  background-repeat: no-repeat;
  background-position: -200px 0;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: 8px;
}

[data-theme="light"] .skeleton {
  background-color: rgba(132, 47, 43, 0.08);
  background-image: linear-gradient(
    90deg,
    transparent 0,
    rgba(132, 47, 43, 0.15) 50%,
    transparent 100%
  );
}

.skeleton-text { height: 12px; }
.skeleton-text-lg { height: 16px; }
.skeleton-text-xl { height: 24px; }
.skeleton-avatar { width: 40px; height: 40px; border-radius: 50%; }
.skeleton-card { height: 120px; }
.skeleton-hero { height: 360px; }
```

### Implementation

Add components:

```tsx
export function SkeletonText({ width = "100%", size = "default" }: { width?: string; size?: "sm" | "default" | "lg" | "xl" }) {
  const sizeClass = { sm: "skeleton-text", default: "skeleton-text-lg", lg: "skeleton-text-xl", xl: "skeleton-text-xl" }[size];
  return <span className={`skeleton ${sizeClass}`} style={{ width }} aria-hidden />;
}

export function SkeletonCard() {
  return <div className="skeleton skeleton-card" aria-hidden />;
}

// etc
```

Replace existing `HistoryListSkeleton`, `LeaderboardSkeleton`, etc — keep API surface stable but use new shared components inside.

### Acceptance hint

- All skeletons share shimmer animation
- Light theme works
- API compatible with existing call-sites

---

## Stage 12 — Sign-out confirmation modal

**File:** `apps/web/components/site-chrome/AuthChip.tsx`

### Goals

Premахни directly-fires sign-out на dropdown click "Изход". Replace с small confirmation dialog.

### Implementation

```tsx
"use client";

import { useState } from "react";
// ...

const [confirmSignOut, setConfirmSignOut] = useState(false);

// In dropdown JSX:
<button
  type="button"
  role="menuitem"
  className="nav-dropdown-item nav-dropdown-item-danger"
  onClick={() => {
    setOpen(false);
    setConfirmSignOut(true);
  }}
>
  <LogOut className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
  <span>Изход</span>
</button>

// At end of component:
{confirmSignOut ? (
  <SignOutConfirmDialog
    userName={displayName}
    onCancel={() => setConfirmSignOut(false)}
    onConfirm={async () => {
      setConfirmSignOut(false);
      await authClient.signOut();
      router.push("/");
      router.refresh();
    }}
  />
) : null}
```

New component `SignOutConfirmDialog.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { LogOut, X } from "lucide-react";

interface Props {
  userName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SignOutConfirmDialog({ userName, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="signout-modal-backdrop" role="presentation" onClick={onCancel}>
      <dialog ref={ref} className="signout-modal" open aria-labelledby="signout-title" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="signout-modal-close"
          onClick={onCancel}
          aria-label="Затвори"
        >
          <X strokeWidth={2} />
        </button>

        <header className="signout-modal-head">
          <span className="signout-modal-icon" aria-hidden>
            <LogOut strokeWidth={1.8} />
          </span>
          <h2 id="signout-title">Излизаш ли от масата?</h2>
          <p>Здрасти, {userName}. Сесията ще се затвори и ще се върнеш на началната страница.</p>
        </header>

        <div className="signout-modal-actions">
          <button type="button" className="signout-modal-cancel" onClick={onCancel}>
            Отказ
          </button>
          <button type="button" className="signout-modal-confirm" onClick={onConfirm}>
            Излизам
          </button>
        </div>
      </dialog>
    </div>
  );
}
```

CSS adds `.signout-modal*` rules. Light theme variants.

### Acceptance hint

- Click "Изход" в dropdown → modal opens
- Modal blur backdrop
- Cancel returns to logged-in state
- Confirm signs out as before

---

## Stage 13 — Welcome flow first-time user

### Goals

1. **Detect first-time login** — localStorage flag `tutorial-completed` absent
2. **Redirect after sign-in success** → `/tutorial?welcome=1` if first-time, else default destination
3. **Welcome banner on `/tutorial?welcome=1`** — small overlay "Добре дошъл, {name}. Това е първата ти игра."
4. **Auto-dismiss banner** after 6s OR manual close

### Implementation

**File:** `apps/web/components/sign-in/SignInStage.tsx` (or wherever post-signin redirect logic lives)

```tsx
const completed = localStorage.getItem("tutorial-completed");
const finalRedirect = completed ? redirect : "/tutorial?welcome=1";
router.push(finalRedirect);
```

**File:** `apps/web/components/tutorial/TutorialFlipbook.tsx`

Add welcome banner detection:

```tsx
const isWelcome = searchParams.get("welcome") === "1";
const [welcomeBannerVisible, setWelcomeBannerVisible] = useState(isWelcome);

useEffect(() => {
  if (!welcomeBannerVisible) return;
  const timer = window.setTimeout(() => setWelcomeBannerVisible(false), 6000);
  return () => window.clearTimeout(timer);
}, [welcomeBannerVisible]);

// In render:
{welcomeBannerVisible ? (
  <aside className="tutorial-welcome-banner" role="status">
    <p>
      <span className="tutorial-welcome-kicker">добре дошъл</span>
      <strong>{userName ?? "Играч"},</strong> ето кратък пробег през първата игра.
    </p>
    <button type="button" onClick={() => setWelcomeBannerVisible(false)} aria-label="Затвори">
      <X aria-hidden strokeWidth={2} />
    </button>
  </aside>
) : null}
```

CSS добавя `.tutorial-welcome-banner` с slide-down + auto-fade animation.

### Acceptance hint

- New user signs in → lands on /tutorial?welcome=1 не on /
- Welcome banner visible at top
- Auto-dismisses after 6s или manual close
- Returning user (tutorial-completed true) skips welcome flow

---

## Stage 14 — Brand mark + footer polish

### Brand mark — `site-chrome.tsx` BrandMark component

Add subtle hover scale + glow:

```css
.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  transition: transform 200ms ease;
}

.site-brand:hover {
  transform: scale(1.02);
}

.site-brand-mark {
  /* existing styles */
  transition: filter 280ms ease;
}

.site-brand:hover .site-brand-mark {
  filter: drop-shadow(0 0 12px rgba(217, 154, 66, 0.55));
}
```

### Footer enhancement

`apps/web/components/SiteFooter.tsx`:

Add small painterly motif + version stamp:

```tsx
<footer className="site-footer">
  <div className="site-footer-links">
    <Link href="/privacy">Поверителност</Link>
    <span aria-hidden>·</span>
    <Link href="/terms">Условия</Link>
    <span aria-hidden>·</span>
    <Link href="/report">Сигнал</Link>
    <span aria-hidden>·</span>
    <Link href="/status">Състояние</Link>
  </div>
  <p className="site-footer-tagline">© {new Date().getFullYear()} Върколак и Мафия · Бета</p>
</footer>
```

CSS adds `.site-footer-tagline` styling с дим subtle copyright.

### Acceptance hint

- Brand mark slightly scales + glows on hover
- Footer has small copyright line

---

## Stage 15 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected baselines:
- All redesigned pages × 2 themes (dark + light)
- Mobile variants
- Specific interactive states (sign-out modal, welcome banner, toast samples)

Approximate: ~40+ new/updated baseline images.

---

## Acceptance criteria

Comprehensive list (verify all):

### Pages redesigned
1. ✅ `/play/[code]` — framed-shell, sticky players panel, single "Започни игра", mobile players-on-top
2. ✅ `/lobby/[code]` — code as focal point, copy + share buttons, player preview, cinematic banner
3. ✅ `/history/[gameId]/replay` — replay viewer with timeline, banner, player chips, verdict card
4. ✅ `/friends` — cinematic banner, modern invite form, bulk action, ghost-state preview
5. ✅ `/offline` — cinematic banner, network status indicator, auto-retry, design system colors
6. ✅ `/forgot-password`, `/reset-password`, `/verify-email` — frame system, modern inputs, lucide icons

### Bugs fixed
7. ✅ Phase timeline loop arrow — single continuous SVG path с integrated badge

### Migrations completed
8. ✅ Navbar utility icons → lucide (Menu, X, MoreHorizontal, Play, Volume2/VolumeX, Sun/Moon)

### UI polish
9. ✅ Toast notifications — modern slide-in, type-aware, stack management
10. ✅ Loading skeletons — unified shimmer family, dark + light themes
11. ✅ Sign-out confirmation modal — replaces direct-fires logout
12. ✅ Welcome flow — first-time user redirect to /tutorial?welcome=1
13. ✅ Brand mark — hover scale + glow
14. ✅ Footer — small copyright tagline

### Assets
15. ✅ 4 new imagen banners (lobby, replay, friends, offline)

### Cross-cutting
16. ✅ All redesigned components have light theme variants
17. ✅ All redesigned pages use `framed-shell` pattern where applicable
18. ✅ Visual regression baselines regenerated × 2 themes
19. ✅ БГ copy preserved, English commits
20. ✅ `pnpm verify` passes end to end
21. ✅ No new npm dependencies (lucide-react already installed)

---

## Не пипай

- Game-server, schemas, role assignment, win conditions, Better Auth core
- Existing painterly art assets (only adding 4 new)
- Achievement plaque icons / FAQ category icons / promise badges (these stay custom)
- Database schema, migrations
- Test infrastructure
- Deploy pipeline

---

## Verification после всеки commit

```bash
pnpm regression && pnpm typecheck && pnpm build
```

Green → continue. Red → fix or revert immediately.

После всичките stages:
```bash
pnpm install
pnpm optimize:assets
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm smoke
pnpm frontend:e2e
E2E_LOCAL_ONLY=true pnpm e2e:auth
pnpm playtest
pnpm visual:update
pnpm visual
pnpm perf:budget
```

Manual checks:
- Open всяка redesigned page и verify cohesive с останалия site
- Test light theme toggle on every page
- Test sign-out modal flow
- Sign in as new user → verify welcome banner appears
- Trigger toast notifications от reported actions

---

## Commit strategy (≈30 atomic English commits, directly on `main`)

### Imagen + assets (1)
1. `chore(art): generate cinematic banners for lobby replay friends offline`

### /play/[code] redesign (4)
2. `feat(play): apply framed-shell wrapper and unified section styling`
3. `feat(play): sticky players panel on desktop, top-of-stack on mobile`
4. `feat(play): remove duplicate start-game CTA from narrator controls`
5. `style(play): light theme variants for all play-room components`

### /lobby/[code] (3)
6. `feat(lobby-invite): cinematic banner and focal code display`
7. `feat(lobby-invite): copy and native share buttons with toast feedback`
8. `feat(lobby-invite): player preview chips for joined participants`

### /history/[gameId]/replay (3)
9. `chore(art): wire replay banner asset`
10. `feat(replay): timeline view with phase grouping and key moments`
11. `feat(replay): player chips with final roles and verdict card`

### /friends (2)
12. `feat(friends): cinematic banner and modern invite form`
13. `feat(friends): bulk invite action and ghosted empty state preview`

### /offline (2)
14. `feat(offline): cinematic banner with network status indicator`
15. `feat(offline): auto-retry with reload on reconnection`

### Auth trio (3)
16. `style(auth): forgot-password modernized inputs and frame wrapper`
17. `style(auth): reset-password modernized inputs and frame wrapper`
18. `style(auth): verify-email modernized inputs and frame wrapper`

### Phase arrow fix (1)
19. `fix(rules): phase timeline loop arrow as single continuous svg path`

### Lucide migration completion (2)
20. `feat(site-chrome): migrate navbar utility icons to lucide`
21. `chore(css): remove obsolete custom svg helper functions`

### Toast polish (2)
22. `feat(toast): modern slide-in animation with type-aware styling`
23. `feat(toast): stack management with countdown indicators`

### Loading skeletons (2)
24. `feat(skeleton): unified shimmer family with dark and light variants`
25. `refactor(skeleton): migrate existing call-sites to shared components`

### Sign-out modal (1)
26. `feat(auth-chip): sign-out confirmation modal replaces direct logout`

### Welcome flow (1)
27. `feat(tutorial): welcome banner for first-time signed-in users`

### Brand + footer polish (1)
28. `style(site-chrome): brand mark hover glow and footer copyright tagline`

### Visual baselines (1)
29. `chore(visual): regenerate baselines for final polish pass across themes`

Plus optional:
30. `docs: update AGENTS.md with completed redesign coverage`

### Workflow

```bash
git status
git pull origin main --rebase

# Per commit:
# 1. Read relevant files
# 2. Edit
# 3. git add specific paths (no bulk -A)
# 4. git commit -m "English message"
# 5. pnpm regression && pnpm typecheck && pnpm build
# 6. Green → push (optional batched). Red → revert и поправи.
```

Recommended commit batching push: after every 5-6 commits, push to remote so progress е safe.

---

## Estimated effort

- ~5-6 hours Codex execution at high reasoning
- ~30 commits
- ~4 new imagen generations
- ~40+ visual baselines regenerated
- 0 new npm dependencies

---

## Final notes

Този PR е голям но **coherent** — finale на frontend polish work. След него:
- Всичките frontend pages използват unified design language
- Frame system + painterly bg + light theme work everywhere
- Lucide icons consistent across utility chrome
- Game-room (most complex page) finally on par с останалия site

Ако Codex срещне unexpected complexity на даден stage (e.g., /play/[code] refactor пуска test failures), **STOP, revert последния commit, и report findings**. Не продължавай със следващи stages при broken build.

---

(End of prompt)
