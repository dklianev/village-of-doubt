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
  internal?: boolean;
}

export interface FaqItem {
  slug: string;
  category: FaqCategory;
  question: string;
  answer: readonly AnswerBlock[];
  searchableText: string;
  tutorialStep?: number;
}

export function flattenSearchableText(blocks: readonly AnswerBlock[]): string {
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
          return `${block.title} ${block.links.map((link) => link.text).join(" ")}`;
        case "image":
          return block.alt + (block.caption ?? "");
      }
    })
    .join(" ");
}

export function flattenAnswerForSchema(blocks: readonly AnswerBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "tldr":
        case "paragraph":
        case "callout":
          return block.text;
        case "steps":
          return block.items.map((step, index) => `${index + 1}. ${step}`).join(" ");
        case "bullets":
          return block.items.join(". ");
        case "link-list":
          return `${block.title}: ${block.links.map((link) => link.text).join(", ")}`;
        case "image":
          return block.caption ?? block.alt;
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
  const item: FaqItem = {
    slug,
    category,
    question,
    answer,
    searchableText: `${question} ${flattenSearchableText(answer)}`.toLowerCase(),
  };

  if (options?.tutorialStep !== undefined) {
    item.tutorialStep = options.tutorialStep;
  }

  return item;
}

export const FAQ_DATA = [
  faq("werewolf-vs-mafia", "gameplay", "Каква е разликата между Върколак и Мафия?", [
    {
      type: "paragraph",
      text:
        "Двете игри ползват едни и същи механики на тайно гласуване и нощни действия. Върколак върви по фолклорен сценарий — лунна нощ, селяни, върколаци, гадатели. Мафия е градски ноар — Дон, Комисар, алибита и подозрение по улицата. Различен тон, същият инстинкт за лъжа и оцеляване.",
    },
  ]),
  faq("player-count", "gameplay", "С колко души се играе?", [
    {
      type: "paragraph",
      text:
        "Минимум 5, оптимално 8-12. Поддържаме до 30 в една стая. За първа игра препоръчваме 8 души — достатъчно за интересна динамика, но не толкова много, че да се изгубите в обсъжданията.",
    },
  ]),
  faq("game-duration", "gameplay", "Колко трае една игра?", [
    {
      type: "paragraph",
      text:
        "Една стандартна стая на 8-10 души приключва за 15-25 минути. С повече играчи и опитни групи — 30-40 минути. На живо може да отнеме повече, защото няма таймер върху обсъжданията.",
    },
  ]),
  faq("solo-play", "gameplay", "Мога ли да играя сам?", [
    {
      type: "paragraph",
      text:
        "Не. Това е социална игра — нужни са поне 5 души. Препоръчваме покана към група приятели или приобщаване към публична стая.",
    },
  ]),
  faq("paritet-rule", "gameplay", "Какво е „паритет“ и кога приключва играта?", [
    {
      type: "paragraph",
      text:
        "Селяните печелят, ако елиминират всички Върколаци/Вампири. Върколаците печелят, ако техният брой стане равен или по-голям от живите Селяни — този момент се нарича „паритет“. Същото правило важи за Вампири и Мафия.",
    },
  ]),
  faq("why-account", "account", "Защо ми трябва акаунт?", [
    {
      type: "paragraph",
      text:
        "Акаунтът пази историята, постиженията и поканите ти. Без него не можем да съхраним кои стаи си посетил или какви победи си натрупал. Освен това спира ботовете и спама в публичните стаи.",
    },
  ]),
  faq("anonymous-play", "account", "Мога ли да играя без акаунт?", [
    {
      type: "paragraph",
      text:
        "На този момент — не. Преди публичното пускане поддържахме временна анонимна идентичност, но за стабилност и защита от злоупотреби влизането е задължително. Можеш да влезеш с Google, Discord или имейл за под 30 секунди.",
    },
  ]),
  faq("delete-account", "account", "Как да изтрия профила си?", [
    {
      type: "paragraph",
      text:
        "Отиди в „Моят профил“ от менюто горе вдясно. Долу има секция „Изтрий профила“. Изтриването е окончателно. Имената от твоите игри ще бъдат заменени с „Изтрит играч“, за да остане честна история на масата, но всички лични данни и постижения изчезват.",
    },
  ]),
  faq("forgot-password", "account", "Загубих си паролата. Какво да направя?", [
    {
      type: "paragraph",
      text:
        "На страницата за вход кликни „Забравена парола?“. Въведи имейла си — изпращаме линк за нова парола, валиден за един час. Ако не получаваш писмото, провери в „Спам“ или „Промоции“.",
    },
  ]),
  faq("devices", "tech", "На какви устройства работи играта?", [
    {
      type: "paragraph",
      text:
        "Браузър на всяко устройство — Windows, Mac, Android, iOS. Препоръчваме съвременен браузър като Chrome, Firefox, Safari или Edge. За мобилно играта работи добре, но за стая на живо с 8+ души настолен компютър или таблет дава по-комфортно изживяване.",
    },
  ]),
  faq("connection-issues", "tech", "Защо губя връзка по средата на играта?", [
    {
      type: "paragraph",
      text:
        "Това обикновено е мрежов проблем, не на играта. Сървърът пази твоето състояние — при повторно свързване ще се върнеш в същата фаза с твоята роля. Ако често прекъсваш, провери Wi-Fi сигнала или превключи на 4G.",
    },
  ]),
  faq("no-sound", "tech", "Защо не чувам звук?", [
    {
      type: "paragraph",
      text:
        "По подразбиране звукът е изключен заради правилата на браузърите за автоматично пускане. Кликни иконата с високоговорителя в горната дясна част на навигацията — звукът се включва от следващата фаза нататък.",
    },
  ]),
  faq("offline-mode", "tech", "Играта работи ли офлайн?", [
    {
      type: "paragraph",
      text:
        "Отчасти — менюто и правилата се зареждат от кеша, ако вече си посетил сайта. Но играта изисква активна интернет връзка за свързване със сървъра.",
    },
  ]),
  faq("what-data", "privacy", "Какви данни събирате за мен?", [
    {
      type: "paragraph",
      text:
        "Имейл, име на масата, идентификатор от вход през Google/Discord, профилна снимка от избрания вход, игрова история и постижения. Не събираме телефон, адрес или банкови данни.",
      links: [{ text: "Политика за поверителност", href: "/privacy", internal: true }],
    },
  ]),
  faq("report-issue", "privacy", "Как да докладвам бъг или нарушение?", [
    {
      type: "paragraph",
      text: "За технически бъг — ползвай малкия плаващ бутон долу вдясно „Дай ни бележка“. За нарушение или съмнително поведение — отвори формата за сигнал.",
      links: [{ text: "Подай сигнал", href: "/report", internal: true }],
    },
  ]),
] as const satisfies readonly FaqItem[];
