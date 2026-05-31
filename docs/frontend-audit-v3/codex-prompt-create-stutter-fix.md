# Codex prompt — `/werewolf/create` + `/mafia/create` stutter / flicker / layout-shift pass

При навигиране между стъпки в lobby wizard-а (`/werewolf/create` и `/mafia/create`) има три отделни проблема, които се сливат в общо "лагаво" усещане:

1. **Премигване** — целият document cross-fade-ва (StepNav, StickyPreview, navbar, дори фон), въпреки че view-transition е иmenuvan само на `.lobby-step-pane`
2. **Месене** — step content-ите имат drastically различни височини (Step 1 ≈ 1200px, Step 4 ≈ 500px), а container-ът няма `min-height` → surrounding layout jump-ва при swap
3. **Лагав feel** — full unmount/remount на step components, autoFocus auto-scroll, нов AudioContext на всеки step change, StickyPreview re-render-ва на всеки keystroke

**Работа директно на `main`.** 11 atomic English commits. No new npm dependencies. ~2 часа Codex work at high reasoning.

---

## Pre-analysis

### Architecture

- **Entry:** `apps/web/components/lobby-create-client.tsx` обвива `LobbyWizard` в `<Suspense>` (заради `useSearchParams`)
- **Orchestrator:** `apps/web/components/lobby/LobbyWizard.tsx` — useReducer + 4 conditional step components
- **Step components:** `StepRoom.tsx`, `StepRoles.tsx`, `StepStyle.tsx`, `StepPreview.tsx`
- **Sidebar:** `StickyPreview.tsx` (desktop) + `MobileSummaryChip.tsx` (mobile)
- **Step navigation:** `StepNav.tsx` — top breadcrumb + bottom Назад/Напред buttons
- **View transition:** `document.startViewTransition` + CSS `view-transition-name: "lobby-step"`
- **Audio cues:** `apps/web/lib/sound.ts` — `playCue("phase-change")` на всеки step change

### Reproduction

1. Отвори `/werewolf/create`
2. Click "Напред" 3 пъти за да стигнеш Step 4
3. Наблюдаваш:
   - StepNav-ът, StickyPreview-то и navbar-ът леко мигат при всеки swap → **проблем 1**
   - Page footer и scroll position се местят, защото Step 4 е ~700px по-къс от Step 1 → **проблем 2**
   - Натисни Назад → Напред бързо 3 пъти → audio glitch, RoleCarousel images re-decode-ват → **проблем 3**

### Root causes (по приоритет на visual impact)

| # | Cause | File:line | Impact |
|---|---|---|---|
| 1 | Root view transition crossfade-ва целия document (default behavior) | `LobbyWizard.tsx:42–49`, `globals.css:9013` | 🔴 P0 — премигване |
| 2 | `.lobby-step-pane` няма `min-height` или `contain` | `globals.css:8128` | 🔴 P0 — layout jump |
| 3 | Full unmount/remount на step components | `LobbyWizard.tsx:92–95` | 🟠 P1 — re-mount cost |
| 4 | `autoFocus` на roomName input → auto-scroll при всяко visit на Step 1 | `StepRoom.tsx:62` | 🟠 P1 — disorienting |
| 5 | Нов `AudioContext` на всеки step change | `LobbyWizard.tsx:66–73` + `sound.ts:59` | 🟡 P2 — audio glitch |
| 6 | `StickyPreview` re-render-ва на всеки keystroke | `StickyPreview.tsx` (no memo) | 🟡 P2 — wasted work |
| 7 | `roles-step-sticky` губи position при step swap | `StepRoles.tsx:53` | 🟡 P2 — resolved by #3 |
| 8 | `preview-balance i` width animira → reflow | `StickyPreview.tsx:47` | 🟢 P3 — micro-jank |
| 9 | Confetti не respect-ва `prefers-reduced-motion` | `LobbyWizard.tsx:132–149` | 🟢 P3 — a11y |
| 10 | `useSearchParams()` reactive memo без stable subscription | `LobbyWizard.tsx:36–38` | 🟢 P3 — wasted memo |
| 11 | RoleDetailModal винаги renders inside StepRoles | `StepRoles.tsx:136–142` | 🟢 P3 — fixed by #3 |

### Out of scope

