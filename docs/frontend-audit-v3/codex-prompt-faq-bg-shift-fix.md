# Codex prompt — `/faq` background shift on accordion expand

Малък focused fix. На `/faq` страницата, когато потребителят отвори въпрос (accordion expand), **фонът се "месе"** — двата ambient radial glow-а пълзят вертикално синхронно с разширяването. Това **не е търсен ефект** — страничен резултат от факта, че background-ът е сетнат на `body` с **процентни Y координати** (`at 4% 50%`), а body height се променя dinamично при expand/collapse.

**Работа директно на `main`.** 1–2 atomic English commits. No new dependencies. ~10 минути Codex work.

---

## Pre-analysis

### Reproduction

1. Отваряш `/faq` в browser
2. Click на който и да е въпрос за да отвори accordion
3. По време на 420ms expand transition, наблюдаваш как двата ambient glow-а (топъл amber вляво на 4%, студен teal вдясно на 96%) **пълзят вертикално** заедно с разширяващата се секция
4. Същото при затваряне в обратна посока

### Root cause

**File:** `apps/web/app/globals.css:14557–14573`

```css
body:has(.privacy-shell),
body:has(.terms-shell),
body:has(.report-shell),
body:has(.status-shell),
body:has(.faq-shell) {
  position: relative;
  z-index: 0;
  background:
    radial-gradient(ellipse at 4% 50%, rgba(200, 154, 85, 0.18), transparent 34rem),
    radial-gradient(ellipse at 96% 48%, rgba(43, 93, 105, 0.18), transparent 38rem),
    linear-gradient(115deg,
      rgba(5, 7, 8, 0.58) 0%,
      rgba(6, 8, 9, 0.34) 47%,
      rgba(5, 7, 8, 0.64) 100%),
    var(--art-landing-ambient) center top / 100% auto;
  background-repeat: no-repeat, no-repeat, no-repeat, repeat-y;
}
```

Двата radial gradient-а ползват **процентни Y координати** (`50%` и `48%`). CSS изчислява тези спрямо background area = body element size.

Accordion в `apps/web/components/faq/FaqHearth.tsx` използва CSS transition на `max-height` (globals.css:17857):

```css
.faq-hearth-item-answer-shell {
  max-height: 0;
  transition: max-height 360ms cubic-bezier(0.22, 0.78, 0.22, 1), …;
}
.faq-hearth-item[data-open="true"] .faq-hearth-item-answer-shell {
  max-height: 1600px;
  transition: max-height 420ms …;
}
```

При open: body height нараства с до ~1600px за 420ms. `50%` Y координата на radial gradient-а recompute-ва към нова абсолютна пиксел позиция → gradient "пълзи" нагоре или надолу sync-нато с expand transition-а. Това е видимото "месене".

### Why /privacy /terms /status /report не показват същия артефакт

Същият background setup, но **нямат accordion**. Body height е статичен след load → процентните координати не се преизчисляват → glow-овете не мърдат.

(Те все пак ще имат същия artifact ако някога добавим accordion / collapsible там — fix-а превенирно покрива и тях.)

### `scrollbar-gutter: stable` вече handle-ва scrollbar shift

В `apps/web/app/globals.css:14575`:

```css
html:has(.faq-shell) {
  scrollbar-gutter: stable;
}
```

Това запазва scrollbar slot reserved → няма horizontal jitter при expand. Но **не помага** за gradient recalculation, която е unrelated.

### Out of scope

- FAQ accordion logic / `FaqHearth.tsx` — компонентният код остава
- `FAQ_DATA` / `faq-data.ts`
- Other faq-related styles (toolbar, search, filters)
- `--art-landing-ambient` / `--texture-paper` background images — те остават scroll-вани на body
- Other pages without the `:has()` background pattern

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Fix approach | **Move radial + linear gradients to `position: fixed` pseudo-element**. Ambient art texture остава на body (scroll-ва нормално). |
| Why not `background-attachment: fixed` | iOS Safari silently игнорира това → не работи на mobile |
| Why not pixel positions (`50vh`, `600px`) | Glow остава винаги в горната част на page → губи "ambient throughout" feel |
| Why not disable transition | Запазваме smooth accordion UX |
| Scope | Покрива **всички 5 shell-ове** (privacy/terms/report/status/faq) — единствен FAQ показва видим artifact, но fix-а е универсален |
| Pseudo choice | `::before` (вече deklariran но `display: none`-нат — re-enable-ваме го); `::after` остава disabled |
| Branch | Directly on `main` |
| Validation | `pnpm regression && pnpm typecheck && pnpm build`. If red, revert. |

---

## Stage 1 — Split background: art stays on body, gradients move to fixed pseudo

### Step 1a: Simplify body background to art only (dark theme)

**File:** `apps/web/app/globals.css`, около ред 14557.

