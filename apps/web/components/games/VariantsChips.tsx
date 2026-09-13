import type { GameFamily } from "@werewolf/shared";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { coverImageSizes, roleArtPath, roleArtSource } from "@/lib/role-art";
import { RoleDossierTrigger } from "./RoleDossierTrigger";

const WEREWOLF_VARIANTS = [
  { label: "Класическа вечер", body: "Селото срещу върколаците. Добро начало за първата ви игра.", href: "/werewolf/create", action: "Създай стая", art: "/game-art/werewolf/night-5-dawn.webp" },
  { label: "Двама с обща съдба", body: "Купидон свързва двама Влюбени. Падне ли единият, другият го последва.", role: "cupid", action: "Картата на Купидон", art: roleArtPath("werewolves", "cupid") },
  { label: "Още една заплаха", body: "Вампирите добавят трета страна. Селото вече не търси само Върколаци.", role: "vampire", action: "Картата на Вампира", art: roleArtPath("werewolves", "vampire") },
] as const;

const MAFIA_VARIANTS = [
  { label: "Свободна Мафия", body: "Градът срещу Мафията. Съставът е ваш избор.", href: "/mafia/create", action: "Създай стая", art: "/game-art/mafia/night-5-morning.webp" },
  { label: "Комисар и Доктор", body: "Разследване и защита на страната на Града.", role: "doctor", action: "Картата на Доктора", art: roleArtPath("mafia", "doctor") },
  { label: "Кръстник с Адвокат", body: "Една проверка може да ви заблуди, когато Адвокатът се намеси.", role: "lawyer", action: "Картата на Адвоката", art: roleArtPath("mafia", "lawyer") },
] as const;

export function VariantsChips({ family }: { family: GameFamily }) {
  const variants = family === "mafia" ? MAFIA_VARIANTS : WEREWOLF_VARIANTS;

  return (
    <section className="variants-chips" data-family={family} aria-label={family === "mafia" ? "Варианти на Мафия" : "Варианти на Върколак"}>
      <header className="variants-chips__header family-section-heading">
        <p className="section-kicker">варианти</p>
        <h2>{family === "mafia" ? "Друг състав. Други подозрения." : "Всяко село има своите истории."}</h2>
      </header>
      <ul className="variants-chips__list">
        {variants.map((variant) => (
          <li key={variant.label} className="variant-chip">
            <div
              className={"role" in variant ? "variant-chip__art role-art-frame" : "variant-chip__art"}
              data-frame-family={"role" in variant ? family : undefined}
            >
              <Image src={variant.art} alt="" fill sizes={coverImageSizes(
                "role" in variant ? roleArtSource(family, variant.role) : { width: 4, height: 3 },
                [{ media: "(max-width: 600px)", width: 88, aspectRatio: 2 / 3 }, { width: 112, aspectRatio: 2 / 3 }],
              )} quality={85} />
            </div>
            <div className="variant-chip__copy">
              <h3>{variant.label}</h3>
              <p>{variant.body}</p>
              {"role" in variant ? (
                <RoleDossierTrigger family={family} role={variant.role} className="family-text-link">
                  {variant.action}
                </RoleDossierTrigger>
              ) : (
                <Link href={variant.href} className="family-text-link" prefetch={false}>{variant.action}<ArrowUpRight size={15} aria-hidden="true" /></Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
