import {
  GAME_MODE_DEFINITIONS,
  getGameFamily,
  getGameModeNameBg,
  phaseLabelBg,
  type ChatChannel,
  type GameFamily,
  type GameMode,
  type GamePhase,
  type RoleCode,
} from "@werewolf/shared";
import { canFactionKill, isNightPhase } from "@/lib/play/role-rules";
import type { PublicPlayer } from "@/lib/play/types";


interface PhaseGuideCopy {
  title: string;
  body: string;
  wakes: string;
}

const PHASE_GUIDE_BG: Partial<Record<GamePhase, PhaseGuideCopy>> = {
  lobby: {
    title: "Настройка на стаята",
    body: "Домакинът подготвя стаята. При включено автоматично начало се изчаква готовността на всички участници. Домакинът може да започне и без всички да са готови, ако останалите условия за начало са изпълнени.",
    wakes: "Никой още не се буди.",
  },
  role_reveal: {
    title: "Виж тайно ролята си",
    body: "Всеки вижда само собствената си карта. Не показвай телефона си, ако играете на живо.",
    wakes: "Всеки гледа само собствената си роля.",
  },
  first_night: {
    title: "Първа нощ",
    body: "Еднократните стартови роли действат преди обикновените нощни действия.",
    wakes: "Крадец, Купидон, фракции, проверки и защитни роли.",
  },
  night: {
    title: "Нощ",
    body: "Играчите с нощни действия избират цел. Изборите остават тайни и се разрешават по установения ред.",
    wakes: "Върколаците, Вампирите, Гадателката, Оракулът и останалите роли с нощни действия.",
  },
  day_announcement: {
    title: "Събуждане и обявяване",
    body: "Системата обявява публичните резултати от нощта, без да разкрива скрита информация.",
    wakes: "Всички се събуждат.",
  },
  day_discussion: {
    title: "Дневно обсъждане",
    body: "Всички живи играчи спорят, блъфират и събират подозрения. Таймерът пази ритъма на разговора.",
    wakes: "Всички живи играчи говорят.",
  },
  nomination: {
    title: "Номинации",
    body: "При спортна или ръчно водена игра тук се избират кандидати за гласуване.",
    wakes: "Всички живи играчи участват.",
  },
  defense: {
    title: "Защита",
    body: "Номинираните получават време за последна защита преди гласуване.",
    wakes: "Говорят номинираните.",
  },
  voting: {
    title: "Гласуване",
    body: "Всеки жив играч избира кого да елиминира. Кметът решава само ако водещите кандидати са с равен брой гласове.",
    wakes: "Всички живи играчи гласуват.",
  },
  resolution: {
    title: "Развръзка",
    body: "Присъдата се изпълнява, ролята се разкрива според настройките и се проверява дали играта е приключила.",
    wakes: "Никой не действа, освен ако не се задейства специална роля.",
  },
  hunter_revenge: {
    title: "Последен изстрел",
    body: "Ако Ловецът умре, той избира един жив играч за отмъщение.",
    wakes: "Буден е само Ловецът.",
  },
  mayor_successor: {
    title: "Наследник на Кмета",
    body: "Ако Кметът умре, Разказвачът или домакинът избира наследник според настройките.",
    wakes: "Разказвачът или домакинът управлява избора.",
  },
  paused: {
    title: "Пауза",
    body: "Фазата е спряна временно от Разказвача или домакина.",
    wakes: "Никой няма задължително действие.",
  },
  game_over: {
    title: "Край на играта",
    body: "Победителят е известен, а историята на вечерта вече може да се прегледа.",
    wakes: "Играта приключи за всички.",
  },
};

