import Link from "next/link";
import {
  GAME_MODE_DEFINITIONS,
  getMafiaFreePreset,
  getRoleNameBg,
  getWerewolvesClassicPreset,
  type GameFamily,
  type GameMode,
  type RoleCode,
} from "@werewolf/shared";
import { ResourceHints } from "@/components/resource-hints";

export function GameHomePage({ family }: { family: GameFamily }) {
  const isMafia = family === "mafia";
  const mode: GameMode = isMafia ? "mafia_free" : "werewolves_classic";
  const root = isMafia ? "/mafia" : "/werewolf";
  const title = isMafia ? "Мафия" : "Върколак";
  const subtitle = isMafia
    ? "Криминален ноар за град, който трябва да различи алиби от лъжа."
    : "Фолклорен хорър за село, което заспива заедно, но не всички се будят невинни.";
  const preset = isMafia ? getMafiaFreePreset(10) : getWerewolvesClassicPreset(10);

  return (
    <main className="shell game-home-shell" data-theme={family} data-family={family}>
      <ResourceHints images={[isMafia ? "/game-art/mobile/mafia/bg-landing-hero.webp" : "/game-art/mobile/bg-landing-hero.webp"]} />
      <section className="card game-home-hero rounded-[2rem] p-7">
        <p className="section-kicker">{isMafia ? "град под напрежение" : "нощ над селото"}</p>
        <h1 className="mt-3 text-6xl font-black leading-none md:text-8xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#ead9ba]">{subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`${root}/create`} className="btn btn-primary">
            Играй
          </Link>
          <Link href={`${root}/roles`} className="btn btn-secondary" prefetch={false}>
            Роли
          </Link>
          <Link href={`${root}/rules`} className="btn btn-secondary" prefetch={false}>
            Правила
          </Link>
          <Link href={`${root}/join`} className="btn btn-secondary" prefetch={false}>
            Влез с код
          </Link>
        </div>
      </section>

      <section className="paper-card rounded-[2rem] p-7">
        <p className="section-kicker text-[#842f2b]">{GAME_MODE_DEFINITIONS[mode].recommendedPlayersBg}</p>
        <h2 className="mt-3 text-4xl font-black">Как започва една добра игра</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InfoCard title="1. Име" body="Всеки влиза само с потребителско име. Няма нужда от акаунт." />
          <InfoCard title="2. Стая" body="Водещият създава код, настройва ролите и споделя поканата." />
          <InfoCard title="3. Игра" body="Сървърът пази тайните роли и показва на всеки само позволеното." />
        </div>
        <div className="mt-6 rounded-3xl bg-white/30 p-5">
          <h3 className="text-2xl font-black">Стартово разпределение</h3>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {Object.entries(preset).map(([role, count]) => (
              <li key={role} className={`role-count-chip role-${role}`}>
                <span>{getRoleNameBg(role as RoleCode)}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[1.5rem] border border-[#221611]/15 bg-white/35 p-5">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-3 text-sm font-bold leading-6 text-[#4b3024]">{body}</p>
    </article>
  );
}
