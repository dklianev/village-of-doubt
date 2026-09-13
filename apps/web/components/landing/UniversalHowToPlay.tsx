import Link from "next/link";
import { ArrowRight, KeyRound, UsersRound, VenetianMask } from "lucide-react";
import { roleThumbPath } from "@/lib/role-art";

const STEPS = [
  {
    label: "Влез",
    body: "Влизаш с Google, Discord или имейл.",
    icon: KeyRound,
  },
  {
    label: "Събери компанията",
    body: "Отвори стая и сподели кода. Поканените влизат при теб.",
    icon: UsersRound,
  },
  {
    label: "Получи роля",
    body: "Щом играта започне, получаваш тайна роля на своя екран.",
    icon: VenetianMask,
  },
] as const;

export function UniversalHowToPlay() {
  return (
    <section className="home-start" aria-label="Първата ти игра">
      <div className="home-start-deck" aria-hidden="true">
        <img src={roleThumbPath("werewolves", "seer")} alt="" width="520" height="780" loading="lazy" decoding="async" />
        <img src={roleThumbPath("mafia", "commissioner")} alt="" width="520" height="780" loading="lazy" decoding="async" />
        <img src="/game-art/thumbs/card-back-secret.webp" alt="" width="520" height="780" loading="lazy" decoding="async" />
      </div>
      <div className="home-start-intro">
        <p className="section-kicker">Първата ти игра</p>
        <h2>Познаваш хората.<br />Не и ролите.</h2>
        <Link href="/tutorial" prefetch={false} className="home-text-link">
          Виж как се играе <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <ol className="home-start-steps">
        {STEPS.map(({ label, body, icon: Icon }) => (
          <li key={label}>
            <div className="home-start-step-heading">
              <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
              <h3>{label}</h3>
            </div>
            <p>{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
