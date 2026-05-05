export interface AchievementDefinition {
  id: string;
  titleBg: string;
  descriptionBg: string;
  iconBg: string;
}

export interface AchievementEventLike {
  type: string;
  phase: string;
  payload: unknown;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first_blood",
    titleBg: "Първа кръв",
    descriptionBg: "В играта има елиминация през първата нощ.",
    iconBg: "кръв",
  },
  {
    id: "jester_win",
    titleBg: "Шут на вечерта",
    descriptionBg: "Шутът постига лична победа чрез дневно елиминиране.",
    iconBg: "маска",
  },
  {
    id: "guardian_save",
    titleBg: "Пазител в тъмното",
    descriptionBg: "Нощна смърт е спряна от защита, лечение или благословия.",
    iconBg: "щит",
  },
  {
    id: "hunter_revenge",
    titleBg: "Последен изстрел",
    descriptionBg: "Ловецът взема някого със себе си след смъртта.",
    iconBg: "куршум",
  },
  {
    id: "perfect_record",
    titleBg: "Протокол без празнини",
    descriptionBg: "Replay-ът има поне 20 записани събития.",
    iconBg: "архив",
  },
  {
    id: "maniac_endgame",
    titleBg: "Сам срещу града",
    descriptionBg: "Маниакът печели като последна реална заплаха.",
    iconBg: "нож",
  },
];

export function deriveAchievementsFromEvents(events: AchievementEventLike[]) {
  const unlocked = new Set<string>();

  if (events.some((event) => event.type === "death" && event.phase === "first_night")) {
    unlocked.add("first_blood");
  }
  if (events.some((event) => event.type === "jester_personal_win" || event.type === "personal_win")) {
    unlocked.add("jester_win");
  }
  if (
    events.some(
      (event) =>
        event.type === "night_death_prevented" ||
        event.type === "priest_blessing_protected" ||
        event.type === "guard_dog_protected_mayor",
    )
  ) {
    unlocked.add("guardian_save");
  }
  if (events.some((event) => event.type === "death" && JSON.stringify(event.payload).includes("Ловеца"))) {
    unlocked.add("hunter_revenge");
  }
  if (events.length >= 20) {
    unlocked.add("perfect_record");
  }
  if (events.some((event) => JSON.stringify(event.payload).includes("maniac") || JSON.stringify(event.payload).includes("Маниак"))) {
    unlocked.add("maniac_endgame");
  }

  return ACHIEVEMENTS.filter((achievement) => unlocked.has(achievement.id));
}
