# Codex prompt — `/werewolf/join` + `/mafia/join` polish pass

Текущите join страници са функционални, но **визуално и копи-wise идентични** между мафия и върколак — само accent цветът се различава чрез `data-theme`. Картата е статична, паство-frinedly, но missing-ват loading state, family-specific лице, paste handling за URL, recent rooms, и room metadata preview за inviting flow.

**Работа директно на `main`.** ~11 atomic English commits. No new npm dependencies, no new imagen. ~2–3 часа Codex work at high reasoning.

---

## Pre-analysis

### Current implementation

**Page wrappers:**
- `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx`
- `apps/web/app/mafia/join/[[...roomCode]]/page.tsx`

Двата файла рендерират **същата компонента** `AuthGatedEntryClient` (`apps/web/components/games/auth-gated-entry-client.tsx`) със само `family` + `mode` пропс. CSS в `apps/web/app/globals.css` секция "Join gate — room code entry" (lines ~6181–6489).

Room code-овете са винаги **6 символа** от alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (без I, O, 0, 1 — източник: `apps/game-server/src/rooms/GameRoom.ts:2233`). Това е важно за валидация и UI hint.

### Issues

| # | Issue |
|---|---|
| 1 | Двете семейства имат **идентично копи** — heading, kicker, code label, CTA labels. Само `data-theme` accent се различава. Loss of identity. |
| 2 | Hero icon `DoorOpen` е универсален — нищо мафия / нищо върколак. |
| 3 | "Влез в стая" → `router.push(playPath)` няма **loading feedback**. Click → 200–800ms пауза, тогава navigation. Потребителят cliked отново. |
| 4 | Картата не е `<form>` element — **Enter не submit-ва**, autofill / password manager не работят. |
| 5 | Едно дълго input поле с `letter-spacing: 0.18em` — paste на `ABC-123` или `https://…/play/ABC123` не работи. Codex-prompt-join-redesign.md проектира **6 segmented slots** които никога не са имплементирани. |
| 6 | **Recent rooms recall** липсва — група, която играе няколко session-а в един и същ ден, type-ва кода всеки път. |
| 7 | **Room metadata preview** липсва — `/werewolf/join/ABC123` показва празна форма с pre-filled код вместо banner "Стая ABC123 · 4/8 играчи в лоби · Митко стопанин". |
| 8 | "Влез в стая" + "Създай стая" са **равноправни CTA-та**. Когато идваш от покана (`initialCode` present), категорично искаш join, не create. |
| 9 | Spectator toggle live-ва редом до code panel, без обяснение **какво значи**. И ако цъкнеш "Създай стая" с toggle включен — `spectator=1` пропада (Create маршрут не го forward-ва). |
| 10 | `maxLength={12}` на input-а е щедро. Истинските кодове са винаги 6. |
| 11 | Грешката се появява тихо без `role="alert"`, без shake animation. |
| 12 | Картата има `min-height: 420px` → под нея 64px празно тъмно поле. |
| 13 | `session.user.name ?? "играч"` — fallback "играч" звучи технически. По-добре "приятел". |
| 14 | Loading state (`isPending || !session`) replace-ва съдържанието с spinner card. Картата подскача когато session resolve-не. |
| 15 | **Box-in-box** — page wrapper-ът добавя `framed-shell` (cream/dark рамка + border + radius + shadow), а `.join-entry-card` вътре има свой пълен chrome (border + radius + tavern art + shadow). Две концентрични рамки → "passport вътре в албум". |

### Out of scope

- Game-server / schemas / role-assignment / win-conditions
- `apps/web/app/api/game-token/route.ts` (auth flow)
- `apps/web/components/lobby-create-client.tsx` (Create flow)
- The play page (`/play/[code]`) — separate redesign
- Adding new npm dependencies — vanilla React + CSS only

---

## Pre-decisions (locked, no clarifying questions)

| Decision | Choice |
|---|---|
| Branch | Directly on `main`, atomic English commits |
| Code input | Replace single `<input>` с **6 segmented brass slots** (auto-advance + paste + backspace) |
| Family copi разклонение | YES — kicker, heading, sub, code label, CTA labels всички различни |
| Family icon | `Martini` (мафия) / `Moon` (върколак) instead of `DoorOpen` |
| Loading state на CTA | `useTransition` + disabled button + label swap ("Хлопаме на вратата…" / "Тръгваме към селото…") |
| Form wrapper | `<form onSubmit>` за Enter + autofill |
| Recent rooms | localStorage `werewolf-mafia:recent-rooms` — top 3 entries, chips под полето |
| URL paste handling | Paste handler regex: `/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}/` — auto-extract от целия линк |
| Room metadata preview | NEW endpoint `GET /api/rooms/[code]/preview` (read-only, 5s cache) + banner above code |
| CTA hierarchy with initialCode | Primary `Влез в стая` full-width, Create demoted до ghost link "Нямам код? Създай нова стая →" |
| CTA hierarchy без initialCode | Запази equal-weight pair |
| Spectator + Create conflict | Forward `?spectator=1` в Create URL; create flow приема и форсира `as_spectator` mode |
| Error display | role="alert" + shake animation + move above code slots |
| Empty bottom space | Add trust strip + family flavor citation footer вътре в framed-shell |
| Light theme | All new components include `[data-theme="light"]` overrides |
| Bulgarian-only copy | All user-facing strings; English само в commits и code identifiers |
| Box-in-box | **Drop `framed-shell` от join pages**. `.join-entry-card` already носи пълен chrome (border + radius + art + shadow); outer cream рамка е излишна. |
| Validation | After each commit: `pnpm regression && pnpm typecheck && pnpm build`. If red, revert immediately. |

