import Link from "next/link";
import Image from "next/image";
import { Expand, ArrowRight } from "lucide-react";
import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import { coverImageSizes, roleArtSource } from "@/lib/role-art";
import { RoleDossierTrigger } from "./RoleDossierTrigger";

const WEREWOLF_SPOTLIGHT: RoleCode[] = ["ordinary_villager", "werewolf", "seer", "witch"];
const MAFIA_SPOTLIGHT: RoleCode[] = ["civilian", "mafioso", "commissioner", "don"];

export function RoleSpotlight({ family }: { family: GameFamily }) {
  const roles = family === "mafia" ? MAFIA_SPOTLIGHT : WEREWOLF_SPOTLIGHT;
  const root = family === "mafia" ? "/mafia" : "/werewolf";

  return (
    <section
      className="role-spotlight"
      data-family={family}
      aria-label={family === "mafia" ? "Класически роли в Мафия" : "Класически роли във Върколак"}
    >
      <header className="role-spotlight__header family-section-heading">
        <p className="section-kicker">{family === "mafia" ? "градът" : "селото"}</p>
        <h2>{family === "mafia" ? "Лицата зад алибитата" : "Лицата на селото"}</h2>
        <p>{family === "mafia" ? "Познато лице. Неизвестна страна." : "Познаваш съседите си. Но не и техните тайни."}</p>
        <Link href={`${root}/roles`} className="family-text-link">Виж всички роли<ArrowRight size={16} aria-hidden="true" /></Link>
      </header>

      <ul className="role-spotlight__grid">
        {roles.map((role) => {
          const definition = ROLE_DEFINITIONS[role];
          const source = roleArtSource(family, role);

          return (
            <li key={role} className="role-spotlight__tile">
              <RoleDossierTrigger family={family} role={role} className="role-spotlight__link">
                <span className="role-spotlight__art role-art-frame" data-frame-family={family}>
                  <Image src={source.src} alt="" fill sizes={coverImageSizes(source, [
                    { media: "(max-width: 600px)", width: "45vw", aspectRatio: 2 / 3 },
                    { media: "(max-width: 900px)", width: "22vw", aspectRatio: 2 / 3 },
                    { media: "(max-width: 1240px)", width: "17vw", aspectRatio: 2 / 3 },
                    { width: 202, aspectRatio: 2 / 3 },
                  ])} quality={85} />
                  <span className="role-spotlight__open" style={{ zIndex: 2 }} title="Разгледай ролята" aria-hidden="true"><Expand size={18} /></span>
                </span>
                <strong>{definition.nameBg}</strong>
                <small>{definition.shortDescriptionBg}</small>
              </RoleDossierTrigger>
            </li>
          );
        })}
      </ul>

    </section>
  );
}
