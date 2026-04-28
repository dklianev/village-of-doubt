import Link from "next/link";
import { GAME_MODE_DEFINITIONS, getMafiaSportPreset, getWerewolvesMvpPreset, type GameMode } from "@werewolf/shared";

const werewolfPreset = getWerewolvesMvpPreset(10);
const mafiaPreset = getMafiaSportPreset(10);

export function LandingExperience() {
  return (
    <main className="shell landing-shell">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="card landing-hero-card rounded-[2rem] p-7">
          <div className="landing-logo-mark" aria-hidden="true" />
          <p className="text-sm uppercase tracking-[0.35em] text-[#c18a38]">скрити роли</p>
          <h1 className="mt-5 text-5xl font-black leading-none text-[#f4e8d1] md:text-7xl">
            Село под съмнение
          </h1>
          <p className="landing-hero-copy mt-6 max-w-xl text-lg leading-8 text-[#ead9ba]">
            Българска Мафия и Върколаци с авторитетен игрови сървър, тайни роли,
            Разказвач и режими за Discord, онлайн или игра на живо.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/lobby" className="btn btn-primary">
              Създай стая
            </Link>
            <Link href="/history" className="btn btn-secondary">
              История
            </Link>
            <Link href="/roles" className="btn btn-secondary">
              Виж ролите
            </Link>
          </div>

          <div className="mode-choice-grid mt-8">
            <ModeChoiceCard
              mode="werewolves_classic"
              href="/lobby?mode=werewolves_classic"
              title="Играй Върколаци"
              line="Фолклорен хорър, Кмет, Ясновидка, Лечител и нощни събуждания."
            />
            <ModeChoiceCard
              mode="mafia_sport"
              href="/lobby?mode=mafia_sport"
              title="Играй Мафия"
              line="Криминален ноар, Комисар, Дон, Мафиоти и обвинения на масата."
            />
          </div>

          <div className="landing-tableau" aria-hidden="true">
            <div className="tableau-card role-art-tile role-werewolf">
              <span>Върколак</span>
            </div>
            <div className="tableau-card role-art-tile role-seer">
              <span>Ясновидка</span>
            </div>
            <div className="tableau-card role-art-tile role-vampire">
              <span>Вампир</span>
            </div>
          </div>
        </aside>

        <section className="paper-card landing-rules-card rounded-[2rem] p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">основни правила</p>
              <h2 className="mt-3 text-4xl font-black">Готово за първата маса</h2>
            </div>
            <span className="rounded-full bg-[#842f2b] px-4 py-2 text-sm font-black text-white">
              Само на български
            </span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <RuleCard
              title="Върколаци"
              subtitle="10 играчи по подразбиране"
              items={[
                `${werewolfPreset.werewolf ?? 0} Върколака`,
                `${werewolfPreset.seer ?? 0} Ясновидка`,
                `${werewolfPreset.witch ?? 0} Вещица`,
                `${werewolfPreset.healer ?? 0} Лечител`,
                "Кмет като публична титла",
              ]}
            />
            <RuleCard
              title="Спортна Мафия"
              subtitle="10 играчи"
              items={[
                `${mafiaPreset.civilian ?? 0} Мирни граждани`,
                `${mafiaPreset.commissioner ?? 0} Комисар`,
                `${mafiaPreset.mafioso ?? 0} Мафиоти`,
                `${mafiaPreset.don ?? 0} Дон`,
              ]}
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function RuleCard({ title, subtitle, items }: { title: string; subtitle: string; items: string[] }) {
  return (
    <article className="rounded-[1.5rem] border border-[#221611]/15 bg-white/35 p-5">
      <span className="text-xs font-black uppercase tracking-[0.25em] text-[#842f2b]">{subtitle}</span>
      <h3 className="mt-2 text-2xl font-black">{title}</h3>
      <ul className="mt-5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm font-bold">
            <span className="h-2 w-2 rounded-full bg-[#842f2b]" />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function ModeChoiceCard({ mode, href, title, line }: { mode: GameMode; href: string; title: string; line: string }) {
  const definition = GAME_MODE_DEFINITIONS[mode];

  return (
    <Link href={href} className={`mode-choice-card mode-${mode}`} data-theme={definition.family}>
      <span>{definition.nameBg}</span>
      <strong>{title}</strong>
      <p>{line}</p>
    </Link>
  );
}