```diff
  body:has(.privacy-shell),
  body:has(.terms-shell),
  body:has(.report-shell),
  body:has(.status-shell),
  body:has(.faq-shell) {
    position: relative;
    z-index: 0;
-   background:
-     radial-gradient(ellipse at 4% 50%, rgba(200, 154, 85, 0.18), transparent 34rem),
-     radial-gradient(ellipse at 96% 48%, rgba(43, 93, 105, 0.18), transparent 38rem),
-     linear-gradient(115deg,
-       rgba(5, 7, 8, 0.58) 0%,
-       rgba(6, 8, 9, 0.34) 47%,
-       rgba(5, 7, 8, 0.64) 100%),
-     var(--art-landing-ambient) center top / 100% auto;
-   background-repeat: no-repeat, no-repeat, no-repeat, repeat-y;
+   background: var(--art-landing-ambient) center top / 100% auto repeat-y;
  }
```

### Step 1b: Simplify body background to art only (light theme)

В съседния override (около ред 14583):

```diff
  html[data-theme="light"] body:has(.privacy-shell),
  html[data-theme="light"] body:has(.terms-shell),
  html[data-theme="light"] body:has(.report-shell),
  html[data-theme="light"] body:has(.status-shell),
  html[data-theme="light"] body:has(.faq-shell) {
-   background:
-     radial-gradient(ellipse at 4% 50%, rgba(255, 230, 180, 0.32), transparent 34rem),
-     radial-gradient(ellipse at 96% 48%, rgba(180, 200, 220, 0.28), transparent 38rem),
-     linear-gradient(115deg,
-       rgba(252, 244, 230, 0.58) 0%,
-       rgba(252, 244, 230, 0.34) 47%,
-       rgba(252, 244, 230, 0.64) 100%),
-     var(--texture-paper) center / 620px 620px,
-     var(--art-landing-ambient) center top / 100% auto;
-   background-repeat: no-repeat, no-repeat, no-repeat, repeat, repeat-y;
+   background:
+     var(--texture-paper) center / 620px 620px repeat,
+     var(--art-landing-ambient) center top / 100% auto repeat-y;
  }
```

Texture paper остава на body (scroll-вa). Тя е tileable pattern → recompute не е visible.

### Step 1c: Re-enable `::before` като fixed gradient layer (dark theme)

Текущото правило около ред 14596 крие двата pseudo-а:

```diff
- body:has(.privacy-shell)::before,
- body:has(.privacy-shell)::after,
- body:has(.terms-shell)::before,
- body:has(.terms-shell)::after,
- body:has(.report-shell)::before,
- body:has(.report-shell)::after,
- body:has(.status-shell)::before,
- body:has(.status-shell)::after,
- body:has(.faq-shell)::before,
- body:has(.faq-shell)::after {
-   display: none;
- }

+ body:has(.privacy-shell)::before,
+ body:has(.terms-shell)::before,
+ body:has(.report-shell)::before,
+ body:has(.status-shell)::before,
+ body:has(.faq-shell)::before {
+   content: "";
+   position: fixed;
+   inset: 0;
+   z-index: -1;
+   pointer-events: none;
+   background:
+     radial-gradient(ellipse at 4% 50%, rgba(200, 154, 85, 0.18), transparent 34rem),
+     radial-gradient(ellipse at 96% 48%, rgba(43, 93, 105, 0.18), transparent 38rem),
+     linear-gradient(115deg,
+       rgba(5, 7, 8, 0.58) 0%,
+       rgba(6, 8, 9, 0.34) 47%,
+       rgba(5, 7, 8, 0.64) 100%);
+ }

+ body:has(.privacy-shell)::after,
+ body:has(.terms-shell)::after,
+ body:has(.report-shell)::after,
+ body:has(.status-shell)::after,
+ body:has(.faq-shell)::after {
+   display: none;
+ }
```

### Step 1d: Light theme override на pseudo

Веднага след light theme body rule (около ред 14594), добави:

```css
html[data-theme="light"] body:has(.privacy-shell)::before,
html[data-theme="light"] body:has(.terms-shell)::before,
html[data-theme="light"] body:has(.report-shell)::before,
html[data-theme="light"] body:has(.status-shell)::before,
html[data-theme="light"] body:has(.faq-shell)::before {
  background:
    radial-gradient(ellipse at 4% 50%, rgba(255, 230, 180, 0.32), transparent 34rem),
    radial-gradient(ellipse at 96% 48%, rgba(180, 200, 220, 0.28), transparent 38rem),
    linear-gradient(115deg,
      rgba(252, 244, 230, 0.58) 0%,
      rgba(252, 244, 230, 0.34) 47%,
      rgba(252, 244, 230, 0.64) 100%);
}
```

### Why `z-index: -1` + body `z-index: 0`

Body вече има `z-index: 0` (запазен в Step 1a/1b), което създава **stacking context**. `::before` с `z-index: -1` ще се рендерира **зад** body's contents, но **в** body's stacking context — т.е. **под** main content, но **над** други fixed elements (като navbar) ако те имат техен собствен higher z-index. Това запазва navbar и popovers стабилни.

`pointer-events: none` гарантира, че pseudo-то не intercept-ва clicks/scroll wheel events.

### Commit 1

