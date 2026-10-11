import type { CSSProperties } from "react";
import { EyeOff } from "lucide-react";
import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import { formatPrivateResult, roleGuideBg } from "@/lib/play/private-copy";
import { roleSigil } from "@/lib/play/player-display";
import { roleArtPath, roleThumbPath } from "@/lib/role-art";
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
  presentation?: "full" | "compact" | "mini" | "console";
}) {
  if (!role) {
    return null;
  }

  const compact = presentation === "compact" || presentation === "mini";
  const mini = presentation === "mini";
  const consolePresentation = presentation === "console";
  const definition = ROLE_DEFINITIONS[role.role];
  const roleFamily = family ?? definition.availableInFamilies[0] ?? "werewolves";
  const guide = roleGuideBg(role.role, roleFamily);
  // Console (120x180) and mini portraits stay sharp at 3x with the 520x780 thumb;
  // only the larger presentations need the full plate.
  const roleArtUrl = consolePresentation || mini
    ? roleThumbPath(roleFamily, role.role)
    : roleArtPath(roleFamily, role.role, "webp");
  const roleArtStyle = {
    "--role-art": `url("${roleArtUrl}")`,
  } as CSSProperties;
  const privateResult = result ? (
    <p className={`role-card-result ${styles.result}`} role="status" aria-label="Личен резултат">
      <span className={styles.resultLabel}>Резултат от проверката</span>{" "}
      <span>{formatPrivateResult(result, players)}</span>
    </p>
  ) : null;

  return (
    <article
      className={`role-card role-${role.role} ${consolePresentation ? styles.console : `paper-card ${styles.dossier}${compact ? ` ${styles.compact}` : ""}${mini ? ` ${styles.mini}` : ""}`}`}
      data-private-dossier="true"
      data-role-presentation={presentation}
      data-role-family={roleFamily}
      data-role-team={definition.team}
      aria-label={`Тайна роля: ${role.roleNameBg}`}
      style={roleArtStyle}
    >
      <div className={styles.art} aria-hidden="true" />
      <div className={styles.content}>
        <div className={`role-card-header ${styles.header}`}>
          <div>
            {!mini ? <p className={`section-kicker ${styles.kicker}`}>{consolePresentation ? <EyeOff aria-hidden /> : null}само за теб</p> : null}
            <h2>{role.roleNameBg}</h2>
            {compact ? <p className={styles.team}>{guide.team}</p> : null}
          </div>
          {!compact && !consolePresentation ? (
            <div className={`role-sigil ${styles.sigil}`} aria-hidden="true">
              {roleSigil(role.role)}
            </div>
          ) : null}
        </div>
        {!mini ? privateResult : null}
        <div className={`role-card-body ${styles.body}`}>
          {!mini && !consolePresentation ? <p>{guide.summary}</p> : null}
          {compact || consolePresentation ? (
            <details className={styles.details}>
              <summary>За ролята</summary>
              {mini || consolePresentation ? <p>{guide.summary}</p> : null}
              {consolePresentation ? <RoleFact label="Отбор" value={guide.team} /> : null}
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
