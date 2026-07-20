import {
  GAME_MODE_DEFINITIONS,
  ROLE_DEFINITIONS,
  getGameFamily,
  getGameModeNameBg,
  phaseLabelBg,
  type ChatChannel,
  type GameMode,
  type GamePhase,
  type RoleCode,
} from "@werewolf/shared";
import { canFactionKill, isNightPhase } from "@/lib/play/role-rules";
import type { PrivateResult, PublicPlayer } from "@/lib/play/types";

export const ROLE_GUIDE_BG: Partial<Record<RoleCode, { summary: string; team: string; timing: string; win: string }>> = {
  civilian: {
    summary: "Нямаш нощно действие. Силата ти е в дневното обсъждане, логиката и гласа.",
    team: "Мирни граждани",
    timing: "Ден и гласуване",
    win: "Елиминирайте Мафията",
  },
  commissioner: {
    summary: "Всяка нощ проверяваш играч и разбираш дали е от Мафията. Резултатът е само за теб.",
    team: "Мирни граждани",
    timing: "Всяка нощ",
    win: "Открий Мафията без да се издадеш твърде рано",
  },
  mafioso: {
    summary: "Будиш се с Мафията и участваш в избора на нощна жертва.",
    team: "Мафия",
    timing: "Всяка нощ",
    win: "Мафията да достигне паритет с мирните",
  },
  don: {
    summary: "Водиш Мафията. Можеш да участваш в убийството или да търсиш Комисаря.",
    team: "Мафия",
    timing: "Всяка нощ",
    win: "Открий Комисаря и пази Мафията скрита",
  },
  ordinary_villager: {
    summary: "Нямаш нощно действие. Наблюдавай реакциите, пази логиката и гласувай внимателно.",
    team: "Село",
    timing: "Ден и гласуване",
    win: "Всички Върколаци и други зли роли да бъдат елиминирани",
  },
  werewolf: {
    summary: "Будиш се с Върколаците и избирате една нощна жертва.",
    team: "Върколаци",
    timing: "Всяка нощ",
    win: "Върколаците да достигнат паритет със селото",
  },
  seer: {
    summary: "Всяка нощ виждаш точната роля на избран играч. Информацията е силна, но опасна за разкриване.",
    team: "Село",
    timing: "Всяка нощ",
    win: "Насочи селото към злите роли",
  },
  witch: {
    summary: "Имаш една лечебна отвара и една отрова. Всяка може да се използва само веднъж.",
    team: "Село",
    timing: "Нощ, докато имаш отвара",
    win: "Спаси ключов играч или елиминирай подозрителен",
  },
  healer: {
    summary: "Всяка нощ пазиш един играч от убийство. Можеш да пазиш себе си и същия играч в поредни нощи.",
    team: "Село",
    timing: "Всяка нощ",
    win: "Прекъсвай нощните убийства без да се издаваш",
  },
  priest: {
    summary: "Веднъж благославяш играч. Благословията остава до края и спира първото убийство срещу него.",
    team: "Село",
    timing: "Една нощ в играта",
    win: "Дай трайна защита на най-ценния съюзник",
  },
  hunter: {
    summary: "Ако умреш, получаваш последен изстрел и можеш да вземеш друг жив играч със себе си.",
    team: "Село",
    timing: "При смърт",
    win: "Накарай злите роли да се страхуват да те елиминират",
  },
  cupid: {
    summary: "Първата нощ избираш двама Влюбени. Ако единият умре, другият умира от разбито сърце.",
    team: "Село",
    timing: "Само първата нощ",
    win: "Селото печели, освен ако Влюбените не останат последни",
  },
  vampire: {
    summary: "Вампирите са отделна зла фракция. Будите се заедно и избирате нощна жертва.",
    team: "Вампири",
    timing: "Всяка нощ",
    win: "Вампирите да достигнат паритет с всички останали",
  },
  jester: {
    summary: "Искаш да те изгонят чрез дневното гласуване. Ако селото те линчува, печелиш лична победа.",
    team: "Самостоятелен",
    timing: "Ден и гласуване",
    win: "Бъди изгонен през гласуване",
  },
  little_girl: {
    summary: "Разширена роля за ръчно водени игри. Наднича, докато Върколаците са будни, но рискува да бъде разкрита.",
    team: "Село",
    timing: "Нощ, ръчно/разширено",
    win: "Събирай информация без да бъдеш хваната",
  },
  thief: {
    summary: "Първата нощ крадеш карта веднъж. Ти ставаш откраднатата роля, а целта става Обикновен селянин.",
    team: "Променлив",
    timing: "Само първата нощ",
    win: "След кражбата печелиш с новия си отбор",
  },
};