---

## Stage 1 — Family copy + icon разклонение

**File:** `apps/web/components/games/auth-gated-entry-client.tsx`

### Step 1a: Update imports

Replace `DoorOpen, Eye, Gamepad2` import с family-specific icons:

```tsx
import {
  Eye,
  Gamepad2,
  KeyRound,
  LoaderCircle,
  Martini,
  Moon,
  Plus,
  Users,
} from "lucide-react";
```

### Step 1b: Add family copy map

Веднага преди `export function AuthGatedEntryClient`:

```ts
const FAMILY_COPY = {
  mafia: {
    Icon: Martini,
    kicker: "частен бар",
    greeting: (name: string) => `Добре дошъл в бара, ${name}.`,
    sub: "Покажи кода на бара. Заведи се на масата.",
    codeLabel: "Парола на бара",
    placeholder: "4F7K2A",
    submitLabel: "Хлопам на вратата",
    submittingLabel: "Хлопаме на вратата…",
    createLabel: "Създай нов бар",
    createGhostLabel: "Нямам код? Създай нов бар →",
    spectatorOn: "Сядам встрани, без роля",
    spectatorOff: "Влизам да играя",
    spectatorHint: "Гледаш играта, но не получаваш роля. Можеш да говориш само в чат за наблюдатели.",
    flavorFooter: "„Името стои на масата. Кодът отваря вратата. Останалото — между нас.\"",
  },
  werewolves: {
    Icon: Moon,
    kicker: "тихо село",
    greeting: (name: string) => `Добре дошъл в селото, ${name}.`,
    sub: "Покажи знакът. Премини през оградата.",
    codeLabel: "Знакът на селото",
    placeholder: "MOON42",
    submitLabel: "Влизам в селото",
    submittingLabel: "Тръгваме към селото…",
    createLabel: "Създай ново село",
    createGhostLabel: "Нямам знак? Създай ново село →",
    spectatorOn: "Гледам отстрани, без роля",
    spectatorOff: "Влизам да играя",
    spectatorHint: "Гледаш как селото решава, но не получаваш роля.",
    flavorFooter: "„Селото е тихо. Покажи знакът си преди оградата.\"",
  },
} as const;
```

### Step 1c: Use family copy в JSX

Replace existing `<header>` block:

```tsx
const copy = FAMILY_COPY[isMafia ? "mafia" : "werewolves"];
const FamilyIcon = copy.Icon;
const friendlyName = session.user.name?.trim() || "приятел";
// ...
<header className="join-entry-hero">
  <span className="join-entry-mark" aria-hidden>
    <FamilyIcon strokeWidth={1.8} />
  </span>
  <div>
    <p className="section-kicker join-entry-kicker">{copy.kicker}</p>
    <h2>{copy.greeting(friendlyName)}</h2>
    <p>{copy.sub}</p>
  </div>
</header>
```

Аналогично за code label, CTA label-и, spectator pill labels — read от `copy.*`.

### Commit 1

```
feat(join): family-specific copy and lucide icons for mafia vs werewolves
```

---

## Stage 2 — Segmented code slots (6 brass cells)

### Step 2a: Constants in shared

**File:** `packages/shared/src/index.ts` (или съответния exports file)

Експортирай room code конфигурация:

```ts
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_REGEX = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
export const ROOM_CODE_EXTRACT_REGEX = new RegExp(`[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}`, "g");
```

Re-use в `auth-gated-entry-client.tsx`, `LobbyCreateClient`, `cleanRoomCode` helper-а.

### Step 2b: New `JoinCodeSlots` subcomponent

**File:** `apps/web/components/games/join-code-slots.tsx` (нов файл)

```tsx
"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_CODE_EXTRACT_REGEX } from "@werewolf/shared";

type JoinCodeSlotsProps = {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
};

export function JoinCodeSlots({ value, onChange, invalid, autoFocus }: JoinCodeSlotsProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && !value) {
      refs.current[0]?.focus();
    }
  }, [autoFocus, value]);

  const setRef = (i: number) => (el: HTMLInputElement | null) => {
    refs.current[i] = el;
  };

  const handleChange = (i: number, raw: string) => {
    const clean = raw.toUpperCase().split("").filter((c) => ROOM_CODE_ALPHABET.includes(c)).slice(0, 1).join("");
    if (!clean) {
      // Allow clearing
      const next = value.slice(0, i) + " " + value.slice(i + 1);
      onChange(next.replace(/\s+$/, "").trimEnd());
      return;
    }
    const padded = value.padEnd(ROOM_CODE_LENGTH, " ");
    const next = (padded.slice(0, i) + clean + padded.slice(i + 1)).trimEnd();
    onChange(next.slice(0, ROOM_CODE_LENGTH));
    if (i < ROOM_CODE_LENGTH - 1) {
      refs.current[i + 1]?.focus();
      refs.current[i + 1]?.select();
    }
  };

  const handleKeyDown = (i: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !value[i] && i > 0) {
      event.preventDefault();
      const next = value.slice(0, i - 1);
      onChange(next);
      refs.current[i - 1]?.focus();
    } else if (event.key === "ArrowLeft" && i > 0) {
      event.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (event.key === "ArrowRight" && i < ROOM_CODE_LENGTH - 1) {
      event.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text").toUpperCase();
    const match = text.match(ROOM_CODE_EXTRACT_REGEX);
    if (match && match[0]) {
      onChange(match[0]);
      refs.current[ROOM_CODE_LENGTH - 1]?.focus();
    }
  };

  return (
    <div
      className="join-codeslots"
      data-invalid={invalid ? "true" : undefined}
      role="group"
      aria-label="Код на стаята"
    >
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={setRef(i)}
          className="join-codeslot"
          data-filled={value[i] ? "true" : undefined}
          maxLength={1}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          spellCheck={false}
          value={value[i] ?? ""}
          onChange={(event) => handleChange(i, event.target.value)}
          onKeyDown={(event) => handleKeyDown(i, event)}
          onPaste={handlePaste}
          aria-label={`Символ ${i + 1} от ${ROOM_CODE_LENGTH}`}
        />
      ))}
    </div>
  );
}
```

