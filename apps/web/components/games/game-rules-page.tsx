"use client";

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
  },
  {
    id: "role",
    title: "Разкриване на роли",
    short: "тайна карта",
    body: "Всеки играч вижда само собствената си карта. Това е личен момент, особено при игра на живо с телефони на една маса.",
    timer: "15-30 секунди",
    wakes: "Всеки гледа само своя телефон.",
    example: "Ако си Лечител, виждаш само Лечител. Не виждаш кои са Върколаците.",
  },
  {
    id: "night",
    title: "Нощ",
    short: "събуждания",
    body: "Ролите действат в фиксиран ред. Фракциите избират жертва, защитните роли пазят, а разследващите получават личен резултат.",
    timer: "30-90 секунди",
    wakes: "Купидон, Свещеник, Върколаци, Вампири, Гадателка, Оракул, Вещица, Лечител и други активни роли.",
    example: "Вампирската жертва не пада веднага: смъртта се случва в края на следващия ден.",
  },
  {
    id: "day",
    title: "Ден",
    short: "спор",
    body: "Всички живи играчи обсъждат кой лъже. В no-chat или live режим приложението става табло с фаза и таймер.",
    timer: "90-300 секунди",
    wakes: "Всички живи говорят.",
    example: "Разказвачът може да удължи времето, ако масата е в ключов спор.",
  },
  {
    id: "vote",
    title: "Гласуване",
    short: "решение",
    body: "Всеки жив играч гласува. Кметът не е постоянен двоен глас: той решава само при равенство според PDF логиката.",
    timer: "30-90 секунди",
    wakes: "Всички живи гласуват.",
    example: "При равни гласове, ако Кметът е гласувал за един от вързаните кандидати, неговият избор решава.",
  },
  {
    id: "resolution",
    title: "Развръзка",
    short: "смърт и победа",
    body: "Сървърът прилага смъртите, проверява Ловец, наследяване на Кмет, Влюбени и условия за победа.",
    timer: "10-20 секунди",
    wakes: "Само роли със задействан ефект, например Ловец.",
    example: "Ако Ловецът умре, играта спира за последния му изстрел.",
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
  },
  {
    id: "role",
    title: "Досие",
    short: "тайна карта",
    body: "Всеки играч получава собствено досие. Мафията знае своята фракция, но Градът трябва да работи през разговор.",
    timer: "15-30 секунди",
    wakes: "Всеки гледа само собствената си роля.",
    example: "Комисарят вижда само своята проверка, не чуждите карти.",
  },
  {
    id: "night",
    title: "Нощни договорки",
    short: "сделка",
    body: "Мафията избира жертва, Донът може да търси Комисаря, Комисарят проверява, Докторът пази.",
    timer: "30-60 секунди",
    wakes: "Мафия, Дон, Комисар, Доктор и включени разширени роли.",
    example: "Ако Докторът пази жертвата на Мафията, сутринта няма смърт.",
  },
  {
    id: "day",
    title: "Градът говори",
    short: "разпит",
    body: "Денят е за версии, противоречия и натиск. В спортния формат речите са по-строги, в свободния формат масата води темпото.",
    timer: "90-180 секунди",
    wakes: "Всички живи говорят.",
    example: "Добър гражданин не доказва, че е добър; той намира кой сменя историята си.",
  },
  {
    id: "vote",
    title: "Обвинение",
    short: "глас",
    body: "Гласуването елиминира един играч или оставя града без присъда според правилата на стаята.",
    timer: "15-60 секунди",
    wakes: "Всички живи гласуват.",
    example: "Мафиотът често гласува рано, за да изглежда решителен. Това също е следа.",
  },
  {
    id: "resolution",
    title: "Присъда",
    short: "последствие",
    body: "Сървърът прилага елиминацията, разкриването при смърт и проверява дали Градът или Мафията печели.",
    timer: "10-20 секунди",
    wakes: "Никой не действа, освен ако роля не го изисква.",
    example: "Ако Мафията достигне контрол над гласуването, играта приключва.",
  },
];

const FALLBACK_PHASE = WEREWOLF_PHASES[0] as PhaseRule;

export function GameRulesPage({ family }: { family: GameFamily }) {
  const rules = getRulesForFamily(family);
  const phases = family === "mafia" ? MAFIA_PHASES : WEREWOLF_PHASES;
  const firstPhase = phases[0] ?? FALLBACK_PHASE;
  const [activePhaseId, setActivePhaseId] = useState(firstPhase.id);
  const activePhase = phases.find((phase) => phase.id === activePhaseId) ?? firstPhase;

  return (
    <main className="shell rules-shell" data-theme={family} data-family={family}>
      <section className="card role-codex-hero rounded-[2rem] p-7">
        <p className="section-kicker">{family === "mafia" ? "как се играе" : "правила от голямата кутия"}</p>
        <h1 className="mt-3 text-5xl font-black leading-none md:text-7xl">{rules.titleBg}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#ead9ba]">{rules.introBg}</p>
      </section>

      <section className="rules-phase-lab mt-6 rounded-[2rem] p-6">
        <div>
          <p className="section-kicker">ход на играта</p>
          <h2 className="mt-2 text-4xl font-black">Фазово колело</h2>
          <p className="mt-3 max-w-2xl text-[#ead9ba]">
            Натисни фаза, за да видиш кой действа, какъв таймер е подходящ и какво се случва при no-chat или игра на живо.
          </p>
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
        <article className="phase-detail-card">
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
          </dl>
        </article>
      </section>

      <section className="rules-table-mode mt-6 rounded-[2rem] p-6">
        <div>
          <p className="section-kicker">игра на живо и без чат</p>
          <h2 className="mt-2 text-3xl font-black">Телефонът е табло, не високоговорител</h2>
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

      <section className="mt-6 grid gap-5">
        {rules.sections.map((section) => (
          <article key={section.titleBg} className="paper-card rounded-[2rem] p-7">
            <h2 className="text-3xl font-black">{section.titleBg}</h2>
            <p className="mt-4 text-lg leading-8">{section.bodyBg}</p>
            {section.bulletsBg ? (
              <ul className="mt-5 grid gap-3">
                {section.bulletsBg.map((item) => (
                  <li key={item} className="flex gap-3 rounded-2xl bg-white/30 p-4 font-bold">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#842f2b]" />
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
