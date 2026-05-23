import type { ArtifactKey } from "../primitives/artifacts";

export type EmptyStateKey =
  | "home-no-rooms"
  | "home-no-last-story"
  | "lobby-list-empty"
  | "lobby-search-no-match"
  | "play-lobby-waiting"
  | "history-empty"
  | "history-filter-no-match"
  | "achievements-zero"
  | "achievements-locked"
  | "friends-empty"
  | "friends-pending"
  | "leaderboard-empty"
  | "leaderboard-week-empty"
  | "account-unverified"
  | "account-no-avatar"
  | "faq-no-results"
  | "report-no-reports"
  | "status-all-healthy"
  | "status-partial-outage"
  | "status-major-outage"
  | "search-global"
  | "notifications";

export interface EmptyStateDef {
  artifact: ArtifactKey;
  title: string;
  body: string;
  action?: {
    label: string;
    href?: string;
  };
}

export const EMPTY_STATES: Record<EmptyStateKey, EmptyStateDef> = {
  "home-no-rooms": {
    artifact: "empty-chair",
    title: "Бъди първият на масата.",
    body: "Няма активни стаи в момента.",
    action: { label: "Създай стая", href: "/create" },
  },
  "home-no-last-story": {
    artifact: "closed-book",
    title: "Първите герои ще се появят тук.",
    body: "След първата завършена игра.",
  },
  "lobby-list-empty": {
    artifact: "empty-chair",
    title: "Тихо е. Започни ти.",
    body: "Никой не е създал стая в последния час.",
    action: { label: "Създай стая", href: "/create" },
  },
  "lobby-search-no-match": {
    artifact: "closed-book",
    title: "Не намерихме такава стая.",
    body: "Провери кода или потърси друга.",
    action: { label: "Изчисти търсенето" },
  },
  "play-lobby-waiting": {
    artifact: "open-door",
    title: "Първи влизаш - мястото е твое.",
    body: "Сподели кода с приятели.",
    action: { label: "Копирай код" },
  },
  "history-empty": {
    artifact: "sealed-letter",
    title: "Архивът чака първото си писмо.",
    body: "Завърши една игра и тя ще се появи тук.",
    action: { label: "Седни на маса", href: "/create" },
  },
  "history-filter-no-match": {
    artifact: "closed-book",
    title: "Не намерихме дело с тези критерии.",
    body: "Опитай с по-широко търсене.",
    action: { label: "Изчисти филтри" },
  },
  "achievements-zero": {
    artifact: "dusty-shelf",
    title: "Легендите още не са започнали.",
    body: "Първата победа отключва първата легенда.",
    action: { label: "Играй сега", href: "/create" },
  },
  "achievements-locked": {
    artifact: "closed-book",
    title: "Заключена легенда.",
    body: "Подсказка: спечели три нощи поред.",
  },
  "friends-empty": {
    artifact: "empty-chair",
    title: "Покани първия си гост.",
    body: "Сподели покана с приятели.",
    action: { label: "Копирай покана" },
  },
  "friends-pending": {
    artifact: "sealed-letter",
    title: "Поканите чакат отговор.",
    body: "Изпрати напомняне, ако е минала седмица.",
  },
  "leaderboard-empty": {
    artifact: "unprinted-paper",
    title: "Изданието още не е тиражирано.",
    body: "Утрешният брой ще носи първото име. Завърши една игра.",
    action: { label: "Започни първото издание", href: "/create" },
  },
  "leaderboard-week-empty": {
    artifact: "unprinted-paper",
    title: "Тази седмица е без новини.",
    body: "Виж класирането от миналата седмица.",
    action: { label: "Виж миналата седмица" },
  },
  "account-unverified": {
    artifact: "sealed-letter",
    title: "Изпратихме ти писмо.",
    body: "Отвори пощата и потвърди адреса.",
    action: { label: "Изпрати отново" },
  },
  "account-no-avatar": {
    artifact: "empty-chair",
    title: "Покажи лицето си.",
    body: "Избери от осем портрета от епохата.",
    action: { label: "Избери портрет" },
  },
  "faq-no-results": {
    artifact: "closed-book",
    title: "Огънят не познава този въпрос.",
    body: "Изпрати ни го - ще намерим отговор.",
    action: { label: "Дай ни бележка", href: "/report" },
  },
  "report-no-reports": {
    artifact: "closed-book",
    title: "Нямаш отворени сигнали.",
    body: "Когато подадеш сигнал, ще се появи тук.",
  },
  "status-all-healthy": {
    artifact: "balanced-scale",
    title: "Селото работи.",
    body: "Всички услуги отговарят нормално.",
  },
  "status-partial-outage": {
    artifact: "broken-candle",
    title: "Селото е тихо.",
    body: "Една услуга не отговаря - работим по нея.",
    action: { label: "Виж детайли" },
  },
  "status-major-outage": {
    artifact: "broken-candle",
    title: "Селото спи.",
    body: "Сериозен проблем. Опитай след малко.",
    action: { label: "Абонирай се за известия" },
  },
  "search-global": {
    artifact: "closed-book",
    title: "Не намерихме нищо за това.",
    body: "Опитай с по-кратък термин.",
  },
  notifications: {
    artifact: "sealed-letter",
    title: "Никакви известия.",
    body: "Когато се случи нещо важно, ще намериш писмо тук.",
  },
};
