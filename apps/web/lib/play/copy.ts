import {
  GAME_MODE_DEFINITIONS,
  getGameModeNameBg,
  type ChatChannel,
  type GameFamily,
  type GameMode,
  type RoleCode,
} from "@werewolf/shared";


export { phaseGuideBg, roleWakeHint } from "./phase-guide";

export function nightActionHelpBg(role: RoleCode) {
  const labels: Partial<Record<RoleCode, string>> = {
    mafioso: "Координирай се със съотборниците си в тайния канал. Ако изборите ви се разминават, няма жертва.",
    don: "Можеш да помогнеш за убийството и отделно да провериш дали някой е Комисарят през същата нощ.",
    werewolf: "Избери жертва заедно с глутницата. Лечител, Вещица или благословия могат да спрат смъртта.",
    vampire: "Вампирите действат като отделна зла фракция и имат собствена жертва.",
    commissioner: "Проверката казва дали целта е от Мафията, не показва точната роля.",
    detective: "Разследването дава личен резултат според настройките на Мафия.",
    informant: "Доносникът вижда точна карта, освен ако някой не е прикрит.",
    roleblocker: "Избраният играч няма да може да изпълни нощното си действие.",
    lawyer: "Адвокатът прави целта да изглежда чиста пред разследващите.",
    medium: "Медиумът може да пита вече елиминиран играч каква е била ролята му.",
    seer: "Проверяваш дали избраният играч е Върколак или Вампир. Получаваш личен отговор за заплаха, без точна роля.",
    oracle: "Оракулът проверява дали целта е Върколак или Вампир.",
    witch: "Лечението и отровата са еднократни. Ако ги изразходваш, после вече не са налични.",
    healer: "Лечителят не може да пази себе си и не може да пази един и същ играч две нощи поред.",
    doctor: "Пазиш един играч от всяка нощна смърт. Самозащитата зависи от настройките на стаята.",
    bodyguard: "Бодигардът пази цел с риск за себе си според настройките.",
    vigilante: "Вигилантето може да атакува, но грешният избор помага на Мафията.",
    maniac: "Маниакът играе сам и може да елиминира през нощта.",
    vampire_hunter: "Убиецът на вампири може да ловува, но губи умението си при грешна жертва.",
    priest: "Благословията е еднократна като действие, но защитата остава до края на играта.",
    blacksmith: "Ковачът избира кой получава меча и срещу кого се използва. Мечът е еднократен.",
    investigator: "Следователката проверява избран играч и двамата му живи съседи като една тройка.",
    insomniac: "Неспящата получава личен резултат в края на нощта, ако около нея е имало движение.",
    stray_cat: "Уличната котка избира дом. Ако попадне при чудовище, и двамата излизат от играта.",
    thief: "След кражбата ти ставаш новата роля, а целта става Обикновен селянин.",
    cupid: "Влюбените са тайно свързани. Смъртта на единия повлича другия.",
  };

  return labels[role] ?? "Ако нямаш действие, спокойно можеш да пропуснеш фазата.";
}

export function privateChannelBg(channel: ChatChannel) {
  const labels: Record<ChatChannel, string> = {
    public: "публичен разговор",
    mafia: "разговор на Мафията",
    werewolves: "разговор на Върколаците",
    vampires: "разговор на Вампирите",
    dead: "разговор на мъртвите",
    system: "системен канал",
  };

  return labels[channel];
}

