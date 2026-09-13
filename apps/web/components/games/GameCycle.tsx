import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GameFamily } from "@werewolf/shared";
import { coverImageSizes } from "@/lib/role-art";

type CyclePhase = { label: string; body: string; art: string };

export function GameCycle({ family, title, phases }: { family: GameFamily; title: string; phases: readonly CyclePhase[] }) {
  const root = family === "mafia" ? "/mafia" : "/werewolf";
  return (
    <section className={`night-timeline night-timeline--${family}`} aria-labelledby={`${family}-game-cycle-title`}>
      <header className="night-timeline__header family-section-heading">
        <p className="section-kicker">ходът на играта</p>
        <h2 id={`${family}-game-cycle-title`}>{title}</h2>
        <p>Тайна роля. Общ разговор. Решение, зад което трябва да застанеш.</p>
        <Link href={`${root}/rules`} className="family-text-link">Правилата накратко<ArrowRight size={16} aria-hidden="true" /></Link>
      </header>
      <ol className="night-timeline__phases">
        {phases.map((phase, index) => (
          <li key={phase.label} className="night-phase">
            <figure className="night-phase__art">
              <Image src={phase.art} alt="" fill sizes={coverImageSizes({ width: 4, height: 3 }, [
                { media: "(max-width: 600px)", width: 96, aspectRatio: 1 },
                { media: "(max-width: 900px)", width: "30vw", aspectRatio: 4 / 3 },
                { media: "(max-width: 1240px)", width: "22vw", aspectRatio: 4 / 3 },
                { width: 276, aspectRatio: 4 / 3 },
              ])} quality={85} />
            </figure>
            <div className="night-phase__body">
              <span className="night-phase__step" aria-hidden="true">0{index + 1}</span>
              <h3>{phase.label}</h3>
              <p>{phase.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="night-timeline__repeat">После идва нова нощ. Играта продължава, докато една страна спечели.</p>
    </section>
  );
}
