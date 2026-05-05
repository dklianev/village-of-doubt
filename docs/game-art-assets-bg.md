# Game Art Asset System

Всички визуални assets са оригинални imagegen изображения в `apps/web/public/game-art`.
Не използваме официални карти, лога, rulebook scans или чужди protected assets.
PNG файловете са source/fallback, а `pnpm optimize:assets` генерира WebP версии за production delivery.

## Основни слоеве

- `bg-*`: големи фонове за landing, lobby, role reveal, night/day/vote/resolution, narrator и history.
- `transition-*`: кинематографични phase backgrounds за активната игра.
- `role-*`: карти за българските роли в ролева карта, codex и role count chips.
- `icon-phase-*`: малки phase sigils за rail-а на играта.
- `icon-ability-*`: икони за бутони на нощни действия.
- `faction-*`: финални winner cards за Село, Върколаци, Вампири, Мафия, Влюбени и неутрален край.
- `event-*`: badges за timeline събития като смърт, разкриване и изстрел на Ловец.
- `screen-*`: свързване, reconnect и error states.
- `empty-*`: празно лоби, празен площад и празна история.
- `*-sheet`: sprite sheets за presets, badges, avatars, role states и орнаментен texture слой.

## Интеграция във frontend

- `globals.css` държи всички asset URL-и като CSS variables, за да може UI-то да сменя визуални състояния без React state за картинки.
- CSS background-ите използват `image-set(...)`: браузърите взимат WebP, а PNG остава fallback.
- `PlayRoomClient` сменя phase background според `phase-*`, показва faction winner art, connection art, event badges и empty states.
- `LobbyCreateClient` показва preset preview cards и achievement strip.
- `lobby/[code]` показва карта на селото за покана.
- `layout.tsx` използва `og-preview.png` за OpenGraph/Twitter preview.

## Дизайн правило

Всяко ново изображение трябва да следва същия български folk-horror / градска мистерия език: восък, орехово дърво, вечерна мъгла, печати, селски площад, ръчно рисувани карти, без четим AI текст вътре в самото изображение.
