import { getGameFamily, phaseLabelBg, type GameMode, type GamePhase, type RoleCode } from "@werewolf/shared";
import { canFactionKill, isNightPhase } from "./role-rules";
import type { PublicPlayer } from "./types";

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
    body: "Номинации през приложението се подават само в Спортна Мафия, по време на дневните речи.",
    wakes: "В тази фаза не се подават номинации.",
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
    wakes: "Градът се събужда.",
  },
  day_discussion: {
    body: "Играчите защитават версии, притискат противоречия и събират подозрения. Таймерът пази ритъма на разговора.",
  },
  nomination: {
    title: "Обвинения",
  },
  defense: {
    title: "Последна защита",
    body: "Номинираните получават време да защитят версията си преди присъдата.",
  },
  voting: {
    body: "Всеки жив играч избира кого градът да елиминира. След последния глас резултатът се преброява.",
  },
};

const SPORT_PHASE_GUIDE_BG: Partial<Record<GamePhase, Partial<PhaseGuideCopy>>> = {
  day_discussion: {
    title: "Дневни речи",
    body: "Живите играчи говорят по ред. Само текущият говорител може да номинира друг жив играч или да смени номинацията си.",
    wakes: "Говори и номинира само текущият говорител.",
  },
  nomination: {
    title: "Преглед на номинациите",
    body: "Номинациите от дневните речи са приключили. Следват защитите; без номинирани денят завършва без гласуване.",
  },
  voting: {
    body: "Всеки жив играч гласува сред номинираните. При прегласуване изборът е само между останалите кандидати.",
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

  return {
    ...base,
    title: phaseLabelBg(phase, mode),
    ...MAFIA_PHASE_GUIDE_BG[phase],
    ...(mode === "mafia_sport" ? SPORT_PHASE_GUIDE_BG[phase] : undefined),
  };
}

export function roleWakeHint(role: RoleCode | undefined, phase: string, ownPlayer: PublicPlayer | undefined) {
  if (ownPlayer?.narrator) {
    return "Ти си Разказвачът. Води фазите и пази тайните на играчите.";
  }
  if (ownPlayer && !ownPlayer.playing) {
    return "Ти наблюдаваш играта. Не участваш в действията и гласуването.";
  }
  if (ownPlayer && !ownPlayer.alive) {
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
