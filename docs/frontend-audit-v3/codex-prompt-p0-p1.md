# Codex prompt — Frontend audit v3, P0 + P1 fixes

Copy-paste long-form prompt за Codex. Реферира към одита в `docs/frontend-audit-v3/REPORT.md` и скрийншотите в `audit-v3/`.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4, Colyseus game server). Read `AGENTS.md` first for invariants — most relevant: **всички user-facing strings са на български** (никакви Latin words в copy, освен product names и technical tokens като URL-и).

Контекст: имам реален визуален audit в `docs/frontend-audit-v3/REPORT.md` със скрийншоти в `audit-v3/desktop/` и `audit-v3/mobile/`. Прочети REPORT.md преди да започнеш. Този PR трябва да покрие **всички P0 и P1** точки от него.

Работи на нов клон `fix/audit-v3-p0-p1`. Commit-вай атомарно по теми (виж списъка по-долу). **All commit messages must be in English, under 70 characters on the summary line** (project convention). **Не ремонтирай неща извън списъка** — P2 и P3 ще бъдат отделен PR.

---

### Задача 1 — Mobile роли grid (🔴 P0)

**Файл:** `apps/web/components/games/game-roles-page.tsx` + `apps/web/app/globals.css` (търси `.role-card` / `.roles-grid` блокове)

**Проблем:** На viewport под 480px CSS-ът принуждава 2-кол grid; всеки role card е твърде тесен и името се пречупва вертикално на 1-2 кирилски символа на ред (виж `audit-v3/mobile/04-werewolf-roles.png`).

**Поправка:**
1. Под `480px` breakpoint grid-ът преминава на **1 кол** (full-width card).
2. Заключи name typography в card-а:
   ```css
   .role-card-title {
     white-space: nowrap;
     overflow: hidden;
     text-overflow: ellipsis;
     max-width: 100%;
   }
   ```
3. Същата корекция за `/mafia/roles` (същият component).
4. Тествай и при 360px (Galaxy fold-mode), и при 414px (iPhone 14 Plus).

**Acceptance:** Screenshot на `/werewolf/roles` при 390×844 — всяко име на роля се показва на **един** ред с ellipsis, ако се налага. Никога вертикално по 1 символ.

---

### Задача 2 — BG-only invariant нарушения (🔴 P0)

Шест user-facing string-а в Latin script. Заменете точно:

| Файл:линия | Старо | Ново |
|---|---|---|
| `apps/web/app/achievements/page.tsx:7` | `"Колекция от replay-базирани моменти: първа кръв, спасени нощи, лични победи и финални обрати."` | `"Колекция от моменти, отключени от записите: първа кръв, спасени нощи, лични победи и финални обрати."` |
| `apps/web/app/achievements/page.tsx:17-18` | `"Постиженията не са grind. Те се отключват от replay събитията и разказват какво се е случило на масата:"` | `"Постиженията не са повтаряне. Те се отключват от събитията в записа и разказват какво се е случило на масата:"` |
| `apps/web/app/achievements/page.tsx:25` | `"Виж replay история"` | `"Виж записаните игри"` |
| `apps/web/components/play-room-client.tsx:906` | `{player.host ? " · host" : ""}` | `{player.host ? " · водещ" : ""}` |
| `apps/web/components/keyboard-shortcuts-modal.tsx:8` | `"Пауза за host или Разказвач, когато играта не е паузирана и не е приключила."` | `"Пауза за водещ или Разказвач, когато играта не е паузирана и не е приключила."` |
| `apps/web/components/games/game-rules-page.tsx:65` | `"Всички живи играчи обсъждат кой лъже. В no-chat или live режим приложението става табло с фаза и таймер."` | `"Всички живи играчи обсъждат кой лъже. В режим без чат или 'на живо' приложението става табло с фаза и таймер."` |

**Bonus:** добави в `scripts/regression.mjs` нова проверка `assertNoLatinCopyLeak()`, която grep-ва `apps/web/app/**` и `apps/web/components/**` (без `.next`, без `*.test.ts`, без `import`/`from`/JSX `className`/`aria-`/`href`/`src` lines) за списък забранени Latin думи: `replay`, `grind`, `host`, `chat`, `live`, `loading`, `continue`, `cancel`, `save`, `delete`. Изключи export const identifier-и (e.g. `const host =`). Ако намери — fail-ва regression-а с file:line.

**Acceptance:** `pnpm regression` минава; `grep -rEn "\b(replay|grind|host|no-chat|live)\b" apps/web/{app,components}` връща само legitimate technical uses (импорти, classNames, props).

---

### Задача 3 — `/play/[code]` desktop layout balance (🟠 P1)

**Файл:** `apps/web/components/play-room-client.tsx` + relevant CSS in `globals.css`

**Проблем:** Дясната parchment колона "Играчите на площада" приключва на ~40% от viewport-а и оставя огромно празно тъмно поле под себе си (виж `audit-v3/desktop/14-play-lobby.png`).

**Поправка:**
1. Layout grid: десният panel става `position: sticky; top: 96px;` (под navbar-а).
2. Players panel-ът държи **и** Chat log-а (събере секциите Играчите + Чат лог в един sticky scroll-container с max-height: `calc(100vh - 120px)` и `overflow-y: auto`). Сега Чат лог и Събития са отделни секции долу — премести Чат под Players в десния panel.
3. Mobile (под 1024px): sticky disabled, players panel **се мести най-горе** в DOM (преди "Лични сигнали за фазите" / "Настройка"). Използвай CSS grid order или separate render order.

