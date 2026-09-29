import Link from "next/link";
import { preload } from "react-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import "@/components/games/GameRulesPage.module.css";
import { getRulesForFamily, type GameFamily, type GameMode } from "@werewolf/shared";
import {
  GameRulesContents,
  GameRulesPhaseTimeline,
  type GameRulesPhase as PhaseRule,
} from "@/components/games/GameRulesPhaseTimeline";

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
    body: "Водещият избира роли, таймери, Разказвач и дали разговорът ще е вграден, на живо или извън приложението.",
    action: "Присъедини се с кода или поканата, провери състава на стаята и отбележи, че си готов.",
    timer: "без таймер",
    wakes: "Никой още не се буди.",
    example: "Преди началото всички виждат разпределението, но не и кой коя роля ще получи.",
  },
  {
    id: "role",
    phase: "role_reveal",
    title: "Разкриване на роля",
    body: "Всеки играч вижда само собствената си карта. Това е личен момент, особено при игра на живо с телефони на една маса.",
    action: "Прочети ролята, отбора и способността си. Скрий картата, преди да оставиш телефона.",
    timer: "15-30 секунди",
    wakes: "Всеки гледа само своя телефон.",
    example: "Ако си Лечител, виждаш само Лечител. Не виждаш кои са Върколаците.",
  },
  {
    id: "night",
    phase: "night",
    title: "Нощ",
    body: "Ролите действат по установен ред. Нощните заплахи избират жертва, защитните роли пазят, а разследващите получават личен резултат.",
    action: "Ако имаш нощно действие, избери допустима цел и го изпрати. Изчакай потвърждението. Ако си Селянин, изчакай деня.",
    timer: "30-90 секунди",
    wakes: "Върколаците и включените роли с нощно действие. Всеки вижда само разрешените за него избори.",
    example: "Лечителят пази един играч. Ако той е нападнат от Върколаците, защитата може да го спаси.",
  },
  {
    id: "day",
    phase: "day_discussion",
    title: "Дневно обсъждане",
    body: "След новините от нощта всички живи обсъждат кой лъже. После започва директно гласуване, без отделни номинации и защити.",
    action: "Прочети какво се е случило през нощта, изслушай останалите и обясни подозрението си. Не показвай тайния си екран.",
    timer: "90-300 секунди",
    wakes: "Всички живи говорят.",
    example: "Няма жертва сутринта. Това е следа, но само по себе си не доказва нечия роля.",
  },
  {
    id: "vote",
    phase: "voting",
    title: "Гласуване",
    body: "Живите играчи избират кого да елиминират. При обикновено мнозинство водещият по гласове отпада; при абсолютно са нужни гласовете на повече от половината живи.",
    action: "Избери жив играч и изпрати гласа си. Изчакай потвърждението. Можеш да пропуснеш само ако стаята го позволява.",
    timer: "30-90 секунди",
    wakes: "Всички живи гласуват.",
    example: "При равенство следва прегласуване само между равните или ден без елиминация според настройката. Кметът, ако е включен, може да реши равенството.",
  },
  {
    id: "resolution",
    phase: "resolution",
    title: "Развръзка",
    body: "Приключва дневният вот. Играта прилага елиминациите и евентуалните последни действия на включените роли, после проверява кой печели.",
    action: "Прочети резултата от вота. Ако получиш лично последно действие, изпълни го; иначе изчакай края или следващата нощ.",
    timer: "10-20 секунди",
    wakes: "Само роли със задействан ефект, например Ловец.",
    example: "Ако Ловецът умре, играта спира за последния му изстрел.",
  },
];