- Game-server / schemas / role-assignment
- `apps/web/lib/lobby-form.ts` reducer logic (само добавяме `useRef` за initial computation pattern)
- Role definitions / mode configs
- Step component **functionality** — само mount lifecycle и focus поведение
- New npm deps — vanilla React + CSS

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Root view transition | **Disable** crossfade on root pseudo; keep `lobby-step` named animation |
| Step pane sizing | `min-height: clamp(560px, 70vh, 880px)` + `contain: layout paint` |
| Step component lifecycle | **Persist all 4 components** via `hidden` attribute; CSS `display: none` for inactive |
| autoFocus | Replace `autoFocus` prop with guarded `useEffect` — only on first mount when roomName empty |
| AudioContext | Singleton in `sound.ts` — lazy-init, never close (browser GCs on tab close) |
| StickyPreview memo | `React.memo` с shallow comparator на relevant state slices |
| Progress bar | `transform: scaleX()` instead of inline `width: X%` |
| Confetti | Skip render under `prefers-reduced-motion` |
| initialState computation | Move from `useMemo` to `useRef` (computed once on mount) |
| Branch | Directly on `main` |
| Validation | After each commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert. |

---

## Stage 1 — Kill root view-transition crossfade (P0)

### Step 1a: Override default `::view-transition-old(root)` + `::view-transition-new(root)` animations

**File:** `apps/web/app/globals.css` — около ред 9013, в секцията за `::view-transition` правила.

```diff
  ::view-transition-old(lobby-step),
  ::view-transition-new(lobby-step) {
    animation-duration: 260ms;
    animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
  }

+ /* Disable default root crossfade — only the named lobby-step element animates */
+ ::view-transition-old(root),
+ ::view-transition-new(root) {
+   animation: none;
+   mix-blend-mode: normal;
+ }
+
+ ::view-transition-group(root) {
+   animation-duration: 0s;
+ }

  ::view-transition-old(lobby-step) {
    animation-name: lobbyStepOut;
  }
```

**Защо това работи:** `document.startViewTransition` прави snapshot на целия document. Browser-ът създава имплицитна `view-transition-name: root` за `:root` element. По дефолт root snapshot-ите cross-fade-ват (250ms opacity transition). Override-ваме това с `animation: none`. Само елементи с explicit имена (като `.lobby-step-pane` → `lobby-step`) ще се аnimirат.

**Note:** Това не нарушава други view transitions в проекта (ако има такива), стига те да ползват **собствени** named transitions. Само default root cross-fade се изключва.

### Commit 1

```
fix(create): disable view-transition root crossfade, keep lobby-step animation
```

---

## Stage 2 — Stabilize step pane height (P0)

### Step 2a: Add `min-height` + `contain` на `.lobby-step-pane`

**File:** `apps/web/app/globals.css:8128`

```diff
  .lobby-step-pane {
    border-radius: 32px;
    padding: clamp(18px, 3vw, 34px);
    background:
      radial-gradient(circle at 10% 0%, rgba(209, 154, 66, 0.16), transparent 24rem),
      linear-gradient(145deg, rgba(8, 10, 10, 0.72), rgba(248, 236, 210, 0.06));
+   min-height: clamp(560px, 70vh, 880px);
+   contain: layout paint;
  }
```

**Защо:** Step 4 ≈ 500px height; Step 1 ≈ 1200px. Без `min-height`, container collapsва/expand-ва drastically при swap → footer и scroll position jump-ват. С `min-height: clamp(560px, 70vh, 880px)`:
- Минимум 560px (cover Step 4 + spare room)
- Растем до 70% viewport на средни screens
- Максимум 880px (не overflow на large displays)

`contain: layout paint` казва на browser-а, че layout shifts вътре в pane не променят outer layout — браузърът skip-ва reflow на навислящи елементи. Подобрява и rendering perf по време на view transition.

### Step 2b: Mobile responsive min-height

В съществуващия `@media (max-width: 767px)` блок (около ред 9059):

```diff
  @media (max-width: 767px) {
    .lobby-field-grid,
    /* … */ {
      grid-template-columns: 1fr;
    }

+   .lobby-step-pane {
+     min-height: clamp(480px, 80vh, 720px);
+   }
+
    .lobby-step-nav ol {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
```

### Commit 2

```
fix(create): stabilize lobby-step-pane height with min-height and contain
```

---

## Stage 3 — Persist step components (P1)

### Step 3a: Replace conditional render с `hidden` attribute

