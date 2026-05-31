# Codex prompt — `/werewolf/join` + `/mafia/join` box-in-box fix

Малък focused fix за **двойната рамка** на join страниците. Page wrapper-ът има `framed-shell` (cream/dark parchment border + radius + shadow), а `.join-entry-card` вътре има **същия pattern** (border + radius + tavern art bg + shadow). Резултат — две концентрични chrome рамки, "passport вътре в албум" feel. На light theme cream parchment рамката се вижда около кремаво-кафявата карта като дублиран layer.

**Работа директно на `main`.** 3 atomic English commits. No new dependencies, no new imagen. ~15 минути Codex work.

---

## Pre-analysis

### Current implementation

**Page wrappers:**
- `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx`
- `apps/web/app/mafia/join/[[...roomCode]]/page.tsx`

И двата файла рендерират:

```tsx
<main className="shell lobby-shell join-shell framed-shell" data-theme="…" data-family="…">
  <div className="framed-shell-inner join-shell-inner">
    <AuthGatedEntryClient … />
  </div>
</main>
```

Което произвежда:

1. **Outer chrome:** `framed-shell` (apps/web/app/globals.css:18069)
   - `border: 1px solid rgba(245, 232, 200, 0.14)`
   - `border-radius: 28px`
   - `background: rgba(17, 12, 10, 0.92)` (cream `rgba(252, 246, 236, 0.94)` в light theme)
   - `box-shadow: 0 32px 60px rgba(0, 0, 0, 0.45), inset …`

2. **Inner chrome:** `.join-entry-card` (apps/web/app/globals.css:6195)
   - `border: 1px solid rgba(245, 232, 200, 0.16)`
   - `border-radius: 28px`
   - `background: linear-gradient(…) + var(--art-lobby) center / cover`
   - `box-shadow: 0 28px 82px rgba(0, 0, 0, 0.42), inset …`
   - Плюс `::before` (inner edge) и `::after` (radial glow)

Двете chrome layer-а имат **същия border radius (28px)** и similar shadow patterns. На light theme outer cream parchment се вижда като рамка около inner кремаво-кафявата карта — нещо като "passport вътре в албум".

### Why dropping framed-shell is the right move

- `.join-entry-card` вече **е** визуалният chrome на страницата — full border, radius, tavern art с gradient mask, shadow, inner edge.
- Outer `framed-shell` дублира всичко без visual stake.
- Други страници (privacy, terms, status, faq) ползват `framed-shell` защото съдържанието им е безличен текст, който се нуждае от рамка. Join card-ът е visually heavy panel и не се нуждае.

### Out of scope

- Game-server / schemas / role-assignment
- Auth flow / require-session
- AuthGatedEntryClient component code — само page wrappers + CSS
- Other pages that use `framed-shell` — `/privacy`, `/terms`, `/status`, `/faq`, `/report` остават както са

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Approach | Drop `framed-shell` + `framed-shell-inner` от join pages; decouple `.join-shell` стайлсте от `.join-shell.framed-shell` композитния селектор |
| Compensation | Strengthen картата леко — radius 28→32px, shadow 28→36px, depth 82→96px; за да компенсира загубата на outer chrome |
| Light theme | Same strengthen на light variant |
| Branch | Directly on `main` |
| Validation | After each commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert. |

---

## Stage 1 — Drop `framed-shell` от двата page файла

### Step 1a: Update mafia join page

**File:** `apps/web/app/mafia/join/[[...roomCode]]/page.tsx`

```diff
  return (
-   <main className="shell lobby-shell join-shell framed-shell" data-theme="mafia" data-family="mafia">
-     <div className="framed-shell-inner join-shell-inner">
+   <main className="shell lobby-shell join-shell" data-theme="mafia" data-family="mafia">
+     <div className="join-shell-inner">
        <AuthGatedEntryClient family="mafia" mode="mafia_free" initialCode={initialCode} />
      </div>
    </main>
  );
```

### Step 1b: Update werewolf join page

**File:** `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx`

```diff
  return (
-   <main className="shell lobby-shell join-shell framed-shell" data-theme="werewolves" data-family="werewolves">
-     <div className="framed-shell-inner join-shell-inner">
+   <main className="shell lobby-shell join-shell" data-theme="werewolves" data-family="werewolves">
+     <div className="join-shell-inner">
        <AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode={initialCode} />
      </div>
    </main>
  );
```

### Commit 1

```
fix(join): drop outer framed-shell wrapper from werewolf and mafia join pages
```

---

## Stage 2 — Decouple `.join-shell` от композитния селектор

**File:** `apps/web/app/globals.css` — в "Join gate — room code entry" секцията (около ред 6185).

Текущо правило ползва двата класа заедно. Замени селектора така че `.join-shell` да работи самостоятелно, понеже page-овете вече не ползват `framed-shell`:

```diff
  /* ============================== */
  /* Join gate — room code entry     */
  /* ============================== */

- .join-shell.framed-shell {
+ .join-shell {
    width: min(1120px, 94vw);
+   margin: 24px auto 96px;
    padding-block: 32px 64px;
  }
```

И в mobile media query секцията долу (около ред 6471):

```diff
  @media (max-width: 760px) {
-   .join-shell.framed-shell {
+   .join-shell {
      width: min(100%, 100vw);
      padding-top: 12px;
    }
```

