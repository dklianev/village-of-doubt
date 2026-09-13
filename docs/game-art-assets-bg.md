# Game Art Asset System

PNG master-ите са в `assets/game-art-source`, а оптимизираните файлове за
приложението са в `apps/web/public/game-art`. Новите сюжетни изображения се
генерират с imagegen; не копираме официални карти, лога или страници от правилници.
`pnpm optimize:assets` създава WebP/AVIF и специализираните производни. PNG се
публикува само там, където metadata форматът го изисква, а не като общ fallback.

Master-ите вече са неизменяеми: оптимизацията не намалява резолюцията или
цветовете им. Възстановяването на оригиналите, актуалните правила за доставка
и проверките са описани в [Image Quality Repair](image-quality-repair.md).
Размерите и настройките в по-старите записи по-долу са исторически данни,
а не текущи ограничения за оригиналите.

## Основни слоеве

- `bg-*`: големи фонове за landing, lobby, role reveal, night/day/vote/resolution, narrator и history.
- `transition-*`: кинематографични phase backgrounds за активната игра.
- `role-*`: карти за българските роли в ролева карта, codex и role count chips.
- `icon-phase-*`: фазови сцени за правилата и малки производни за лентата на играта.
- `icon-ability-*`: икони за бутони на нощни действия.
- `faction-*`: финални winner cards за Село, Върколаци, Вампири, Мафия, Влюбени и неутрален край.
- `event-*`: badges за timeline събития като смърт, разкриване и изстрел на Ловец.
- `screen-*`: свързване, reconnect и error states.
- `empty-*`: празно лоби, празен площад и празна история.
- `*-sheet`: sprite sheets за presets, badges, avatars, role states и орнаментен texture слой.

## Интеграция във frontend

- `globals.css` държи всички asset URL-и като CSS variables, за да може UI-то да сменя визуални състояния без React state за картинки.
- CSS background-ите използват оптимизираните WebP/AVIF файлове и подходящите mobile варианти.
- Play сменя фоновете според фазата и показва отборен финал, състояние на връзката и събития.
- `GameRulesPhaseTimeline` използва `phase-board/v1/{family}`; фазовата лента използва `phase-rail/v1/{family}`.
- `app/layout.tsx` използва `game-art/og/og-home.png` за основния OpenGraph/Twitter preview.

## Дизайн правило

Всяко ново изображение трябва да следва същия български folk-horror / градска мистерия език: восък, орехово дърво, вечерна мъгла, печати, селски площад, ръчно рисувани карти, без четим AI текст вътре в самото изображение.

## D3: Фази на Мафия, 2026-09-05

Шестте `assets/game-art-source/mafia/icon-phase-*.png` са заменени с отделно
генерирани noir сцени чрез вградения `image_gen`: 6 извиквания, 6 успешни
изображения, без API/CLI fallback. Общата задача е рисувана стара София,
осезаеми дърво, хартия и восък, осветен централен сюжет, без текст, лога и насилие.
Прегледани стилови референции: `mafia/bg-day-discussion.png`,
`mafia/bg-hero-v2.png` и Werewolf `icon-phase-voting.png` от source директорията.

| Файл `icon-phase-*.png` | Сюжет | Оригинален imagegen файл |
|---|---|---|
| `lobby` | Маса и празни столове преди събирането | `exec-20aa5705-b144-45b3-8973-bed5fd03312a.png` |
| `role-reveal` | Тайно досие с восъчен печат | `exec-0ef7e449-5d60-420a-b142-145c9843948a.png` |
| `night` | Скрито предаване на плик под фенер | `exec-85e3782b-8759-4980-bedb-565bd6802cf2.png` |
| `day` | Дневно обсъждане между трима граждани | `exec-4d547eaa-6151-474e-9275-43cc3110af6c.png` |
| `voting` | Пускане на бюлетина в дървена урна | `exec-82ecc51c-93e4-472b-9f9a-c6953fc07553.png` |
| `resolution` | Чукче върху поставка след решението | `exec-1164b8b0-0f9b-4a74-ac0e-a94d5b653e59.png` |

Оригиналите 1536×1024 са запазени в
`$CODEX_HOME/generated_images/01a06e5e-79a2-76f3-9d41-358fdd397cdf/`.
Master-ите са 720×480 PNG (palette quality 78, compression 9) по настройките на
`scripts/optimize-assets.mjs`, с лимит 500 KiB. Само съответните шест публични
`mafia/icon-phase-*.webp` са обновени при quality 82, effort 6, smartSubsample,
с лимит 150 KiB. Само Mafia производните в `phase-board/v1/mafia/` и
`phase-rail/v1/mafia/` следват `scripts/generate-phase-rail-assets.mjs`:
560×400 / quality 64 / 48 KiB и 128×128 / quality 80 / 20 KiB,
централно cover изрязване, effort 6, без уголемяване.
Прегледани са шестте крайни master-а и contact sheet с board изображенията
и реалните 128px икони върху светъл и тъмен фон; всички файлове са под бюджета.
