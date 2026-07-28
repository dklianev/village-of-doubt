import { ROLE_DEFINITIONS, getRoleAssetKey, type GameFamily, type RoleCode } from "@werewolf/shared";
import type { PublicPlayer } from "@/lib/play/types";

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

  const roleArtFamily = definition.availableInFamilies[0] ?? "werewolves";
  const prefix = roleArtFamily === "mafia" ? "/game-art/mafia" : "/game-art";
  const slug = `role-${getRoleAssetKey(role)}`;

  return (
    <article className={`death-reveal-card mt-8 rounded-[2rem] p-5 role-${role}`} data-family={family}>
      <div className="death-reveal-scene" aria-hidden="true" />
      <picture className="death-reveal-role-art" aria-hidden="true">
        <source srcSet={`${prefix}/${slug}.webp`} type="image/webp" />
        <img src={`${prefix}/${slug}.webp`} alt="" loading="lazy" width={280} height={392} />
      </picture>
      <div>
        <p className="section-kicker">разкрита карта</p>
        <h2>{revealed.displayName} беше {definition.nameBg}</h2>
        <p>{definition.shortDescriptionBg}</p>
      </div>
    </article>
  );
}