**Бележка:** Margin (`24px auto 96px`) преди се наследяваше от `.framed-shell` базата. Сега го добавяме explicit-но на `.join-shell`, за да запазим vertical rhythm-а на страницата.

### Commit 2

```
refactor(join): decouple .join-shell from .framed-shell composite selector
```

---

## Stage 3 — Strengthen картата леко

Понеже outer chrome изчезна, картата става единственият visual anchor. Малко по-голям радиус + малко по-силна сянка за да задържи visual weight.

**File:** `apps/web/app/globals.css` — в `.join-entry-card` (около ред 6195):

```diff
  .join-entry-card {
    position: relative;
    overflow: hidden;
    display: grid;
    gap: 24px;
    min-height: 420px;
    border: 1px solid rgba(245, 232, 200, 0.16);
-   border-radius: 28px;
+   border-radius: 32px;
    padding: clamp(24px, 4vw, 44px);
    background:
      linear-gradient(90deg, rgba(13, 9, 8, 0.94) 0%, rgba(17, 12, 10, 0.8) 52%, rgba(17, 12, 10, 0.48) 100%),
      var(--art-lobby) center / cover no-repeat;
    box-shadow:
-     0 28px 82px rgba(0, 0, 0, 0.42),
+     0 36px 96px rgba(0, 0, 0, 0.5),
      inset 0 1px rgba(255, 255, 255, 0.08);
    color: #f5e8c8;
    isolation: isolate;
  }
```

И на light theme override (около ред 6407):

```diff
  html[data-theme="light"] .join-entry-card {
-   border-color: rgba(83, 52, 31, 0.18);
+   border-color: rgba(83, 52, 31, 0.22);
    background:
      linear-gradient(90deg, rgba(252, 246, 236, 0.94) 0%, rgba(247, 233, 208, 0.82) 58%, rgba(247, 233, 208, 0.54) 100%),
      var(--art-lobby) center / cover no-repeat;
    box-shadow:
-     0 24px 62px rgba(67, 39, 24, 0.16),
+     0 32px 80px rgba(67, 39, 24, 0.22),
      inset 0 1px rgba(255, 255, 255, 0.55);
    color: #2a1b10;
  }
```

И на mobile responsive override (около ред 6477):

```diff
  @media (max-width: 760px) {
    /* … */
    .join-entry-card {
      min-height: auto;
-     border-radius: 22px;
+     border-radius: 26px;
    }
```

### Commit 3

```
style(join): strengthen card chrome to compensate for removed outer frame
```

---

## Acceptance criteria

1. **Single visible chrome layer** — на `/mafia/join` и `/werewolf/join` (desktop + mobile, dark + light theme) има **една единствена** видима рамка — самата карта.
2. **Light theme:** няма cream parchment "passport" около кремавата карта. Visual depth идва само от самата карта's shadow.
3. **Tavern art preserved** — gradient mask + tavern background image остават както са.
4. **Card placement** — vertical margin не се променя осезаемо (24px top, 96px bottom от document edges, същото както преди при `framed-shell` heritage).
5. **No HTML regressions** — `.join-entry-card`, `.join-entry-hero`, `.join-entry-code-panel`, и т.н. не са пипнати. Само outer wrapper класовете на `<main>` и `<div>` се променят.
6. **Other framed pages untouched** — `/privacy`, `/terms`, `/status`, `/faq`, `/report`, `/sign-in/forgot-password`, `/sign-in/verify-email` запазват `framed-shell` визуализация.
7. **Regression + typecheck + build** green:
   ```bash
   pnpm regression
   pnpm typecheck
   pnpm build
   ```

---

## Verification

След трите commit-и:

```bash
pnpm regression
pnpm typecheck
pnpm build
```

Стартирай preview и направи **before/after screenshots** в `audit-v3/after/join-box-fix/`:

1. `mafia-join-desktop-dark.png` — `/mafia/join`, 1440×900, dark theme
2. `mafia-join-desktop-light.png` — `/mafia/join`, 1440×900, light theme
3. `werewolf-join-desktop-dark.png` — `/werewolf/join`, 1440×900, dark theme
4. `werewolf-join-desktop-light.png` — `/werewolf/join`, 1440×900, light theme
5. `mafia-join-mobile.png` — `/mafia/join`, 390×844
6. `werewolf-join-mobile.png` — `/werewolf/join`, 390×844

На всеки screenshot потвърди, че **outer cream/dark parchment рамка не съществува** — само самата карта с tavern art-а е видима.

**Sanity check на други pages:**

7. `privacy-still-framed.png` — `/privacy`, потвърждава, че fixture pages запазват `framed-shell`
8. `terms-still-framed.png` — `/terms`, същото

---

## Не пипай

- `apps/web/components/games/auth-gated-entry-client.tsx` — компонентният код остава
- `apps/web/lib/require-session.ts`
- `apps/web/app/api/game-token/route.ts`
- Game-server logic
- `.framed-shell` базови стайлсте (other pages still use them)
- Pages other than join — `/privacy`, `/terms`, `/status`, `/faq`, `/report`, `/sign-in/*`

---

## Commit summary

3 atomic English commits on `main`:

1. `fix(join): drop outer framed-shell wrapper from werewolf and mafia join pages`
2. `refactor(join): decouple .join-shell from .framed-shell composite selector`
3. `style(join): strengthen card chrome to compensate for removed outer frame`

PR title (if not direct push): `fix: remove box-in-box chrome on /werewolf/join + /mafia/join`

---

(End of prompt)