export function nightInstructionBg(role: RoleCode) {
  const labels: Partial<Record<RoleCode, string>> = {
    mafioso: "Мафията избира жертва",
    don: "Донът избира жертва и търси Комисаря",
    werewolf: "Върколаците избират жертва",
    vampire: "Вампирите избират жертва",
    commissioner: "Комисарят проверява подозрителен играч",
    detective: "Детективът разследва подозрителен играч",
    informant: "Доносникът отваря чуждо досие",
    roleblocker: "Блокиращият спира нощно действие",
    lawyer: "Адвокатът подготвя алиби",
    medium: "Медиумът говори с елиминиран играч",
    seer: "Гадателката проверява за нощна заплаха",
    oracle: "Оракулът проверява заплахата",
    witch: "Вещицата избира кого да лекува и кого да отрови",
    healer: "Лечителят пази един играч за тази нощ",
    doctor: "Докторът пази един играч за тази нощ",
    bodyguard: "Бодигардът охранява един играч",
    vigilante: "Вигилантето избира цел",
    maniac: "Маниакът избира жертва",
    vampire_hunter: "Убиецът на вампири ловува",
    priest: "Свещеникът дава една трайна благословия",
    blacksmith: "Ковачът изковава един меч",
    investigator: "Следователката проверява тройка",
    insomniac: "Неспящата чака края на нощта",
    stray_cat: "Уличната котка избира дом",
    thief: "Крадецът краде карта веднъж през първата нощ",
    cupid: "Купидон избира двама Влюбени",
  };

  return labels[role] ?? "Тази роля няма задължително нощно действие";
}

export function nightTargetHeadingBg(role: RoleCode, targetName: string) {
  if (role === "healer" || role === "doctor" || role === "bodyguard") {
    return `Защита за ${targetName}`;
  }
  if (role === "priest") {
    return `Благословия за ${targetName}`;
  }
  if (role === "lawyer") {
    return `Алиби за ${targetName}`;
  }
  if (role === "medium") {
    return `Връзка с ${targetName}`;
  }
  if (
    role === "commissioner" ||
    role === "detective" ||
    role === "informant" ||
    role === "don" ||
    role === "seer" ||
    role === "oracle" ||
    role === "investigator"
  ) {
    return `Проверка на ${targetName}`;
  }
  if (role === "roleblocker") {
    return `Блокиране на ${targetName}`;
  }
  if (role === "witch") {
    return `Решение за ${targetName}`;
  }
  if (role === "stray_cat") {
    return `Избран дом: ${targetName}`;
  }
  if (role === "thief") {
    return `Кражба от ${targetName}`;
  }
  if (role === "cupid" || role === "lovers") {
    return `Първа връзка: ${targetName}`;
  }
  if (role === "blacksmith") {
    return `Първа цел: ${targetName}`;
  }
  return `Нощна цел: ${targetName}`;
}


export function modeBg(mode: string) {
  return isKnownMode(mode) ? getGameModeNameBg(mode) : mode;
}

function isKnownMode(mode: string): mode is GameMode {
  return mode in GAME_MODE_DEFINITIONS;
}

export function narratorBg(mode: string) {
  const labels: Record<string, string> = {
    automatic: "Автоматичен Разказвач",
    honest_human: "Човешки Разказвач",
    full_human: "Пълен Разказвач",
  };

  return labels[mode] ?? mode;
}

export function communicationBg(mode: string) {
  const labels: Record<string, string> = {
    built_in_chat: "Вграден разговор",
    no_chat: "Без писмен разговор",
    system_only: "Само системни съобщения",
    secret_channels: "Тайни канали",
  };

  return labels[mode] ?? mode;
}

export function tempoBg(mode: string) {
  const labels: Record<string, string> = {
    fast_online: "Бърза онлайн игра",
    normal_online: "Стандартна онлайн игра",
    live: "На живо",
    sport_mafia: "Спортна Мафия",
    manual: "Ръчно водене",
  };

  return labels[mode] ?? mode;
}

export function majorityModeBg(mode: string) {
  const labels: Record<string, string> = {
    simple: "обикновено мнозинство",
    absolute: "абсолютно мнозинство",
  };

  return labels[mode] ?? mode;
}

export function winnerBg(winner: string, family?: GameFamily) {
  const labels: Record<string, string> = {
    village: family === "mafia" ? "Гражданите печелят" : "Селото печели",
    werewolves: "Върколаците печелят",
    vampires: "Вампирите печелят",
    mafia: "Мафията печели",
    maniac: "Маниакът печели",
    lovers: "Влюбените печелят",
    draw: "Никой не печели",
  };

  return labels[winner] ?? winner;
}