const MAFIA_PHASES: PhaseRule[] = [
  {
    id: "lobby",
    phase: "lobby",
    title: "Лоби",
    body: "Свободната Мафия допуска 4-24 играчи и роли по избор. Домакинът определя състава, таймерите и начина на разговор.",
    action: "Присъедини се с кода или поканата, провери правилата на стаята и отбележи, че си готов.",
    timer: "без таймер",
    wakes: "Никой още не действа.",
    example: "Домакинът споделя код или покана. Играчите влизат в профилите си и се присъединяват.",
  },
  {
    id: "role",
    phase: "role_reveal",
    title: "Разкриване на роля",
    body: "Всеки играч получава тайна роля. Членовете на Мафията познават съотборниците си; Градът трябва да ги разкрие.",
    action: "Прочети тайно ролята и целта си, после скрий картата. Не показвай личната информация на масата.",
    timer: "15-30 секунди",
    wakes: "Всеки гледа само собствената си роля.",
    example: "Комисарят вижда само своята проверка, не чуждите карти.",
  },
  {
    id: "night",
    phase: "night",
    title: "Нощ",
    body: "Мафията избира жертва, Комисарят проверява, а Докторът пази, ако е включен. Първата нощ може да е без убийство според настройките.",
    action: "Ако ролята ти има действие, избери цел, изпрати избора и изчакай потвърждението. Като Мирен гражданин изчакай деня.",
    timer: "30-60 секунди",
    wakes: "Мафията, Комисарят и другите включени роли с нощно действие.",
    example: "Докторът може да спаси жертвата на Мафията. Това не изключва смърт от друга включена заплаха.",
  },
  {
    id: "day",
    phase: "day_discussion",
    title: "Дневно обсъждане",
    body: "След новините от нощта има общ разговор с един таймер. След него започва директно гласуване, без отделни номинации и защити.",
    action: "Изслушай версиите, задай въпрос и обясни кого подозираш. Сравни думите с предишните гласове.",
    timer: "90-180 секунди",
    wakes: "Всички живи говорят.",
    example: "Сравни какво е казал един играч сутринта с версията му преди гласуването.",
  },
  {
    id: "vote",
    phase: "voting",
    title: "Гласуване",
    body: "При обикновено мнозинство водещият по гласове отпада; при абсолютно са нужни гласовете на повече от половината живи. Равенството се решава според настройката.",
    action: "Избери жив играч и изпрати гласа си. Изчакай потвърждението. Пропускането е възможно само ако е позволено в стаята.",
    timer: "15-60 секунди",
    wakes: "Всички живи гласуват.",
    example: "При прегласуване можеш да избереш само играч от равенството.",
  },
  {
    id: "resolution",
    phase: "resolution",
    title: "Развръзка",
    body: "Резултатът от вота се изпълнява, ролята се разкрива според настройките и се проверяват условията за победа.",
    action: "Прочети резултата. Ако си елиминиран, не подсказвай на живите. Ако няма победител, изчакай следващата нощ.",
    timer: "10-20 секунди",
    wakes: "Никой не действа, освен ако роля не го изисква.",
    example: "Двама мафиоти срещу двама граждани печелят. Жива друга смъртоносна страна би отложила победата.",
  },
];