### Step 2c: Replace в `AuthGatedEntryClient`

Премахни единичния input. Замени `.join-entry-code-field` с:

```tsx
<div className="join-entry-code-field">
  <span>
    <KeyRound aria-hidden strokeWidth={1.8} />
    {copy.codeLabel}
  </span>
  <JoinCodeSlots
    value={roomCode}
    onChange={setRoomCode}
    invalid={Boolean(error)}
    autoFocus={!initialCode}
  />
  <span className="join-codeslots-hint">
    {ROOM_CODE_LENGTH} знака · A–Z (без I, O) · 2–9 (без 0, 1)
  </span>
</div>
```

### Step 2d: CSS for slots

**File:** `apps/web/app/globals.css` — добавb в "Join gate" section:

```css
.join-codeslots {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(6px, 1.2vw, 12px);
}

.join-codeslot {
  width: clamp(48px, 10vw, 72px);
  height: clamp(64px, 12vw, 92px);
  border: 2px solid rgba(245, 232, 200, 0.18);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(245, 232, 200, 0.08) 0%, rgba(17, 12, 10, 0.6) 100%);
  color: #f5e8c8;
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.8rem, 4.5vw, 2.8rem);
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  caret-color: rgba(209, 154, 66, 0.9);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 0 rgba(0, 0, 0, 0.22);
}

.join-codeslot[data-filled="true"] {
  border-color: rgba(209, 154, 66, 0.62);
  background:
    linear-gradient(180deg, rgba(209, 154, 66, 0.18) 0%, rgba(17, 12, 10, 0.7) 100%);
}

.join-codeslot:focus-visible {
  outline: none;
  border-color: rgba(209, 154, 66, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 4px rgba(209, 154, 66, 0.18);
}

.join-codeslots[data-invalid="true"] .join-codeslot {
  animation: join-shake 220ms cubic-bezier(0.36, 0.07, 0.19, 0.97) 3;
  border-color: rgba(217, 74, 61, 0.6);
}

@keyframes join-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.join-codeslots-hint {
  display: block;
  margin-top: 8px;
  color: rgba(245, 232, 200, 0.5);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
}

/* Light theme overrides */
html[data-theme="light"] .join-codeslot {
  border-color: rgba(132, 47, 43, 0.22);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(247, 233, 208, 0.6) 100%);
  color: #2a1b10;
}

html[data-theme="light"] .join-codeslot[data-filled="true"] {
  border-color: rgba(132, 47, 43, 0.62);
  background: linear-gradient(180deg, rgba(255, 226, 200, 0.85) 0%, rgba(247, 233, 208, 0.62) 100%);
}

html[data-theme="light"] .join-codeslot:focus-visible {
  border-color: rgba(132, 47, 43, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 0 0 4px rgba(132, 47, 43, 0.16);
}

html[data-theme="light"] .join-codeslots-hint {
  color: rgba(42, 27, 16, 0.58);
}
```

### Commit 2

```
feat(join): segmented 6-cell room code with auto-advance, paste, backspace nav
```

---

## Stage 3 — Loading state + form submit

### Step 3a: Wrap в `<form>`

Replace `<section>` с `<section><form onSubmit={…}>`:

```tsx
function onSubmit(event: React.FormEvent) {
  event.preventDefault();
  submit("join");
}

// ...
<form onSubmit={onSubmit} noValidate>
  {/* hero, code panel, error, actions */}
</form>
```

### Step 3b: useTransition за loading

```tsx
import { useTransition } from "react";

const [isJoining, startTransition] = useTransition();

function submit(action: "create" | "join") {
  if (action === "join" && !isValidRoomCode(roomCode)) {
    setError("Кодът трябва да е 6 знака.");
    return;
  }
  setError("");
  startTransition(() => {
    router.push(action === "create" ? createPath : playPath);
  });
}
```

Където `createPath`:

```ts
const createPath = useMemo(() => {
  if (!spectator) return `${gameRoot}/create`;
  const params = new URLSearchParams({ spectator: "1" });
  return `${gameRoot}/create?${params.toString()}`;
}, [gameRoot, spectator]);
```

### Step 3c: Disabled + label swap

```tsx
<button
  className="btn btn-primary"
  type="submit"
  disabled={!isValidRoomCode(roomCode) || isJoining}
>
  {isJoining ? <LoaderCircle className="spin" aria-hidden strokeWidth={1.8} /> : <Users aria-hidden strokeWidth={1.8} />}
  {isJoining ? copy.submittingLabel : copy.submitLabel}
</button>
```

CSS за `.spin`:

```css
.btn .spin {
  animation: btn-spin 900ms linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

```

### Commit 3

```
feat(join): form-element wrap with enter submit, loading state and spinner
```

---

## Stage 4 — CTA hierarchy: invite vs cold entry

### Step 4a: Branch на initialCode

