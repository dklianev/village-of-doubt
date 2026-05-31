# Goal brief — /play „next level" кинематографичен полиш (свободна ръка)

> Пейстни в Codex CLI:
>
> ```
> /goal Вдигни /play до next-level кинематографично качество по docs/frontend-audit-v3/codex-goal-play-uiux-polish.md. Имаш свободна ръка по естетиката и разрешение да ползваш системния imagegen за нов арт. Не спирай, докато екранът не изглежда премиум по ВСЯКА фаза × фракция × тема × viewport И gate-ът е зелен. Пази само HARD CONSTRAINTS; води кратък checkpoint лог.
> ```
>
> Пусни в full-auto. **Не комитвай** — човек ревюва diff-а накрая. По избор: token budget на целта.

---

## 0. Дух на задачата (чети първо)

**Свободна ръка.** Това НЕ е „поправи списък дефекти" — а „направи `/play` най-красивия, кинематографичен екран в приложението". Имаш право да преструктурираш композицията, да въвеждаш ново осветление/дълбочина/движение и да **генерираш нов арт**. Дръзко > плахо; драматично > безопасно-скучно. Единствените твърди граници са **§2 (предпазители)** и **зеленият gate (§4)** — всичко между тях е твое поле.

## 1. North star (вкусът, към който се целиш)

- Кинематографична „стая": дълбочина, атмосферно осветление, ясен фокус към масата.
- Две силно различими фракции: **върколаци** = лунна нощ, мъгла, гора, сребро; **мафия** = ноар, щори, абажур, дим, месинг.
- Премиум, не претрупано: йерархия, ритъм, тишина около фокуса. По-малко кутии, повече сцена.
- Тъмната сцена е сърцето във ВСЯКА тема. Светлата тема = топъл парчмент за панелите около сцената.
- Движението служи на настроението (тлеещо, дишащо), не разсейва. Compositor-only.

## 2. HARD CONSTRAINTS (единствените спирачки — при конфликт спри и докладвай)

- **Само клиентско представяне.** Забранено: `apps/game-server/**`, логика в `packages/shared`, protocol/schema/socket/state. Виж [AGENTS.md](../../AGENTS.md) — тайните роли НИКОГА не са в `GameState`.
- **Никога** тайни данни (`privateRole`, `privateResult`, `narratorSnapshot`, `privateLover`) в публичен/сценичен DOM (seats, stage, chronicle).
- **Без нови зависимости** (npm пакети). Нов **арт** е ок — виж §3.
- **БЕЗ `prefers-reduced-motion`** никъде (изрично предпочитание на собственика). Ако правило го изисква — СПРИ и докладвай.
- **Само български** потребителски текст. Свери [docs/dictionary.md](../dictionary.md); `pnpm check:dict` без нови hard warnings.
- Визуалният fixture остава **dev-only / production-gated** (`NODE_ENV !== "production"`).
- **Не комитвай / не push-вай.** Анимации само `transform`/`opacity`; разумен `will-change`.

## 3. Системен imagegen + арт pipeline (имаш разрешение)

- Ползвай **системния imagegen** за фонове на сцената, текстури, атмосферни слоеве (мъгла/дим/прах), фракционни мотиви и по избор role-арт — където реално вдига кадъра.
- **ВСЕКИ генериран растер минава през репо-pipeline-а**, иначе чупи regression:
  - WebP **+** AVIF (+ PNG fallback) pairing и `image-set()` доставка — копирай модела на наличния арт в `apps/web/public/game-art/…`. Контрактите „game art WebP pairing" и „CSS image-set delivery" го пазят.
  - Спазвай budget-ите: `pnpm perf:budget` зелен (арт asset budget). Пусни `pnpm optimize:assets` след добавяне.
  - Правилно именуване/папки по фракция (`werewolf/`, `mafia/`, `mobile/…`).
- Стил: стилизирано, в тона на играта. **Без лица/реални хора** (репо-правило за facial images). Без текст в арта (или само bg).
- Арт = публичен asset, ок за shipping. Дръж дифа ревюируем: добавяй арт на партиди + лог.

## 4. Done bar (леко, но проверимо — кога спираш)

Спри САМО когато и двете:
1. По матрицата (§6) няма **счупено / клипнато / overflow / нечитаемо (под WCAG AA) / разнобой по тема** — И екранът изглежда премиум (твоя преценка спрямо §1).
2. Gate зелен: `pnpm typecheck && pnpm test && pnpm regression` · `git diff --check` · `pnpm check:dict` · `pnpm perf:budget`. `pnpm playtest` не е счупен.

