# Goal brief — пълен regression + bug audit на текущата работа

> Пейстни в Codex CLI:
>
> ```
> /goal Направи пълен regression + bug audit по docs/frontend-audit-v3/codex-goal-regression-audit.md. Не спирай, докато цялата матрица (route × тема × viewport + /play фази) и пълният gate не са обходени, всяка находка не е в доклада със severity/repro/root cause, P0/P1 не са поправени, и gate-ът не е зелен. Спазвай HARD CONSTRAINTS; не комитвай.
> ```
>
> Пусни в full-auto. **Не комитвай** — целта е да се де-рискова големият некомитнат diff преди ревю.

---

## 0. Контекст (защо този audit)

Има голям **некомитнат** diff: цялостен /play overhaul (30+ итерации) + нощно-действена логика + споделени компоненти + seat-geometry фикс. Нищо не е минало през човешко ревю. Тази цел е да го **провери за регресии и бъгове** систематично, да поправи ясните и да каталогизира останалите, за да тръгне commit-ът от стабилна база.

## 1. Objective (един, проверим)

Намери всички регресии и бъгове, въведени от текущата некомитната работа (и съседния код, който тя докосва), през целия апп; поправи P0/P1; каталогизирай всичко в структуриран доклад.

## 2. Definition of done (verifiable stop)

Спри САМО когато ВСИЧКИ:
1. **Матрицата (§5) е обходена** — всяка клетка проверена визуално + програмно.
2. **Пълният gate е зелен:** `pnpm typecheck && pnpm test && pnpm regression && pnpm playtest && pnpm build && pnpm check:dict && pnpm perf:budget` + `git diff --check`. (Ако `pnpm frontend:e2e` / `e2e:auth` са изпълними локално — пусни и тях; иначе отбележи защо не.)
3. **Докладът е пълен** — `docs/frontend-audit-v3/regression-audit-report.md` с всяка находка: severity (P0–P3), route/клетка, repro стъпки, root cause, предложен фикс, статус (поправено / за човек).
4. **P0/P1 поправени** (счупено/клипнато/нечитаемо/недостъпно/счупен flow/security). P2/P3 — каталогизирай, НЕ ги полирай (избягвай разрастване на diff-а).

## 3. Първична рискова повърхност (фокусирай тук)

Текущият некомитнат diff пипна основно това — провери го с приоритет:
- **/play seat geometry** — за N = 3..18 × всички фази × теми × {1390×820, 1366×768, 1440×900, 1920×1080} × mobile: нито един seat извън `.play-stage`, върху `.play-table-core`, или застъпен. (Скорошен фикс: овална маса за <9 в `getSeatPosition`; периметър за ≥9.)
- **Нощно-действена логика** — `apps/web/lib/play/night-actions.ts` (refactor: role-aware цели, двуцелеви роли, `requiresExplicitNightActionChoice`, `doctorCanSelfProtect`). Кръстосано провери клиентските цели/действия срещу СЪРВЪРНИТЕ правила (`apps/game-server/src/rooms/GameRoom.ts` night-resolver/role-assignment — само ЧЕТЕНЕ) за всяка роля: UI да не предлага цел, която сървърът отхвърля, нито да крие валидна. Особено doctor self-protect (вкл. стаи, където е забранен).
- **Споделени компоненти** — `CookieBanner.tsx` (`aside`→`div`+`data-cookie-banner`): провери consent UX/a11y на НЕ-/play страници. `RoleCard`, `VoteTallyBar`, `PhaseTransitionOverlay`, `LiveCuePanel`, `NightActionPanel`, `HunterRevengePanel`, `VotingPanel` — без клипване/нечитаемост.
- **types.ts / use-game-room.ts** — `doctorCanSelfProtect`, `actionTargets`: само presentation, без скрит protocol drift.
- **Light-theme parity** — всички /play панели + другите страници: без тъмен-остров/нечитаем текст на парчмент.

## 4. Инварианти (твърди — провери изрично)

- **Тайни роли НЕ текат** в публичен/сценичен DOM (`privateRole`, `privateResult`, `narratorSnapshot`, `privateLover`). Сверявай със security regression контракта + `AGENTS.md`.
- Без `prefers-reduced-motion` в source; Motion само `opacity`/`transform`.
- Само български UI текст (`pnpm check:dict` без нови hard warnings).
- Визуален fixture остава dev-only / production-gated.

## 5. Coverage матрица

- **Routes:** `/` (landing), `/werewolf`, `/mafia`, `/create` (+ mafia/werewolf), `/play` (VISUAL fixture), `/history`, achievements (Легенди), `/leaderboard`, legal/FAQ/privacy/terms, auth/sign-in, account/dashboard.
- **/play фази (14):** lobby, role_reveal, first_night, night, day_announcement, day_discussion, nomination, defense, voting, resolution, hunter_revenge, mayor_successor, paused, game_over.
- **Теми:** dark, light. **Viewports:** desktop 1440×900 + 1390×820 (нисък лаптоп) + mobile 390×844.
- Дефекти за хващане: клипнато/overflow/колабирано, хоризонтален скрол, нечитаем текст (под WCAG AA), theme-разнобой, счупен/липсващ интерактивен state, счупен flow/navigation, console errors, hydration mismatch (различи pre-existing от нов).

## 6. Validation loop / методология

1. `pnpm dev`. VISUAL fixture: `http://localhost:3000/play/VISUAL?visualGame=1&phase=<PHASE>&family=<FAMILY>&viewer=<VIEWER>&players=<N>&role=<ROLE>&...` (виж `apps/web/hooks/play/visual-game-fixture.ts`).
2. Програмна проверка (playwright): `getBoundingClientRect` за overlap/clip, computed contrast, `scrollWidth>clientWidth`, axe sweep, console listener.
3. Тема: `localStorage['werewolf-theme']` + reload. Запиши находка → поправи (ако P0/P1) → re-verify.
4. На всеки блок: `pnpm typecheck`; накрая пълният gate (§2).

## 7. HARD CONSTRAINTS

- **Поправяй само client presentation** (`apps/web/**`). Сървърни/protocol/schema/балансни проблеми → САМО докладвай (не пипай `apps/game-server/**`, `packages/shared` логика). Четенето им за верификация е ок.
- Без нови npm deps. Без `prefers-reduced-motion`. Само bg текст. Fixture dev-only. **Не комитвай / не push-вай.**
- НЕ полирай P2/P3 и не предприемай голям рефактор — това е audit, не overhaul. Дръж fix-diff-а минимален и ревюируем.
- Анимации compositor-only.

## 8. Формат на доклада (`docs/frontend-audit-v3/regression-audit-report.md`)

За всяка находка: `[P0–P3] Заглавие` · Route/клетка (+ fixture URL) · Repro · Очаквано vs реално · Root cause · Предложен фикс · Статус (поправено SHA-less / за човек). Накрая: обобщена таблица + резултат от всяка gate команда (pass/fail) + списък с НЕпоправеното (за човешко решение).

## 9. Ориентация (cold start)

- /play: `apps/web/components/play-room-client.tsx` + `apps/web/components/play/*` + `PlayRoom.module.css` + `.play-*` в `app/globals.css`.
- Gate команди: `AGENTS.md` (таблицата с `pnpm` скриптове). Bg речник: `docs/dictionary.md`.
- Скорошни логове за контекст какво е пипано: `docs/frontend-audit-v3/play-uiux-polish-log.md`.