```tsx
const hasInviteCode = Boolean(initialCode);

// ...
<div className="join-entry-actions" data-mode={hasInviteCode ? "invite" : "cold"}>
  <button className="btn btn-primary" type="submit" disabled={…}>
    {copy.submitLabel}
  </button>
  {hasInviteCode ? (
    <Link className="btn-ghost-link" href={createPath}>
      {copy.createGhostLabel}
    </Link>
  ) : (
    <Link className="btn btn-secondary" href={createPath}>
      <Plus aria-hidden strokeWidth={1.8} />
      {copy.createLabel}
    </Link>
  )}
</div>
```

### Step 4b: CSS

```css
.join-entry-actions[data-mode="invite"] .btn-primary {
  width: 100%;
}

.btn-ghost-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: rgba(245, 232, 200, 0.62);
  font-size: 0.86rem;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: rgba(209, 154, 66, 0.32);
  text-underline-offset: 4px;
  transition: color 160ms ease, text-decoration-color 160ms ease;
}

.btn-ghost-link:hover {
  color: #d19a42;
  text-decoration-color: rgba(209, 154, 66, 0.86);
}

html[data-theme="light"] .btn-ghost-link {
  color: rgba(42, 27, 16, 0.62);
}

html[data-theme="light"] .btn-ghost-link:hover {
  color: #842f2b;
  text-decoration-color: rgba(132, 47, 43, 0.86);
}
```

### Commit 4

```
feat(join): demote Create CTA to ghost link when invite code present
```

---

## Stage 5 — Recent rooms recall

### Step 5a: Hook за localStorage

**File:** `apps/web/lib/use-recent-rooms.ts` (нов файл)

```ts
"use client";

import { useEffect, useState } from "react";
import { ROOM_CODE_REGEX } from "@werewolf/shared";

const STORAGE_KEY = "werewolf-mafia:recent-rooms";
const MAX_ENTRIES = 3;

export type RecentRoom = {
  code: string;
  family: "mafia" | "werewolves";
  visitedAt: number;
};

export function useRecentRooms(family: "mafia" | "werewolves") {
  const [rooms, setRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecentRoom[];
      const valid = parsed
        .filter((r) => r.family === family && ROOM_CODE_REGEX.test(r.code))
        .slice(0, MAX_ENTRIES);
      setRooms(valid);
    } catch {
      // ignore corrupt storage
    }
  }, [family]);

  const remember = (code: string) => {
    if (!ROOM_CODE_REGEX.test(code)) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing = raw ? (JSON.parse(raw) as RecentRoom[]) : [];
      const filtered = existing.filter((r) => r.code !== code);
      const next: RecentRoom[] = [{ code, family, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ENTRIES * 2);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  return { rooms, remember };
}
```

### Step 5b: Surface chips

В `AuthGatedEntryClient`:

```tsx
const { rooms: recent } = useRecentRooms(isMafia ? "mafia" : "werewolves");

// под `.join-entry-code-field`, преди spectator toggle:
{recent.length > 0 && !roomCode ? (
  <div className="join-recent">
    <span className="join-recent-label">Скорошни:</span>
    {recent.map((r) => (
      <button
        key={r.code}
        type="button"
        className="join-recent-chip"
        onClick={() => setRoomCode(r.code)}
      >
        {r.code}
      </button>
    ))}
  </div>
) : null}
```

### Step 5c: Remember on submit

В `submit("join")` path, веднага преди router.push:

```ts
const { remember } = useRecentRooms(isMafia ? "mafia" : "werewolves");
// ...
remember(roomCode);
startTransition(() => router.push(playPath));
```

### Step 5d: CSS

```css
.join-recent {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.join-recent-label {
  color: rgba(245, 232, 200, 0.5);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.join-recent-chip {
  border: 1px solid rgba(209, 154, 66, 0.32);
  border-radius: 999px;
  padding: 4px 12px;
  background: rgba(209, 154, 66, 0.08);
  color: rgba(245, 232, 200, 0.86);
  font-family: "Noto Serif", serif;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, transform 120ms ease;
}

.join-recent-chip:hover {
  border-color: rgba(209, 154, 66, 0.68);
  background: rgba(209, 154, 66, 0.16);
  transform: translateY(-1px);
}

html[data-theme="light"] .join-recent-label {
  color: rgba(42, 27, 16, 0.58);
}

html[data-theme="light"] .join-recent-chip {
  border-color: rgba(132, 47, 43, 0.32);
  background: rgba(132, 47, 43, 0.08);
  color: rgba(42, 27, 16, 0.78);
}

html[data-theme="light"] .join-recent-chip:hover {
  border-color: rgba(132, 47, 43, 0.68);
  background: rgba(132, 47, 43, 0.14);
}
```

### Commit 5

```
feat(join): recent rooms recall (localStorage, top 3 per family)
```

---

## Stage 6 — Room metadata preview banner

### Step 6a: New API endpoint

**File:** `apps/web/app/api/rooms/[code]/preview/route.ts` (нов файл)

```ts
import { NextResponse } from "next/server";
import { ROOM_CODE_REGEX } from "@werewolf/shared";

type RoomPreview = {
  code: string;
  status: "lobby" | "in_game" | "finished" | "missing";
  playerCount: number;
  capacity: number;
  hostName: string | null;
  family: "mafia" | "werewolves" | null;
};

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!ROOM_CODE_REGEX.test(upper)) {
    return NextResponse.json({ status: "missing" } as RoomPreview, { status: 404 });
  }

  try {
    const gameServerUrl = process.env.GAME_SERVER_HTTP_URL ?? "http://localhost:2567";
    const res = await fetch(`${gameServerUrl}/rooms/${upper}/preview`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      return NextResponse.json({ status: "missing" } as RoomPreview, { status: 404 });
    }
    const data = (await res.json()) as RoomPreview;
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "private, max-age=5" },
    });
  } catch {
    return NextResponse.json({ status: "missing" } as RoomPreview, { status: 404 });
  }
}
```

