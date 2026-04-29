import Link from "next/link";

const GAMES = [
  {
    id: "werewolf",
    family: "werewolves",
    title: "Върколак",
    eyebrow: "фолклорен хорър",
    description:
      "Класическо село с тайни роли, нощни събуждания, Върколаци, Вампири и Разказвач.",
    href: "/werewolf",
  },
  {
    id: "mafia",
    family: "mafia",
    title: "Мафия",
    eyebrow: "градска мистерия",
    description:
      "Криминална маса с Град, Мафия, Комисар, Доктор, Кръстник и роли за по-опитни групи.",
    href: "/mafia",
  },
] as const;

export function LandingExperience() {
  return (
    <main className="shell landing-shell">
      <section className="card landing-hero-card rounded-[2rem] p-7">
        <div className="landing-logo-mark" aria-hidden="true" />
        <p className="section-kicker">избери игра</p>
        <h1 className="mt-5 text-5xl font-black leading-none text-[#f4e8d1] md:text-7xl">
          Върколак или Мафия
        </h1>
        <p className="landing-hero-copy mt-6 max-w-3xl text-lg leading-8 text-[#ead9ba]">
          Две отделни игри, два отделни речника и два отделни набора роли. Влизаш с име, създаваш стая
          или въвеждаш код и започваш без регистрация.
        </p>

        <div className="game-choice-grid mt-8">
          {GAMES.map((game) => (
            <article key={game.id} className={`game-choice-card game-choice-${game.id}`} data-theme={game.family}>
              <span className="section-kicker">{game.eyebrow}</span>
              <h2>{game.title}</h2>
              <p>{game.description}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`${game.href}/create`} className="btn btn-primary">
                  Играй
                </Link>
                <Link href={`${game.href}/roles`} className="btn btn-secondary">
                  Роли
                </Link>
                <Link href={`${game.href}/rules`} className="btn btn-secondary">
                  Правила
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
