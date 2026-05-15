"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { getRulesForFamily, phaseLabelBg, type GameFamily, type GameMode, type GamePhase } from "@werewolf/shared";

interface PhaseRule {
  id: string;
  phase: GamePhase;
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
    phase: "lobby",
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
    phase: "role_reveal",
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
    phase: "night",
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
    phase: "day_discussion",
    title: "Ден",
    short: "спор",
    body: "Всички живи играчи обсъждат кой лъже. В режим без чат или на живо приложението става табло с фаза и таймер.",
    timer: "90-300 секунди",
    wakes: "Всички живи говорят.",
    example: "Разказвачът може да удължи времето, ако масата е в ключов спор.",
    watch: "Гласуването по-късно тежи повече от речите. Запомни кой кого пази.",
  },
  {
    id: "vote",
    phase: "voting",
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
    phase: "resolution",
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
    phase: "lobby",
    title: "Маса",
    short: "алибита",
    body: "Стаята избира свободна или спортна Мафия, брой играчи, таймери, чат и дали Докторът може да пази себе си.",
    timer: "без таймер",
    wakes: "Никой още не действа.",
    example: "Поканата е досие: кодът влиза директно в стаята след вход.",
    watch: "Уточни дали играете спортно или свободно, защото темпото променя разговорите.",
  },
  {
    id: "role",
    phase: "role_reveal",
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
    phase: "night",
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
    phase: "day_discussion",
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
    phase: "voting",
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
    phase: "resolution",
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
const PHASE_ICONS: Record<GamePhase, string> = {
  lobby: "lobby",
  role_reveal: "role_reveal",
  first_night: "night",
  night: "night",
  day_announcement: "day_discussion",
  day_discussion: "day_discussion",
  nomination: "voting",
  defense: "voting",
  voting: "voting",
  resolution: "resolution",
  hunter_revenge: "resolution",
  mayor_successor: "resolution",
  paused: "lobby",
  game_over: "resolution",
};

export function GameRulesPage({ family }: { family: GameFamily }) {
  const rules = getRulesForFamily(family);
  const phases = family === "mafia" ? MAFIA_PHASES : WEREWOLF_PHASES;
  const scenarios = family === "mafia" ? MAFIA_SCENARIOS : WEREWOLF_SCENARIOS;
  const isMafia = family === "mafia";
  const mode: GameMode = isMafia ? "mafia_free" : "werewolves_classic";

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

      <PhaseTimeline phases={phases} mode={mode} />

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

function PhaseTimeline({ phases, mode }: { phases: PhaseRule[]; mode: GameMode }) {
  const firstPhase = phases[0] ?? FALLBACK_PHASE;
  const [activePhaseId, setActivePhaseId] = useState(firstPhase.id);
  const activePhase = phases.find((phase) => phase.id === activePhaseId) ?? firstPhase;

  return (
    <section className="phase-timeline-section rules-phase-timeline" aria-labelledby="phase-timeline-title">
      <header className="rules-phase-intro phase-timeline-header">
        <p className="section-kicker">ход на играта</p>
        <h2 id="phase-timeline-title">Фазова карта</h2>
        <p>Натисни фаза, за да видиш кой действа, какъв таймер е подходящ и какво да следиш.</p>
      </header>

      <div className="phase-timeline" role="tablist" aria-label="Фази">
        <span className="phase-timeline__line" aria-hidden="true" />
        <span className="phase-timeline__line is-loop" aria-hidden="true" />
        {phases.map((phase, index) => (
          <PhaseNode
            key={phase.id}
            phase={phase}
            index={index}
            label={phaseLabelBg(phase.phase, mode)}
            selected={phase.id === activePhase.id}
            onSelect={() => setActivePhaseId(phase.id)}
          />
        ))}
        <PhaseLoopArrow />
      </div>

      <PhaseDetailPanel phase={activePhase} title={phaseLabelBg(activePhase.phase, mode)} />
    </section>
  );
}

function PhaseNode({
  phase,
  index,
  label,
  selected,
  onSelect,
}: {
  phase: PhaseRule;
  index: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-pressed={selected}
      aria-current={selected ? "step" : undefined}
      className={selected ? "phase-node is-selected" : "phase-node"}
      onClick={onSelect}
    >
      <span className="phase-node-number">{String(index + 1).padStart(2, "0")}</span>
      <span className={`phase-node-medallion phase-node-icon phase-${PHASE_ICONS[phase.phase]}`} aria-hidden="true" />
      <span className="phase-node-label">{label}</span>
      <span className="phase-node-short">{phase.short}</span>
    </button>
  );
}

function PhaseLoopArrow() {
  return (
    <div className="phase-loop-arrow" aria-hidden="true">
      <div className="phase-loop-bracket">
        <span className="phase-loop-bracket__top" />
        <span className="phase-loop-label">↻ ПОВТАРЯ СЕ</span>
      </div>
      <span className="phase-loop-mobile-marker">↻ ПОВТАРЯ СЕ</span>
    </div>
  );
}

function PhaseDetailPanel({ phase, title }: { phase: PhaseRule; title: string }) {
  return (
    <article className="phase-detail-panel" key={phase.id}>
      <div className="phase-detail-panel__lead">
        <p className="section-kicker">{phase.short}</p>
        <h3>{title}</h3>
        <p>{phase.body}</p>
      </div>
      <dl className="phase-info-grid">
        <InfoChip icon={<TimerIcon />} label="Таймер" value={phase.timer} />
        <InfoChip icon={<EyeIcon />} label="Кой се буди" value={phase.wakes} />
        <InfoChip icon={<BulbIcon />} label="Пример" value={phase.example} />
        <InfoChip icon={<TargetIcon />} label="Следи за" value={phase.watch} />
      </dl>
    </article>
  );
}

function InfoChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="phase-info-chip">
      <dt>
        <span className="phase-info-chip__icon">{icon}</span>
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="11" r="6.2" />
      <path d="M8 3h4M10 11V7.5M10 11l2.4 1.6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.5 10s2.7-4.6 7.5-4.6 7.5 4.6 7.5 4.6-2.7 4.6-7.5 4.6S2.5 10 2.5 10Z" />
      <circle cx="10" cy="10" r="2.1" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6.4 9.2a3.6 3.6 0 1 1 7.2 0c0 1.5-.8 2.4-1.7 3.2-.5.5-.8 1-.8 1.8H8.9c0-.8-.3-1.3-.8-1.8-.9-.8-1.7-1.7-1.7-3.2Z" />
      <path d="M8.7 16h2.6M8.9 14.2h2.2" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="3.3" />
      <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2" />
    </svg>
  );
}
