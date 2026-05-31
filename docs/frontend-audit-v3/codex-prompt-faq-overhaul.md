# Codex prompt — `/faq` complete overhaul

Цялостен redesign на `/faq`:
- **30 въпроса** в **5 категории** (от 15 в 4)
- **Rich answer blocks** — TL;DR, paragraphs, numbered steps, bullets, callouts, link lists
- **Search bar** + ⌘K shortcut + token highlighting
- **Deep linking** (`/faq?q=slug`) с copy-link бутони
- **Category color-coding** + 5 inline SVG icons per category
- **Power-user features**: expand-all, print stylesheet, "Помогна ли?" feedback
- **Mobile polish**: sticky search, larger touch targets
- **Tutorial integration**: deep links към `/tutorial?step=N` за релевантни въпроси
- **JSON-LD update**: всичките 30 въпроса в FAQPage rich snippet
- **1 new imagen asset**: painterly "паритет" diagram (визуал за най-критичния геймплей въпрос)
- 5 category icons като inline SVG (no imagen)

~14 atomic English commits.

---

## Pre-decisions (locked)

- **Keep current hero art**: `/game-art/faq/library-catalog-hero.png` стои както е. Library cabinet metaphor е cohesive с останалата визуална езика.
- **Imagen scope**: 1 нов asset (parity diagram). Category icons → inline SVG (similar pattern to `AchievementIcon.tsx`).
- **Feedback storage**: localStorage anonymous. No backend endpoint в този PR.
- **Tutorial deep-links**: relevant въпроси сочат към specific tutorial slides (`?step=N`).
- **Branch**: `feat/faq-overhaul`.

---

## Stage 1 — Generate 1 imagen asset

### Asset: Paritet diagram

**Path:** `apps/web/public/game-art/faq/paritet-diagram.png`

**Imagen prompt:**
```
A painterly cinematic illustration showing a horizontal sequence
of three small wooden tabletop scenes from left to right, each
inside its own oval painterly frame, separated by warm directional
candlelight pools. Frame 1 (left): two indistinct figure
silhouettes shown larger on the left side of a wooden table
facing five smaller silhouettes on the right — clearly the
"small group versus larger group" composition. Frame 2 (middle):
the same setup but now two silhouettes face only three on the
right — visibly closer to equal. Frame 3 (right): two
silhouettes face exactly two silhouettes — equal balance, with
soft warm glow indicating an end moment. Each frame's silhouettes
are simplified painterly shapes, no detailed features. Mood: a
visual lesson, the moment of recognition that balance has tipped.
Oil-paint style with visible brushwork, warm sepia and amber
palette, dark wood-brown surfaces, soft frame edges. No text,
no letters, no numbers, no symbols, no markings on any silhouette.
Aspect ratio 3:1 (wide horizontal banner — for use as an inline
explanatory illustration).
```

**Size:** 1500 × 500 pixels (3:1 horizontal banner).

После: `pnpm optimize:assets` за WebP. Ако output-ът има stray текст/числа на силуетите, regenerate с по-силен emphasis на "no text".

---

## Stage 2 — Type system: rich answer blocks

### `apps/web/lib/faq-data.ts` — full rewrite

Текущата схема е flat `answer: FaqAnswerPart[]`. Заменяме с **block-based** rich structure.

```ts
export type FaqCategory = "pre-game" | "gameplay" | "account" | "tech" | "privacy";

export type AnswerBlock =
  | { type: "tldr"; text: string }
  | { type: "paragraph"; text: string; links?: AnswerLink[] }
  | { type: "steps"; items: string[] }
  | { type: "bullets"; items: string[] }
  | { type: "callout"; tone: "info" | "warning"; text: string }
  | { type: "link-list"; title: string; links: AnswerLink[] }
  | { type: "image"; src: string; alt: string; caption?: string };

export interface AnswerLink {
  text: string;
  href: string;
  internal?: boolean; // hint to renderer: use <Link> vs <a>
}

export interface FaqItem {
  slug: string;            // for deep linking (?q=slug)
  category: FaqCategory;
  question: string;
  answer: readonly AnswerBlock[];
  searchableText: string;  // computed at definition time for filter index
  tutorialStep?: number;   // optional: deep-link target step
}

function flattenSearchableText(blocks: readonly AnswerBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "tldr":
        case "paragraph":
        case "callout":
          return block.text;
        case "steps":
        case "bullets":
          return block.items.join(" ");
        case "link-list":
          return `${block.title} ${block.links.map((l) => l.text).join(" ")}`;
        case "image":
          return block.alt + (block.caption ?? "");
      }
    })
    .join(" ");
}

function faq(
  slug: string,
  category: FaqCategory,
  question: string,
  answer: readonly AnswerBlock[],
  options?: { tutorialStep?: number },
): FaqItem {
  return {
    slug,
    category,
    question,
    answer,
    searchableText: `${question} ${flattenSearchableText(answer)}`.toLowerCase(),
    tutorialStep: options?.tutorialStep,
  };
}
```

### The 30 questions, fully written in БГ

Replace the existing FAQ_DATA array with the following. Codex: copy verbatim — these are the canonical БГ answers. Do not paraphrase.

