# Codex prompt — Redesign `/werewolf/join` + `/mafia/join`

Целта: текущата страница за вход с код е безлична параграма + 2 inputs + чекбокс. Иска се кинематографичен, тематичен, премиум вход — различен за двете семейства, споделящ обща компонента-каркас.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo. Read `AGENTS.md` for invariants. Most relevant: всичкият user-facing copy на български; никакви нови npm dependencies; не пипай game-server logic.

### Контекст

Текущата страница `/mafia/join` и `/werewolf/join` рендерира една универсална форма-компонент `apps/web/components/games/anonymous-entry-client.tsx`:
- Една parchment карта с heading "Влез с име"
- Two inputs: "Потребителско име" + "Код на стая"
- Checkbox "Влез като наблюдател"
- Two CTA-та: "Влез в стая" + "Създай стая"

Изглежда супер basic — никаква връзка със семейството (мафия vs върколак), никаква йерархия върху кода (който е the whole point), огромна тъмна празнота под формата.

### Целта на редизайна

Превърни страницата в **кинематографичен двупанелен вход**:
- **Lеван panel** = атмосферен side-art (с painterly fade към тъмното).
- **Десен panel** = форма, в която **room code е визуалният hero** — segmented monospace slots, brass-frame, paste-friendly.
- **Тематично разклоняване**: мафия и върколак ползват една и съща компонентна структура, но различен art, accent color и flavor copy.
- **Mobile**: art collapses to compact hero hero-banner, form below — same visual hierarchy.

### Files to touch

1. `apps/web/components/games/anonymous-entry-client.tsx` — пълен redesign
2. `apps/web/app/globals.css` — нови `.join-stage` / `.join-codeslots` / `.join-side-art` блокове
3. `apps/web/app/mafia/join/[[...roomCode]]/page.tsx` — layout wrapper (от `lobby-shell` към `join-shell` ако е нужно)
4. `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx` — същото

Не пипай:
- `apps/web/lib/anonymous-player.ts` (валидаторите)
- `apps/web/app/api/game-token/route.ts`
- Game-server-а

### Design spec

#### Layout

Desktop (≥1024px):
```
┌──────────────────────────────────────────────────────────────┐
│  [navbar]                                                    │
│                                                              │
│  ┌──────────────────────────┬───────────────────────────┐    │
│  │                          │  ╭──────────────────────╮ │    │
│  │   SIDE ART               │  │  ВРАТАТА Е ЗАТВОРЕНА │ │    │
│  │   (full-bleed painterly  │  │                      │ │    │
│  │    art, mask-image fade  │  │  Покажи кода         │ │    │
│  │    to right edge)        │  │                      │ │    │
│  │                          │  │  ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐  │ │    │
│  │   small flavor caption   │  │  │A││B││C││1││2││3│  │ │    │
│  │   bottom-left            │  │  └─┘└─┘└─┘└─┘└─┘└─┘  │ │    │
│  │                          │  │                      │ │    │
│  │                          │  │  Как се казваш?      │ │    │
│  │                          │  │  [____________]      │ │    │
│  │                          │  │                      │ │    │
│  │                          │  │  ⊙ страничен поглед  │ │    │
│  │                          │  │                      │ │    │
│  │                          │  │  [ ВЛЕЗ ] [ СЪЗДАЙ ] │ │    │
│  │                          │  ╰──────────────────────╯ │    │
│  └──────────────────────────┴───────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

Mobile (<1024px):
```
┌─────────────────────┐
│ [navbar]            │
│ ┌─────────────────┐ │
│ │  COMPACT HERO   │ │
│ │  art (160px)    │ │
│ │  + family title │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │  Code slots     │ │
│ │  [A][B][C]...   │ │
│ │                 │ │
│ │  Name input     │ │
│ │  Spectator pill │ │
│ │  CTAs           │ │
│ └─────────────────┘ │
└─────────────────────┘
```

#### Side art

- **Мафия:** използвай `/game-art/mafia/bg-lobby-tavern.webp` (опуши, червен warm tint вече е там). Painterly fade с `mask-image: linear-gradient(to right, black 60%, transparent 100%)`. Над art-а — leko vignette (`box-shadow: inset -120px 0 80px rgba(0,0,0,0.4)`).
- **Върколак:** използвай `/game-art/werewolf/bg-hero-v2.webp`. Същия маск.
- Под art-а — caption (Bulgarian, italic, малък):
  - Мафия: *"Името на вратата. Кодът на бара. Останалото — между нас."*
  - Върколак: *"Селото е тихо. Покажи знакът си, преди да отвори вратата."*

#### Code slots — the hero

Замени единичен `<input>` с **6 (до 12) сегментирани slot-ове**:
```tsx
<div className="join-codeslots" role="group" aria-label="Код на стаята">
  {Array.from({ length: 6 }).map((_, i) => (
    <input
      key={i}
      ref={(el) => { slotRefs.current[i] = el; }}
      className="join-codeslot"
      maxLength={1}
      inputMode="text"
      autoCapitalize="characters"
      value={roomCode[i] ?? ""}
      onChange={(e) => handleSlotChange(i, e.target.value)}
      onKeyDown={(e) => handleSlotKeyDown(i, e)}
      onPaste={(e) => handlePaste(e)}
      aria-label={`Символ ${i + 1}`}
    />
  ))}