**File:** `apps/web/components/lobby/LobbyWizard.tsx:91–96`

```diff
- <div className="lobby-step-pane" style={{ viewTransitionName: "lobby-step" }}>
-   {state.step === 1 ? <StepRoom state={state} dispatch={dispatch} /> : null}
-   {state.step === 2 ? <StepRoles state={state} dispatch={dispatch} /> : null}
-   {state.step === 3 ? <StepStyle state={state} dispatch={dispatch} /> : null}
-   {state.step === 4 ? <StepPreview state={state} dispatch={dispatch} onSubmit={onSubmit} /> : null}
- </div>
+ <div className="lobby-step-pane" style={{ viewTransitionName: "lobby-step" }}>
+   <div className="lobby-step-slot" hidden={state.step !== 1}>
+     <StepRoom state={state} dispatch={dispatch} />
+   </div>
+   <div className="lobby-step-slot" hidden={state.step !== 2}>
+     <StepRoles state={state} dispatch={dispatch} />
+   </div>
+   <div className="lobby-step-slot" hidden={state.step !== 3}>
+     <StepStyle state={state} dispatch={dispatch} />
+   </div>
+   <div className="lobby-step-slot" hidden={state.step !== 4}>
+     <StepPreview state={state} dispatch={dispatch} onSubmit={onSubmit} />
+   </div>
+ </div>
```

**Защо:** `hidden` attribute уважава browser-default `display: none` — компонентът остава mounted в React tree, но не се render-ва визуално. Запазваме:
- Decoded role thumbnail images в `RoleCarousel` (Step 2)
- Scroll position на role carousel
- Focused input states
- Sticky position на `roles-step-sticky`
- `state.roleDetail` modal lifecycle

### Step 3b: CSS за `.lobby-step-slot`

**File:** `apps/web/app/globals.css` — добави след `.lobby-step-pane` (около ред 8135):

```css
.lobby-step-slot {
  display: grid;
  gap: 22px;
}

.lobby-step-slot[hidden] {
  display: none;
}
```

`display: grid` (вместо default `block` на div) запазва flex/grid behavior на children. `[hidden]` override-ва за full hide.

### Step 3c: Verify role detail modal все още работи

`RoleDetailModal` (`StepRoles.tsx:136`) се render-ва inside StepRoles. С persistent компоненти, modal-ът остава mounted дори когато си на step 3 (но `state.roleDetail` е null → modal не render-ва). При връщане на step 2 — same behavior като before. ✓

### Commit 3

```
refactor(create): persist all step components via hidden attr to preserve scroll/focus/images
```

---

## Stage 4 — Guard autoFocus на roomName input (P1)

### Step 4a: Replace `autoFocus` prop с conditional effect

**File:** `apps/web/components/lobby/StepRoom.tsx`

В imports:
```diff
- import type { Dispatch, ReactNode } from "react";
+ import { useEffect, useRef, type Dispatch, type ReactNode } from "react";
```

В StepRoom компонента, преди `return`:
```diff
  const range = playerRange(state.mode);
  const players = boundedPlayerCount(state);
  const modes = availableModes(state.family);
+
+ const roomNameRef = useRef<HTMLInputElement | null>(null);
+ const didAutoFocus = useRef(false);
+
+ useEffect(() => {
+   if (didAutoFocus.current) return;
+   if (state.roomName) {
+     didAutoFocus.current = true;
+     return;
+   }
+   roomNameRef.current?.focus({ preventScroll: true });
+   didAutoFocus.current = true;
+ }, [state.roomName]);
```

В JSX-а на field:
```diff
  <input
    className="field-input"
+   ref={roomNameRef}
    value={state.roomName}
    maxLength={42}
-   autoFocus
    onChange={(event) => dispatch({ type: "SET_ROOM_NAME", roomName: event.target.value })}
  />
```

**Защо:**
- `autoFocus` prop се прилага on every mount → с persistent components (Stage 3) се прилага само веднъж, но guard-ът добавя safety net в случай че Stage 3 се rollback-не
- `{ preventScroll: true }` казва на browser-а да фокусира БЕЗ да scrolls input-а в view — премахва auto-scroll сюрприза
- Guard-ът проверява дали roomName вече има стойност — ако да (от URL params), не фокусира (потребителят е минал по invitation flow и сигурно е попълнил)

### Commit 4

