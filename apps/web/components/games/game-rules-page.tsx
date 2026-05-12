"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { getRulesForFamily, type GameFamily } from "@werewolf/shared";

interface PhaseRule {
  id: string;
  title: string;
  short: string;
  body: string;
  timer: string;
  wakes: string;
  example: string;
  watch: string;
}

interface ScenarioCard {
  title: string;
  setup: string;
  result: string;
}

const WEREWOLF_PHASES: PhaseRule[] = [
  {
    id: "lobby",
    title: "Лоби",
    short: "събиране",
    body: "Водещият избира роли, таймери, Разказвач и дали разговорът ще е вграден, на живо или извън приложението.",
    timer: "без таймер",
    wakes: "Никой още не се буди.",
    example: "Преди старт всички виждат разпределението, но не и кой коя роля ще получи.",
    watch: "Провери дали броят роли съвпада с броя играчи и дали режимът е ясен за масата.",
  },
  {
    id: "role",
    title: "Разкриване на роли",
    short: "тайна карта",
    body: "Всеки играч вижда само собствената си карта. Това е личен момент, особено при игра на живо с телефони на една маса.",
    timer: "15-30 секунди",
    wakes: "Всеки гледа само своя телефон.",
    example: "Ако си Лечител, виждаш само Лечител. Не виждаш кои са Върколаците.",
    watch: "Никой не трябва да показва екрана си. Това е моментът за тишина.",
  },
  {
    id: "night",
    title: "Нощ",
    short: "събуждания",
    body: "Ролите действат в фиксиран ред. Фракциите избират жертва, защитните роли пазят, а разследващите получават личен резултат.",
    timer: "30-90 секунди",
    wakes: "Купидон, Свещеник, Върколаци, Вампири, Гадателка, Оракул, Вещица, Лечител и други активни роли.",
    example: "Вампирската жертва не пада веднага: смъртта се случва в края на следващия ден.",
    watch: "Следи личните резултати и не издавай роля само защото някой е действал бързо.",
  },
  {
    id: "day",
    title: "Ден",
    short: "спор",
    body: "Всички живи играчи обсъждат кой лъже. В no-chat или live режим приложението става табло с фаза и таймер.",
    timer: "90-300 секунди",
    wakes: "Всички живи говорят.",
    example: "Разказвачът може да удължи времето, ако масата е в ключов спор.",
    watch: "Гласуването по-късно тежи повече от речите. Запомни кой кого пази.",
  },
  {
    id: "vote",
    title: "Гласуване",
    short: "решение",
    body: "Всеки жив играч гласува. Кметът не е постоянен двоен глас: неговият избор натежава само при равенство.",
    timer: "30-90 секунди",
    wakes: "Всички живи гласуват.",
    example: "При равни гласове, ако Кметът е гласувал за един от вързаните кандидати, неговият избор решава.",
    watch: "Равенството не е случайност, ако едни и същи играчи го правят два дни поред.",
  },
  {
    id: "resolution",
    title: "Развръзка",
    short: "смърт и победа",
    body: "Сървърът прилага смъртите, проверява Ловец, наследяване на Кмет, Влюбени и условия за победа.",
    timer: "10-20 секунди",
    wakes: "Само роли със задействан ефект, например Ловец.",
    example: "Ако Ловецът умре, играта спира за последния му изстрел.",
    watch: "Изчакай сървърът да приключи всички ефекти преди следващия спор.",
  },
];