### Step 6b: Lightweight read-only endpoint on game-server

**File:** `apps/game-server/src/index.ts` (или съответния HTTP routes file — find existing one с `find -name "index.ts" -path "*game-server*"`)

```ts
app.get("/rooms/:code/preview", async (req, res) => {
  const code = String(req.params.code ?? "").toUpperCase();
  const room = await findRoomByCode(code); // re-use съществуващ helper
  if (!room) {
    return res.status(404).json({ status: "missing" });
  }
  return res.json({
    code,
    status: room.state.phase === "lobby" ? "lobby" :
            room.state.phase === "ended" ? "finished" : "in_game",
    playerCount: room.state.players.size,
    capacity: room.state.config.playerCount,
    hostName: room.state.hostName ?? null,
    family: room.state.config.family,
  });
});
```

**Важно:** само read-only публични полета. Никога не върнал secret role данни, votes, или actions. Re-use existing read-mode сметка на `findRoomByCode` ако такава съществува.

### Step 6c: Preview banner в client

```tsx
const [preview, setPreview] = useState<RoomPreview | null>(null);
const [previewLoading, setPreviewLoading] = useState(false);

useEffect(() => {
  if (!ROOM_CODE_REGEX.test(roomCode)) {
    setPreview(null);
    return;
  }
  let cancelled = false;
  setPreviewLoading(true);
  fetch(`/api/rooms/${roomCode}/preview`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((data: RoomPreview) => {
      if (!cancelled) setPreview(data);
    })
    .catch(() => {
      if (!cancelled) setPreview(null);
    })
    .finally(() => {
      if (!cancelled) setPreviewLoading(false);
    });
  return () => {
    cancelled = true;
  };
}, [roomCode]);
```

JSX, веднага под code field, преди spectator toggle:

```tsx
{preview && preview.status !== "missing" ? (
  <div className="join-preview-banner" data-status={preview.status}>
    <span className="join-preview-dot" aria-hidden />
    <div className="join-preview-text">
      {preview.status === "lobby" ? (
        <>
          <strong>Стая {preview.code}</strong> · {preview.playerCount}/{preview.capacity} играчи в лоби
          {preview.hostName ? <> · {preview.hostName} стопанин</> : null}
        </>
      ) : preview.status === "in_game" ? (
        <>
          <strong>Стая {preview.code}</strong> · играта вече тече. Влизаш като наблюдател.
        </>
      ) : (
        <>
          <strong>Стая {preview.code}</strong> · приключила
        </>
      )}
    </div>
  </div>
) : null}
```

Ако `status === "in_game"`, форсирай `spectator` toggle:

```ts
useEffect(() => {
  if (preview?.status === "in_game") {
    setSpectator(true);
  }
}, [preview?.status]);
```

### Step 6d: CSS за banner

```css
.join-preview-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  border: 1px solid rgba(99, 158, 100, 0.32);
  border-radius: 14px;
  padding: 10px 14px;
  background: rgba(99, 158, 100, 0.1);
  color: rgba(245, 232, 200, 0.92);
  font-size: 0.92rem;
}

.join-preview-banner[data-status="in_game"] {
  border-color: rgba(209, 154, 66, 0.42);
  background: rgba(209, 154, 66, 0.12);
}

.join-preview-banner[data-status="finished"] {
  border-color: rgba(245, 232, 200, 0.2);
  background: rgba(245, 232, 200, 0.06);
  color: rgba(245, 232, 200, 0.58);
}

.join-preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 12px currentColor;
}

html[data-theme="light"] .join-preview-banner {
  background: rgba(99, 158, 100, 0.14);
  color: #2a1b10;
}
```

### Commit 6

```
feat(join): room preview banner (status, capacity, host) with 5s cache
```

---

## Stage 7 — Spectator toggle hint + forward на Create

### Step 7a: Hint button

```tsx
<div className="join-spectator-row">
  <button
    type="button"
    className="join-spectator-toggle"
    data-active={spectator}
    aria-pressed={spectator}
    onClick={() => setSpectator((v) => !v)}
  >
    <span className="join-spectator-dot" aria-hidden />
    {spectator ? <Eye aria-hidden strokeWidth={1.8} /> : <Gamepad2 aria-hidden strokeWidth={1.8} />}
    {spectator ? copy.spectatorOn : copy.spectatorOff}
  </button>
  <p className="join-spectator-hint">{copy.spectatorHint}</p>
</div>
```

### Step 7b: CSS

```css
.join-spectator-row {
  display: grid;
  gap: 6px;
}

.join-spectator-hint {
  margin: 0;
  color: rgba(245, 232, 200, 0.5);
  font-size: 0.78rem;
  line-height: 1.5;
}

html[data-theme="light"] .join-spectator-hint {
  color: rgba(42, 27, 16, 0.58);
}
```

### Step 7c: Create flow uvazha `?spectator=1`

**File:** `apps/web/components/lobby-create-client.tsx`

Read URL search param `spectator` на mount, pre-check съответния spectator toggle в Create UI (ако такъв съществува). Ако Create не позволява spectator role при стопанина (типично) — show small advisory: "Като стопанин не можеш да бъдеш наблюдател. Toggle ще се изключи."

### Commit 7

```
feat(join): spectator hint copy and forward ?spectator=1 to create flow
```

---

## Stage 8 — Error UX (alert + shake + position)

### Step 8a: Move error above code field

В JSX, преди `.join-entry-code-panel`:

```tsx
{error ? (
  <p className="join-entry-error" role="alert" aria-live="polite">
    {error}
  </p>
) : null}
```