**Acceptance:**
- Screenshot at 1440×900 на /play/[code] показва players panel scroll-ващ заедно с десния viewport.
- Screenshot at 390×844 показва "Играчите на площада" първи (под Лоби панела), преди настройките/контрола на водещия.

---

### Задача 4 — Премахни дублиран "Започни игра" CTA (🟠 P1)

**Файл:** `apps/web/components/play-room-client.tsx`

**Проблем:** Бутонът "Започни игра" се появява и в Лоби панела, и в "Контрол на водещия" блока — две идентични primary CTA-та.

**Поправка:** Запази **само** Лоби панела (горе) с primary "Започни игра". В "Контрол на водещия" премахни start-game бутона; той трябва да съдържа само runtime controls (пауза / следваща фаза / +30 / +60 / +180 / тих режим / клавиши).

**Acceptance:** Грабни всички матчове на `Започни игра` (или константа за "startGame") в `play-room-client.tsx` — трябва да остане един `<button>` JSX node, в Lobby panel section.

---

### Задача 5 — Phase-map loop arrow (🟠 P1)

**Файл:** `apps/web/components/games/game-rules-page.tsx` (search за `phase-timeline` / phase map SVG) + `apps/web/app/globals.css`

**Проблем:** Loop arrow от node 06 към node 03 е три несвързани парчета: badge "ПОВТАРЯ СЕ" + arc + arrowhead — не приличат на една линия (виж `audit-v3/desktop/06-werewolf-rules.png`).

**Поправка:** Една continuous SVG `<path>` старваща точно от центъра на node 06, arc-ваща нагоре над timeline-а (curve height ~24-32px), и завършваща с малък arrowhead на центъра на node 03. Badge "ПОВТАРЯ СЕ" се позиционира на средата на arc-а като SVG `<text>` с background rect, не като отделен HTML chip.

Псевдо-структура (адаптирай според реалните координати на timeline-а):
```tsx
<svg className="phase-loop-arrow" viewBox="0 0 600 60" aria-hidden>
  <defs>
    <marker id="loop-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
    </marker>
  </defs>
  <path
    d="M 540 30 Q 300 -10 90 30"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeDasharray="6 4"
    markerEnd="url(#loop-arrowhead)"
  />
  <rect x="270" y="0" width="60" height="20" rx="10" fill="var(--surface-paper)" />
  <text x="300" y="14" textAnchor="middle" className="phase-loop-label">ПОВТАРЯ СЕ</text>
</svg>
```

**Acceptance:** Screenshot на /werewolf/rules timeline показва една плавна dashed линия от node 06 нагоре и обратно към node 03, с badge "ПОВТАРЯ СЕ" седнал на нея, без visible gap-ове.

---

### Задача 6 — Cinematic hero fade в `/werewolf` и `/mafia` (🟠 P1)

**Файл:** `apps/web/components/games/game-home-page.tsx` + `apps/web/app/globals.css` (`.game-home-hero` или подобен)

**Проблем:** Видим вертикален шев между painterly art (отдясно) и тъмния фон (отляво) — двата не се сливат (виж `audit-v3/desktop/02-werewolf.png`, `03-mafia.png`).

**Поправка:** Добави `mask-image: linear-gradient(to left, black 60%, transparent 100%)` (или равностойно `-webkit-mask-image` за съвместимост) на hero-art image / picture wrapper-а. Същия mask за webp + png fallback. На mobile (stack layout) маскът остава, но като `to top` за вертикален fade.

**Acceptance:** Screenshot на /werewolf desktop — art-ът отдясно избледнява плавно към тъмното, без видим вертикален шев.

---

### Verification gauntlet

След всички commit-и:

1. `pnpm regression` — трябва да мине (включително новата `assertNoLatinCopyLeak`).
2. `pnpm build` (root) — без errors.
3. Стартирай preview сървърите и проверки чрез Playwright MCP (или ръчно):
   - 390×844 → `/werewolf/roles` — имена на ролите на 1 ред.
   - 1440×900 → `/play/{code}` — балансиран desktop layout.
   - 390×844 → `/play/{code}` — Players panel най-горе.
   - 1440×900 → `/werewolf/rules` — loop arrow една линия.
   - 1440×900 → `/werewolf`, `/mafia` — без видим вертикален шев на hero-art.
4. Сравни новите screenshot-и срещу `audit-v3/desktop/` и `audit-v3/mobile/` baseline-а — запиши новите в `audit-v3/after/` (нов поддиректор).

### Не пипай

- Не променяй game-server logic / schemas / role assignment.
- Не пипай auth / sign-in пакет.
- Не въвеждай нови npm зависимости (използвай CSS / SVG / inline solutions).
- Без accessibility prompts (focus rings, ARIA-live, focus traps, reduce-motion) — user-ът изрично каза без тези.

### PR

Когато всичко мине, отвори PR `fix: frontend audit v3 P0+P1 fixes` срещу `main`, с тяло, което списък-ва всичко по задачите и линкове към обновените screenshot-и.

---

(End of prompt)
