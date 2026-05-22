import { ROLE_DEFINITIONS, getRoleAssetKey, type RoleCode } from "@werewolf/shared";
import type { PublicPlayer } from "@/lib/play/types";

export function DeathRevealCinematic({ players }: { players: PublicPlayer[] }) {
  const revealed = [...players].reverse().find((player) => player.playing && !player.alive && player.revealedRole);
  if (!revealed?.revealedRole) {
    return null;
  }

  const role = revealed.revealedRole as RoleCode;
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) {
    return null;
  }

  const family = definition.availableInFamilies[0] ?? "werewolves";
  const prefix = family === "mafia" ? "/game-art/mafia" : "/game-art";
  const slug = `role-${getRoleAssetKey(role)}`;

  return (
    <article className={`death-reveal-card mt-8 rounded-[2rem] p-5 role-${role}`}>
      <picture aria-hidden="true">
        <source srcSet={`${prefix}/${slug}.webp`} type="image/webp" />
        <img src={`${prefix}/${slug}.png`} alt="" loading="lazy" width={280} height={392} />
      </picture>
      <div>
        <p className="section-kicker">разкрита карта</p>
        <h2>{revealed.displayName} беше {definition.nameBg}</h2>
        <p>{definition.shortDescriptionBg}</p>
      </div>
    </article>
  );
}