const MAFIA_PHASES: PhaseRule[] = [
  {
    id: "lobby",
    title: "Маса",
    short: "алибита",
    body: "Стаята избира свободна или спортна Мафия, брой играчи, таймери, чат и дали Докторът може да пази себе си.",
    timer: "без таймер",
    wakes: "Никой още не действа.",
    example: "Поканата е досие: кодът влиза директно в стаята без регистрация.",
    watch: "Уточни дали играете спортно или свободно, защото темпото променя разговорите.",
  },
  {
    id: "role",
    title: "Досие",
    short: "тайна карта",
    body: "Всеки играч получава собствено досие. Мафията знае своята фракция, но Градът трябва да работи през разговор.",
    timer: "15-30 секунди",
    wakes: "Всеки гледа само собствената си роля.",
    example: "Комисарят вижда само своята проверка, не чуждите карти.",
    watch: "Мафията трябва да знае своята фракция, но не и целия град.",
  },
  {
    id: "night",
    title: "Нощни договорки",
    short: "сделка",
    body: "Мафията избира жертва, Донът може да търси Комисаря, Комисарят проверява, Докторът пази.",
    timer: "30-60 секунди",
    wakes: "Мафия, Дон, Комисар, Доктор и включени разширени роли.",
    example: "Ако Докторът пази жертвата на Мафията, сутринта няма смърт.",
    watch: "Липсата на смърт е следа, но не е доказателство за конкретен играч.",
  },
  {
    id: "day",
    title: "Градът говори",
    short: "разпит",
    body: "Денят е за версии, противоречия и натиск. В спортния формат речите са по-строги, в свободния формат масата води темпото.",
    timer: "90-180 секунди",
    wakes: "Всички живи говорят.",
    example: "Добър гражданин не доказва, че е добър; той намира кой сменя историята си.",
    watch: "Следи кой прави обвинение лесно и кой сменя версията си след натиск.",
  },
  {
    id: "vote",
    title: "Обвинение",
    short: "глас",
    body: "Гласуването елиминира един играч или оставя града без присъда според правилата на стаята.",
    timer: "15-60 секунди",
    wakes: "Всички живи гласуват.",
    example: "Мафиотът често гласува рано, за да изглежда решителен. Това също е следа.",
    watch: "Важна е не само елиминацията, а кой я направи възможна.",
  },
  {
    id: "resolution",
    title: "Присъда",
    short: "последствие",
    body: "Сървърът прилага елиминацията, разкриването при смърт и проверява дали Градът или Мафията печели.",
    timer: "10-20 секунди",
    wakes: "Никой не действа, освен ако роля не го изисква.",
    example: "Ако Мафията достигне контрол над гласуването, играта приключва.",
    watch: "Изчакай победното условие да се изчисли, преди масата да започне нов спор.",
  },
];

const WEREWOLF_SCENARIOS: ScenarioCard[] = [
  {
    title: "Няма смърт сутрин",
    setup: "Защитна роля може да е спасила жертвата или заплахата може да е била блокирана от ефект.",
    result: "Не доказвай автоматично никого. Питай кой печели от тази тишина.",
  },
  {
    title: "Равен вот",
    setup: "Кметът решава само ако е гласувал за един от вързаните кандидати.",
    result: "Търси кой е държал гласа си до края и кой е направил равенството удобно.",
  },
  {
    title: "Вампирска жертва",
    setup: "Вампирската смърт идва със закъснение, не веднага през нощта.",
    result: "Дневното поведение преди смъртта може да е последната полезна следа.",
  },
];

const MAFIA_SCENARIOS: ScenarioCard[] = [
  {
    title: "Докторът спасява",
    setup: "Ако Докторът пази правилния човек, сутринта може да няма жертва.",
    result: "Градът получава време, но Мафията получава информация кой е важен.",
  },
  {
    title: "Комисарят има резултат",
    setup: "Проверката е силна само ако Комисарят оцелее или успее да я подаде убедително.",
    result: "Търси меко насочване, не само директни разкрития.",
  },
  {
    title: "Мафията контролира вота",
    setup: "Когато Мафията стане достатъчно силна, дневният вот вече не е неутрален инструмент.",
    result: "Градът трябва да разпознае блока преди последния ден.",
  },
];

const FALLBACK_PHASE = WEREWOLF_PHASES[0] as PhaseRule;

