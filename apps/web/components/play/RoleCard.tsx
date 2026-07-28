import type { CSSProperties } from "react";
import { ROLE_DEFINITIONS, getRoleShortDescriptionBg, teamLabelBg, type GameFamily, type RoleCode } from "@werewolf/shared";
import { ROLE_GUIDE_BG, formatPrivateResult } from "@/lib/play/copy";
import { roleSigil } from "@/lib/play/player-display";
import { roleArtPath } from "@/lib/role-art";
import type { PrivateResult, PublicPlayer } from "@/lib/play/types";
import styles from "./RoleCard.module.css";

export function RoleCard({
  role,
  result,
  players,
  family,
}: {
  role: { role: RoleCode; roleNameBg: string } | null;
  result: PrivateResult | null;
  players: PublicPlayer[];
  family?: GameFamily;
}) {
  if (!role) {
    return null;
  }

  const definition = ROLE_DEFINITIONS[role.role];
  const roleFamily = family ?? definition.availableInFamilies[0] ?? "werewolves";
  const guide = ROLE_GUIDE_BG[role.role] ?? {
    summary: getRoleShortDescriptionBg(role.role),
    team: teamLabelBg(definition.team, roleFamily),
    timing: definition.nightAction ? "Нощна фаза" : "Ден и гласуване",
    win: "winConditionBg" in definition ? definition.winConditionBg : "Следвай целта на своя отбор",
  };
  const roleArtStyle = {
    "--role-art": `url("${roleArtPath(roleFamily, role.role, "webp")}")`,
  } as CSSProperties;

  return (
    <article
      className={`role-card paper-card role-${role.role} ${styles.dossier}`}
      data-private-dossier="true"
      data-role-family={roleFamily}
      aria-label={`Тайна роля: ${role.roleNameBg}`}
      style={roleArtStyle}
    >
      <div className={styles.art} aria-hidden="true" />
      <div className={styles.content}>
        <div className={`role-card-header ${styles.header}`}>
          <div>
            <p className={`section-kicker ${styles.kicker}`}>само за теб</p>
            <h2>{role.roleNameBg}</h2>
          </div>
          <div className={`role-sigil ${styles.sigil}`} aria-hidden="true">
            {roleSigil(role.role)}
          </div>
        </div>
        <div className={`role-card-body ${styles.body}`}>
          <p>{guide.summary}</p>
          <div className={`role-card-facts ${styles.facts}`}>
            <RoleFact label="Отбор" value={guide.team} />
            <RoleFact label="Кога действа" value={guide.timing} />
            <RoleFact label="Цел" value={guide.win} />
          </div>
        </div>
        {result ? (
          <p className={`role-card-result ${styles.result}`}>
            {formatPrivateResult(result, players)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function RoleFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