```ts
export const FAQ_DATA = [
  // ============================================
  // A. ПРЕДИ ПЪРВА ИГРА (4)
  // ============================================
  faq(
    "minimum-setup",
    "pre-game",
    "Каква е минималната конфигурация?",
    [
      { type: "tldr", text: "Браузър от 2022 нататък. Без app store install." },
      {
        type: "paragraph",
        text: "Поддържаме съвременните браузъри: Chrome 100+, Firefox 100+, Safari 15+, Edge 100+. Минимум 2 GB RAM и 5 Mbps интернет за стабилно изживяване. На мобилно — Android 10+ или iOS 15+.",
      },
      {
        type: "callout",
        tone: "info",
        text: "Ако играта мига или лагне, провери дали браузърът ти е актуален. Първото нещо, което изпратваме, е fresh state — старите браузъри се препъват.",
      },
    ],
  ),
  faq(
    "is-it-free",
    "pre-game",
    "Колко струва?",
    [
      { type: "tldr", text: "Безплатно за всички." },
      {
        type: "paragraph",
        text: "Играта е free-to-play. Без реклами, без in-app покупки за основната игра. По-късно може да добавим опция за дарения от поддръжниците, но никога paywall за роли, стаи или функции.",
      },
    ],
  ),
  faq(
    "player-count",
    "pre-game",
    "С колко души се играе?",
    [
      { type: "tldr", text: "Минимум 5, оптимално 8-12, максимум 30." },
      {
        type: "bullets",
        items: [
          "6-7 души: бърза игра, по-малко роли",
          "8-12 души: класически състав, идеално за първа стая",
          "13-18 души: разширен състав с повече специални роли",
          "19-30 души: за големи събирания, изисква опитен Разказвач",
        ],
      },
    ],
  ),
  faq(
    "need-friends",
    "pre-game",
    "Трябва ли да съм с приятели за да играя?",
    [
      { type: "tldr", text: "Да — играта работи само с истински хора." },
      {
        type: "paragraph",
        text: "Нямаме бот режим. Покани приятели чрез код на стаята или влез в публична стая (когато активираме този режим). Минимум 5 души.",
      },
    ],
  ),

  // ============================================
  // B. ГЕЙМПЛЕЙ (8)
  // ============================================
  faq(
    "werewolf-vs-mafia",
    "gameplay",
    "Каква е разликата между Върколак и Мафия?",
    [
      { type: "tldr", text: "Същата механика, различна вселена." },
      {
        type: "paragraph",
        text: "Двете игри ползват еднаква основа на тайно гласуване и нощни действия. Върколак е фолклорен сценарий — лунна нощ, селяни, върколаци, гадатели. Мафия е градски ноар — Дон, Комисар, алибита, подозрителни улички.",
      },
      {
        type: "link-list",
        title: "Виж в подробности",
        links: [
          { text: "Правила за Върколак", href: "/werewolf/rules", internal: true },
          { text: "Правила за Мафия", href: "/mafia/rules", internal: true },
        ],
      },
    ],
  ),
  faq(
    "game-duration",
    "gameplay",
    "Колко трае една игра?",
    [
      { type: "tldr", text: "15-40 минути в зависимост от размера." },
      {
        type: "bullets",
        items: [
          "6-8 души: 15-20 минути",
          "10-12 души: 20-30 минути",
          "16-20 души: 30-45 минути",
          "На живо около маса: без таймер, обикновено по-дълго",
        ],
      },
    ],
  ),
  faq(
    "paritet-rule",
    "gameplay",
    "Какво е „паритет“ и кога приключва играта?",
    [
      { type: "tldr", text: "Селяните печелят като елиминират всички заплахи. Заплахата печели когато брой стане равен на селяни." },
      {
        type: "image",
        src: "/game-art/faq/paritet-diagram.png",
        alt: "Три сцени показващи как балансът се измества от 2 заплахи срещу 5 селяни до 2 срещу 2.",
        caption: "Балансът се мести от ход на ход. Когато нощната заплаха стане равна на селяните — играта приключва.",
      },
      {
        type: "paragraph",
        text: "Селото печели, ако елиминира всички Върколаци (или Вампири, или Мафиоти). Заплахата печели когато техният брой стане равен или по-голям от живите играчи от другата страна. Този момент се нарича „паритет“.",
      },
      {
        type: "callout",
        tone: "info",
        text: "Пример: 2 живи Върколака срещу 2 живи Селяни → играта приключва веднага. Върколаците печелят. Селото няма как да обърне резултата с гласуване.",
      },
    ],
    { tutorialStep: 5 },
  ),
  faq(
    "what-roles-exist",
    "gameplay",
    "Какви роли има в играта?",
    [
      { type: "tldr", text: "Над 35 роли в обща библиотека." },
      {
        type: "paragraph",
        text: "Селяни (Селянин, Лечител, Гадател, Свещеник, Ловец и др.), нощни заплахи (Върколак, Вампир, Мафиот, Дон), неутрални (Шут, Маниак), специални (Купидон, Кмет, Готвач) и още. Hostът избира преди стартиране кои да са активни.",
      },
      {
        type: "link-list",
        title: "Виж пълните списъци",
        links: [
          { text: "Роли във Върколак", href: "/werewolf/roles", internal: true },
          { text: "Роли в Мафия", href: "/mafia/roles", internal: true },
        ],
      },
    ],
  ),
  faq(
    "sport-vs-free-mafia",
    "gameplay",
    "Каква е разликата между Спортна и Свободна Мафия?",
    [
      { type: "tldr", text: "Спортна = строги правила, фиксиран състав. Свободна = по-гъвкаво." },
      {
        type: "bullets",
        items: [
          "Спортна Мафия: точно 10 души, фиксиран състав (6 Граждани, 1 Комисар, 2 Мафиоти, 1 Дон). Кратки фази, формат за турнири.",
          "Свободна Мафия: 4-24 души. Hostът избира състава. По-снизходителни правила, повече персонализация.",
        ],
      },
    ],
  ),
  faq(
    "live-mode",
    "gameplay",
    "Мога ли да играя на живо в една стая, всички около маса?",
    [
      { type: "tldr", text: "Да — има специален „на живо“ темпо." },
      {
        type: "paragraph",
        text: "Избираш темпо „На живо“ в съветника за стая. Чатът е изключен, личните звуци и вибрации са тихи (за да не издават кой се събужда през нощта), фазите са по-дълги. Телефонът се ползва само за тайни действия и потвърждения.",
      },
      {
        type: "callout",
        tone: "warning",
        text: "Телефонът е карта, не микрофон. Дръж екрана надолу или близо до тялото си.",
      },
    ],
  ),
  faq(
    "voice-chat",
    "gameplay",
    "Има ли voice chat в играта?",
    [
      { type: "tldr", text: "Не — играта се играе с писмен чат или гласовете на масата." },
      {
        type: "paragraph",
        text: "Voice chat не е в скоупа. За дистанционна игра препоръчваме Discord или Telegram като странична voice комуникация. На живо около маса — говорите със собствените си гласове.",
      },
    ],
  ),
  faq(
    "all-leave-room",
    "gameplay",
    "Какво се случва ако всички напуснат стаята?",
    [
      { type: "tldr", text: "Стаята остава 5 минути, после се изтрива." },
      {
        type: "paragraph",
        text: "Ако всички играчи напуснат и никой не се върне за 5 минути, стаята се закрива автоматично. Игровият state не се запазва — следваща сесия е нова игра.",
      },
    ],
  ),

  // ============================================
  // C. ПРОФИЛ И СЕСИЯ (6)
  // ============================================
  faq(
    "why-account",
    "account",
    "Защо ми трябва акаунт?",
    [
      { type: "tldr", text: "За да пазим историята, постиженията и сигурността." },
      {
        type: "paragraph",
        text: "Акаунтът свързва твоите игри, победи и постижения. Без него не можем да съхраним кои стаи си посетил или какви роли си играл. Освен това спира ботове и спам в публичните стаи.",
      },
    ],
  ),
  faq(
    "anonymous-play",
    "account",
    "Мога ли да играя без акаунт?",
    [
      { type: "tldr", text: "Не. Преди беше възможно, сега не." },
      {
        type: "paragraph",
        text: "Преди публичното пускане поддържахме временна анонимна идентичност, но за стабилност и защита от злоупотреби, влизането е задължително. Можеш да влезеш с Google, Discord или имейл за под 30 секунди.",
      },
    ],
  ),
  faq(
    "lost-connection",
    "account",
    "Какво се случва ако загубя връзка по средата на игра?",
    [
      { type: "tldr", text: "Сървърът пази твоето състояние. Reconnect автоматично възстановява." },
      {
        type: "paragraph",
        text: "Затвори раздела или загуби Wi-Fi — отвори отново на същия URL и играта те връща в същата фаза с твоята роля. Не пропускаш ходове. Останалите играчи виждат че си disconnect-нат, но няма „auto-skip“ на твоите действия.",
      },
      {
        type: "callout",
        tone: "info",
        text: "Ако reconnect-ът отнема повече от 30 секунди, разказвачът може да продължи фазата без теб.",
      },
    ],
  ),
  faq(
    "forgot-password",
    "account",
    "Загубих си паролата. Какво да правя?",
    [
      { type: "tldr", text: "Кликни „Забравена парола?“ на страницата за вход." },
      {
        type: "steps",
        items: [
          "Отвори /sign-in",
          "Под формата кликни „Забравена парола?“",
          "Въведи имейла, с който си регистриран",
          "Провери inbox-а — линкът е валиден за 1 час",
          "Кликни линка в писмото",
          "Създай нова парола (поне 8 знака)",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "Не виждаш писмото? Провери в „Спам“ или „Промоции“. Изпращачът е noreply от нашия домейн.",
      },
    ],
  ),
  faq(
    "delete-account",
    "account",
    "Как да изтрия профила си?",
    [
      { type: "tldr", text: "От „Моят профил“ → секция „Изтрий профила“." },
      {
        type: "steps",
        items: [
          "Влез в „Моят профил“ от менюто горе вдясно",
          "Скролни до секцията „Изтрий профила“",
          "Кликни бутона „Изтрий моя профил“",
          "Потвърди в диалога",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text: "Изтриването е окончателно. Имената от твоите игри ще бъдат заменени с „Изтрит играч“ (за да остане честна история на масата), но всички лични данни, постижения и достъп до акаунта изчезват.",
      },
    ],
  ),
  faq(
    "ban-system",
    "account",
    "Може ли някой да ме банне? Как работи?",
    [
      { type: "tldr", text: "В момента нямаме автоматичен ban — операторите ръчно ревюират сигнали." },
      {
        type: "paragraph",
        text: "Ако друг играч подаде сигнал срещу теб (за неуместно поведение или нарушение на правилата), нашият екип ревюира казуса. При потвърдено нарушение ще получиш имейл с обяснение и санкция. По-късно ще въведем стъпкуван механизъм: предупреждение → временно ограничение → временен ban → постоянен ban.",
      },
      {
        type: "link-list",
        title: "Виж също",
        links: [
          { text: "Правила за поведение (Условия)", href: "/terms", internal: true },
          { text: "Подай сигнал", href: "/report", internal: true },
        ],
      },
    ],
  ),

  // ============================================
  // D. ТЕХНИЧЕСКИ (6)
  // ============================================
  faq(
    "devices",
    "tech",
    "На какви устройства работи играта?",
    [
      { type: "tldr", text: "Браузър на всичко модерно." },
      {
        type: "paragraph",
        text: "Windows, Mac, Linux, Android, iOS. Поддържани браузъри: Chrome, Firefox, Safari, Edge. Можеш да играеш и от таблет. За стая на живо с 8+ души настолен компютър или таблет дава по-комфортно изживяване.",
      },
    ],
  ),
  faq(
    "install-pwa",
    "tech",
    "Как да инсталирам играта като приложение?",
    [
      { type: "tldr", text: "От браузъра — „Добави към началния екран“." },
      {
        type: "steps",
        items: [
          "iOS Safari: кликни „Сподели“ → „Добави към началния екран“",
          "Android Chrome: кликни менюто (три точки) → „Добави към началния екран“",
          "Desktop Chrome/Edge: иконата „install“ в адрес лентата",
          "След install — иконата излиза на началния екран като native app",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "Не сме в App Store или Google Play. PWA install е равностойна стъпка и не изисква store review.",
      },
    ],
  ),
  faq(
    "no-sound",
    "tech",
    "Защо не чувам звук?",
    [
      { type: "tldr", text: "Кликни иконата с високоговорителя в навигацията — звукът е изключен по подразбиране." },
      {
        type: "paragraph",
        text: "Браузърите изискват user gesture (клик) преди да позволят автоматично пускане на звук. Затова по подразбиране звукът е тих. След като активираш — звукът работи цялата сесия.",
      },
    ],
  ),
  faq(
    "connection-issues",
    "tech",
    "Защо често прекъсвам връзка?",
    [
      { type: "tldr", text: "Обикновено е мрежов проблем, не на играта." },
      {
        type: "steps",
        items: [
          "Провери Wi-Fi сигнала и приближи се до router-а",
          "Превключи временно на 4G/5G",
          "Рестартирай router-а ако проблемът продължава",
          "Затвори тежки фонови приложения (видео, изтегляния)",
          "Ако продължава, подай сигнал — може да е наш проблем",
        ],
      },
    ],
  ),
  faq(
    "offline-mode",
    "tech",
    "Играта работи ли офлайн?",
    [
      { type: "tldr", text: "Меню и правила — да. Игра — не." },
      {
        type: "paragraph",
        text: "PWA кешира статичните страници (началния екран, правилата, FAQ), така че можеш да ги прелистваш без интернет. Но активна игра изисква връзка със сървъра — нощните действия и гласуванията се решават там.",
      },
    ],
  ),
  faq(
    "no-native-app",
    "tech",
    "Защо няма приложение в App Store / Google Play?",
    [
      { type: "tldr", text: "PWA install от браузъра е равностойна стъпка." },
      {
        type: "paragraph",
        text: "Native приложенията изискват дълги review процеси и забавят разработката. PWA работи отлично, install отнема два клика, и можем да обновяваме веднага без да чакаме store approval. Може да добавим native app по-късно, но засега PWA е приоритет.",
      },
    ],
  ),

  // ============================================
  // E. ПОВЕРИТЕЛНОСТ И КОНТАКТ (6)
  // ============================================
  faq(
    "what-data",
    "privacy",
    "Какви данни събирате за мен?",
    [
      { type: "tldr", text: "Имейл, име, идентификатор от OAuth, игрова история, постижения." },
      {
        type: "paragraph",
        text: "Не събираме телефон, адрес или банкови данни. Не показваме реклами. Не ползваме Google Analytics, Facebook Pixel или подобни tracking системи. Игрова статистика се пази анонимно и служи само за подобряване на баланса на ролите.",
      },
      {
        type: "link-list",
        title: "Виж в подробности",
        links: [
          { text: "Пълна политика за поверителност", href: "/privacy", internal: true },
        ],
      },
    ],
  ),
  faq(
    "who-sees-email",
    "privacy",
    "Кой може да види моя имейл?",
    [
      { type: "tldr", text: "Само ти и нашите оператори за support цели." },
      {
        type: "paragraph",
        text: "Други играчи в стаите не виждат имейла ти. Виждат само избраното от теб display name. Имейлът никога не е публичен и не се появява в leaderboard, история или постижения.",
      },
    ],
  ),
  faq(
    "report-issue",
    "privacy",
    "Как да докладвам бъг или нарушение?",
    [
      { type: "tldr", text: "Бъг — floating button долу вдясно. Нарушение — /report." },
      {
        type: "bullets",
        items: [
          "За технически бъг: кликни плаващия бутон „Дай ни бележка“ в долния десен ъгъл",
          "За нарушение на правилата: отвори /report и попълни формата",
          "Преглеждаме сигнали в рамките на 48 часа",
          "За авторски права: специален път през /report → тип „Авторски права“",
        ],
      },
      {
        type: "link-list",
        title: "Линкове",
        links: [
          { text: "Подай сигнал", href: "/report", internal: true },
          { text: "Условия за ползване", href: "/terms", internal: true },
        ],
      },
    ],
  ),
  faq(
    "data-export",
    "privacy",
    "Мога ли да изтегля всичките си данни?",
    [
      { type: "tldr", text: "Да — GDPR право на преносимост." },
      {
        type: "paragraph",
        text: "От „Моят профил“ има бутон „Изтегли моите данни“. Получаваш JSON файл с целия си history — игри, постижения, профил, всичко което знаем за теб.",
      },
    ],
  ),
  faq(
    "contact-team",
    "privacy",
    "Как да се свържа с екипа?",
    [
      { type: "tldr", text: "По имейл или през формите на сайта." },
      {
        type: "bullets",
        items: [
          "Общи въпроси: support@example.com (заменете преди публикуване)",
          "Поверителност (GDPR): privacy@example.com",
          "Нарушения и доклади: /report",
          "Бъг или предложение: floating бутон „Дай ни бележка“",
        ],
      },
    ],
  ),
  faq(
    "roadmap",
    "privacy",
    "Има ли план за нови функции и роли?",
    [
      { type: "tldr", text: "Да — публичен roadmap." },
      {
        type: "paragraph",
        text: "Следващите 6 месеца планираме: гласов разказвач (TTS), нови role packs, режим за турнири, мобилно native app. Roadmap-ът се обновява всеки месец. Следи /status или нашата Discord общност за анонси.",
      },
    ],
  ),
] as const satisfies readonly FaqItem[];
```

