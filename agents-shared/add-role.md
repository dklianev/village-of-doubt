# Workflow: добавяне или промяна на роля

Този guide описва покритието на една роля в shared contracts, authoritative
server, web UI, assets и tests. Това не е фиксирана поредица от файлове.
Започни с `rg` и използвай актуалната структура на кода.

## Решение преди код

Изведи от заявката и съществуващите роли всичко, което може да се определи
разумно: slug, family, team, BG име, asset key и дали ролята е advanced.
Питай само ако липсва механика, която променя баланса или публичното поведение:

- кога и колко пъти действа;
- кои са валидните цели;
- как взаимодейства с roleblock, protection, death chains и win conditions;
- какво е публично и какво остава private;
- в кои режими и player counts може да участва.

Запиши или обнови правилото в `docs/rules-bg.md`, когато добавяш ново продуктово
поведение. Не измисляй механика само за да запълниш липсващо поле.

## Shared contract

Провери и обнови приложимите места:

- `packages/shared/src/roles.ts`: `RoleCode`, `ROLE_DEFINITIONS`, families,
  българско име, кратко описание, tags и asset key.
- `packages/shared/src/game-config.ts`: presets, availability, minimum counts и
  role-distribution validation.
- `packages/shared/src/protocol.ts`: command/event schema само ако ролята добавя
  нов network contract.
- `packages/shared/src/role-assignment.ts` и `win-conditions.ts`, ако ролята
  влияе на assignment или победа.

Търси exhaustive maps и role-code switches, вместо да разчиташ на запомнен
списък:

```powershell
rg -n "RoleCode|ROLE_DEFINITIONS|switch \(.*role|Record<RoleCode" packages apps
```

## Authoritative game-server

- Валидирай action kind, phase, actor state, target count и target eligibility
  server-side.
- Пази consumables, lover links, checks и други тайни стойности в private state.
- Ако ролята участва в нощна резолюция, обнови pure resolver-а и interaction
  order само там, където е необходимо.
- Ако действието е immediate или има lifecycle side effect, използвай
  съществуващия handler/manager с правилната ownership граница.
- Включи ролята в readiness, reconnect replay и narrator snapshot само ако
  поведението го изисква.
- Persist-вай state-changing събития с правилната visibility.

Преди финалния преглед използвай `agents-shared/role-mechanics-review.md`.

## Web и copy

Shared definition е основният източник за role name, team и кратко описание.
Провери само UI повърхностите, които имат отделен interaction contract:

- `apps/web/lib/play/copy.ts`
- `apps/web/lib/play/player-display.ts`
- `apps/web/lib/play/role-rules.ts`
- `apps/web/lib/play/night-actions.ts`
- `apps/web/components/play/NightActionPanel.tsx`
- family role pages и lobby role editor

Добавяй отделен mapping само ако shared metadata не може да изрази нужния UI
контекст. Всички видими инструкции и errors са естествен български.

## Art

- Source masters живеят в `assets/game-art-source/`.
- Runtime WebP и thumbnails живеят в `apps/web/public/game-art/`.
- Family-specific variant използва съществуващата структура и
  `apps/web/lib/role-art.ts`.
- Не редактирай generated variants на ръка. Използвай asset pipeline-а.
- Placeholder е допустим само временно и не е завършен user-facing резултат,
  освен ако заявката изрично го допуска.

Пусни `pnpm optimize:assets` само когато source asset е променен, след което
`pnpm verify:assets` и съответната визуална проверка.

## Минимални tests

- Shared definition/config: `pnpm --filter @werewolf/shared test`
- Server mechanic: `pnpm --filter @werewolf/game-server test`
- Web interaction/copy: targeted `@werewolf/web` test
- Multi-client или reconnect поведение: `pnpm playtest`
- Cross-package contract: `pnpm regression`
- Ново art/layout поведение: засегнат visual test и `pnpm perf:budget`

Тестовете трябва да покриват новото правило и най-рисковото му interaction
поведение. Не добавяй тестове за непроменени роли само за формална пълнота.

## Готово означава

- Ролята може да бъде конфигурирана и разпределена във валидните режими.
- Authoritative server приема само валидни действия и не издава private data.
- Играчът вижда правилната карта, инструкция, controls и reconnect state.
- Правилата, copy-то, art-ът и tests описват една и съща механика.