</div>
```

Поведение:
- Автоматично се прехвърля фокусът на следващия slot при typing.
- Backspace на празен slot премества фокус назад.
- Paste на пълен код в който и да е slot — попълва всички (`navigator.clipboard` не е нужен, ползвай `onPaste` event).
- `cleanRoomCode` логиката остава — приема само `[A-Z0-9]`, автоматично uppercase.

Styling spec:
```css
.join-codeslots {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.join-codeslot {
  width: 52px;
  height: 64px;
  font: 700 28px/1 "Noto Serif", serif;
  text-align: center;
  background: linear-gradient(180deg, #f6e9d4 0%, #ead8b8 100%);
  color: #2a1b10;
  border: 2px solid rgba(132, 47, 43, 0.4);
  border-radius: 8px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.6),
    0 2px 0 rgba(0,0,0,0.2);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.join-codeslot:focus-visible {
  border-color: var(--accent-strong);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.6),
    0 0 0 3px var(--accent-soft);
}
.join-codeslot[data-filled="true"] {
  border-color: var(--accent-strong);
}
```

Под slot-овете малка моноспейс реплика:
```
ABC123 • 6 знака • A-Z 0-9
```

#### Name input

Запази текущия `<input>`, но размер по-малък (по-малък emphasis от кода). Label става:
- Мафия: "На кое име на масата?"
- Върколак: "С кое име в селото?"

Placeholder остава Bulgarian примерен ("Например: Мила").

#### Spectator toggle

Замени raw checkbox с **pill-style toggle**:
```tsx
<button
  type="button"
  className="join-spectator-toggle"
  data-active={spectator}
  onClick={() => setSpectator((v) => !v)}
  aria-pressed={spectator}
>
  <span className="join-spectator-dot" />
  {spectator ? "Сядам встрани, без роля" : "Влизам да играя"}
</button>
```

Стилизирай като toggle pill (left "off" state → right "on" state с малък dot).

#### CTAs

Запази две действия (Влез / Създай), но:
- Primary "Влез в стая" — стейт-зависим:
  - Disabled когато кодът < 6 символа
  - Label: "Хлопам на вратата" → след клик "Хлопаме..." (loading state)
- Secondary "Създай нова стая" — винаги достъпен (води към `/{family}/create`).

#### Error state

Когато `error` е set — show ABOVE code slots, не отдолу. Style: small inline pill with icon:
```tsx
{error ? (
  <div className="join-error" role="alert">
    <span aria-hidden>⚠</span> {error}
  </div>
) : null}
```

При invalid code: leko shake animation на code slots (`@keyframes shake` с 200ms 3 oscillations).

#### Family theming via data-attribute

Page wrapper-ът вече има `data-theme="mafia"` / `data-theme="werewolves"`. Дефинирай CSS variables в `globals.css`:

```css
.join-stage[data-theme="mafia"] {
  --accent-strong: #842f2b;
  --accent-soft: rgba(132, 47, 43, 0.18);
  --family-tagline: "Не питат за документи. Само за кода.";
}
.join-stage[data-theme="werewolves"] {
  --accent-strong: #6b3f10;
  --accent-soft: rgba(107, 63, 16, 0.18);
  --family-tagline: "Тиха гора, тихи стъпки. Шепни кода.";
}
```

#### Header block (вместо текущото "БЕЗ РЕГИСТРАЦИЯ / Влез с име")

```tsx
<header className="join-header">
  <p className="join-kicker">{family === "mafia" ? "частен бар" : "тихо село"}</p>
  <h1 className="join-title">
    {family === "mafia" ? "Покажи кода" : "Покажи знакът"}
  </h1>
  <p className="join-subtitle">
    {family === "mafia"
      ? "Името стои на масата. Кодът отваря вратата. Останалото — между нас."
      : "Името върви по селските пътеки. Кодът пуска отвъд оградата."}
  </p>
</header>
```

#### Responsive

Tailwind ще ти даде грид. Прости container queries (или `@media (min-width: 1024px)`):

```css
.join-stage {
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr;
  min-height: calc(100vh - 80px);
}
@media (min-width: 1024px) {
  .join-stage {
    grid-template-columns: 1.1fr 1fr;
    align-items: stretch;
  }
}
.join-side-art {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  min-height: 320px;
}
@media (min-width: 1024px) {
  .join-side-art {
    min-height: auto;
  }
}
```

### Acceptance criteria

1. Desktop 1440×900:
   - Two-column layout, art left + form right.
   - Room code е визуално най-силният елемент в формата (6 brass slots).
   - Не остава празно тъмно поле под формата.
2. Mobile 390×844:
   - Compact 160px art hero отгоре с family title.
   - Form под него; code slots се wrap-ват в 1 ред (slot ширина се мащабира надолу до 40px).
3. Семействата визуално разграничими:
   - Мафия = warm червен accent + tavern art + crime-noir flavor copy.
   - Върколак = warm amber accent + forest art + folk-tale flavor copy.
4. Paste на пълен код в който и да е slot попълва всички slot-ове.
5. Backspace на празен slot отива на предния slot.
6. Disabled state на primary CTA когато кодът е < 6 символа.
7. Spectator toggle е visible pill, не raw checkbox.
8. Bulgarian-only copy; никакви Latin words в user-facing text.
9. `pnpm regression` минава.
10. `pnpm build` минава.

### Visual references (за inspiration, не за copy)

- "Boarding pass" segmented code (airline passes, like Frontier).
- 6-digit one-time passcode patterns (Stripe / Apple OTP screens) — но не sterile, а thematic.
- Vintage "speakeasy" door peek-window with brass plaque.

### Не пипай

- Game-server / schemas / role assignment.
- `apps/web/lib/anonymous-player.ts` валидаторите.
- Темата `data-theme` infrastructure-ът (само добавяй CSS vars).
- Не въвеждай нови npm dependencies — всичко на vanilla React + CSS.
- Без accessibility prompts извън стандартни ARIA attributes (`aria-label`, `aria-pressed`, `role="alert"`) — които вече са в JSX-а по-горе.

### Verification

След commit-ите:
1. `pnpm regression`
2. `pnpm build`
3. Стартирай preview и направи screenshot-и на:
   - `/mafia/join` desktop + mobile
   - `/werewolf/join` desktop + mobile
   - `/mafia/join/SECRET1` (с initialCode попълнен — slot-овете трябва да са вече запълнени)
4. Запиши screenshot-ите в `audit-v3/after/join/`.

### Commit strategy

Препоръчителни commits на този клон `feat/join-redesign`:
All commit messages must be in English (project convention).

1. `feat(join): two-panel layout + side art with painterly fade`
2. `feat(join): segmented room code with auto-advance + paste`
3. `feat(join): family theming + flavor copy + spectator pill toggle`
4. `style(join): error state + shake + loading CTA`
5. `chore(join): screenshot baseline in audit-v3/after/join/`

PR title: `feat: redesign /mafia/join + /werewolf/join — cinematic two-panel entry`.

---

(End of prompt)