const MAFIA_SPORT_PHASES: PhaseRule[] = MAFIA_PHASES.flatMap((phase): PhaseRule[] => {
  switch (phase.id) {
    case "lobby":
      return [{ ...phase, body: "Стандартният спортен състав е 10 играчи: 6 Мирни граждани, 1 Комисар, 2 Мафиоти и 1 Кръстник. Речите и защитите са по ред, с отделен таймер." }];
    case "night":
      return [{ ...phase,
        body: "Мафията избира жертва, Комисарят проверява, а Кръстникът търси Комисаря. В стандартния спортен състав няма Доктор.",
        timer: "20-30 секунди",
        wakes: "Мафията, Кръстникът и Комисарят.",
        example: "Резултатът от проверката на Комисаря е личен. Не се показва на целия Град.",
      }];
    case "day":
      return [{ ...phase,
        title: "Дневни речи",
        body: "Всеки жив играч получава собствена реч. Само текущият говорител може да номинира друг жив играч и да смени своята номинация, докато има думата.",
        action: "Изчакай реда си. По време на своята реч изложи версията си и, ако желаеш, номинирай друг жив играч.",
        timer: "60 секунди на играч",
        wakes: "Само текущият говорител; останалите слушат.",
        example: "Можеш да смениш номинацията си по време на речта. Остава последният потвърден избор.",
      }, {
        id: "nomination", phase: "nomination", title: "Номинации",
        body: "След последната реч се обобщават вече направените номинации. Тук не се подават нови. Ако няма номинирани, денят приключва без защити и гласуване.",
        action: "Провери кои играчи са номинирани и изчакай защитите им.",
        timer: "според стаята", wakes: "Никой не прави нов избор.",
        example: "Без нито една номинация играта преминава направо към развръзката.",
      }, {
        id: "defense", phase: "defense", title: "Защита",
        body: "Номинираните говорят един по един със собствен таймер. След последната защита се отваря гласуването.",
        action: "Ако си номиниран, защити се, когато дойде редът ти. Иначе изслушай защитите и обмисли гласа си.",
        timer: "60 секунди на номиниран", wakes: "Само номинираният, който е на ред.",
        example: "Двама номинирани получават две отделни защити, преди някой да гласува.",
      }];
    case "vote":
      return [{ ...phase,
        action: "Избери един от номинираните живи играчи и изпрати гласа си. Изчакай потвърждението. В спортния формат няма пропускане на вот.",
        example: "Не можеш да гласуваш за неноминиран играч. При прегласуване изборът се стеснява до равните кандидати.",
      }];
    default:
      return [phase];
  }
});

const WEREWOLF_SCENARIOS: ScenarioCard[] = [
  {
    title: "Няма смърт сутрин",
    setup: "Защитна роля може да е спасила жертвата или заплахата може да е била блокирана от ефект.",
    result: "Липсата на жертва не доказва нечия роля. Сравни я с останалите следи.",
  },
  {
    title: "Равен вот",
    setup: "Кметът решава само ако е гласувал за един от кандидатите с равен резултат.",
    result: "Търси кой е държал гласа си до края и кой е направил равенството удобно.",
  },
  {
    title: "Две заплахи още са живи",
    setup: "На масата са двама Върколаци, един Вампир и един Селянин.",
    result: "Върколаците са половината живи, но не печелят: Вампирът е съперничеща смъртоносна страна.",
  },
];

const MAFIA_SCENARIOS: ScenarioCard[] = [
  {
    title: "Докторът спасява",
    setup: "Ако Докторът пази правилния човек, сутринта може да няма жертва.",
    result: "Липсата на жертва не доказва кой е Докторът или кого е пазил.",
  },
  {
    title: "Комисарят има резултат",
    setup: "Проверката е силна само ако Комисарят оцелее или успее да я подаде убедително.",
    result: "Търси меко насочване, не само директни разкрития.",
  },
  {
    title: "Маниакът още е жив",
    setup: "На масата са двама мафиоти, един Маниак и един Мирен гражданин.",
    result: "Мафията е половината живи, но не печели, докато Маниакът е жив. Ако цялата Мафия отпадне, Градът също трябва да елиминира Маниака.",
  },
];