Checkpoint: по 1–2 реда before/after на клетка/итерация в `docs/frontend-audit-v3/play-uiux-polish-log.md`.

## 5. Validation loop (всяка итерация)

1. `pnpm dev` (web :3000) — fixture-ът е dev-only.
2. Зареди клетка: `http://localhost:3000/play/VISUAL?visualGame=1&phase=<PHASE>&family=<FAMILY>&viewer=<VIEWER>&players=<N>&role=<ROLE>&winner=<TEAM>&voteTally=<…>&connection=<…>` — пълните параметри: [apps/web/hooks/play/visual-game-fixture.ts](../../apps/web/hooks/play/visual-game-fixture.ts).
3. Тема: navbar toggle или `localStorage['werewolf-theme']='light'|'dark'` + reload.
4. Верифицирай визуално + програмно (playwright/browser: rect, contrast, `scrollWidth>clientWidth`, `:focus-visible`).
5. Поправи → повтори. На всеки ~5 клетки: `pnpm typecheck` + допиши лога.

## 6. Матрица (обхват)

- **Фази (14):** `lobby`, `role_reveal`, `first_night`, `night`, `day_announcement`, `day_discussion`, `nomination`, `defense`, `voting`, `resolution`, `hunter_revenge`, `mayor_successor`, `paused`, `game_over`.
- **Фракции:** `werewolves`, `mafia`. **Теми:** `dark`, `light`. **Viewports:** desktop `1440×900`, mobile `390×844`.
- **По избор:** `viewer=host|narrator|player`; плътности `players=4/8/12/15`.

## 7. Вече направено този цикъл (НЕ регресирай)

- Атмосферните FX (върколашка мъгла/луна, мафиотски щори/лампа) са **скопирани само за нощ** през `data-night` на `.play-stage`. Не ги връщай по лоби/ден.
- Панелът на водещия е изваден в **пълноширока лента** `.play-narrator-deck` (grid-area `narrator`, `flow-root`). Колабираше до 50px в rail-grid заради `overflow:hidden`. Не го връщай в rail-а.
- Rail scrollbar-ът е **скрит** (скролът работи).
- Светла тема за narrator лентата = парчмент + `btn-secondary` ink-on-parchment fix (scoped към `.play-action-dock`/`.play-narrator-deck`/`.play-side-rail`). Разшири СЪЩИЯ подход към панелите, които още са тъмни/нечетими на светло.
- Seats = портретни медальони; победен splash = драматичен.

## 8. Идеи за next level (вдъхновение, НЕ задължителен списък)

- Параметрично осветление/виньетка по фаза (зора → ден → здрач → нощ) върху тъмната сцена.
- Генериран атмосферен фон на сцената по **фракция × фаза** (imagegen) + CSS параллакс/дим/мъгла слоеве за дълбочина.
- По-богати seat медальони: рамки по състояние, фин sheen, тен по фракция, ясен selection feedback (вкл. two-step роли).
- Кинематографични фазови преходи (има `PhaseTransitionOverlay` — вдигни го до „завеса/проблясък").
- Премиум role карти: генериран арт + фолио/восъчен печат, четими и в двете теми.
- Light-theme parity по ВСИЧКИ панели (`NightActionPanel`, `VotingPanel`, `HunterRevengePanel`, `PrivateChatPanel`, `LoverCard`, blessed card, `DeathRevealCinematic`, `PhaseGuide`, `RulesSummary`, `PostGameStory`, modals).
- Empty/loading/connection states с характер. Mobile: tap targets ≥44px, без хоризонтален скрол.

## 9. Out of scope

Сървър/протокол/schema/socket · рендиране на тайни роли · нови npm зависимости · `prefers-reduced-motion` · неbg текст · лица/реални хора в арт · commit/push · авто-обновяване на `pnpm visual` baseline-и (intentional промени ще ги „чупят" — флагни за човешко ревю, не ги презаписвай сляпо).

## 10. Ориентация (cold start)

- Оркестратор: [apps/web/components/play-room-client.tsx](../../apps/web/components/play-room-client.tsx) — `renderActionDock`, `renderPlayersPanel` (rail), `renderNarratorDeck`, `renderStageTakeover`.
- Презентационни: [apps/web/components/play/](../../apps/web/components/play/). Стилове: [PlayRoom.module.css](../../apps/web/components/play/PlayRoom.module.css) (`:global(.play-*)`) + `.play-*`/`.narrator-*` в [globals.css](../../apps/web/app/globals.css).
- Layout: `.play-layout` → desktop `"stage rail" / "dock dock" / "narrator narrator"`; mobile едноколонен. Тема: `html[data-theme]`; сцената е тъмна „стая" във всяка тема.
