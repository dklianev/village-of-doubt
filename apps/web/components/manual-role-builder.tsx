"use client";

import { useState } from "react";
import {
  ROLE_DEFINITIONS,
  countRoles,
  getRoleBalanceScore,
  getRoleNameBg,
  getRoleRuntimeStatus,
  getRolesForFamily,
  teamLabelBg,
  type GameFamily,
  type RoleCode,
  type RoleDistribution,
  type TeamCode,
} from "@werewolf/shared";
import { stringifyRolesParam } from "@/lib/room-options";
import { roleArtPath, roleThumbPath } from "@/lib/role-art";

interface ManualRoleBuilderProps {
  family: GameFamily;
  playerCount: number;
  roles: RoleDistribution;
  warnings: readonly string[];
  onRolesChange: (roles: RoleDistribution) => void;
  onSavePreset: () => void;
  onLoadPreset: () => void;
  presetMessage?: string;
}

type RuntimeFilter = "playable" | "manual_only";

const TEAM_ORDER: TeamCode[] = ["village", "werewolves", "vampires", "mafia", "lovers", "neutral"];

export function ManualRoleBuilder({
  family,
  playerCount,
  roles,
  warnings,
  onRolesChange,
  onSavePreset,
  onLoadPreset,
  presetMessage,
}: ManualRoleBuilderProps) {
  const selection = useManualRoleSelection(roles, playerCount, family, onRolesChange);
  const {
    query,
    setQuery,
    runtimeFilter,
    setRuntimeFilter,
    total,
    balance,
    groups,
    copyMessage,
    setRoleCount,
    undo,
    redo,
    canUndo,
    canRedo,
    copyPreset,
  } = selection;

  return (
    <section className="manual-role-builder mt-6 rounded-[2rem] p-5">
      <div className="manual-builder-header">
        <div>
          <p className="section-kicker">ръчно разпределение</p>
          <h2 className="mt-2 text-3xl font-black">Построй своята игра</h2>
          <p className="mt-2 text-sm text-[#ead9ba]">
            Добавяй роли като карти, гледай баланса в реално време и остави сървъра да валидира невъзможните комбинации.
          </p>
        </div>
        <BalanceMeter family={family} balance={balance} total={total} playerCount={playerCount} />
      </div>

      <div className="manual-builder-toolbar mt-5">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Търси роля, отбор или таг..."
          aria-label="Търси роля"
        />
        <div className="manual-filter-tabs" aria-label="Филтър на ролите">
          <button
            type="button"
            className={runtimeFilter === "playable" ? "is-active" : ""}
            onClick={() => setRuntimeFilter("playable")}
          >
            Работещи роли
          </button>
          <button
            type="button"
            className={runtimeFilter === "manual_only" ? "is-active" : ""}
            onClick={() => setRuntimeFilter("manual_only")}
          >
            Разширени роли
          </button>
        </div>
      </div>

      <div className="manual-builder-actions mt-4">
        <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={onSavePreset}>
          Запази шаблон
        </button>
        <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={onLoadPreset}>
          Зареди шаблон
        </button>
        <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={copyPreset}>
          Копирай шаблон
        </button>
        <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={undo} disabled={!canUndo}>
          Назад
        </button>
        <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={redo} disabled={!canRedo}>
          Напред
        </button>
        {presetMessage ? <span className="manual-builder-message">{presetMessage}</span> : null}
        {copyMessage ? <span className="manual-builder-message">{copyMessage}</span> : null}
      </div>

      <WarningStrip warnings={warnings} family={family} balance={balance} total={total} playerCount={playerCount} />

      <div className="manual-team-stack mt-5">
        {groups.map((group) => (
          <details key={group.team} className="manual-team-section" open>
            <summary>
              <span>{teamLabelBg(group.team, family)}</span>
              <strong>{countTeamRoles(roles, group.team)} роли</strong>
            </summary>
            <div className="manual-role-grid">
              {group.roles.map((role) => (
                <RoleTile
                  key={role}
                  family={family}
                  role={role}
                  count={roles[role] ?? 0}
                  onChange={(count) => setRoleCount(role, count)}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function useManualRoleSelection(
  roles: RoleDistribution,
  playerCount: number,
  family: GameFamily,
  onRolesChange: (roles: RoleDistribution) => void = () => {},
) {
  const [query, setQuery] = useState("");
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>("playable");
  const [history, setHistory] = useState<RoleDistribution[]>([]);
  const [future, setFuture] = useState<RoleDistribution[]>([]);
  const [copyMessage, setCopyMessage] = useState("");
  const total = countRoles(roles);
  const balance = getRoleBalanceScore(roles);
  const visibleRoles = getRolesForFamily(family).filter((role) => {
    const definition = ROLE_DEFINITIONS[role];
    const haystack = `${definition.nameBg} ${definition.shortDescriptionBg} ${definition.tags.join(" ")} ${role}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    return matchesQuery && getRoleRuntimeStatus(role) === runtimeFilter;
  });

  function commit(nextRoles: RoleDistribution) {
    setHistory((items) => [...items.slice(-11), roles]);
    setFuture([]);
    onRolesChange(cleanRoles(nextRoles));
  }

  function setRoleCount(role: RoleCode, count: number) {
    commit({
      ...roles,
      [role]: Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)),
    });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) {
      return;
    }
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [roles, ...items.slice(0, 11)]);
    onRolesChange(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) {
      return;
    }
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items.slice(-11), roles]);
    onRolesChange(next);
  }

  async function copyPreset() {
    const params = new URLSearchParams({
      players: String(playerCount),
      roles: stringifyRolesParam(roles),
    });
    await navigator.clipboard.writeText(params.toString()).catch(() => {});
    setCopyMessage("Шаблонът е копиран като линк параметри.");
  }

  const groups = TEAM_ORDER.map((team) => ({
    team,
    roles: visibleRoles.filter((role) => ROLE_DEFINITIONS[role].team === team),
  })).filter((group) => group.roles.length > 0);

  return {
    query,
    setQuery,
    runtimeFilter,
    setRuntimeFilter,
    total,
    balance,
    visibleRoles,
    groups,
    copyMessage,
    setRoleCount,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    copyPreset,
  };
}

function RoleTile({
  family,
  role,
  count,
  onChange,
}: {
  family: GameFamily;
  role: RoleCode;
  count: number;
  onChange: (count: number) => void;
}) {
  const definition = ROLE_DEFINITIONS[role];
  const runtimeStatus = getRoleRuntimeStatus(role);

  return (
    <article className={`manual-role-tile role-${role} ${count > 0 ? "is-selected" : ""}`}>
      <picture className="manual-role-art" aria-hidden="true">
        <source srcSet={roleThumbPath(family, role)} type="image/webp" />
        <img src={roleArtPath(family, role, "png")} alt="" loading="lazy" decoding="async" width={520} height={728} />
      </picture>
      <div className="manual-role-body">
        <div className="manual-role-title-row">
          <h3>{definition.nameBg}</h3>
          <span>{formatValue(definition.value)}</span>
        </div>
        <p>{definition.shortDescriptionBg}</p>
        <div className="manual-role-meta">
          <span>{definition.nightAction ? "нощна" : "дневна"}</span>
          <span>{definition.minPlayers}+ играчи</span>
          {runtimeStatus === "manual_only" ? <span>ръчно</span> : null}
        </div>
        <details className="manual-role-details">
          <summary>Как се играе</summary>
          <p>{definition.fullDescriptionBg}</p>
          {definition.dependencies.length > 0 ? (
            <ul>
              {definition.dependencies.map((dependency) => (
                <li key={dependency.roleId}>{dependency.reasonBg}</li>
              ))}
            </ul>
          ) : null}
        </details>
        <div className="manual-role-counter">
          <button type="button" onClick={() => onChange(count - 1)} aria-label={`Премахни ${definition.nameBg}`}>
            -
          </button>
          <input
            aria-label={`Брой ${definition.nameBg}`}
            type="number"
            min={0}
            max={definition.maxCopies}
            value={count}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <button type="button" onClick={() => onChange(count + 1)} aria-label={`Добави ${definition.nameBg}`}>
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function BalanceMeter({
  family,
  balance,
  total,
  playerCount,
}: {
  family: GameFamily;
  balance: number;
  total: number;
  playerCount: number;
}) {
  const balanceLabel =
    family === "mafia"
      ? total === playerCount
        ? "брой роли готов"
        : "провери броя роли"
      : Math.abs(balance) <= 3
        ? "добър баланс"
        : balance < 0
          ? "силна заплаха"
          : "силно село";
  const fill = family === "mafia" ? Math.min(100, Math.round((total / playerCount) * 100)) : Math.max(8, 100 - Math.min(92, Math.abs(balance) * 12));

  return (
    <div className="manual-balance-meter" data-status={Math.abs(balance) <= 3 ? "ok" : "warn"}>
      <span>{balanceLabel}</span>
      <strong>{family === "mafia" ? `${total}/${playerCount}` : balance > 0 ? `+${balance}` : balance}</strong>
      <div>
        <i style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function WarningStrip({
  warnings,
  family,
  balance,
  total,
  playerCount,
}: {
  warnings: readonly string[];
  family: GameFamily;
  balance: number;
  total: number;
  playerCount: number;
}) {
  const friendlyWarnings = warnings.length > 0 ? warnings : [successMessage(family, balance, total, playerCount)];

  return (
    <div className={`manual-warning-strip mt-5 ${warnings.length > 0 ? "has-warnings" : "is-clean"}`}>
      {friendlyWarnings.map((warning) => (
        <span key={warning}>{warning}</span>
      ))}
    </div>
  );
}

function successMessage(family: GameFamily, balance: number, total: number, playerCount: number) {
  if (total !== playerCount) {
    return `Остават ${Math.abs(playerCount - total)} роли до пълна маса.`;
  }
  if (family === "mafia") {
    return "Разпределението е готово за Мафия.";
  }
  if (Math.abs(balance) <= 3) {
    return "Балансът е близо до нула и е подходящ за стартова игра.";
  }
  return "Разпределението е валидно, но балансът е по-остър.";
}

function countTeamRoles(distribution: RoleDistribution, team: TeamCode) {
  return Object.entries(distribution).reduce((sum, [role, count]) => {
    return ROLE_DEFINITIONS[role as RoleCode].team === team ? sum + (count ?? 0) : sum;
  }, 0);
}

function cleanRoles(distribution: RoleDistribution): RoleDistribution {
  const cleaned: RoleDistribution = {};
  for (const [role, count] of Object.entries(distribution) as [RoleCode, number | undefined][]) {
    if (count && count > 0) {
      cleaned[role] = count;
    }
  }
  return cleaned;
}

function formatValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
