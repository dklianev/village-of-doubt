# Frontend visual audit — v3

> Реален визуален одит на цялото фронтенд приложение **Върколак и Мафия**.
> Скрийншотите са свалени с Playwright на работещи preview сървъри (web :3000, game-server :2567).
> Desktop viewport: **1440 × 900**. Mobile viewport: **390 × 844**.
> Дата: 2026-05-15. Преглеждани commit-и: `HEAD` на текущия клон.

Източниковите изображения са в `audit-v3/desktop/` и `audit-v3/mobile/`. Файловите имена в заглавията на секциите по-долу препращат към тях.

---

## 0. Изпълнено резюме

| # | Severity | Тема | Линк |
|---|---|---|---|
| 1 | 🔴 P0 | `/werewolf/roles` и `/mafia/roles` на мобилно: имената на ролите се чупят по 1-2 кирилски символа на ред (картите са твърде тесни за 2-кол grid). | [§ 3](#3-werewolfroles-и-mafiaroles) |
| 2 | 🔴 P0 | BG-only invariant нарушения: "replay", "grind", "host", "no-chat", "live" в copy. | [§ 9.1](#91-bg-only-нарушения) |
| 3 | 🟠 P1 | `/play/[code]` desktop: дясната parchment колона "Играчите на площада" е остров — оставя огромно празно тъмно поле под себе си. | [§ 7](#7-playcode) |
| 4 | 🟠 P1 | `/play/[code]` — два видими "Започни игра" CTA-а в две различни секции, без ясна йерархия. | [§ 7](#7-playcode) |
| 5 | 🟠 P1 | Phase-map loop arrow във `/werewolf/rules` остава визуално счупен (виж и предишния audit). | [§ 6](#6-werewolfrules-и-mafiarules) |
| 6 | 🟠 P1 | Cinematic hero-арт ръбът среща тъмния фон с видим вертикален шев (`/werewolf`, `/mafia`). | [§ 2](#2-werewolf-и-mafia-семейни-начални) |
| 7 | 🟡 P2 | Homepage и game-home завършват с **две** празни state-карти една до друга — страницата приключва на празнота. | [§ 1, § 2](#1-homepage-) |
| 8 | 🟡 P2 | `/history` desktop: една празна-state ивица плава върху огромен тъмен фон, изглежда счупено. | [§ 4](#4-history-и-leaderboard) |
| 9 | 🟡 P2 | `/lobby/[code]`: ABC123 печат е дребен и в ъгъл; основното на страницата (кодът) не е фокална точка. | [§ 8](#8-lobbycode) |
| 10 | 🟡 P2 | Achievements: смесени 4-кол и 3-кол редове; "ВИЖ REPLAY ИСТОРИЯ" – Latin script. | [§ 5](#5-achievements) |
| 11 | 🟡 P2 | Wizard preset chips (Бърза/Класика/Голяма маса) не различават визуално препоръчания. | [§ 11](#11-werewolfcreate-mafiacreate-wizard) |
| 12 | 🟢 P3 | Дублиране на "Телефонът е карта" блок в `/tutorial` и `/werewolf/rules`. | [§ 10](#10-tutorial) |

---

## 1. Homepage `/`

**Файлове:** `audit-v3/desktop/01-home.png`, `audit-v3/mobile/01-home.png`

### Desktop
- Heroto работи: голямото заглавие "Върколак или Мафия" + dual cards с painterly background.
- Само върху картата на Върколак има малък "Продължи" pill — асиметрия с Мафия (нормално, но визуално несбалансирано).
- 5-стъпковият strip "Как започва добра игра" с кръгли медалиони е добре центриран.
- **Проблем:** Страницата приключва с **две съседни празни-state карти** ("Бъди първият на масата" + "Първите герои ще се появят тук."). Това е последното нещо, което потребителят вижда — създава впечатление за недовършен продукт.

### Mobile (390×844)
- Стъпковете в strip-а стават вертикални; текстът в кръгчетата е малък но четим.
- Двете game-cards се стекват добре.
- Същия проблем с двойната празна-state долу.

### Препоръки
- P2 — Сменете последните две card-ове на едно по-плътно "Покани приятел" CTA + "Последна игра" миниатюра (когато има история, иначе скрий блока изобщо).
- P3 — Премахнете "Продължи" pill ако последното семейство е било преди >7 дни (избягваме фалшива персонализация при празен профил).

---

## 2. `/werewolf` и `/mafia` (семейни начални)

**Файлове:** `audit-v3/desktop/02-werewolf.png`, `audit-v3/desktop/03-mafia.png`, `audit-v3/mobile/02-werewolf.png`, `audit-v3/mobile/07-mafia.png`

### Desktop
- Cinematic hero (заглавие ляво, painterly art дясно) работи концептуално.
- **Проблем (P1):** Видим вертикален шев между художествения панел отдясно и тъмния фон вляво — двата слоя не се сливат, изглежда като колаж, не като сцена.
- 3-те CTA pills (ИГРАЙ / РОЛИ / ПРАВИЛА) са добре оразмерени; "ВЛЕЗ С КОД" се появява допълнително — четвъртият CTA затормозява йерархията.
- "Как започва добра игра" 5-stepper се повтаря от homepage-а (същия компонент). На страница, която вече има семеен hero, това е излишно.
- Двете долни празни-state карти (както на homepage) — отново двойна празнота в подножието.

### Mobile
- Hero arts се стекват добре над текста; вертикалният шев не съществува при стек.
- 4-те CTA pills wrap-ват на 2 реда — приемливо.
- Stepper-ът във вертикален вид има малки бодита.

### Препоръки
- P1 — Замъглете дясната ивица на hero-art (`mask-image: linear-gradient(to left, black 70%, transparent)`) за да се слее с тъмния фон.
- P2 — Махнете долния "Как започва" stepper от семейните страници, оставете го само на homepage. На семейната страница покажете 1-2 ключови роли или вертикална timeline на фазите.
- P2 — Слейте "ВЛЕЗ С КОД" в "ИГРАЙ" dropdown или го направете secondary chip; не трябва да е същата визуална тежест като primary action.

---

## 3. `/werewolf/roles` и `/mafia/roles`

**Файлове:** `audit-v3/desktop/05-werewolf-roles.png`, `audit-v3/mobile/04-werewolf-roles.png`

### Desktop
- 4-кол grid с art-thumbnails работи приемливо.
- "Червена шапчица" се wrap-ва на 2 реда; "Сладкарката" — също.
- Картите имат смесено качество на изображенията; някои роли в долната половина на страницата показват генеричен placeholder ("Селянин").
- Филтър chip-овете отгоре (вероятно "Всички / Селяни / Върколаци / Неутрални") са OK.

### Mobile — 🔴 КРИТИЧНО
- **Grid-ът е принуден на 2 колони на 390px ширина**, при което всяка карта е твърде тясна за името на ролята.
- Резултат: имена като "Златна ръка" се пречупват вертикално на 1-2 кирилски символа на ред. Скрийншотът показва четим преглед като
  ```
  Ор
  ъл
  Зл
  ат
  на
  ръ
  ка
  ```
  Това е функционално нечетимо. Потребителят на мобилно не може да види за коя роля гледа.

### Препоръки
- 🔴 P0 — Под 480px breakpoint върнете на **1 колона** (картата заема цялата ширина) или направете компактен list-vue с малък thumb 48px + име в 1 ред + tap-to-expand.
- P0 — В CSS-а на role-card-а заключете `.role-card-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }` — никога не позволявайте вертикален wrap по 1 символ.
- P2 — Добавете "Виж по екип" filter (Селски / Върколашки / Неутрален) за бърза навигация в дълъг списък.

---

## 4. `/history` и `/leaderboard`

**Файлове:** `audit-v3/desktop/07-history.png`, `audit-v3/desktop/08-leaderboard.png`, `audit-v3/mobile/08-leaderboard.png`

### Desktop
- `/history`: само една празна-state хоризонтална ивица "Завършваш миг и започваш" над огромна тъмна painterly area. Изглежда **счупено** — потребителят се чуди дали страницата е заредила.
- `/leaderboard`: едно empty-state card "Първата победа още не е написана" в центъра. По-добре от history, но все още много празно пространство долу.

### Mobile
- `/leaderboard` mobile се справя по-добре защото вертикалното подреждане скрива празнотата.

### Препоръки
- 🟠 P1 — Когато няма данни: попълнете страницата с **примерна / "what you'll see" preview** карта (greyed out с надпис "Така ще изглежда след първата игра"). По-добре от мега-tomb.
- P2 — `/history` empty: добавете 2-3 микро-стъпки "Как да стартираш първата си игра" в карта под празната ивица.

---

## 5. `/achievements`

**Файлове:** `audit-v3/desktop/09-achievements.png`

### Desktop
- 4-кол grid в първи ред, после 3-кол grid в втори ред — несиметрично.
- Картите са дребни, но четими.
- Bottom CTA: **"ВИЖ REPLAY ИСТОРИЯ"** — Latin script "REPLAY" в Bulgarian-only UI.
- Hero copy: "Постиженията не са grind. Те се отключват от replay събитията..." — две Latin думи ("grind", "replay") в Bulgarian copy.

### Препоръки
- 🔴 P0 — Замени Latin думи: "replay" → "запис", "grind" → "повторение" (или премахни цялата дума).
- P2 — Локирай grid на **3 колони на desktop** или **4 за всички редове** — не смесвай.
- P3 — Добави progress bar на всеки achievement (0/3 unlocks, например).

---

## 6. `/werewolf/rules` и `/mafia/rules`

**Файлове:** `audit-v3/desktop/06-werewolf-rules.png`, `audit-v3/mobile/05-werewolf-rules.png`

### Desktop
- Hero "Правила за Върколак" с painterly art и две CTA-та (Създай стая / Виж ролите) — добре.
- Phase-map timeline (Лоби → Първа нощ → Обсъждане → Гласуване → Изпълнение → ПОВТАРЯ СЕ) — концептуално добре, **но loop arrow остава визуално счупен**: badge "ПОВТАРЯ СЕ" + arrowhead + arc — изглеждат като три несвързани парчета, не като една continuous линия от node 06 към node 03.
- Под фазовата карта има **само** "Лоби" детайл — никакъв drill-down или expand за останалите фази. Потребителят вижда 6 nodes но получава подробности само за първия.
- "Телефонът е табло, не високоговорител" — нов раздел, който се повтаря в `/tutorial`.
- 3-кол guidance карти + 4-кол "Какво означава, когато..." + 4 големи карти (Цел/Нощ/Ден/Баланс) — много информация, добър ритъм.

### Mobile
- Phase-map се stack-ва вертикално, иконите се запазват.
- Тъмната палитра е консистентна с целия mobile flow.

### Препоръки
- 🟠 P1 — Phase-map loop arrow: една continuous SVG path от node 06, изскачаща нагоре над timeline-а, спираща с малък arrowhead на node 03. Badge "ПОВТАРЯ СЕ" trick → label върху arc-а, не floating.
- P2 — Експандирайте фазовите детайли (клик на node → разкрива описание на фазата). В момента имате 6 nodes но 1 expanded блок.
- P3 — Махнете дублирания "Телефонът е табло" блок (виж § 10).

---

## 7. `/play/[code]`

**Файлове:** `audit-v3/desktop/14-play-lobby.png`, `audit-v3/mobile/06-play-lobby.png`

### Desktop — 🟠 СЕРИОЗЕН LAYOUT ПРОБЛЕМ
- Лявата (главна) колона е dark / painterly (Лоби панел + Лични сигнали + Настройка на стаята + Контрол на водещия + ...) — много секции, голяма височина.
- Дясната колона е една cream parchment карта "Играчите на площада" с 1 играч + чат placeholder — занимава ~40% от viewport height и след това **прекъсва, оставяйки огромна тъмна празна област под себе си**.
- Двете колони не са visually balanced: лявата е 3-4× по-висока от дясната.
- Контрастът cream-on-dark е силен, но единичната parchment плоча изглежда като изтръгнат бележник, не като част от UI-а.
- **Двойни CTA проблем:** "Започни игра" се появява **два пъти** — веднъж в "Лоби" панела, веднъж в "Контрол на водещия" блок долу. Същият бутон, различен контекст. Потребителят не знае кой да натисне.
- "Контрол на водещия" блок съдържа мозайка от мини-панели: Фаза / Започни игра / Пауза / Следваща фаза / +30 сек / +60 сек / +180 сек / Тих режим / Клавишни команди. Етикетите са малки.

### Mobile
- Същата cream parchment "Играчите на площада" се поставя **в края** на дългата вертикална колона. Главното (списък играчи + чат) е визуално подцен.
- Цялото "Контрол на водещия" се stack-ва над players panel-а, което за играч (не водещ) е безсмислено.

### Препоръки
- 🟠 P1 — Desktop: направете parchment panel-а **sticky** в дясната колона (`position: sticky; top: 80px`) или го разширете чрез "stretchy" sub-panels за чат + събития (така че да заеме същата височина като лявата колона).
- P1 — Махнете дублирания "Започни игра" — само един primary CTA, в Лоби панела. Контрол на водещия да показва паузи/фаза/+сек, без re-issue на start.
- P1 — Mobile: преместете "Играчите на площада" panel веднага под "Лоби" заглавието (преди фази-сигнали / настройки). Това е първото нещо, което играчът пита: "кой е тук?"
- P2 — "Контрол на водещия" — събери под един collapsible panel "Само за водещ". Скрий го за играчите без host/narrator role.
- P2 — Cream parchment ↔ dark page преход: добави subtle drop shadow + леко скосен ръб ("torn parchment") за да изглежда като част от scenografията, не като щит.

---

## 8. `/lobby/[code]`

**Файлове:** `audit-v3/desktop/12-lobby-code.png`

### Desktop
- Hero "Покана за масата" — добре, но **кодът ABC123 е малък печат в горния десен ъгъл**. Целият смисъл на страницата е споделянето на кода — той трябва да е визуалният център.
- "КЪМ ИГРАТА / НАБЛЮДАВАЙ" pills имат равна тежест със страничен "Маршрут до площада" link — primary action не се откроява.
- Долу: две паралелни "Следваща стъпка" блока ("Сподели..." × 2) с почти идентичен look.

### Препоръки
- 🟠 P2 — Направи кода ABC123 **фокална точка**: огромен (4-5rem font-size), монопространствен, в decorative frame центрирано на страницата. Под него: "Копирай" + "Сподели" pills.
- P2 — Само един primary CTA: "Към играта" — секондар "Наблюдавай" по-малък под него, не на същия ред.
- P3 — Махни дублирания "Следваща стъпка" блок; един е достатъчен.

---

## 9. `/sign-in`

**Файлове:** `audit-v3/desktop/11-sign-in.png`, `audit-v3/mobile/09-sign-in.png`

### Desktop
- Двукол layout: form ляво, illustrative artwork (3 face-down cards) дясно.
- Right artwork има поетична линия "Всички виждат площада. Само ти виждаш картата си." — добре.
- Form-ът е минимален и работи.
- "Имаш профил? Регистрирай се" toggle е дребен.

### Препоръки
- P3 — Уголеми toggle "Регистрирай се" — направи го visible separate button под form-а, не inline link.
- P3 — Mobile: artwork може да бъде хороидно изобразено над form-а (както homepage hero), не премахнато.

---

## 9.1. BG-only нарушения

Project invariant в `AGENTS.md`: **всички user-facing strings са на български**. Открити нарушения:

| Файл | Линия | Текст | Поправка |
|---|---|---|---|
| `apps/web/app/achievements/page.tsx` | 7 (metadata description) | "Колекция от **replay**-базирани моменти..." | "Колекция от моменти, отключени от записи..." |
| `apps/web/app/achievements/page.tsx` | 17 (hero copy) | "Постиженията не са **grind**. Те се отключват от **replay** събитията..." | "Постиженията не са повтаряне. Те се отключват от събитията на играта..." |
| `apps/web/app/achievements/page.tsx` | 25 (CTA) | "Виж **replay** история" | "Виж записа на играта" |
| `apps/web/components/play-room-client.tsx` | 906 | `" · host"` (live UI string) | `" · водещ"` |
| `apps/web/components/keyboard-shortcuts-modal.tsx` | 8 | "Пауза за **host** или Разказвач..." | "Пауза за водещ или Разказвач..." |
| `apps/web/components/games/game-rules-page.tsx` | 65 | "В **no-chat** или **live** режим приложението става табло..." | "В режим без чат или 'на живо' приложението става табло..." |

🔴 P0 — Тези трябва да са поправени преди следващия release. `scripts/regression.mjs` може да добави текстова проверка за списък от забранени Latin думи в `app/**` и `components/**` (без import lines).

---

## 10. `/tutorial`

**Файлове:** `audit-v3/desktop/13-tutorial.png`

### Desktop
- Hero "Научи масата преди първата нощ." с painterly arc art — добре.
- 6 step-cards в 3×2 grid: Избери маса / Въведи име / Раздай ролите / Изиграй нощта / Говори през деня / Гласувай.
- Body text в всеки card е дълъг (4+ реда малък font) — wall-of-text усещане.
- "Примерна мини-маса" 5-character preview (Анна / Борис / Виктор / Гале / Деян) — добра идея, но title fontът е огромен спрямо card content.
- "Телефонът е карта, не микрофон" — **дублира** идентичен раздел в `/werewolf/rules`.

### Препоръки
- P2 — Намалете body на step-cards до 2-3 реда + "Виж повече" hover (или клик за да разкрие подробности). Сега изглежда like docs page, не като въведение.
- P2 — Премахни дубликат "Телефонът е карта" от tutorial **или** от rules, не държи и двете.
- P3 — Mini-маса 5 герои: typographic ритъм — кардовете да са по-плътни (по-голям body, по-малък title), за да приличат на профил-карти.

---

## 11. `/werewolf/create`, `/mafia/create` (wizard)

**Файлове:** `audit-v3/desktop/04-werewolf-create.png`, `audit-v3/mobile/03-werewolf-create.png`

### Desktop
- Top stepper (1 Стая / 2 Роли / 3 Стил / 4 Преглед) — ясно, добре.
- Step 1 показва 3 preset chips (Бърза игра 8 души / Класика 10 души / Голяма маса 16+) хоризонтално — но **никой от тях не е визуално маркиран като активен / препоръчан**. Всички изглеждат еднакво. Потребителят не знае с кой да започне.
- Right preview parchment panel ("Частно село / +4 / Балансът е силно в полза на Селяните") е силно стилизиран и винаги виден — добре. Но повтаряемо: показва същата информация във всеки step.
- Bottom "ТЕМПО" tabs (Бърза / Нормална / На живо) — само "Нормална" има visible active state; другите две изглеждат disabled.

### Mobile
- Step header се stack-ва добре.
- Preset chip-овете се wrap-ват — четими.
- Input field "Частно село" работи.

### Препоръки
- 🟠 P2 — Маркирай "Класика 10 души" с "ПРЕПОРЪЧАНО" badge + по-силен outline. Това е default-ът за повечето групи.
- P2 — TEMPO tabs: добави visible active state на selected tab — current pattern не разкрива кой е избран.
- P3 — Помисли за "Skip wizard" link при step 1: "Имаш кодова стая? Скочи на default настройки →"

---

## 12. `/friends`

**Файлове:** `audit-v3/desktop/10-friends.png`

### Desktop
- Headline "Покани групата без акаунти" — терминът "**без акаунти**" е заблуждаващ; реалната функция е "invite by code" (с акаунти или без).
- Двукол layout: form ляво + празно-state дясно. Half-empty feel.

### Препоръки
- P2 — Сменете headline на "Покани приятел за следваща игра" (по-ясно).
- P3 — Дясната колона: вместо празна-state добавете "How invitations work" 3-step explainer.

---

## 13. Site chrome (header / footer)

**Файлове:** виж всеки screenshot

### Desktop
- Header съдържа: logo + subtitle "Социална игра на сенки" + Играй CTA + Върколак/Мафия chips + "Още страници" overflow + Звук + Тема. Това е **8 елемента**.
- Subtitle "Социална игра на сенки" работи по-добре от старото "ВЪРКОЛАК · МАФИЯ".
- Mobile: chrome се компресира приемливо (logo + Играй + менюта).

### Препоръки
- P3 — Помисли дали "Звук изключен" tab трябва да е в основния header или в "Още страници" overflow.

---

## 14. Крос-сечащи проблеми (cross-cutting)

### 14.1 Empty-state coverage
- /, /werewolf, /mafia, /history, /leaderboard, /friends, /achievements, /lobby/[code] — всички имат empty states, но
  - Те не показват **примерен / preview / "what you'll see"** контент.
  - Те винаги са дребни карти на огромен painterly фон → впечатление за недовършена страница.
- **Препоръка**: създай единичен `<EmptyStatePreview>` компонент, който показва greyed-out примерен запис ("Така ще изглежда твоят първи запис..."), и replace всички "card само с текст" empty states.

### 14.2 Typographic rhythm
- На повечето страници: H1 е огромно (3-4rem), body е малък (0.875rem) → крайности.
- Tutorial и rules имат wall-of-text места.
- **Препоръка**: въведи единичен type scale в `globals.css`:
  ```css
  --fs-display: clamp(2.5rem, 6vw, 4rem);
  --fs-h1: clamp(1.875rem, 4vw, 2.75rem);
  --fs-h2: clamp(1.375rem, 3vw, 1.75rem);
  --fs-body: 1rem;
  --fs-small: 0.875rem;
  ```
  Замени hardcoded font-size-ове с тези променливи.

### 14.3 Spacing scale consistency
- Section padding варира между страниците (виж разликите между /werewolf/rules и /tutorial).
- **Препоръка**: 4 / 8 / 16 / 24 / 40 / 64 / 96 px spacing scale, валидиран в audit.

### 14.4 Mobile breakpoints
- `/werewolf/roles` показва, че не всеки grid е тестван под 480px.
- **Препоръка**: задължителен mobile QA pass на всеки нов grid layout. Добави в `scripts/regression.mjs` smoke screenshot test на 4-5 ключови страници при 390px.

### 14.5 Cinematic art ↔ dark UI разрив
- /werewolf, /mafia, /play/[code]: parchment / hero art има остри ръбове срещу тъмната палитра.
- **Препоръка**: всички major artwork блокове трябва да имат `mask-image: linear-gradient(...)` fade-out към съседния surface.

---

## 15. Priority fix order (предложен)

1. 🔴 **P0 (бъгове, които правят страница неизползваема)**
   - Fix `/werewolf/roles` + `/mafia/roles` mobile grid (1 кол под 480px + `nowrap` на name).
   - Поправи BG-only нарушения (6 текста в § 9.1).

2. 🟠 **P1 (визуални / UX скъсвания)**
   - `/play/[code]` desktop layout balance + sticky right panel.
   - `/play/[code]` mobile: премести Players panel най-горе.
   - Премахни дублирания "Започни игра" CTA в /play.
   - Phase-map loop arrow в /werewolf/rules — една continuous SVG path.
   - Cinematic hero art fade в /werewolf, /mafia.

3. 🟡 **P2 (полировки, които вдигат perceived quality)**
   - Wizard preset "Препоръчано" badge.
   - `/lobby/[code]` — увеличи кода ABC123 до фокална точка.
   - Achievements grid консистентност (всички редове = 3 или = 4 кол).
   - Empty-state preview компонент.
   - /history /leaderboard /friends — попълни с preview.

4. 🟢 **P3 (nice-to-have)**
   - Дублиран "Телефонът е карта" блок.
   - Sign-in toggle уголемяване.
   - Friends headline rewording.
   - Звук бутон в overflow.

---

## 16. Suggested next steps

- Създай GitHub issue per P0 / P1 fix с screenshot линк.
- Добави `scripts/regression.mjs` BG-only word checker (отказва build при намерен Latin word в copy).
- Помисли дали Playwright screenshot smoke test (key routes × desktop + mobile) трябва да влезе в `pnpm regression`.

---

## Appendix: full screenshot index

### Desktop (1440 × 900)
- `01-home.png` — Homepage with dual mode picker
- `02-werewolf.png` — Werewolf family page (cinematic hero)
- `03-mafia.png` — Mafia family page
- `04-werewolf-create.png` — Wizard Step 1 + right preview
- `05-werewolf-roles.png` — Roles grid (4-col)
- `06-werewolf-rules.png` — Rules page with phase map
- `07-history.png` — Empty history
- `08-leaderboard.png` — Empty leaderboard
- `09-achievements.png` — Achievements grid
- `10-friends.png` — Friends invite form + empty list
- `11-sign-in.png` — Sign in form + artwork
- `12-lobby-code.png` — Invite page with code seal
- `13-tutorial.png` — Tutorial with 6 steps + mini-table
- `14-play-lobby.png` — In-game lobby (asymmetric desktop layout)

### Mobile (390 × 844)
- `01-home.png` — Homepage mobile
- `02-werewolf.png` — Werewolf family mobile
- `03-werewolf-create.png` — Wizard mobile
- `04-werewolf-roles.png` — 🔴 Roles grid (broken name wrap)
- `05-werewolf-rules.png` — Rules mobile (vertical phase map)
- `06-play-lobby.png` — Play lobby mobile (Players panel at bottom)
- `07-mafia.png` — Mafia family mobile
- `08-leaderboard.png` — Leaderboard mobile
- `09-sign-in.png` — Sign in mobile
