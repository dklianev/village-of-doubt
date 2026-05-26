import Link from "next/link";
import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import { roleThumbStyle } from "@/lib/role-art";

const WEREWOLF_SPOTLIGHT: RoleCode[] = ["ordinary_villager", "werewolf", "seer", "healer", "hunter"];
const MAFIA_SPOTLIGHT: RoleCode[] = ["civilian", "mafioso", "commissioner", "don", "doctor"];

export function RoleSpotlight({ family }: { family: GameFamily }) {
  const roles = family === "mafia" ? MAFIA_SPOTLIGHT : WEREWOLF_SPOTLIGHT;
  const root = family === "mafia" ? "/mafia" : "/werewolf";

  return (
    <section
      className="role-spotlight"
      data-family={family}
      aria-label={family === "mafia" ? "Класически роли в Мафия" : "Класически роли във Върколак"}
    >
      <header className="role-spotlight__header family-section-plaque">
        <p className="section-kicker">{family === "mafia" ? "градът" : "селото"}</p>
        <h2>{family === "mafia" ? "Кой седи на масата" : "Кой се събужда нощем"}</h2>
        <p>{family === "mafia" ? "Пет роли формират гръбнака на всяка игра." : "Пет роли водят всяка фолклорна нощ."}</p>
      </header>

      <ul className="role-spotlight__grid">
        {roles.map((role) => {
          const definition = ROLE_DEFINITIONS[role];

          return (
            <li key={role} className="role-spotlight__tile">
              <span className="role-spotlight__art" aria-hidden="true" style={roleThumbStyle(family, role)} />
              <strong>{definition.nameBg}</strong>
              <small>{definition.shortDescriptionBg}</small>
            </li>
          );
        })}
      </ul>

      <p className="role-spotlight__more">
        <Link href={`${root}/roles`} className="quickstart-card-cta">
          Виж всички роли <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