interface PhaseGuideCopy {
  title: string;
  body: string;
  wakes: string;
}

const PHASE_GUIDE_BG: Partial<Record<GamePhase, PhaseGuideCopy>> = {
  lobby: {
    title: "Настройка на стаята",
    body: "Водещият избира режим, роли, таймери, комуникация и Разказвач. Всички трябва да са готови преди старт.",
    wakes: "Никой още не се буди.",
  },
  role_reveal: {
    title: "Виж тайно ролята си",
    body: "Всеки играч получава само своята карта като лично събитие. Не показвай телефона си, ако играете на живо.",
    wakes: "Всеки гледа само собствената си роля.",
  },
  first_night: {
    title: "Първа нощ",
    body: "Първата нощ разрешава еднократните стартови роли преди обикновените нощни действия.",
    wakes: "Крадец, Купидон, фракции, проверки и защитни роли.",
  },
  night: {
    title: "Нощ",
    body: "Играчите с нощни действия избират цел. Сървърът пази действията тайни и ги разрешава в фиксиран ред.",
    wakes: "Мафия/Върколаци/Вампири, Комисар/Ясновидка, Вещица, Лечител, Свещеник.",
  },
  day_announcement: {
    title: "Събуждане и обявяване",
    body: "Системата обявява публичните резултати от нощта, без да разкрива скрита информация.",
    wakes: "Всички се събуждат.",
  },
  day_discussion: {
    title: "Дневно обсъждане",
    body: "Всички живи играчи спорят, блъфират и събират подозрения. Таймерът е само видимият ритъм; сървърът е източникът на истината.",
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
    body: "Сървърът прилага елиминацията, евентуално разкрива роля и проверява условията за победа.",
    wakes: "Никой не действа, освен ако не се задейства специална роля.",
  },
  hunter_revenge: {
    title: "Последен изстрел",
    body: "Ако Ловецът умре, той избира един жив играч за отмъщение.",
    wakes: "Буден е само Ловецът.",
  },
  mayor_successor: {
    title: "Наследник на Кмета",
    body: "Ако Кметът умре, Разказвачът или хостът избира наследник според настройките.",
    wakes: "Разказвачът/хостът управлява избора.",
  },
  paused: {
    title: "Пауза",
    body: "Фазата е спряна временно от Разказвача или хоста.",
    wakes: "Никой няма задължително действие.",
  },
  game_over: {
    title: "Край на играта",
    body: "Победителят е изчислен и историята може да се прегледа след края.",
    wakes: "Всички роли вече са приключили.",
  },
};

const MAFIA_PHASE_GUIDE_BG: Partial<Record<GamePhase, Partial<PhaseGuideCopy>>> = {
  role_reveal: {
    title: "Виж тайно досието си",
    body: "Всеки играч получава само своята карта като лично събитие. Не показвай телефона си, ако играете на живо.",
    wakes: "Всеки гледа само собствената си роля.",
  },
  first_night: {
    body: "Първият договор подрежда началните действия преди редовните нощни решения.",
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
    body: "Играчите защитават версии, притискат противоречия и събират подозрения. Таймерът е видимият ритъм; сървърът е източникът на истината.",
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
    body: "Всеки жив играч избира кого градът да елиминира. Сървърът валидира гласа и брои резултата.",
    wakes: "Всички живи играчи гласуват.",
  },
  resolution: {
    body: "Сървърът прилага присъдата, евентуално разкрива роля и проверява условията за победа.",
    wakes: "Никой не действа, освен ако не се задейства специална роля.",
  },
};

