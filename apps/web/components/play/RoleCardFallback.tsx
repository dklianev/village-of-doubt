import type { ComponentProps } from "react";
import { ROLE_DEFINITIONS, teamLabelBg } from "@werewolf/shared";
import { formatPrivateResult } from "@/lib/play/private-result-copy";
import type { RoleCard } from "./RoleCard";

export function RoleCardFallback({ role, result, players, family }: ComponentProps<typeof RoleCard>) {
  if (!role) return null;
  const definition = ROLE_DEFINITIONS[role.role];
  return <article className="play-personal-context" aria-label={`Тайна роля: ${role.roleNameBg}`}>
    <h2>{role.roleNameBg}</h2>
    <p>{teamLabelBg(definition.team, family ?? definition.availableInFamilies[0])}</p>
    <p>{definition.fullDescriptionBg}</p>
    {result ? <p role="status" aria-label="Личен резултат">{formatPrivateResult(result, players)}</p> : null}
  </article>;
}
