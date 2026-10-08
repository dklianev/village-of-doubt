import { ROLE_DEFINITIONS, getRoleShortDescriptionBg, teamLabelBg, type GameFamily, type RoleCode } from "@werewolf/shared";
export { formatPrivateResult } from "./private-result-copy";

const CITIZEN_GOAL_BG = "Елиминирайте Мафията и Маниака, ако участва";
const MAFIA_GOAL_BG = "Елиминирайте Маниака, ако участва, и поемете контрола над гласуването";
const VILLAGE_GOAL_BG = "Печелиш със селото след елиминиране на Върколаците и Вампирите";

export const ROLE_GUIDE_BG: Partial<Record<RoleCode, { summary: string; team: string; timing: string; win: string }>> = {
  civilian: {
    summary: "Нямаш нощно действие. Силата ти е в дневното обсъждане, логиката и гласа.",
    team: "Мирни граждани",
    timing: "Ден и гласуване",
    win: CITIZEN_GOAL_BG,
  },
  commissioner: {
    summary: "Всяка нощ проверяваш играч и разбираш дали е от Мафията. Резултатът е само за теб.",
    team: "Мирни граждани",
    timing: "Всяка нощ",
    win: CITIZEN_GOAL_BG,
  },
  mafioso: {
    summary: "Будиш се с Мафията и участваш в избора на нощна жертва.",
    team: "Мафия",
    timing: "Всяка нощ",
    win: MAFIA_GOAL_BG,
  },
  don: {
    summary: "Водиш Мафията. Можеш да участваш в убийството и отделно да търсиш Комисаря през същата нощ.",
    team: "Мафия",
    timing: "Всяка нощ",
    win: MAFIA_GOAL_BG,
  },
  ordinary_villager: {
    summary: "Нямаш нощно действие. Наблюдавай реакциите, пази логиката и гласувай внимателно.",
    team: "Село",
    timing: "Ден и гласуване",
    win: VILLAGE_GOAL_BG,
  },
  werewolf: {
    summary: "Будиш се с Върколаците и избирате една нощна жертва.",
    team: "Върколаци",
    timing: "Всяка нощ",
    win: "Елиминирайте Вампирите, ако участват, и поемете контрола над гласуването",
  },
  seer: {
    summary: "Всяка нощ проверяваш дали избран играч е Върколак или Вампир. Резултатът е само за теб.",
    team: "Село",
    timing: "Всяка нощ",
    win: VILLAGE_GOAL_BG,
  },
  witch: {
    summary: "Имаш една лечебна отвара и една отрова. Всяка може да се използва само веднъж.",
    team: "Село",
    timing: "Нощ, докато имаш отвара",
    win: VILLAGE_GOAL_BG,
  },
  healer: {
    summary: "Всяка нощ пазиш друг играч от нощна смърт. Не можеш да пазиш себе си или един и същ човек две нощи поред.",
    team: "Село",
    timing: "Всяка нощ",
    win: VILLAGE_GOAL_BG,
  },
  priest: {
    summary: "Веднъж благославяш играч. Благословията го пази от нощна смърт до края на играта и не се изчерпва при атака.",
    team: "Село",
    timing: "Една нощ в играта",
    win: VILLAGE_GOAL_BG,
  },
  hunter: {
    summary: "Ако умреш, получаваш последен изстрел и можеш да вземеш друг жив играч със себе си.",
    team: "Село",
    timing: "При смърт",
    win: VILLAGE_GOAL_BG,
  },
  cupid: {
    summary: "Първата нощ избираш двама Влюбени. Ако единият умре, другият умира от разбито сърце.",
    team: "Село",
    timing: "Само първата нощ",
    win: VILLAGE_GOAL_BG,
  },
  vampire: {
    summary: "Вампирите са отделна зла фракция. Будите се заедно и избирате нощна жертва.",
    team: "Вампири",
    timing: "Всяка нощ",
    win: "Елиминирайте Върколаците, ако участват, и поемете контрола над гласуването",
  },
  jester: {
    summary: "При елиминиране чрез дневен вот печелиш лично. Само ти научаваш веднага; останалите разбират на финала. Това не прекратява автоматично играта. При нощна смърт не печелиш.",
    team: "Самостоятелен",
    timing: "Ден и гласуване",
    win: "Бъди изгонен през гласуване",
  },
  little_girl: {
    summary: "Разширена роля за ръчно водени игри. Наднича, докато Върколаците са будни, но рискува да бъде разкрита.",
    team: "Село",
    timing: "Нощ, ръчно/разширено",
    win: VILLAGE_GOAL_BG,
  },
  thief: {
    summary: "Първата нощ крадеш карта веднъж. Ти ставаш откраднатата роля, а целта става Обикновен селянин.",
    team: "Променлив",
    timing: "Само първата нощ",
    win: "След кражбата следваш целта на новата си роля",
  },
};

export type RoleGuide = { summary: string; team: string; timing: string; win: string };

/** Curated guide copy for a role, with a generic fallback built from the shared definitions. */
export function roleGuideBg(role: RoleCode, family: GameFamily): RoleGuide {
  const definition = ROLE_DEFINITIONS[role];
  return ROLE_GUIDE_BG[role] ?? {
    summary: getRoleShortDescriptionBg(role),
    team: teamLabelBg(definition.team, family),
    timing: definition.nightAction ? "Нощна фаза" : "Ден и гласуване",
    win: "winConditionBg" in definition ? definition.winConditionBg : "Следвай целта на своя отбор",
  };
}