export function GameRulesPage({ family }: { family: GameFamily }) {
  preloadRulesHero(family);
  const rules = getRulesForFamily(family);
  const phases = family === "mafia" ? MAFIA_PHASES : WEREWOLF_PHASES;
  const scenarios = family === "mafia" ? MAFIA_SCENARIOS : WEREWOLF_SCENARIOS;
  const isMafia = family === "mafia";
  const mode: GameMode = isMafia ? "mafia_free" : "werewolves_classic";
  const [objective, basics, ...chapters] = rules.sections;
  const familyPath = isMafia ? "mafia" : "werewolf";

  return (
    <main className="shell rules-shell" data-faction={family} data-family={family}>
      <section className="rules-playbook-hero">
        <div className="rules-hero-art" aria-hidden="true" />
        <div>
          <p className="section-kicker">Преди първата вечер</p>
          <h1>{rules.titleBg}</h1>
          <p>{rules.introBg}</p>
          <div className="rules-hero-actions">
            <Link className="btn btn-primary" href={`/${familyPath}/create`} prefetch={false}>
              Създай стая <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="rules-ghost-link" href={`/tutorial?game=${mode}&redirect=%2F${familyPath}%2Fcreate`} prefetch={false}>
              <BookOpen size={17} aria-hidden="true" /> Кратък наръчник
            </Link>
          </div>
        </div>
      </section>

      <GameRulesContents familyPath={familyPath} />

      <section id="rules-objective" className="rules-objective" aria-labelledby="rules-objective-title">
        <header>
          <p className="section-kicker">Кой печели</p>
          <h2 id="rules-objective-title">{objective.titleBg}</h2>
          <p>{objective.bodyBg}</p>
        </header>
        <ul>
          {objective.bulletsBg?.map((item, index) => (
            <li key={item}><span className="rules-rule-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></li>
          ))}
        </ul>
      </section>

      <section id="rules-basics" className="rules-basics" aria-labelledby="rules-basics-title">
        <header><p className="section-kicker">Основни правила</p><h2 id="rules-basics-title">{basics.titleBg}</h2><p>{basics.bodyBg}</p></header>
        <ul>{basics.bulletsBg.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <GameRulesPhaseTimeline phases={phases} mode={mode} {...(isMafia ? { sportPhases: MAFIA_SPORT_PHASES } : {})} />

      <section className="rules-table-mode rules-table-protocol">
        <div>
          <p className="section-kicker">Около една маса</p>
          <h2>Разговорът е ваш. Тайните остават на екрана.</h2>
        </div>
        <div className="rules-table-grid">
          <article>
            <strong>На живо</strong>
            <span>Личните звуци и вибрации са изключени по подразбиране, за да не издават кой е буден.</span>
          </article>
          <article>
            <strong>Без писмен разговор</strong>
            <span>Приложението пази фазите, таймерите и тайните действия; разговорът може да е около масата.</span>
          </article>
          <article>
            <strong>Разказвач</strong>
            <span>Честният Разказвач води темпото без тайни роли. Пълният Разказвач вижда тайните само след ясно предупреждение.</span>
          </article>
        </div>
      </section>

      <section id="rules-details" className="rules-chapter-grid" aria-label="Особености на играта">
        {chapters.map((section) => (
          <article key={section.titleBg} className="rules-chapter-card">
            <h2>{section.titleBg}</h2>
            <p>{section.bodyBg}</p>
            {section.bulletsBg ? (
              <ul>{section.bulletsBg.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : null}
          </article>
        ))}
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

      <footer className="rules-next">
        <div><p className="section-kicker">Следващата вечер</p><h2>Събери компанията.</h2></div>
        <Link href={`/${familyPath}/create`} className="btn btn-primary" prefetch={false}>Създай стая <ArrowRight size={17} aria-hidden="true" /></Link>
        <Link className="rules-text-link" href={isMafia ? "/werewolf/rules" : "/mafia/rules"} prefetch={false}>
          {isMafia ? "Правила за Върколак" : "Правила за Мафия"} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </footer>
    </main>
  );
}

function preloadRulesHero(family: GameFamily) {
  const familyPath = family === "mafia" ? "mafia" : "werewolf";
  const desktopRoot = `/game-art/${familyPath}`;
  const mobileRoot = `/game-art/mobile/${familyPath}`;
  const mobileDarkVersion = family === "werewolves" ? "v3" : "v2";
  const variants = [
    { href: `${desktopRoot}/bg-hero-v2.avif`, media: "(min-width: 721px) and (prefers-color-scheme: dark)" },
    { href: `${desktopRoot}/bg-hero-light-v1.avif`, media: "(min-width: 721px) and (prefers-color-scheme: light)" },
    { href: `${mobileRoot}/bg-hero-${mobileDarkVersion}.avif`, media: "(max-width: 720px) and (prefers-color-scheme: dark)" },
    { href: `${mobileRoot}/bg-hero-light-v1.avif`, media: "(max-width: 720px) and (prefers-color-scheme: light)" },
  ];

  for (const variant of variants) {
    preload(variant.href, {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
      media: variant.media,
    });
  }
}
