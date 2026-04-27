import { ROLE_DEFINITIONS, PUBLIC_TITLES, type RoleCode } from "@werewolf/shared";

const ROLE_ORDER: RoleCode[] = [
  "ordinary_villager",
  "werewolf",
  "seer",
  "witch",
  "healer",
  "priest",
  "hunter",
  "cupid",
  "vampire",
  "jester",
  "little_girl",
  "thief",
  "civilian",
  "commissioner",
  "mafioso",
  "don",
];

const ROLE_ART_SLUGS: Record<RoleCode | "mayor", string> = {
  civilian: "civilian",
  commissioner: "commissioner",
  cupid: "cupid",
  don: "don",
  healer: "healer",
  hunter: "hunter",
  jester: "jester",
  little_girl: "little-girl",
  mafioso: "mafioso",
  mayor: "mayor",
  ordinary_villager: "ordinary-villager",
  priest: "priest",
  seer: "seer",
  thief: "thief",
  vampire: "vampire",
  werewolf: "werewolf",
  witch: "witch",
};

export default function RolesPage() {
  return (
    <main className="shell roles-shell">
      <section className="card role-codex-hero rounded-[2rem] p-7">
        <p className="section-kicker">книгата на ролите</p>
        <h1 className="mt-3 text-5xl font-black leading-none md:text-7xl">Кой се буди през нощта?</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#ead9ba]">
          Всички имена, отбори и действия са на български. Този екран е публичен справочник:
          тайните роли в реална игра пак се изпращат само лично от game server-а.
        </p>
      </section>

      <section className="role-codex-grid mt-6">
        {ROLE_ORDER.map((role) => {
          const definition = ROLE_DEFINITIONS[role];
          return (
            <article key={role} className={`role-codex-card role-${role}`}>
              <RoleArt slug={ROLE_ART_SLUGS[role]} />
              <div className="role-codex-copy">
                <p className="section-kicker text-[#842f2b]">{teamBg(definition.team)}</p>
                <h2>{definition.nameBg}</h2>
                <p>{roleSummaryBg(role)}</p>
                <div className="role-codex-tags">
                  <span>{definition.nightAction ? "Нощно действие" : "Без нощно действие"}</span>
                  {"advanced" in definition && definition.advanced ? <span>Advanced</span> : <span>MVP</span>}
                  <span>{definition.secret ? "Тайна карта" : "Публична роля"}</span>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="role-codex-card role-mayor mayor-codex-card mt-6">
        <RoleArt slug={ROLE_ART_SLUGS.mayor} />
        <div className="role-codex-copy">
          <p className="section-kicker text-[#842f2b]">публична титла</p>
          <h2>{PUBLIC_TITLES.mayor.nameBg}</h2>
          <p>{PUBLIC_TITLES.mayor.descriptionBg}</p>
          <div className="role-codex-tags">
            <span>Двоен глас</span>
            <span>Публичен избор</span>
            <span>Не е тайна карта</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function RoleArt({ slug }: { slug: string }) {
  return (
    <picture className="role-codex-art" aria-hidden="true">
      <source srcSet={`/game-art/role-${slug}.webp`} type="image/webp" />
      <img src={`/game-art/role-${slug}.png`} alt="" loading="lazy" />
    </picture>
  );
}

function teamBg(team: string) {
  const labels: Record<string, string> = {
    village: "Село",
    werewolves: "Върколаци",
    vampires: "Вампири",
    mafia: "Мафия",
    lovers: "Влюбени",
    neutral: "Самостоятелен",
  };

  return labels[team] ?? team;
}

function roleSummaryBg(role: RoleCode) {
  const summaries: Record<RoleCode, string> = {
    civilian: "Мирен гражданин за Мафия режимите. Няма нощно действие и печели чрез логика, реч и глас.",
    commissioner: "Проверява дали избран играч е от Мафията. Резултатът е личен и не се публикува.",
    mafioso: "Будиш се с Мафията и участваш в избора на нощна жертва.",
    don: "Води Мафията и може да търси Комисаря, за да защити фракцията си.",
    ordinary_villager: "Обикновен селянин без нощно действие. Силата му е в дневното обсъждане.",
    werewolf: "Будиш се с Върколаците и избираш жертва като фракция.",
    seer: "Вижда точната роля на избран играч. Информацията е силна, но опасна за разкриване.",
    witch: "Има една лечебна отвара и една отрова. Всяка се използва само веднъж.",
    healer: "Пази един играч от нощно убийство. Може да пази себе си и същия играч поредни нощи.",
    priest: "Дава една благословия, която остава до края и спира първото убийство срещу целта.",
    hunter: "При смърт получава последен изстрел и може да вземе един жив играч със себе си.",
    cupid: "Първата нощ избира двама Влюбени. Смъртта на единия повлича другия.",
    vampire: "Отделна зла фракция с нощна жертва. Подходяща за по-големи или advanced групи.",
    jester: "Самостоятелна роля, която иска да бъде изгонена чрез дневното гласуване.",
    little_girl: "Advanced ръчна роля. Наднича по време на събуждането на Върколаците, но рискува да бъде хваната.",
    thief: "Първата нощ краде карта веднъж, става новата роля, а целта става Обикновен селянин.",
  };

  return summaries[role];
}
