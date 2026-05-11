"use client";

import {
  ROLE_DEFINITIONS,
  countRoles,
  getGameModeNameBg,
  teamLabelBg,
  type RoleCode,
  type TeamCode,
} from "@werewolf/shared";
import type { Dispatch } from "react";
import {
  boundedPlayerCount,
  currentConfig,
  roleBalance,
  roleWarnings,
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { roleThumbStyle } from "@/lib/role-art";

export function StickyPreview({
  state,
  dispatch,
  compact = false,
}: {
  state: LobbyFormState;
  dispatch?: Dispatch<LobbyFormAction>;
  compact?: boolean;
}) {
  const config = currentConfig(state);
  const warnings = roleWarnings(state);
  const total = countRoles(config.roles);
  const balance = roleBalance(state);
  const teamSummary = summarizeTeams(state);

  return (
    <aside className={`sticky-preview ${compact ? "is-compact" : ""}`}>
      <p className="section-kicker">преглед</p>
      <h2>{state.roomName || "Частна стая"}</h2>
      <div className="preview-summary-chip">
        {boundedPlayerCount(state)} играчи · {teamSummary}
      </div>
      <div className="preview-balance">
        <span>{state.family === "werewolves" ? "Баланс" : "Роли"}</span>
        <strong>{state.family === "werewolves" ? (balance > 0 ? `+${balance}` : balance) : `${total}/${boundedPlayerCount(state)}`}</strong>
        <i style={{ width: `${Math.max(10, Math.min(100, state.family === "werewolves" ? 100 - Math.abs(balance) * 12 : (total / boundedPlayerCount(state)) * 100))}%` }} />
      </div>
      <div className={`preview-warning ${warnings.length > 0 ? "has-warnings" : "is-clean"}`}>
        {warnings.length > 0 ? warnings.slice(0, 2).join(" ") : "Тази комбинация от роли е валидна."}
      </div>
      <dl className="preview-stat-list">
        <div>
          <dt>Режим</dt>
          <dd>{getGameModeNameBg(state.mode)}</dd>
        </div>
        <div>
          <dt>Темпо</dt>
          <dd>{config.timers.dayDiscussionSeconds}/{config.timers.factionNightActionSeconds}/{config.timers.voteSeconds} сек.</dd>
        </div>
      </dl>
      <div className="preview-role-stack">
        {Object.entries(config.roles)
          .slice(0, compact ? 6 : 10)
          .map(([role, count]) => (
            <span key={role} className={`role-count-chip role-${role}`}>
              <span className="role-count-art" aria-hidden="true" style={roleThumbStyle(state.family, role as RoleCode)} />
              <strong>{ROLE_DEFINITIONS[role as RoleCode].nameBg}</strong>
              <b>{count}</b>
            </span>
          ))}
      </div>
      <div className="achievement-preview-strip" aria-hidden="true">
        <span>победи</span>
        <span>оцеляване</span>
        <span>блъф</span>
      </div>
      {dispatch ? (
        <button type="button" className="btn btn-secondary preview-close-button" onClick={() => dispatch({ type: "SET_MOBILE_SUMMARY_OPEN", open: false })}>
          Затвори
        </button>
      ) : null}
    </aside>
  );
}

function summarizeTeams(state: LobbyFormState) {
  const roles = currentConfig(state).roles;
  const byTeam = new Map<string, number>();
  for (const [role, count] of Object.entries(roles) as [RoleCode, number | undefined][]) {
    const definition = ROLE_DEFINITIONS[role];
    byTeam.set(definition.team, (byTeam.get(definition.team) ?? 0) + (count ?? 0));
  }
  return [...byTeam.entries()]
    .slice(0, 3)
    .map(([team, count]) => `${count} ${teamLabelBg(team as TeamCode, state.family).toLowerCase()}`)
    .join(" · ");
}