```
fix(faq): move ambient gradients to position:fixed pseudo (kill body-height shift)
```

---

## Stage 2 — Verify no regressions on other framed pages

### Manual verification matrix

| Page | Dark theme | Light theme | Mobile dark | Mobile light |
|---|---|---|---|---|
| `/faq` (closed accordion) | ✓ glow visible | ✓ glow visible | ✓ | ✓ |
| `/faq` (open accordion) | ✓ glow **NOT** moving | ✓ glow **NOT** moving | ✓ | ✓ |
| `/faq` (deep scroll) | ✓ glow stays viewport-centered | ✓ same | ✓ | ✓ |
| `/privacy` | ✓ identical to before | ✓ identical | ✓ | ✓ |
| `/terms` | ✓ identical | ✓ identical | ✓ | ✓ |
| `/status` | ✓ identical | ✓ identical | ✓ | ✓ |
| `/report` | ✓ identical | ✓ identical | ✓ | ✓ |

### Edge cases to test

1. **Navbar dropdowns** — отвори "Игри" / "Профил" dropdown на `/faq`. Pseudo с `z-index: -1` трябва да остане под dropdown surface.
2. **Modal overlays** — ако някоя страница отваря modal (sign-out confirm, etc.), background pseudo не трябва да го засенчва.
3. **iOS Safari** — отвори `/faq` на iPhone safari. Pseudo с `position: fixed` работи нативно (за разлика от `background-attachment: fixed`). Open accordion → glow стабилен.
4. **Print view** — `window.print()` от `/privacy`. Pseudo с `position: fixed` може да повлияе на pagination. Ако виждаш проблем, добави `@media print { body::before { display: none; } }`.

### Commit 2 (optional, only if print breakage observed)

```
fix(faq): hide ambient pseudo gradient in print media
```

```css
@media print {
  body:has(.privacy-shell)::before,
  body:has(.terms-shell)::before,
  body:has(.report-shell)::before,
  body:has(.status-shell)::before,
  body:has(.faq-shell)::before {
    display: none;
  }
}
```

---

## Acceptance criteria

1. **No background shift on /faq accordion** — open/close на въпрос вече не премества двата ambient glow-а. Те остават fixed спрямо viewport.
2. **Visual parity** — glow appearance (color, size, position) изглежда identical с предишното състояние при закрит accordion и при scroll position 0. Само expand/collapse behavior е променен.
3. **Other shells unchanged** — `/privacy`, `/terms`, `/status`, `/report` изглеждат identical визуално (не виждаш разлика между before/after screenshots).
4. **Scroll behavior** — art ambient + paper texture (light theme) запазват scroll-вай behavior. Само radial + linear glow са fixed.
5. **Mobile (iOS Safari)** — glow стабилен по време на accordion expand на iPhone — за разлика от `background-attachment: fixed`, който iOS игнорира.
6. **Stacking** — navbar, dropdowns, modals не са обвити или засенчени от pseudo-то.
7. **Regression + typecheck + build** green:
   ```bash
   pnpm regression
   pnpm typecheck
   pnpm build
   ```

---

## Verification

След commit-а:

```bash
pnpm regression
pnpm typecheck
pnpm build
```

Стартирай preview и направи screenshots в `audit-v3/after/faq-bg-shift/`:

1. `faq-dark-closed.png` — `/faq`, всички accordion-и затворени, dark theme
2. `faq-dark-open.png` — `/faq`, един въпрос отворен mid-expand (бутни и направи screenshot бързо)
3. `faq-dark-open-settled.png` — същия въпрос но след transition completion
4. `faq-light-open.png` — light theme equivalent на #3
5. `faq-mobile-dark-open.png` — 390×844, dark, accordion open
6. `faq-mobile-light-open.png` — 390×844, light, accordion open

Sanity checks (потвърждават no regressions):

7. `privacy-dark.png` — `/privacy` dark theme
8. `privacy-light.png` — `/privacy` light theme
9. `terms-dark.png` — `/terms` dark theme
10. `status-dark.png` — `/status` dark theme

**Critical visual test:** Запиши кратко video / GIF на accordion open/close cycle. Двата ambient glow-а не трябва да помръднат **изобщо** по време на 420ms expansion. Преди fix-а, движението е видимо около ~30–50% през transition-а.

---

## Не пипай

- `apps/web/components/faq/FaqHearth.tsx` — компонентният code остава
- `apps/web/components/faq/FaqAnswerRenderer.tsx`
- `apps/web/lib/faq-data.ts`
- `.faq-hearth-item-answer-shell` transition — accordion UX остава непокътната
- Other faq-related styles (toolbar, search, filters, item footer)
- `--art-landing-ambient` background image
- `--texture-paper` (light theme)
- Game-server / schemas / auth flow

---

## Commit summary

1–2 atomic English commits on `main`:

1. `fix(faq): move ambient gradients to position:fixed pseudo (kill body-height shift)`
2. *(optional)* `fix(faq): hide ambient pseudo gradient in print media`

PR title (if not direct push): `fix: kill background shift on /faq accordion expand`

---

(End of prompt)