---

## Stage 3 — Inline SVG category icons

Create `apps/web/components/faq/FaqCategoryIcon.tsx`:

```tsx
interface IconProps { className?: string }

const COMMON = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case "pre-game":
      return (
        // Key with ribbon - "starting key"
        <svg className={className} {...COMMON}>
          <circle cx="14" cy="24" r="7" />
          <path d="M21 24 L38 24 M34 24 L34 30 M38 24 L38 28" />
          <path d="M14 17 Q 14 13 18 12 M14 31 Q 14 35 18 36" strokeDasharray="2 3" />
        </svg>
      );
    case "gameplay":
      return (
        // Three playing cards fanned
        <svg className={className} {...COMMON}>
          <path d="M14 14 L 14 38 L 22 38 L 22 14 Z" />
          <path d="M22 12 L 30 12 L 30 36 L 22 36 Z" transform="rotate(8 22 24)" />
          <path d="M28 10 L 36 10 L 36 34 L 28 34 Z" transform="rotate(16 30 22)" />
        </svg>
      );
    case "account":
      return (
        // Manila folder with tab
        <svg className={className} {...COMMON}>
          <path d="M8 14 L 16 14 L 20 18 L 40 18 L 40 38 L 8 38 Z" />
          <path d="M8 22 L 40 22" />
          <circle cx="24" cy="30" r="3.5" />
          <path d="M19 36 Q 24 32 29 36" />
        </svg>
      );
    case "tech":
      return (
        // Brass cog
        <svg className={className} {...COMMON}>
          <circle cx="24" cy="24" r="6" />
          <path d="M24 10 L 24 14 M24 34 L 24 38 M10 24 L 14 24 M34 24 L 38 24" />
          <path d="M14 14 L 17 17 M31 31 L 34 34 M14 34 L 17 31 M31 17 L 34 14" />
          <circle cx="24" cy="24" r="2" fill="currentColor" />
        </svg>
      );
    case "privacy":
      return (
        // Padlock
        <svg className={className} {...COMMON}>
          <rect x="12" y="22" width="24" height="18" rx="2" />
          <path d="M16 22 L 16 16 Q 16 10 24 10 Q 32 10 32 16 L 32 22" />
          <circle cx="24" cy="30" r="2" fill="currentColor" />
          <path d="M24 31 L 24 35" />
        </svg>
      );
    default:
      return (
        <svg className={className} {...COMMON}>
          <circle cx="24" cy="24" r="14" />
        </svg>
      );
  }
}
```

