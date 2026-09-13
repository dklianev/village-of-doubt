# Game-server guidance

Тази директория съдържа authoritative game state и най-високорисковата логика
в репото. Промените са позволени; изискват доказателства според засегнатия
invariant.

## Контракти

- `GameRoom.ts` оркестрира lifecycle-а. Използвай съществуващите managers и
  pure game-logic функции, когато ownership-ът им пасва.
- `PlayerPublicState` и `GameState` не съдържат тайни роли, lover links,
  protection flags, private checks или скрити action targets.
- Private събитие се изпраща само до точния recipient. Faction и dead chat
  използват router-а и неговите recipient filters.
- Всяка команда се валидира server-side независимо от client UX guards.
- Ново protocol поле или event се дефинира в `packages/shared/src/protocol.ts`.
- Room collections, replay buffers и private history имат ясен cap/cleanup.
- Reconnect възстановява необходимия private context без duplicate player.
- Persistence failure не трябва да превръща частично записано състояние в
  успешно приключила операция.

## Работа по механика

При промяна в механика, authority, публичен/private schema договор, protocol
или room lifecycle използвай `agents-shared/role-mechanics-review.md`.
Самото редактиране на `GameRoom.ts` (например коментар) не изисква пълен review.
Третирай `docs/rules-bg.md` като продуктова спецификация. Ако код, тест и
правило си противоречат, установи намерението преди да променяш поведението.

Покрий interaction-а, който реално се променя: roleblock, protection order,
consumables, faction consensus, death chains, win condition, reconnect или
timer recovery. Не добавяй тестове за несвързани роли само за бройка.

## Проверка

- Targeted suite: `pnpm --filter @werewolf/game-server test`
- Shared contract при protocol/rules промяна: `pnpm --filter @werewolf/shared test`
- Multi-client lifecycle: `pnpm playtest`
- Repository contracts: `pnpm regression`

Избери конкретните tests и комбинацията, която доказва засегнатия invariant.
При security/protocol промяна провери producer, consumer и public/private
границата; включи playtest, когато тя зависи от room lifecycle или клиенти.