const MAFIA_PHASE_GUIDE_BG: Partial<Record<GamePhase, Partial<PhaseGuideCopy>>> = {
  role_reveal: {
    title: "Виж тайно досието си",
    body: "Всеки вижда само собственото си досие. Не показвай телефона си, ако играете на живо.",
    wakes: "Всеки гледа само собствената си роля.",
  },
  first_night: {
    body: "Ролите с нощни действия правят първите си избори според настройките на стаята.",
    wakes: "Мафията, Донът и Комисарят според избраните роли.",
  },
  night: {
    body: "Мафията избира жертва, Донът може да търси Комисаря, а Комисарят проверява подозрителен играч.",
    wakes: "Мафията, Донът и Комисарят.",
  },
  day_announcement: {
    body: "Системата обявява публичните резултати от нощта, без да разкрива скрита информация.",
    wakes: "Градът се събужда.",
  },
  day_discussion: {
    body: "Играчите защитават версии, притискат противоречия и събират подозрения. Таймерът пази ритъма на разговора.",
    wakes: "Всички живи играчи говорят.",
  },
  nomination: {
    title: "Обвинения",
    body: "При спортна или ръчно водена Мафия тук се избират кандидати за гласуване.",
    wakes: "Всички живи играчи участват.",
  },
  defense: {
    title: "Последна защита",
    body: "Номинираните получават време да защитят версията си преди присъдата.",
    wakes: "Говорят номинираните.",
  },
  voting: {
    body: "Всеки жив играч избира кого градът да елиминира. След последния глас резултатът се преброява.",
    wakes: "Всички живи играчи гласуват.",
  },
  resolution: {
    body: "Присъдата се изпълнява, ролята се разкрива според настройките и се проверява дали играта е приключила.",
    wakes: "Никой не действа, освен ако не се задейства специална роля.",
  },
};

export function phaseGuideBg(phase: GamePhase, mode: GameMode): PhaseGuideCopy {
  const base = PHASE_GUIDE_BG[phase] ?? {
    title: phaseLabelBg(phase, mode),
    body: "Следвай указанията на екрана. Те показват кога можеш да действаш и какво се случва след това.",
    wakes: "Няма специално събуждане в тази фаза.",
  };

  if (getGameFamily(mode) !== "mafia") {
    return base;
  }

  const override = MAFIA_PHASE_GUIDE_BG[phase] ?? {};
  return {
    ...base,
    title: override.title ?? phaseLabelBg(phase, mode),
    ...override,
  };
}

export function roleWakeHint(role: RoleCode | undefined, phase: string, ownPlayer: PublicPlayer | undefined) {
  if (ownPlayer?.narrator) {
    return "Ти си Разказвачът. Води фазите и пази тайните на играчите.";
  }
  if (ownPlayer && !ownPlayer.playing) {
    return "Ти наблюдаваш играта. Не участваш в действията и гласуването.";
  }
  if (ownPlayer && ownPlayer.playing && !ownPlayer.alive) {
    if (phase === "hunter_revenge" && role === "hunter") {
      return "Ако е твоят последен изстрел, избери жив играч.";
    }
    return "Ти си елиминиран. Следи играта, но не влияеш на живите играчи.";
  }
  if (!role) {
    return "Ролята ти още не е разкрита на това устройство.";
  }
  if (role === "thief" && phase === "first_night") {
    return "Сега е твоят единствен шанс да откраднеш карта.";
  }
  if (role === "cupid" && phase === "first_night") {
    return "Сега избираш двамата Влюбени.";
  }
  if (isNightPhase(phase)) {
    if (
      canFactionKill(role) ||
      [
        "commissioner",
        "detective",
        "don",
        "seer",
        "oracle",
        "witch",
        "healer",
        "doctor",
        "bodyguard",
        "priest",
        "blacksmith",
        "investigator",
        "stray_cat",
        "informant",
        "roleblocker",
        "lawyer",
        "medium",
      ].includes(role)
    ) {
      return "Тази фаза може да имаш активно нощно действие.";
    }
    return "В тази нощ нямаш задължително действие.";
  }
  if (phase === "hunter_revenge") {
    return "Изчакай последния изстрел на Ловеца.";
  }
  if (phase === "voting") {
    return "Гласувай според информацията и блъфовете от деня.";
  }
  return "Следвай публичната фаза и пази тайните си.";
}

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
