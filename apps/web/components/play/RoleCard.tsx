import type { CSSProperties } from "react";
import { ROLE_DEFINITIONS, getRoleShortDescriptionBg, teamLabelBg, type GameFamily, type RoleCode } from "@werewolf/shared";
import { ROLE_GUIDE_BG, formatPrivateResult } from "@/lib/play/private-copy";
import { roleSigil } from "@/lib/play/player-display";
import { roleArtPath } from "@/lib/role-art";
import type { PrivateResult, PublicPlayer } from "@/lib/play/types";
import styles from "./RoleCard.module.css";

export function RoleCard({
  role,
  result,
  players,
  family,
  presentation = "full",
}: {
  role: { role: RoleCode; roleNameBg: string } | null;
  result: PrivateResult | null;
  players: PublicPlayer[];
  family?: GameFamily;
  presentation?: "full" | "compact" | "mini";
}) {
  if (!role) {
    return null;
  }

  const compact = presentation !== "full";
  const mini = presentation === "mini";
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
  const privateResult = result ? (
    <p className={`role-card-result ${styles.result}`} role="status" aria-label="Личен резултат">
      <span className={styles.resultLabel}>Резултат от проверката</span>{" "}
      <span>{formatPrivateResult(result, players)}</span>
    </p>
  ) : null;

  return (
    <article
      className={`role-card paper-card role-${role.role} ${styles.dossier}${compact ? ` ${styles.compact}` : ""}${mini ? ` ${styles.mini}` : ""}`}
      data-private-dossier="true"
      data-role-family={roleFamily}
      data-role-team={definition.team}
      aria-label={`Тайна роля: ${role.roleNameBg}`}
      style={roleArtStyle}
    >
      <div className={styles.art} aria-hidden="true" />
      <div className={styles.content}>
        <div className={`role-card-header ${styles.header}`}>
          <div>
            {!mini ? <p className={`section-kicker ${styles.kicker}`}>само за теб</p> : null}
            <h2>{role.roleNameBg}</h2>
            {compact ? <p className={styles.team}>{guide.team}</p> : null}
          </div>
          {!compact ? (
            <div className={`role-sigil ${styles.sigil}`} aria-hidden="true">
              {roleSigil(role.role)}
            </div>
          ) : null}
        </div>
        {!mini ? privateResult : null}
        <div className={`role-card-body ${styles.body}`}>
          {!mini ? <p>{guide.summary}</p> : null}
          {compact ? (
            <details className={styles.details}>
              <summary>За ролята</summary>
              {mini ? <p>{guide.summary}</p> : null}
              <RoleFact label="Кога действа" value={guide.timing} />
              <RoleFact label="Цел" value={guide.win} />
            </details>
          ) : (
            <div className={`role-card-facts ${styles.facts}`}>
              <RoleFact label="Отбор" value={guide.team} />
              <RoleFact label="Кога действа" value={guide.timing} />
              <RoleFact label="Цел" value={guide.win} />
            </div>
          )}
        </div>
      </div>
      {mini ? privateResult : null}
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