```
fix(create): guard roomName autoFocus with preventScroll to avoid scroll jumps
```

---

## Stage 5 — AudioContext singleton (P2)

### Step 5a: Convert sound.ts to singleton pattern

**File:** `apps/web/lib/sound.ts`

```diff
  export function playCue(name: CueName, options: PlayCueOptions = {}) {
    if (typeof window === "undefined" || !shouldPlayCue(options)) {
      return false;
    }

    try {
-     const AudioContextCtor =
-       window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
-     if (!AudioContextCtor) {
-       return false;
-     }
-
-     const context = new AudioContextCtor();
+     const context = getSharedAudioContext();
+     if (!context) {
+       return false;
+     }
+
+     // Wake context if suspended (mobile browsers suspend until user gesture)
+     if (context.state === "suspended") {
+       void context.resume();
+     }
+
      const master = context.createGain();
      master.gain.setValueAtTime(0.9, context.currentTime);
      master.connect(context.destination);

      for (const voice of CUE_PATTERNS[name]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = context.currentTime + voice.at;
        const endAt = startAt + voice.length;

        oscillator.type = voice.type;
        oscillator.frequency.setValueAtTime(voice.frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(voice.gain, startAt + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(startAt);
        oscillator.stop(endAt + 0.015);
      }

-     const longestCueMs = Math.max(...CUE_PATTERNS[name].map((voice) => (voice.at + voice.length) * 1000));
-     window.setTimeout(() => void context.close(), longestCueMs + 120);
+     // Disconnect master after cue completes, but keep context alive
+     const longestCueMs = Math.max(...CUE_PATTERNS[name].map((voice) => (voice.at + voice.length) * 1000));
+     window.setTimeout(() => master.disconnect(), longestCueMs + 120);
      return true;
    } catch {
      return false;
    }
  }
+
+ let sharedAudioContext: AudioContext | null = null;
+
+ function getSharedAudioContext(): AudioContext | null {
+   if (typeof window === "undefined") return null;
+   if (sharedAudioContext) return sharedAudioContext;
+   const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
+   if (!Ctor) return null;
+   sharedAudioContext = new Ctor();
+   return sharedAudioContext;
+ }
```

**Защо:** Преди — нов context на всяка стъпка → 5–20ms scheduler hitch (повече на Safari/Firefox). Сега — един context за целия живот на page. Disconnect-ваме само master gain след cue завършва. Browser-ът GC-ва context при tab close.

`context.resume()` се вика само ако browser-ът е suspendnal контекста (типично mobile auto-suspend без user gesture).

### Commit 5

```
perf(create): reuse shared AudioContext across cue plays to avoid create/close churn
```

---

## Stage 6 — Memoize StickyPreview (P2)

### Step 6a: Wrap StickyPreview with React.memo

**File:** `apps/web/components/lobby/StickyPreview.tsx`

```diff
- import {
+ import { memo } from "react";
+ import {
    ROLE_DEFINITIONS,
    countRoles,
    getGameModeNameBg,
    teamLabelBg,
    type RoleCode,
    type TeamCode,
  } from "@werewolf/shared";
  import type { Dispatch } from "react";
  /* … */

- export function StickyPreview({
+ function StickyPreviewImpl({
    state,
    dispatch,
    compact = false,
  }: {
    state: LobbyFormState;
    dispatch?: Dispatch<LobbyFormAction>;
    compact?: boolean;
  }) {
    /* … existing body unchanged … */
  }
+
+ export const StickyPreview = memo(StickyPreviewImpl, (prev, next) => {
+   // Re-render only when slices that StickyPreview reads have changed
+   const p = prev.state;
+   const n = next.state;
+   return (
+     prev.compact === next.compact &&
+     prev.dispatch === next.dispatch &&
+     p.roomName === n.roomName &&
+     p.mode === n.mode &&
+     p.playerCount === n.playerCount &&
+     p.family === n.family &&
+     p.manualRoles === n.manualRoles &&
+     p.manualRolesEnabled === n.manualRolesEnabled &&
+     p.rolePreset === n.rolePreset &&
+     p.tempoProfile === n.tempoProfile &&
+     p.advanced === n.advanced
+   );
+ });
```

