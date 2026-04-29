import { getRulesForFamily, type GameFamily } from "@werewolf/shared";

export function GameRulesPage({ family }: { family: GameFamily }) {
  const rules = getRulesForFamily(family);

  return (
    <main className="shell rules-shell" data-theme={family} data-family={family}>
      <section className="card role-codex-hero rounded-[2rem] p-7">
        <p className="section-kicker">{family === "mafia" ? "как се играе" : "правила от голямата кутия"}</p>
        <h1 className="mt-3 text-5xl font-black leading-none md:text-7xl">{rules.titleBg}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#ead9ba]">{rules.introBg}</p>
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
