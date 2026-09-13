import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import type { PublicPlayer } from "@/lib/play/types";
import { roleArtSource } from "@/lib/role-art";

export function DeathRevealCinematic({ family, players }: { family: GameFamily; players: PublicPlayer[] }) {
  const revealed = [...players].reverse().find((player) => player.playing && !player.alive && player.revealedRole);
  if (!revealed?.revealedRole) {
    return null;
  }

  const role = revealed.revealedRole as RoleCode;
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) {
    return null;
  }

  const source = roleArtSource(family, role);

  return (
    <article className={`death-reveal-card mt-8 rounded-[2rem] p-5 role-${role}`} data-family={family}>
      <div className="death-reveal-scene" aria-hidden="true" />
      <picture className="death-reveal-role-art" aria-hidden="true">
        <source srcSet={source.src} type="image/webp" />
        <img src={source.src} alt="" loading="lazy" width={280} height={392} />
      </picture>
      <div>
        <p className="section-kicker">разкрита карта</p>
        <h2>{revealed.displayName} беше {definition.nameBg}</h2>
        <p>{definition.shortDescriptionBg}</p>
      </div>
    </article>
  );
}