**Защо:** StickyPreview чете само горните полета. Без `memo`, **всеки** dispatch (включително `SET_FORM_ERROR`, `SET_ROLE_SEARCH`, `SET_MOBILE_SUMMARY_OPEN`, и т.н.) re-render-ва StickyPreview и recompute-ва `roleBalance`, `roleWarnings`, `teamSummary`, `summarizeTeams`.

При typing в Room Name input → 1 dispatch per character → ~50ms re-render cost на mid-range phone.

С memo-то, тези irrelevant dispatches skip-ват StickyPreview re-render.

### Step 6b: Same for MobileSummaryChip

**File:** `apps/web/components/lobby/MobileSummaryChip.tsx`

Применяй similar `React.memo` pattern. Виж файла за relevant fields.

```diff
- export function MobileSummaryChip({ state, dispatch }: { … }) {
+ function MobileSummaryChipImpl({ state, dispatch }: { … }) {
    /* … */
  }
+
+ export const MobileSummaryChip = memo(MobileSummaryChipImpl);
```

(Default shallow comparator работи добре ако props са винаги state + dispatch — но дисплашира на ВСЯКА state change. Custom comparator може да е по-добре — провери какво chip-ът чете.)

### Commit 6

```
perf(create): memoize StickyPreview and MobileSummaryChip to skip irrelevant re-renders
```

---

## Stage 7 — Progress bar transform instead of width (P3)

### Step 7a: Convert width-based animation to scaleX

**File:** `apps/web/components/lobby/StickyPreview.tsx:44–48`

```diff
  <div className="preview-balance">
    <span>{state.family === "werewolves" ? "Баланс" : "Роли"}</span>
    <strong>{state.family === "werewolves" ? (balance > 0 ? `+${balance}` : balance) : `${total}/${boundedPlayerCount(state)}`}</strong>
-   <i style={{ width: `${Math.max(10, Math.min(100, state.family === "werewolves" ? 100 - Math.abs(balance) * 12 : (total / boundedPlayerCount(state)) * 100))}%` }} />
+   <i
+     className="preview-balance-bar"
+     style={{
+       transform: `scaleX(${
+         Math.max(0.1, Math.min(1, state.family === "werewolves"
+           ? (100 - Math.abs(balance) * 12) / 100
+           : total / boundedPlayerCount(state)))
+       })`,
+     }}
+   />
  </div>
```

### Step 7b: Update CSS

**File:** `apps/web/app/globals.css:8858`

```diff
  .preview-balance i {
    display: block;
    height: 8px;
+   width: 100%;
+   transform-origin: left center;
+   transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    border-radius: 999px;
    background: linear-gradient(90deg, var(--blood), var(--gold));
  }
+
+ @media (prefers-reduced-motion: reduce) {
+   .preview-balance i {
+     transition: none;
+   }
+ }
```

**Защо:** `width` промяна → reflow + repaint цяла progress bar. `transform: scaleX()` → composited layer, GPU accelerated, не trigger-ва reflow. На всеки keystroke в Room Name input → 0 reflows вместо 1.

### Commit 7

```
perf(create): use transform:scaleX for preview balance bar (skip reflow)
```

---

## Stage 8 — Confetti прави reduced-motion guard (P3)

### Step 8a: Skip confetti under reduced-motion

**File:** `apps/web/components/lobby/LobbyWizard.tsx:132–149`

```diff
  function Confetti() {
+   if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
+     return null;
+   }
    return (
      <div className="lobby-confetti" aria-hidden="true">
        {Array.from({ length: 30 }, (_, index) => (
```

Или CSS-only approach (по-clean):

**File:** `apps/web/app/globals.css` — добави след `.lobby-confetti i { … }` (около ред 9000):

```css
@media (prefers-reduced-motion: reduce) {
  .lobby-confetti {
    display: none;
  }
}
```

Препоръчвам **CSS-only** — по-малко JS, и `prefers-reduced-motion` се обработва от browser-а директно.

### Commit 8

```
a11y(create): hide confetti burst under prefers-reduced-motion
```

---

## Stage 9 — Stabilize initialState computation (P3)

### Step 9a: Replace useMemo с useRef pattern

**File:** `apps/web/components/lobby/LobbyWizard.tsx:36–38`

