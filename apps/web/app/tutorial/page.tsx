import Link from "next/link";

export const metadata = {
  title: "Първа игра | Върколак и Мафия",
  description: "Кратък интерактивен наръчник за първа игра без регистрация.",
};

const STEPS = [
  {
    title: "Избери маса",
    text: "Върколак е по-фолклорен и подозрителен. Мафия е по-градска, с алибита, роли и хладни обвинения.",
  },
  {
    title: "Въведи име",
    text: "Не ти трябва акаунт. Името е временно и важи за стаята, в която играеш.",
  },
  {
    title: "Раздай ролите",
    text: "Сървърът раздава картите. Ти виждаш само твоята роля, а чуждите тайни не се пращат към браузъра.",
  },
  {
    title: "Изиграй нощта",
    text: "Ако ролята ти има действие, избираш цел от телефона. Ако играете на живо, оставете cue режима на тихо.",
  },
  {
    title: "Говори през деня",
    text: "Дневното обсъждане е за наблюдения, блъф и малки капани. Не казвай всичко веднага, освен ако имаш план.",
  },
  {
    title: "Гласувай",
    text: "Гласът не е просто бутон. Той оставя следа в историята на играта и често издава отбора.",
  },
] as const;

const DEMO_PLAYERS = [
  { name: "Анна", clue: "говори спокойно, но пази един играч" },
  { name: "Борис", clue: "гласува рано и после сменя темата" },
  { name: "Виктор", clue: "има проверка, но не я казва директно" },
  { name: "Галя", clue: "слуша повече, отколкото говори" },
  { name: "Деян", clue: "обвинява силно без нова причина" },
] as const;

const DEMO_ROUNDS = [
  {
    phase: "Роля",
    text: "Всеки вижда само собствената си карта. Ако телефоните са близо един до друг, екранът стои ниско и без звук.",
  },
  {
    phase: "Нощ",
    text: "Активните роли действат по ред. Ако нямаш действие, просто изчакваш следващата фаза.",
  },
  {
    phase: "Ден",
    text: "Не търси перфектно доказателство. Търси противоречие, необичаен глас или прекалено удобна защита.",
  },
  {
    phase: "Глас",
    text: "Когато гласуваш, оставяш следа. След играта replay-ът показва кой кого е натискал и кога.",
  },
] as const;

export default function TutorialPage() {
  return (
    <main className="shell tutorial-shell">
      <section className="card tutorial-hero rounded-[2rem] p-7">
        <p className="section-kicker">първа игра</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-black leading-none text-[#f4e8d1] md:text-7xl">
          Научи масата преди първата нощ.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#ead9ba]">
          Това е кратък наръчник за приятели, които искат да започнат без обяснение от половин час. Няма бот игра и няма
          фалшиви действия — само ясна подготовка за истинска стая.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/werewolf/create">
            Създай Върколак
          </Link>
          <Link className="btn btn-primary" href="/mafia/create">
            Създай Мафия
          </Link>
          <Link className="btn btn-secondary" href="/werewolf/rules">
            Правила за Върколак
          </Link>
        </div>
      </section>

      <section className="tutorial-board mt-8" aria-label="Стъпки за първа игра">
        {STEPS.map((step, index) => (
          <article key={step.title} className="tutorial-step-card">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      <section className="tutorial-demo-table mt-8 rounded-[2rem] p-6" aria-label="Примерна маса">
        <div>
          <p className="section-kicker">примерна мини-маса</p>
          <h2>Петима играчи, една подозрителна вечер</h2>
          <p>
            Това не е бот игра и не симулира тайна логика. Това е кратък сценарий, който показва как да мислиш по време
            на първата истинска стая.
          </p>
        </div>
        <div className="demo-player-grid">
          {DEMO_PLAYERS.map((player) => (
            <article key={player.name}>
              <strong>{player.name}</strong>
              <span>{player.clue}</span>
            </article>
          ))}
        </div>
        <ol className="demo-round-list">
          {DEMO_ROUNDS.map((round) => (
            <li key={round.phase}>
              <strong>{round.phase}</strong>
              <span>{round.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="tutorial-table-mode mt-8 rounded-[2rem] p-6">
        <p className="section-kicker">ако играете на живо</p>
        <h2>Телефонът е карта, не микрофон.</h2>
        <p>
          Изберете режим без чат или само системни съобщения. Личните звуци и вибрации са изключени по подразбиране в
          live tempo, за да не издават кой се събужда през нощта.
        </p>
      </section>
    </main>
  );
}