export function GameRulesPage({ family }: { family: GameFamily }) {
  const rules = getRulesForFamily(family);
  const phases = family === "mafia" ? MAFIA_PHASES : WEREWOLF_PHASES;
  const scenarios = family === "mafia" ? MAFIA_SCENARIOS : WEREWOLF_SCENARIOS;
  const isMafia = family === "mafia";
  const firstPhase = phases[0] ?? FALLBACK_PHASE;
  const [activePhaseId, setActivePhaseId] = useState(firstPhase.id);
  const activePhase = phases.find((phase) => phase.id === activePhaseId) ?? firstPhase;

  return (
    <main className="shell rules-shell" data-theme={family} data-family={family}>
      <section className="rules-playbook-hero">
        <div>
          <p className="section-kicker">как се играе</p>
          <h1>{rules.titleBg}</h1>
          <p>{rules.introBg}</p>
          <div className="rules-hero-actions">
            <Link className="btn btn-primary" href={isMafia ? "/mafia/create" : "/werewolf/create"}>
              Създай игра
            </Link>
            <Link className="rules-ghost-link" href={isMafia ? "/werewolf/rules" : "/mafia/rules"}>
              {isMafia ? "Правила за Върколак" : "Правила за Мафия"}
            </Link>
            <Link className="rules-ghost-link" href={isMafia ? "/mafia/roles" : "/werewolf/roles"}>
              Виж ролите
            </Link>
          </div>
        </div>
        <aside className="rules-hero-stat" aria-label="Брой фази">
          <strong>{phases.length}</strong>
          <span>фази в играта</span>
        </aside>
      </section>

      <section className="rules-phase-lab rules-phase-timeline">
        <div className="rules-phase-intro">
          <p className="section-kicker">ход на играта</p>
          <h2>Фазова карта</h2>
          <p>Натисни фаза, за да видиш кой действа, какъв таймер е подходящ и какво трябва да следиш.</p>
        </div>
        <div className="phase-wheel" role="tablist" aria-label="Фази">
          {phases.map((phase, index) => (
            <button
              key={phase.id}
              type="button"
              role="tab"
              aria-selected={phase.id === activePhase.id}
              className={phase.id === activePhase.id ? "is-active" : ""}
              style={{ "--step": index } as CSSProperties}
              onClick={() => setActivePhaseId(phase.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{phase.title}</strong>
              <small>{phase.short}</small>
            </button>
          ))}
        </div>
        <article className="phase-detail-card rules-phase-detail">
          <p className="section-kicker">{activePhase.short}</p>
          <h3>{activePhase.title}</h3>
          <p>{activePhase.body}</p>
          <dl>
            <div>
              <dt>Таймер</dt>
              <dd>{activePhase.timer}</dd>
            </div>
            <div>
              <dt>Кой се буди</dt>
              <dd>{activePhase.wakes}</dd>
            </div>
            <div>
              <dt>Пример</dt>
              <dd>{activePhase.example}</dd>
            </div>
            <div>
              <dt>Следи за</dt>
              <dd>{activePhase.watch}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="rules-table-mode rules-table-protocol">
        <div>
          <p className="section-kicker">игра на живо и без чат</p>
          <h2>Телефонът е табло, не високоговорител</h2>
        </div>
        <div className="rules-table-grid">
          <article>
            <strong>На живо</strong>
            <span>Личните звуци и вибрации са изключени по подразбиране, за да не издават кой е буден.</span>
          </article>
          <article>
            <strong>Без чат</strong>
            <span>Приложението пази фазите, таймерите и тайните действия; разговорът може да е около масата.</span>
          </article>
          <article>
            <strong>Разказвач</strong>
            <span>Честният Разказвач води темпото без тайни роли. Пълният Разказвач вижда тайните само след ясно предупреждение.</span>
          </article>
        </div>
      </section>

      <section className="rules-scenario-section">
        <div>
          <p className="section-kicker">сценарии на масата</p>
          <h2>Какво означава, когато...</h2>
        </div>
        <div className="rules-scenario-grid">
          {scenarios.map((scenario) => (
            <article key={scenario.title}>
              <strong>{scenario.title}</strong>
              <p>{scenario.setup}</p>
              <span>{scenario.result}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="rules-chapter-grid" aria-label="Основни правила">
        {rules.sections.map((section) => (
          <article key={section.titleBg} className="rules-chapter-card">
            <h2>{section.titleBg}</h2>
            <p>{section.bodyBg}</p>
            {section.bulletsBg ? (
              <ul>
                {section.bulletsBg.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