```diff
  const router = useRouter();
  const searchParams = useSearchParams();
- const initial = useMemo(() => initialState({ initialMode, family, urlParams: searchParams }), [family, initialMode, searchParams]);
- const [state, dispatch] = useReducer(lobbyFormReducer, initial);
+ const initialRef = useRef<LobbyFormState | null>(null);
+ if (initialRef.current === null) {
+   initialRef.current = initialState({ initialMode, family, urlParams: searchParams });
+ }
+ const [state, dispatch] = useReducer(lobbyFormReducer, initialRef.current);
```

И imports:
```diff
- import { useCallback, useEffect, useMemo, useReducer, useRef, type CSSProperties } from "react";
+ import { useCallback, useEffect, useReducer, useRef, type CSSProperties } from "react";
```

**Защо:** `useReducer(reducer, initial)` използва `initial` **само first render**. `useMemo` recompute-ваше `initial` при every `searchParams` change (потенциално identity-shift between renders), но stойността беше отхвърляна. `useRef` cache-ва resultata веднъж — нула overhead след първи render.

Внимание: `state.lockedFamily`, `state.family` се изчисляват от `family` prop в `initialState`. Ако `family` се промени dynamically (нямa текущ use case, но prophylactic), `useRef` няма да го отрази. Това е приемливо защото `family` идва от route segment, а route change → пълно ре-mount-ва компонента.

### Commit 9

```
perf(create): cache initialState in useRef instead of useMemo
```

---

## Stage 10 — Decouple `playCue` от step change effect timing (P3)

### Step 10a: Fire audio AFTER view transition completes

**File:** `apps/web/components/lobby/LobbyWizard.tsx:66–73`

```diff
  useEffect(() => {
    if (previousStep.current === state.step) {
      return;
    }
    previousStep.current = state.step;
-   playCue("phase-change");
-   triggerHaptic([12]);
+   // Defer to next frame so view-transition has captured snapshots first
+   const id = window.requestAnimationFrame(() => {
+     playCue("phase-change");
+     triggerHaptic([12]);
+   });
+   return () => window.cancelAnimationFrame(id);
  }, [state.step]);
```

**Защо:** Сега audio се пуска SYNCHRONOUSLY когато reducer apply-ва SET_STEP. View transition още не е приключил snapshot capture-а. AudioContext resume може да блокне main thread за 1–5ms → визуален hitch sync-ниран с audio start.

`requestAnimationFrame` defer-ва audio към следващия frame — view transition capture е завършил, layout pause приключен, audio init не пречи на animation start.

### Commit 10

```
perf(create): defer step-change audio cue to next animation frame
```

---

## Stage 11 — RoleDetailModal лазен render (P3)

**Note:** Stage 3 (persist step components) вече решава re-mount cost на RoleDetailModal — той остава mounted dори когато сме на Step 3. С `state.roleDetail = null`, modal-ът return-ва `null` от render — нула DOM cost.

**Не е нужен отделен fix.** Документираме като resolved-by-#3.

---

## Acceptance criteria