(Премахни старото position под code panel.)

### Step 8b: Trigger invalid shake

Вече handled от Stage 2 CSS — `data-invalid` на `.join-codeslots`. Подай invalid prop:

```tsx
<JoinCodeSlots
  value={roomCode}
  onChange={setRoomCode}
  invalid={Boolean(error)}
  autoFocus={!initialCode}
/>
```

### Step 8c: Error messages по-точни

```ts
function submit(action: "create" | "join") {
  if (action === "join") {
    if (!roomCode) {
      setError("Въведи кода на стаята.");
      return;
    }
    if (roomCode.length < ROOM_CODE_LENGTH) {
      setError(`Кодът е ${ROOM_CODE_LENGTH} знака. Имаш ${roomCode.length}.`);
      return;
    }
    if (!ROOM_CODE_REGEX.test(roomCode)) {
      setError("Неправилен формат — само A–Z (без I, O) и 2–9 (без 0, 1).");
      return;
    }
  }
  // ...
}
```

### Commit 8

```
feat(join): error placement above code, alert role, specific bg messages
```

---

## Stage 9 — Empty bottom space → trust + flavor footer

### Step 9a: Add footer block

В JSX, ВЪН от `<form>`, but inside `.join-entry-card`:

```tsx
</form>

<footer className="join-entry-footer">
  <p className="join-entry-flavor">{copy.flavorFooter}</p>
  <p className="join-entry-trust">
    <Link href="/help">Помощ</Link>
    <span aria-hidden>·</span>
    <Link href={`${gameRoot}/rules`}>Правила</Link>
    <span aria-hidden>·</span>
    Безплатно, без реклами, на български
  </p>
</footer>
```

### Step 9b: CSS

```css
.join-entry-footer {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid rgba(245, 232, 200, 0.08);
}

.join-entry-flavor {
  margin: 0;
  color: rgba(245, 232, 200, 0.62);
  font-family: "Noto Serif", serif;
  font-size: 0.92rem;
  font-style: italic;
  letter-spacing: 0.01em;
}

.join-entry-trust {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  color: rgba(245, 232, 200, 0.4);
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

.join-entry-trust a {
  color: rgba(209, 154, 66, 0.78);
  text-decoration: none;
  border-bottom: 1px solid rgba(209, 154, 66, 0.28);
}

.join-entry-trust a:hover {
  color: #d19a42;
  border-bottom-color: rgba(209, 154, 66, 0.86);
}

html[data-theme="light"] .join-entry-footer {
  border-top-color: rgba(83, 52, 31, 0.12);
}

html[data-theme="light"] .join-entry-flavor {
  color: rgba(42, 27, 16, 0.7);
}

html[data-theme="light"] .join-entry-trust {
  color: rgba(42, 27, 16, 0.5);
}

html[data-theme="light"] .join-entry-trust a {
  color: #842f2b;
  border-bottom-color: rgba(132, 47, 43, 0.32);
}
```

### Step 9c: Remove `min-height` на card

```css
.join-entry-card {
  /* min-height: 420px;  ← REMOVE this line */
}
```

С footer-а добавен, височината се self-balance-ва.

### Commit 9

```
feat(join): flavor footer with trust signals; drop fixed min-height
```

---

## Stage 10 — Polish + a11y last mile

### Step 10a: Loading skeleton консистентен

Текущият loading state (`isPending || !session`) replace-ва entire content. Picture height jumps. Set `min-height` на skeleton equal на typical card height:

```tsx
if (isPending || !session) {
  return (
    <section className="auth-entry-card join-entry-card join-entry-card--skeleton" …>
      <span className="join-entry-mark" aria-hidden>
        <LoaderCircle strokeWidth={1.8} className="spin" />
      </span>
      <p className="section-kicker join-entry-kicker">влез в стаята</p>
      <h2>Проверяваме профила…</h2>
      <p>След вход ще те върнем към поканата за тази стая.</p>
    </section>
  );
}
```

```css
.join-entry-card--skeleton {
  min-height: 480px;
  opacity: 0.92;
}
```

### Step 10b: Mobile sticky CTA

```css
@media (max-width: 760px) {
  .join-entry-actions {
    position: sticky;
    bottom: 12px;
    z-index: 2;
    padding: 8px;
    border-radius: 18px;
    background: rgba(13, 9, 8, 0.86);
    backdrop-filter: blur(8px);
  }
  html[data-theme="light"] .join-entry-actions {
    background: rgba(252, 246, 236, 0.86);
  }
}
```

### Step 10c: Page metadata family-specific

**File:** `apps/web/app/mafia/join/[[...roomCode]]/page.tsx`

```ts
export const metadata: Metadata = {
  title: "Влез на масата | Върколак и Мафия",
  description: "Покажи кода на бара и седни на масата с приятели в Мафия.",
};
```

**File:** `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx`

```ts
export const metadata: Metadata = {
  title: "Влез в селото | Върколак и Мафия",
  description: "Покажи знакът на селото и премини през оградата във Върколак.",
};
```

### Step 10d: Accessibility audit

- `<form>` элемент с `noValidate` (Stage 3) ✓
- `role="alert"` на error (Stage 8) ✓
- `aria-labelledby` за code slots group (Stage 2) ✓
- Spectator toggle с `aria-pressed` (вече) ✓
- Focus visible на всички interactive elements (Stage 2 + general buttons)
- Keyboard: ArrowLeft/ArrowRight между slots, Backspace, Enter submit
- Motion override-и за shake + spinner не се добавят.

### Commit 10

```
chore(join): skeleton height, mobile sticky CTA, family-specific page metadata
```

---

