# Workflow: преглед на game mechanics

Използвай този guide при промяна в authoritative room lifecycle, schemas,
night resolution, role assignment, win conditions или command protocol.
Целта е да докажеш поведението, а не да блокираш промяната заради файла, в
който се намира.

## 1. Установи намерението

- Сравни заявката, `docs/rules-bg.md`, текущия код и съществуващите tests.
- Ако си противоречат, определи дали промяната е bug fix или ново продуктово
  правило. Не избирай мълчаливо най-удобната интерпретация.
- Преглеждай реалния diff. Не докладвай проблем само защото pattern-ът е
  теоретично опасен.

## 2. Privacy и public state

- `PlayerPublicState` и `GameState` не съдържат unrevealed role, lover link,
  blessing, consumable state, private check или secret target.
- Targeted private event се изпраща само до правилния user/client.
- Faction и dead chat използват recipient filters, не публичен broadcast.
- Narrator snapshot е достъпен само при валидиран narrator mode/consent.
- Public event и persisted visibility не издават actor/target на тайно действие.

При нов secret добави regression test, който доказва отсъствието му от
serialized/synchronized public state.

## 3. Command authority

- Token, room code, actor identity и production guards остават валидирани.
- Server проверява phase, alive/playing state, role capability, target count,
  self-target policy и повторна употреба на consumable.
- Повторно submission от същия actor заменя или отхвърля предишното действие
  според contract-а; не се брои неволно два пъти.
- Client guards са UX, не security boundary.

## 4. Resolver и interaction order

Провери само приложимите взаимодействия:

- roleblocks и faction consensus;
- kills, delayed effects и multiple death sources;
- heal/protection/bodyguard/blessing order;
- investigation cover и резултати;
- lover, hunter и други death chains;
- once-per-game/consumable flags;
- draw, stalemate и win-condition evaluation.

Pure resolver тест доказва механиката. Room-level test доказва queueing,
private capabilities, transition и public/private events.

## 5. Lifecycle и liveness

- Всяка phase има изход при normal play, ties, abstentions и unavailable actor.
- Timer callback failure не остава в повторяем loop и има наблюдаем recovery.
- Pause/resume и narrator override запазват coherent timer state.
- Disconnect/reconnect не дублира player и възстановява нужния private context.
- Host migration и disposal не оставят room-а permanently locked.

## 6. State growth и persistence

- Public/private buffers имат cap или cleanup policy.
- Ново state-changing събитие се записва с правилната visibility.
- Persistence queue failure е наблюдаем и не нарушава authoritative state.
- Terminal result се записва идемпотентно и не се дублира при retry/dispose.

## 7. Проверка

Избери тестовете според diff-а:

- `pnpm --filter @werewolf/shared test`
- `pnpm --filter @werewolf/game-server test`
- `pnpm playtest` за multi-client lifecycle
- `pnpm regression` за security/protocol/script contracts

Не изисквай нов тест, ако съществуващ test вече доказва точно промененото
поведение. Не приемай зелен aggregate count като доказателство за конкретен
edge case.

## Отчет

Статусът е `OK` или `NEEDS-CHANGES`. Всяка находка съдържа:

- severity според достижимост и impact;
- точен `file:line`;
- възпроизводим сценарий или code-path доказателство;
- конкретна корекция;
- test, който би доказал корекцията.

Разделяй потвърден bug, умишлено правило, продуктово решение и бъдещ hardening.
Не добавяй findings за бройка.