1. **No flicker** — превключване между стъпки не показва видим cross-fade на StepNav, StickyPreview, navbar или background. Само `.lobby-step-pane` слиза/изкача с 260ms morph.
2. **No layout shift** — page footer position остава стабилен при swap. Scroll position не jump-ва (освен ако потребителят е scroll-нал в самата step pane — but that's expected).
3. **Persistent state**:
   - Role carousel scroll position се запазва при step 2 → step 3 → step 2
   - Role search input запазва текст и focus
   - Decoded role thumbnails не се re-decode-ват визуално
   - `roles-step-sticky` остава sticky при visit-и
4. **No autoFocus auto-scroll** — връщане на Step 1 не scrolls input-а в view (`preventScroll: true`).
5. **AudioContext singleton** — DevTools → Performance → Web Audio: само 1 AudioContext entry в timeline-а, регардлес от брой step swaps.
6. **StickyPreview memo** — typing в Room Name input в Step 1 не trigger-ва re-render на StickyPreview (verify в React DevTools profiler).
7. **Progress bar smooth** — баланс bar анимира с `transform: scaleX()` без reflow.
8. **Reduced motion** — `prefers-reduced-motion: reduce` скрива confetti на submit.
9. **No regression на functionality** — всички 4 стъпки работят, Назад/Напред, breadcrumb navigation, ARIA labels непокътнати.
10. **Tests pass** — `apps/web/components/lobby/__tests__/LobbyWizard.test.tsx` все още работи.
11. **Regression + typecheck + build** green след всеки commit:
    ```bash
    pnpm regression
    pnpm typecheck
    pnpm build
    ```

---

## Verification

### Functional tests

```bash
pnpm regression
pnpm typecheck
pnpm build
pnpm --filter @werewolf/web test apps/web/components/lobby/__tests__/LobbyWizard.test.tsx
```

### Manual QA в preview

1. `/werewolf/create` — преминавай напред-назад между 4-те стъпки. Наблюдавай:
   - StepNav не мига
   - StickyPreview не мига
   - Step pane анимация е smooth 260ms
   - Footer не jump-ва
2. Step 2 → scroll role carousel → Step 3 → Step 2 → carousel scroll position запазен
3. Step 1 → въведи name → Step 2 → Step 1 → input не auto-focus + scroll
4. `/mafia/create` — повтори същия flow за мафия
5. Rapid step toggle (click Назад/Напред 5 пъти бързо) — audio не glitch-ва, без visual stutter
6. DevTools Performance recording 5 секунди step toggle session → проверете FPS (target: 60fps постоянно)
7. Submit confetti с `prefers-reduced-motion: reduce` enabled в browser → не render-ва confetti

### Screenshots в `audit-v3/after/create-stutter/`

1. `werewolf-create-step1-desktop.png`
2. `werewolf-create-step2-desktop.png` — role carousel scrolled half-way
3. `werewolf-create-step3-desktop.png`
4. `werewolf-create-step4-desktop.png`
5. `mafia-create-step1-desktop.png`
6. `create-mobile-step1.png`
7. `create-mobile-step2.png`
8. `create-transition-mid.png` — screenshot mid-transition (бутни и направи screenshot бързо) — pane е mid-morph но останалият UI стабилен
9. **Required GIF:** `create-step-swap.gif` — 3-секундно video на step swap cycle. Не трябва да виждаш flicker на StepNav или StickyPreview.

### React DevTools verification

1. Profile session: type 5 characters в Room Name input на Step 1
2. Очаквани re-renders:
   - LobbyWizard ✓ (5×)
   - StepRoom ✓ (5×)
   - StickyPreview ✗ (0× — memo skip-ва)
   - MobileSummaryChip ✗ (0× — memo skip-ва)
3. Profile session: натисни Напред
4. Очаквани re-renders:
   - LobbyWizard ✓ (1×)
   - StepRoom: render-ва се но с `hidden` (display: none, no paint cost)
   - StepRoles ✓ (1× — first reveal)
   - StickyPreview ✓ (1× — mode/playerCount/etc may have updated)

---

## Не пипай

- `apps/web/lib/lobby-form.ts` reducer logic / action types / state shape
- `packages/shared` (всичко) — role definitions, mode configs, validators
- `LobbyWizard.test.tsx` — adapt testing only if API change-ове го счупят (не очаквам)
- Game-server / schemas / role-assignment / win-conditions
- Auth flow / require-session
- `apps/web/components/lobby/RoleCarousel.tsx` internal logic — само промените са в LobbyWizard parent (hidden wrapper)
- `apps/web/components/lobby/AdvancedDrawer.tsx`
- `apps/web/components/lobby/RoleDetailModal.tsx`

---

## Commit summary

11 atomic English commits on `main`:

1. `fix(create): disable view-transition root crossfade, keep lobby-step animation`
2. `fix(create): stabilize lobby-step-pane height with min-height and contain`
3. `refactor(create): persist all step components via hidden attr to preserve scroll/focus/images`
4. `fix(create): guard roomName autoFocus with preventScroll to avoid scroll jumps`
5. `perf(create): reuse shared AudioContext across cue plays to avoid create/close churn`
6. `perf(create): memoize StickyPreview and MobileSummaryChip to skip irrelevant re-renders`
7. `perf(create): use transform:scaleX for preview balance bar (skip reflow)`
8. `a11y(create): hide confetti burst under prefers-reduced-motion`
9. `perf(create): cache initialState in useRef instead of useMemo`
10. `perf(create): defer step-change audio cue to next animation frame`
11. (no separate commit — RoleDetailModal optimization is resolved by #3)

PR title (if not direct push): `perf+fix: eliminate create flow flicker, layout shift, and re-mount churn`

**Recommended ordering note:** P0 фиксове (#1 + #2) могат да бъдат първи commit ако искаш immediate visual improvement за reviewers. Останалите са independent и могат да се landват в произволен ред.

---

(End of prompt)
