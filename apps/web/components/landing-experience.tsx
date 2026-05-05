import Link from "next/link";

const GAMES = [
  {
    id: "werewolf",
    family: "werewolves",
    title: "Върколак",
    eyebrow: "фолклорен хорър",
    description:
      "Класическо село с тайни роли, нощни събуждания, Върколаци, Вампири и Разказвач.",
    line: "Първо пада мъглата. После някой лъже прекалено спокойно.",
    href: "/werewolf",
  },
  {
    id: "mafia",
    family: "mafia",
    title: "Мафия",
    eyebrow: "градска мистерия",
    description:
      "Криминална маса с Град, Мафия, Комисар, Доктор, Кръстник и роли за по-опитни групи.",
    line: "Дъждът измива улицата, но не и алибитата.",
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

        <div className="game-choice-grid landing-split-grid mt-8">
          {GAMES.map((game) => (
            <article key={game.id} className={`game-choice-card game-choice-${game.id}`} data-theme={game.family}>
              <span className="section-kicker">{game.eyebrow}</span>
              <h2>{game.title}</h2>
              <blockquote>{game.line}</blockquote>
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

        <section className="first-game-flow mt-8" aria-label="Първа игра за 30 секунди">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="section-kicker">първа игра за 30 секунди</p>
            <Link href="/tutorial" className="btn btn-secondary min-h-0 px-4 py-2 text-sm">
              Виж краткия наръчник
            </Link>
          </div>
          <ol>
            <li>
              <strong>1. Име</strong>
              <span>Влизаш без акаунт, само с име за масата.</span>
            </li>
            <li>
              <strong>2. Стая</strong>
              <span>Създаваш код или се присъединяваш към приятел.</span>
            </li>
            <li>
              <strong>3. Роля</strong>
              <span>Сървърът ти показва само твоята карта.</span>
            </li>
            <li>
              <strong>4. Нощ</strong>
              <span>Действаш тихо, ако ролята ти го позволява.</span>
            </li>
            <li>
              <strong>5. Глас</strong>
              <span>Денят решава кой ще напусне играта.</span>
            </li>
          </ol>
        </section>

        <section className="landing-live-strip mt-8" aria-label="Жив пулс на играта">
          <LiveTicker />
          <div className="winner-banner">
            <span>последна история</span>
            <strong>Когато първата игра приключи, тук ще се появи победителят.</strong>
          </div>
        </section>
      </section>
    </main>
  );
}

async function loadGameStats() {
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/^ws/, "http") ?? "http://localhost:2567";
  try {
    const response = await fetch(`${gameServerUrl}/stats`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as {
      activeRooms?: number;
      connectedPlayers?: number;
      lastWinner?: { code: string; winnerTeam: string; winnerReasonBg: string } | null;
    };
  } catch {
    return null;
  }
}

async function LiveTicker() {
  const stats = await loadGameStats();
  const activeRooms = stats?.activeRooms ?? 0;
  const connectedPlayers = stats?.connectedPlayers ?? 0;
  const lastWinner = stats?.lastWinner;

  return (
    <div className="live-ticker">
      <span aria-hidden="true" />
      <div>
        <strong>В момента играят</strong>
        <p>
          {activeRooms} {activeRooms === 1 ? "стая" : "стаи"} · {connectedPlayers}{" "}
          {connectedPlayers === 1 ? "човек" : "души"}
        </p>
      </div>
      {lastWinner ? (
        <div>
          <strong>Последна победа</strong>
          <p>
            Стая {lastWinner.code} · {winnerTeamBg(lastWinner.winnerTeam)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function winnerTeamBg(team: string) {
  const labels: Record<string, string> = {
    village: "Селото",
    werewolves: "Върколаците",
    vampires: "Вампирите",
    mafia: "Мафията",
    lovers: "Влюбените",
    draw: "Равенство",
  };

  return labels[team] ?? "неизвестен победител";
}
