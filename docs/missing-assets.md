# Липсващи изображения

Този списък описва ролите, които вече работят в кода, но временно използват стабилен fallback към `card-back-secret`.
UI-то не трябва да се чупи, ако някой asset липсва.

## Върколак

- Червена шапчица — `role-red-riding-hood`
- Оракул — `role-oracle`
- Готвач — `role-cook`
- Ковач — `role-blacksmith`
- Неспяща — `role-insomniac`
- Убиец на вампири — `role-vampire-hunter`
- Следователка — `role-investigator`
- Пияница — `role-drunk`
- Улична котка — `role-stray-cat`
- Куче пазач — `role-guard-dog`

## Мафия

- Доктор — `mafia/role-doctor`
- Детектив — `mafia/role-detective`
- Бодигард — `mafia/role-bodyguard`
- Вигиланте — `mafia/role-vigilante`
- Медиум — `mafia/role-medium`
- Блокиращ — `mafia/role-roleblocker`
- Адвокат — `mafia/role-lawyer`
- Доносник — `mafia/role-informant`
- Маниак — `mafia/role-maniac`
- Шут — `mafia/role-jester`
- Кмет — `mafia/role-mafia-mayor`
- Любовници — `mafia/role-lovers`

## Бележки за генериране

- Всички role art изображения трябва да са вертикални карти със стабилно лице на персонажа и достатъчно празно пространство около него.
- За role cards използваме `object-fit: contain`, затова не режи важни детайли по краищата.
- За hero/background изображения използваме `object-fit/background-size: cover`, затова ключовият фокус трябва да е в централната зона.