## Stage 11 — Box-in-box fix (drop nested chrome)

**Проблем:** Page wrapper-ът има `framed-shell` (border + radius 28px + dark/cream bg + shadow), а `.join-entry-card` вътре има същия pattern (border + radius 28px + tavern art bg + shadow). Резултат — две концентрични рамки, "passport вътре в албум" feel. На light theme cream parchment рамката се вижда около кремаво-кафявата карта като дублиран layer.

**Решение:** Картата (`.join-entry-card`) вече **е** визуалният chrome на страницата — има border, radius, tavern art с gradient mask, shadow, `::before` inner edge и `::after` radial glow. Outer `framed-shell` дублира chrome-а без visual stake. Дроп-ваме го от join pages.

### Step 11a: Update mafia join page

**File:** `apps/web/app/mafia/join/[[...roomCode]]/page.tsx`

```diff
- <main className="shell lobby-shell join-shell framed-shell" data-theme="mafia" data-family="mafia">
-   <div className="framed-shell-inner join-shell-inner">
+ <main className="shell lobby-shell join-shell" data-theme="mafia" data-family="mafia">
+   <div className="join-shell-inner">
    <AuthGatedEntryClient family="mafia" mode="mafia_free" initialCode={initialCode} />
  </div>
</main>
```

### Step 11b: Update werewolf join page

**File:** `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx`

```diff
- <main className="shell lobby-shell join-shell framed-shell" data-theme="werewolves" data-family="werewolves">
-   <div className="framed-shell-inner join-shell-inner">
+ <main className="shell lobby-shell join-shell" data-theme="werewolves" data-family="werewolves">
+   <div className="join-shell-inner">
    <AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode={initialCode} />
  </div>
</main>
```

### Step 11c: Decouple `.join-shell` от `framed-shell` стилизация

**File:** `apps/web/app/globals.css` — около ред 6185, в "Join gate" секцията.

Текущо правило `.join-shell.framed-shell { … }` ползва двата класа заедно. Replace селектора така че `.join-shell` да работи самостоятелно:

```diff
- .join-shell.framed-shell {
+ .join-shell {
    width: min(1120px, 94vw);
+   margin: 24px auto 96px;
    padding-block: 32px 64px;
  }

  @media (max-width: 760px) {
-   .join-shell.framed-shell {
+   .join-shell {
      width: min(100%, 100vw);
      padding-top: 12px;
    }
  }
```

(Margin-ът се добавя explicit-но, понеже преди се наследяваше от `framed-shell`.)

### Step 11d: Strengthen картата леко, за да компенсира загубата на outer frame

Понеже outer chrome изчезна, картата става единствения visual anchor. Малко по-силна сянка + малко по-голям радиус:

```diff
.join-entry-card {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 24px;
  border: 1px solid rgba(245, 232, 200, 0.18);
- border-radius: 28px;
+ border-radius: 32px;
  padding: clamp(24px, 4vw, 44px);
  background:
    linear-gradient(90deg, rgba(13, 9, 8, 0.94) 0%, rgba(17, 12, 10, 0.8) 52%, rgba(17, 12, 10, 0.48) 100%),
    var(--art-lobby) center / cover no-repeat;
  box-shadow:
-   0 28px 82px rgba(0, 0, 0, 0.42),
+   0 36px 96px rgba(0, 0, 0, 0.5),
    inset 0 1px rgba(255, 255, 255, 0.08);
  color: #f5e8c8;
  isolation: isolate;
}
```

Light theme аналогично:

```diff
html[data-theme="light"] .join-entry-card {
  border-color: rgba(83, 52, 31, 0.22);
  background:
    linear-gradient(90deg, rgba(252, 246, 236, 0.94) 0%, rgba(247, 233, 208, 0.82) 58%, rgba(247, 233, 208, 0.54) 100%),
    var(--art-lobby) center / cover no-repeat;
  box-shadow:
-   0 24px 62px rgba(67, 39, 24, 0.16),
+   0 32px 80px rgba(67, 39, 24, 0.22),
    inset 0 1px rgba(255, 255, 255, 0.55);
  color: #2a1b10;
}
```

### Step 11e: Mobile sticky CTA — re-check background opacity

Stage 10b добавя sticky CTA с `rgba(13, 9, 8, 0.86)` / `rgba(252, 246, 236, 0.86)` background. След като outer frame го няма, sticky bar седи директно върху page background-а — opacity-то остава ОК (88-92% покрива tavern art-а зад картата), но провери на mobile preview.

### Acceptance за Stage 11

- На `/mafia/join` и `/werewolf/join` (desktop + mobile, dark + light) има **една единствена** видима рамка — самата карта.
- Няма cream parchment "passport" около кремаво-кафявата карта в light theme.
- Картата запазва tavern art-а с gradient mask; нищо не се чупи визуално.
- Скоростта на load / hydration не се променя — само CSS class drop.

### Commit 11

```
fix(join): drop outer framed-shell to remove nested chrome (box-in-box)
```

---

## Acceptance criteria

1. **Family distinct** — Desktop 1440 и mobile 390 на `/mafia/join` vs `/werewolf/join`:
   - Различни лица: Martini vs Moon icon, "частен бар" vs "тихо село" kicker, "Добре дошъл в бара" vs "Добре дошъл в селото", различни CTA labels.
2. **Code slots functional**:
   - 6 brass cells; въвеждане на знак прескача към следващия cell
   - Backspace на празен cell отива на предишен
   - ArrowLeft/Right navigate между cells
   - Paste на `ABC123`, `ABC-123`, или `https://werewolf.app/play/ABC123` запълва всички cells