---

## Stage 4 — Rich answer renderer

Create `apps/web/components/faq/FaqAnswerRenderer.tsx`:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import type { AnswerBlock, AnswerLink } from "@/lib/faq-data";

export function FaqAnswerRenderer({ blocks }: { blocks: readonly AnswerBlock[] }) {
  return (
    <div className="faq-answer">
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: AnswerBlock }) {
  switch (block.type) {
    case "tldr":
      return (
        <div className="faq-block-tldr">
          <span className="faq-block-tldr-label">Накратко</span>
          <span className="faq-block-tldr-text">{block.text}</span>
        </div>
      );

    case "paragraph":
      return (
        <p className="faq-block-paragraph">
          {block.text}
          {block.links?.map((link, i) => (
            <LinkRenderer key={i} link={link} />
          ))}
        </p>
      );

    case "steps":
      return (
        <ol className="faq-block-steps">
          {block.items.map((step, i) => (
            <li key={i}>
              <span className="faq-step-marker">{i + 1}</span>
              <span className="faq-step-text">{step}</span>
            </li>
          ))}
        </ol>
      );

    case "bullets":
      return (
        <ul className="faq-block-bullets">
          {block.items.map((bullet, i) => (
            <li key={i}>
              <span className="faq-bullet-marker" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      );

    case "callout":
      return (
        <aside className={`faq-block-callout faq-block-callout-${block.tone}`}>
          <span className="faq-callout-icon" aria-hidden>{block.tone === "warning" ? "⚠" : "ℹ"}</span>
          <span>{block.text}</span>
        </aside>
      );

    case "link-list":
      return (
        <nav className="faq-block-link-list" aria-label={block.title}>
          <p className="faq-link-list-title">{block.title}</p>
          <ul>
            {block.links.map((link, i) => (
              <li key={i}>
                <LinkRenderer link={link} />
              </li>
            ))}
          </ul>
        </nav>
      );

    case "image":
      return (
        <figure className="faq-block-image">
          <Image
            src={block.src}
            alt={block.alt}
            width={1500}
            height={500}
            sizes="(max-width: 768px) 100vw, 800px"
            className="faq-block-image-img"
          />
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
  }
}

function LinkRenderer({ link }: { link: AnswerLink }) {
  if (link.internal !== false && link.href.startsWith("/")) {
    return (
      <Link href={link.href} className="faq-link">
        {link.text}
      </Link>
    );
  }
  return (
    <a href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined} className="faq-link">
      {link.text}
    </a>
  );
}
```

---

## Stage 5 — Search, deep linking, и rewritten `FaqClient`

Replace `apps/web/components/faq/FaqClient.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { FaqCategory, FaqItem } from "@/lib/faq-data";
import { FaqAnswerRenderer } from "./FaqAnswerRenderer";
import { CategoryIcon } from "./FaqCategoryIcon";

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  "pre-game": "Преди първа игра",
  gameplay: "Геймплей",
  account: "Профил и сесия",
  tech: "Технически",
  privacy: "Поверителност и контакт",
};

const CATEGORY_ORDER: FaqCategory[] = ["pre-game", "gameplay", "account", "tech", "privacy"];

const STORAGE_FEEDBACK_KEY = "faq-feedback";

interface FeedbackState {
  [slug: string]: "up" | "down" | undefined;
}

export function FaqClient({ items }: { items: readonly FaqItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [search, setSearch] = useState("");
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(() => initialQ ? new Set([initialQ]) : new Set());
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Restore feedback from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_FEEDBACK_KEY);
      if (raw) setFeedback(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // Sync open slug → URL
  useEffect(() => {
    const firstOpen = [...openSlugs][0];
    const params = new URLSearchParams(searchParams.toString());
    if (firstOpen) {
      params.set("q", firstOpen);
    } else {
      params.delete("q");
    }
    const newQuery = params.toString();
    router.replace(`/faq${newQuery ? `?${newQuery}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSlugs]);

  // Cmd/Ctrl+K focuses search
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-scroll to opened drawer if from URL on mount
  useEffect(() => {
    if (!initialQ) return;
    const el = document.querySelector(`[data-slug="${initialQ}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.searchableText.includes(term));
  }, [items, search]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      entries: filtered.filter((item) => item.category === category),
    })).filter((g) => g.entries.length > 0);
  }, [filtered]);

  const toggle = useCallback((slug: string) => {
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setOpenSlugs(new Set(filtered.map((i) => i.slug)));
  }, [filtered]);

  const collapseAll = useCallback(() => {
    setOpenSlugs(new Set());
  }, []);

  const setFeedbackFor = useCallback((slug: string, value: "up" | "down") => {
    setFeedback((prev) => {
      const current = prev[slug];
      const next = current === value ? { ...prev, [slug]: undefined } : { ...prev, [slug]: value };
      try {
        window.localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const copyLink = useCallback(async (slug: string) => {
    const url = `${window.location.origin}/faq?q=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback: no-op
    }
  }, []);

  return (
    <section className="faq-stage">
      <figure className="faq-hero-art" aria-hidden />

      <article className="faq-cabinet">
        <header className="faq-head">
          <p className="faq-kicker">библиотека на масата</p>
          <h1>Често задавани въпроси.</h1>
          <p className="faq-subtitle">
            Шкаф с малки чекмеджета. Всяко с по една карта — отвори, прочети, върни обратно.
          </p>

          <div className="faq-search" role="search">
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Търси въпрос..."
              aria-label="Търсене в често задавани въпроси"
              className="faq-search-input"
            />
            <span className="faq-search-hotkey" aria-hidden>⌘K</span>
          </div>

          <div className="faq-toolbar">
            <button type="button" className="faq-tool-btn" onClick={expandAll} aria-label="Отвори всички чекмеджета">
              Разтвори всичко
            </button>
            <button type="button" className="faq-tool-btn" onClick={collapseAll} aria-label="Затвори всички чекмеджета">
              Затвори всичко
            </button>
            {search ? (
              <span className="faq-result-count">{filtered.length} {filtered.length === 1 ? "резултат" : "резултата"}</span>
            ) : null}
          </div>
        </header>

        {grouped.length === 0 ? (
          <p className="faq-empty">Нищо не намерихме за „{search}“. Опитай друга дума.</p>
        ) : (
          grouped.map(({ category, entries }) => (
            <section key={category} className="faq-drawer-row" data-category={category}>
              <h2 className="faq-drawer-label">
                <CategoryIcon category={category} className="faq-category-icon" />
                {CATEGORY_LABELS[category]}
              </h2>

              <div className="faq-drawer-stack">
                {entries.map((item) => {
                  const isOpen = openSlugs.has(item.slug);
                  const feedbackValue = feedback[item.slug];
                  return (
                    <article
                      key={item.slug}
                      className="faq-drawer"
                      data-open={isOpen}
                      data-slug={item.slug}
                    >
                      <button
                        type="button"
                        className="faq-drawer-handle"
                        onClick={() => toggle(item.slug)}
                        aria-expanded={isOpen}
                      >
                        <span className="faq-drawer-pull" aria-hidden />
                        <span className="faq-drawer-title">
                          <SearchHighlight text={item.question} term={search.trim()} />
                        </span>
                        <span className="faq-drawer-chevron" aria-hidden>{isOpen ? "−" : "+"}</span>
                      </button>

                      {isOpen ? (
                        <div className="faq-drawer-card">
                          <FaqAnswerRenderer blocks={item.answer} />

                          {item.tutorialStep ? (
                            <p className="faq-tutorial-hint">
                              <Link href={`/tutorial?step=${item.tutorialStep}`}>
                                Виж в Tutorial → сцена {item.tutorialStep}
                              </Link>
                            </p>
                          ) : null}

                          <footer className="faq-drawer-footer">
                            <button
                              type="button"
                              className="faq-copy-link"
                              onClick={() => copyLink(item.slug)}
                              aria-label={`Копирай линк към „${item.question}“`}
                            >
                              🔗 Копирай линк
                            </button>

                            <div className="faq-helpful" role="group" aria-label="Помогна ли отговорът?">
                              <span className="faq-helpful-label">Помогна ли?</span>
                              <button
                                type="button"
                                className="faq-helpful-btn"
                                data-active={feedbackValue === "up"}
                                onClick={() => setFeedbackFor(item.slug, "up")}
                                aria-label="Да, помогна"
                              >
                                👍
                              </button>
                              <button
                                type="button"
                                className="faq-helpful-btn"
                                data-active={feedbackValue === "down"}
                                onClick={() => setFeedbackFor(item.slug, "down")}
                                aria-label="Не, не помогна"
                              >
                                👎
                              </button>
                            </div>
                          </footer>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <footer className="faq-foot">
          <p>Имаш въпрос, който не е тук?</p>
          <div className="faq-foot-actions">
            <Link href="/report" className="btn btn-secondary">Дай ни бележка</Link>
            <Link href="/" className="btn btn-secondary">Към началото</Link>
          </div>
        </footer>
      </article>
    </section>
  );
}

function SearchHighlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="faq-highlight">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
```

---

## Stage 6 — CSS for all new patterns

Add to `apps/web/app/globals.css` (within the existing FAQ section, or extend):

```css
/* ============================== */
/* FAQ — overhaul additions       */
/* ============================== */

/* Search bar */

.faq-search {
  display: flex;
  align-items: center;
  margin-top: 18px;
  padding: 0 14px;
  background: rgba(20, 14, 10, 0.45);
  border: 1px solid rgba(217, 154, 66, 0.35);
  border-radius: 12px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.faq-search:focus-within {
  border-color: #d19a42;
  box-shadow: 0 0 0 3px rgba(217, 154, 66, 0.2);
}

.faq-search-input {
  flex: 1;
  height: 44px;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 1rem;
  color: #f5e8c8;
}

.faq-search-input::placeholder {
  color: rgba(245, 232, 200, 0.45);
}

.faq-search-input:focus {
  outline: none;
}

.faq-search-hotkey {
  display: inline-block;
  padding: 4px 8px;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: rgba(245, 232, 200, 0.65);
  background: rgba(245, 232, 200, 0.08);
  border: 1px solid rgba(245, 232, 200, 0.2);
  border-radius: 4px;
}

@media (max-width: 640px) {
  .faq-search-hotkey { display: none; }
}

/* Toolbar */

.faq-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}

.faq-tool-btn {
  padding: 6px 12px;
  background: rgba(20, 14, 10, 0.4);
  border: 1px solid rgba(217, 154, 66, 0.28);
  border-radius: 6px;
  color: rgba(245, 232, 200, 0.85);
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  font-family: inherit;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.faq-tool-btn:hover {
  background: rgba(217, 154, 66, 0.18);
  border-color: rgba(217, 154, 66, 0.55);
}

.faq-result-count {
  margin-left: auto;
  font-size: 0.8rem;
  color: rgba(217, 154, 66, 0.85);
  font-style: italic;
}

/* Category accent colors */

.faq-drawer-row[data-category="pre-game"] .faq-drawer-label,
.faq-drawer-row[data-category="pre-game"] .faq-category-icon {
  color: #d19a42; /* warm amber */
}

.faq-drawer-row[data-category="gameplay"] .faq-drawer-label,
.faq-drawer-row[data-category="gameplay"] .faq-category-icon {
  color: #d94a3d; /* ember red */
}

.faq-drawer-row[data-category="account"] .faq-drawer-label,
.faq-drawer-row[data-category="account"] .faq-category-icon {
  color: #6a8caf; /* steel blue */
}

.faq-drawer-row[data-category="tech"] .faq-drawer-label,
.faq-drawer-row[data-category="tech"] .faq-category-icon {
  color: #a8a39b; /* warm grey */
}

.faq-drawer-row[data-category="privacy"] .faq-drawer-label,
.faq-drawer-row[data-category="privacy"] .faq-category-icon {
  color: #4a6b8a; /* deep blue */
}

.faq-category-icon {
  width: 22px;
  height: 22px;
  margin-right: 8px;
  vertical-align: middle;
}

.faq-drawer-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Search match highlight */

.faq-highlight {
  background: rgba(217, 154, 66, 0.4);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}

.faq-empty {
  text-align: center;
  padding: 48px 16px;
  color: rgba(245, 232, 200, 0.6);
  font-style: italic;
  font-size: 1rem;
}

/* Rich answer blocks */

.faq-answer {
  display: grid;
  gap: 14px;
}

/* TL;DR */

.faq-block-tldr {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: linear-gradient(155deg, rgba(217, 154, 66, 0.18), rgba(217, 154, 66, 0.05));
  border-left: 3px solid #d19a42;
  border-radius: 0 10px 10px 0;
}

.faq-block-tldr-label {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.faq-block-tldr-text {
  color: #1a1410;
  font-weight: 600;
  font-size: 0.98rem;
  line-height: 1.5;
}

/* Paragraph */

.faq-block-paragraph {
  font-size: 0.95rem;
  line-height: 1.7;
  color: #2a1b10;
}

/* Steps */

.faq-block-steps {
  display: grid;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.faq-block-steps li {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 12px;
  align-items: start;
}

.faq-step-marker {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #c8a366;
  color: #1a1410;
  font-family: "Noto Serif Display", serif;
  font-weight: 900;
  font-size: 0.95rem;
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.5), 0 1px 0 rgba(50, 30, 10, 0.3);
}

.faq-step-text {
  padding-top: 4px;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #2a1b10;
}

/* Bullets */

.faq-block-bullets {
  display: grid;
  gap: 6px;
  list-style: none;
  padding: 0;
}

.faq-block-bullets li {
  display: grid;
  grid-template-columns: 14px 1fr;
  gap: 10px;
  align-items: start;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #2a1b10;
}

.faq-bullet-marker {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-top: 8px;
  border-radius: 50%;
  background: #842f2b;
  box-shadow: 0 1px 0 rgba(255, 240, 200, 0.4);
}

/* Callout */

.faq-block-callout {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  border-left: 3px solid;
}

.faq-block-callout-info {
  background: rgba(106, 140, 175, 0.15);
  border-color: #6a8caf;
}

.faq-block-callout-warning {
  background: rgba(217, 154, 66, 0.18);
  border-color: #d19a42;
}

.faq-callout-icon {
  font-size: 1.25rem;
  line-height: 1.2;
}

.faq-block-callout span:last-child {
  font-size: 0.9rem;
  line-height: 1.55;
  color: #2a1b10;
}

/* Link list */

.faq-block-link-list {
  padding: 10px 14px;
  background: rgba(132, 47, 43, 0.06);
  border-radius: 8px;
  border-left: 2px solid rgba(132, 47, 43, 0.4);
}

.faq-link-list-title {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
  margin-bottom: 6px;
}

.faq-block-link-list ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 4px;
}

.faq-link {
  color: #842f2b;
  text-decoration: underline;
  text-underline-offset: 3px;
  font-weight: 600;
}

/* Image block */

.faq-block-image {
  margin: 0;
  display: grid;
  gap: 8px;
}

.faq-block-image-img {
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

.faq-block-image figcaption {
  font-size: 0.85rem;
  font-style: italic;
  color: rgba(42, 27, 16, 0.7);
  text-align: center;
}

/* Tutorial hint */

.faq-tutorial-hint {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(217, 154, 66, 0.12);
  border-radius: 8px;
  font-size: 0.88rem;
}

.faq-tutorial-hint a {
  color: #842f2b;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Drawer footer */

.faq-drawer-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(50, 30, 10, 0.25);
}

.faq-copy-link {
  background: transparent;
  border: 1px solid rgba(50, 30, 10, 0.3);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.8rem;
  color: #4f3829;
  cursor: pointer;
  font-family: inherit;
}

.faq-copy-link:hover {
  background: rgba(132, 47, 43, 0.1);
}

.faq-helpful {
  display: flex;
  align-items: center;
  gap: 6px;
}

.faq-helpful-label {
  font-size: 0.78rem;
  color: rgba(42, 27, 16, 0.6);
  margin-right: 4px;
}

.faq-helpful-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(50, 30, 10, 0.25);
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  transition: background 120ms ease, transform 120ms ease;
}

.faq-helpful-btn:hover {
  transform: scale(1.08);
}

.faq-helpful-btn[data-active="true"] {
  background: rgba(217, 154, 66, 0.25);
  border-color: #d19a42;
}

/* Drawer touch target — mobile */

@media (max-width: 768px) {
  .faq-drawer-handle {
    min-height: 48px;
    padding: 14px 16px;
  }

  .faq-helpful-btn {
    width: 40px;
    height: 40px;
  }

  .faq-copy-link {
    min-height: 32px;
    padding: 6px 12px;
  }
}

/* Sticky search bar on mobile */

@media (max-width: 768px) {
  .faq-head {
    position: sticky;
    top: 80px;
    z-index: 5;
    margin-bottom: 16px;
    padding-bottom: 12px;
    background: linear-gradient(180deg, rgba(28, 18, 10, 0.95) 0%, rgba(28, 18, 10, 0.85) 100%);
    backdrop-filter: blur(8px);
  }
}

/* Print stylesheet */

@media print {
  .faq-hero-art,
  .faq-search,
  .faq-toolbar,
  .faq-drawer-footer,
  .faq-tutorial-hint,
  .faq-foot {
    display: none !important;
  }

  .faq-cabinet {
    background: none !important;
    padding: 0 !important;
    box-shadow: none !important;
    color: #000 !important;
  }

  .faq-drawer {
    background: none !important;
    border: 1px solid #ccc !important;
    page-break-inside: avoid;
    margin-bottom: 12px;
    box-shadow: none !important;
  }

  .faq-drawer[data-open="false"] .faq-drawer-card,
  .faq-drawer-card {
    display: block !important;
  }

  .faq-drawer-chevron {
    display: none;
  }

  .faq-drawer-title {
    font-weight: 700;
    color: #000;
  }

  .faq-block-tldr,
  .faq-block-callout,
  .faq-block-link-list {
    border: 1px solid #999 !important;
    background: none !important;
  }
}
```

---

## Stage 7 — Update FAQPage JSON-LD

`apps/web/app/faq/page.tsx` — update the JSON-LD construction to use the new structure:

```ts
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  url: absoluteUrl("/faq"),
  inLanguage: "bg-BG",
  mainEntity: FAQ_DATA.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: flattenAnswerForSchema(item.answer),
    },
  })),
};

function flattenAnswerForSchema(blocks: readonly AnswerBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "tldr": return block.text;
        case "paragraph": return block.text;
        case "steps": return block.items.map((step, i) => `${i + 1}. ${step}`).join(" ");
        case "bullets": return block.items.join(". ");
        case "callout": return block.text;
        case "link-list": return `${block.title}: ${block.links.map((l) => l.text).join(", ")}`;
        case "image": return block.caption ?? block.alt;
      }
    })
    .join(" ");
}
```

Move `flattenAnswerForSchema` to a shared location (`lib/faq-data.ts`) ако Codex предпочита cleaner separation. Не е критично.

---

## Stage 8 — Update site-chrome + footer links

`/faq` вече е в SECONDARY_LINKS. Provери — `apps/web/components/site-chrome.tsx`. Ако не е, добави:
```ts
{ href: "/faq", label: "Въпроси" },
```

`/faq` вече трябва да е в SiteFooter (от prior PR). Verify.

---

## Stage 9 — Visual regression baseline

`/faq` визуалът се променя значително. След implementation, run:

```bash
pnpm visual:update   # regenerate FAQ baseline (and any other affected pages)
pnpm visual          # confirm only /faq baselines changed
```

Commit the new baseline images.

---

## Stage 10 — Update FAQ-related copy elsewhere

В други страници, които препращат към /faq (например навбар, sign-in foot links, etc.), verify че копират "Въпроси" не "FAQ" или "Често задавани въпроси" (за консистентност на link label).

---

## Acceptance criteria

1. **1 new imagen asset**: `paritet-diagram.png` + `.webp` в `apps/web/public/game-art/faq/`. No visible text in image.
2. **30 questions** in 5 categories (pre-game / gameplay / account / tech / privacy) в `apps/web/lib/faq-data.ts`.
3. **Rich answer types** supported: tldr / paragraph / steps / bullets / callout / link-list / image. Renderer renders all 7 types.
4. **Search** works: real-time filter as you type, token highlighted in question title, "0 резултата" empty state.
5. **⌘K / Ctrl+K** focuses search input.
6. **Deep linking**: open `/faq?q=paritet-rule` → drawer auto-opens + scrolls to it. URL syncs as drawers open/close.
7. **Copy link button** per drawer copies `/faq?q=slug` to clipboard.
8. **Expand all / Collapse all** buttons in toolbar.
9. **Category color accents**: each of 5 categories has distinct color на category label + icon.
10. **Inline SVG category icons** rendered per category (5 unique stroke designs).
11. **Helpful feedback**: 👍/👎 per drawer, persisted to localStorage, no backend.
12. **Tutorial deep-link**: `paritet-rule` drawer includes "Виж в Tutorial → сцена 5" link to `/tutorial?step=5`.
13. **Mobile**:
    - Search bar is sticky at top during scroll
    - Drawer handles ≥ 48px height (touch target)
    - Helpful buttons 40×40px
14. **Print stylesheet**: opens all drawers, hides chrome, page-break-inside: avoid per drawer.
15. **JSON-LD FAQPage** includes all 30 questions with flattened answer text.
16. **БГ-only copy**.
17. **`pnpm verify`** passes (включително `pnpm visual:update` за нов baseline).
18. **Single commit per stage** (14 atomic English commits below).

---

## Не пипай

- Hero art (`/game-art/faq/library-catalog-hero.png`) — keep as-is.
- OG image (`/game-art/og/og-faq.png`) — keep as-is.
- Other pages (privacy, terms, etc.) — out of scope.
- Better Auth, game-server — no touch.

---

## Verification

```bash
pnpm install
pnpm optimize:assets       # paritet-diagram.webp created
pnpm typecheck
pnpm test                  # existing FAQ tests (if any) updated
pnpm build
pnpm regression
pnpm smoke
pnpm visual:update         # new /faq baselines
pnpm visual                # confirm pass
pnpm perf:budget
```

Manual checks:
- Open `/faq` → 30 questions in 5 categories visible with new accent colors.
- Type "паритет" in search → filters to single result, "паритет" highlighted in title.
- Press ⌘K → search field focuses.
- Click `paritet-rule` drawer → opens, shows TL;DR + diagram + paragraph + callout, plus tutorial link.
- Click "Виж в Tutorial → сцена 5" → navigates to `/tutorial?step=5`.
- Click "🔗 Копирай линк" → clipboard contains `https://...domain.../faq?q=paritet-rule`.
- Open new tab to that URL → drawer auto-opens and scrolls into view.
- Click 👍 → button gets accent ring. Reload → still active (localStorage persists).
- Mobile: scroll page → search bar stays sticky.
- Print preview → all drawers open, clean layout, no chrome.

---

## Commit strategy (14 atomic English commits)

Branch: `feat/faq-overhaul`

1. `chore(art): generate painterly paritet diagram for FAQ`
2. `feat(faq): rich answer block type system with tldr/steps/bullets/callout/image`
3. `feat(faq): expand to 30 questions across 5 categories with structured answers`
4. `feat(faq): inline SVG category icons (5 designs)`
5. `feat(faq): rich answer renderer with all 7 block types`
6. `feat(faq): search bar with token highlighting and Cmd/Ctrl+K shortcut`
7. `feat(faq): deep linking via ?q=slug with URL sync and auto-scroll`
8. `feat(faq): expand-all and collapse-all controls`
9. `feat(faq): copy-link button per drawer`
10. `feat(faq): helpful thumbs feedback persisted in localStorage`
11. `feat(faq): category color accents on labels and icons`
12. `feat(faq): tutorial deep-link for paritet question`
13. `style(faq): mobile sticky search + larger touch targets + print stylesheet`
14. `chore(faq): updated visual regression baseline`

PR title: `feat: complete /faq overhaul — search, deep linking, rich answers, 30 questions`

PR body should:
- Link to before/after screenshots in `audit-v3/after/faq/` (regenerate during PR if needed).
- Note: search is client-side only (no backend dependency). Scales fine up to ~100 questions.
- Note: feedback widget is localStorage-only at this stage; no analytics or backend storage.
- Reviewer hint: run `npx serve apps/web/.next/server/app/faq.html` after build to verify static-rendered shell.

---

(End of prompt)