export function phaseGuideBg(phase: GamePhase, mode: GameMode): PhaseGuideCopy {
  const base = PHASE_GUIDE_BG[phase] ?? {
    title: phaseLabelBg(phase, mode),
    body: "Следвай указанията на екрана. Сървърът пази реда на фазите и валидира действията.",
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

export function roleWakeHint(role: RoleCode, phase: string, ownPlayer: PublicPlayer | undefined) {
  if (ownPlayer && ownPlayer.playing && !ownPlayer.alive) {
    return "Ти си елиминиран. Следи играта, но не влияеш на живите играчи.";
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
  if (phase === "hunter_revenge" && role === "hunter") {
    return "Ако си мъртъв Ловец, избери последния си изстрел.";
  }
  if (phase === "voting") {
    return "Гласувай според информацията и блъфовете от деня.";
  }
  return "Следвай публичната фаза и пази тайните си.";
}

export function nightActionHelpBg(role: RoleCode) {
  const labels: Partial<Record<RoleCode, string>> = {
    mafioso: "Координирайте се в тайния канал. Ако има равенство, сървърът няма да измисля произволна жертва.",
    don: "Можеш да помогнеш за убийството или да провериш дали някой е Комисарят.",
    werewolf: "Изберете жертва като фракция. Лечител, Вещица или благословия могат да спрат смъртта.",
    vampire: "Вампирите действат като отделна зла фракция и имат собствена жертва.",
    commissioner: "Проверката казва дали целта е от Мафията, не показва точната роля.",
    detective: "Разследването дава личен резултат според настройките на Мафия.",
    informant: "Доносникът вижда точна карта, освен ако някой не е прикрит.",
    roleblocker: "Избраният играч няма да може да изпълни нощното си действие.",
    lawyer: "Адвокатът прави целта да изглежда чиста пред разследващите.",
    medium: "Медиумът може да пита вече елиминиран играч каква е била ролята му.",
    seer: "Ясновидката вижда точната роля, но резултатът не е публичен.",
    oracle: "Оракулът проверява дали целта е Върколак или Вампир.",
    witch: "Лечението и отровата са еднократни. Ако ги изразходваш, после вече не са налични.",
    healer: "Лечителят не може да пази себе си и не може да пази един и същ играч две нощи поред.",
    doctor: "Докторът пази един играч от нощното убийство на Мафията.",
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
    public: "публичен чат",
    mafia: "чат на Мафията",
    werewolves: "чат на Върколаците",
    vampires: "чат на Вампирите",
    dead: "чат на мъртвите",
    system: "системен канал",
  };

  return labels[channel];
}

export function nightInstructionBg(role: RoleCode) {
  const labels: Partial<Record<RoleCode, string>> = {
    mafioso: "Мафията избира жертва",
    don: "Донът избира жертва или търси Комисаря",
    werewolf: "Върколаците избират жертва",
    vampire: "Вампирите избират жертва",
    commissioner: "Комисарят проверява подозрителен играч",
    detective: "Детективът разследва подозрителен играч",
    informant: "Доносникът отваря чуждо досие",
    roleblocker: "Блокиращият спира нощно действие",
    lawyer: "Адвокатът подготвя алиби",
    medium: "Медиумът говори с елиминиран играч",
    seer: "Ясновидката вижда тайна роля",
    oracle: "Оракулът проверява заплахата",
    witch: "Вещицата решава дали да лекува или отрови",
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

export function formatPrivateResult(result: PrivateResult, players: PublicPlayer[]) {
  if (result.messageBg) {
    return result.messageBg;
  }

  const targetName = players.find((player) => player.userId === result.targetUserId)?.displayName ?? "избрания играч";

  if (result.role) {
    return `${targetName} е ${ROLE_DEFINITIONS[result.role].nameBg}.`;
  }
  if (typeof result.isEvil === "boolean") {
    return result.isEvil ? `${targetName} е от злата страна.` : `${targetName} не е от злата страна.`;
  }
  if (typeof result.isCommissioner === "boolean") {
    return result.isCommissioner ? `${targetName} е Комисарят.` : `${targetName} не е Комисарят.`;
  }

  return `Получен е резултат за ${targetName}.`;
}

export function modeBg(mode: string) {
  return isKnownMode(mode) ? getGameModeNameBg(mode) : mode;
}

function isKnownMode(mode: string): mode is GameMode {
  return mode in GAME_MODE_DEFINITIONS;
}

export function narratorBg(mode: string) {
  const labels: Record<string, string> = {
    automatic: "Автоматичен",
    honest_human: "Честен човек",
    full_human: "Пълен човек",
  };

  return labels[mode] ?? mode;
}

export function communicationBg(mode: string) {
  const labels: Record<string, string> = {
    built_in_chat: "Вграден чат",
    no_chat: "Без чат",
    system_only: "Само системни",
    secret_channels: "Тайни канали",
  };

  return labels[mode] ?? mode;
}

export function tempoBg(mode: string) {
  const labels: Record<string, string> = {
    fast_online: "Бърза онлайн",
    normal_online: "Нормална онлайн",
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

export function winnerBg(winner: string) {
  const labels: Record<string, string> = {
    village: "Селото печели",
    werewolves: "Върколаците печелят",
    vampires: "Вампирите печелят",
    mafia: "Мафията печели",
    maniac: "Маниакът печели",
    lovers: "Влюбените печелят",
    draw: "Никой не печели",
  };

  return labels[winner] ?? winner;
}