3. **Loading state** — клик на primary CTA → spinner + "Хлопаме на вратата…" / "Тръгваме към селото…"; disabled until navigation resolve-не.
4. **Form submit** — Enter на focused slot submit-ва.
5. **Recent rooms** — след успешен join, `localStorage["werewolf-mafia:recent-rooms"]` се update-ва; при следващо посещение на `/{family}/join` без initialCode, се показват chips.
6. **Room preview** — за валиден initialCode (`/werewolf/join/ABC123`), banner показва "Стая ABC123 · 4/8 играчи · Митко стопанин". Ако `status === "in_game"`, spectator toggle се auto-enable-ва.
7. **CTA hierarchy**:
   - С initialCode → primary full-width + Create ghost link
   - Без initialCode → два equal-weight CTA-та
8. **Spectator hint** видим под toggle.
9. **Error UX**:
   - Грешка е над code slots, не под
   - role="alert" присъства
   - Shake animation 3 пъти на code slots при invalid
   - Specific messages: "Кодът е 6 знака. Имаш 4." вместо "Невалиден код на стая."
10. **Empty bottom solved** — footer с flavor citation + trust signals; няма празно тъмно поле под картата.
11. **Mobile**:
    - Sticky primary CTA в долната част
    - Code slots wrap на 2 реда ако трябва (clamp width)
    - Family chips, recent chips се wrap-ват elegantly
12. **Light theme** — всички нови elements имат `[data-theme="light"]` overrides.
13. **Bulgarian-only copy** — `bg-copy-reviewer` agent не намира английски strings в user-facing UI.
14. **Single chrome layer** — page wrapper няма `framed-shell` клас; визуално има **една** рамка (картата). На light theme няма cream parchment passport около кремавата карта.
15. **Regression + build** — `pnpm regression`, `pnpm typecheck`, `pnpm build` green след всеки commit.

---

## Verification

След всички commit-и:

```bash
pnpm regression
pnpm typecheck
pnpm build
```

Стартирай preview и направи screenshots в `audit-v3/after/join-polish/`:

1. `mafia-join-desktop.png` — `/mafia/join` 1440×900, празен код
2. `mafia-join-mobile.png` — `/mafia/join` 390×844, празен код
3. `mafia-join-invite-preview.png` — `/mafia/join/<real-code>` с активно лоби
4. `mafia-join-in-game.png` — `/mafia/join/<in-game-code>` показващ spectator auto-enable
5. `werewolf-join-desktop.png` — `/werewolf/join` 1440×900
6. `werewolf-join-mobile.png` — `/werewolf/join` 390×844
7. `werewolf-join-light.png` — `/werewolf/join` light theme
8. `join-error-shake.png` — code slots в invalid state (4 chars + click submit)
9. `join-loading.png` — primary CTA в loading state (бутни и направи screenshot веднага)
10. `join-recent-chips.png` — `/werewolf/join` с 3 recent rooms видими
11. `mafia-join-light-single-frame.png` — `/mafia/join` light theme, потвърждава single chrome layer (преди-/-след сравнение с baseline screenshot, ако такъв съществува)

Run `bg-copy-reviewer` agent on changed files:
- `apps/web/components/games/auth-gated-entry-client.tsx`
- `apps/web/components/games/join-code-slots.tsx`
- `apps/web/lib/use-recent-rooms.ts`
- `apps/web/app/mafia/join/[[...roomCode]]/page.tsx`
- `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx`

Run `role-mechanics-reviewer` agent on:
- `apps/game-server/src/index.ts` (new preview endpoint must not leak secret state)
- Any modified game-server room methods

---

## Не пипай

- `apps/web/lib/require-session.ts`
- `apps/web/app/api/game-token/route.ts`
- `apps/web/app/api/auth/[...all]/route.ts`
- Game-server room logic (schemas, role-assignment, night-resolver, win-conditions, vote tallying)
- `packages/shared/src/{role-assignment,win-conditions,protocol}.ts` — само добавяй ROOM_CODE_* константи в shared index
- Existing CSS на `lobby-shell`, `framed-shell`, `auth-entry-card` базата — само extend-вай. **Изключение:** Stage 11 explicit-но премахва `framed-shell` от join page wrappers и decouples `.join-shell` от `.join-shell.framed-shell` композитния селектор — това е intentional cleanup, не нарушение на правилото.

---

## Commit summary

11 atomic English commits on `main`:

1. `feat(join): family-specific copy and lucide icons for mafia vs werewolves`
2. `feat(join): segmented 6-cell room code with auto-advance, paste, backspace nav`
3. `feat(join): form-element wrap with enter submit, loading state and spinner`
4. `feat(join): demote Create CTA to ghost link when invite code present`
5. `feat(join): recent rooms recall (localStorage, top 3 per family)`
6. `feat(join): room preview banner (status, capacity, host) with 5s cache`
7. `feat(join): spectator hint copy and forward ?spectator=1 to create flow`
8. `feat(join): error placement above code, alert role, specific bg messages`
9. `feat(join): flavor footer with trust signals; drop fixed min-height`
10. `chore(join): skeleton height, mobile sticky CTA, family-specific page metadata`
11. `fix(join): drop outer framed-shell to remove nested chrome (box-in-box)`

PR title (if not direct push): `feat: polish /werewolf/join + /mafia/join — segmented code, preview, family identity`

**Recommended ordering note:** Commit 11 е чист CSS/class change, но засяга визуалния тест на всички предишни commit-и. Може да бъде преместен на първа позиция ако искаш всички screenshot-и от Stages 1–10 да бъдат вече без box-in-box артефакт. Иначе остави го last като cleanup.

---

(End of prompt)
