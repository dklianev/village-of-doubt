"use client";

import {
  ROLE_DEFINITIONS,
  countRoles,
  getRoleRuntimeStatus,
  getRolesForFamily,
  type RoleCode,
  type RoleDistribution,
} from "@werewolf/shared";
import type { Dispatch } from "react";
import {
  MANUAL_PRESET_STORAGE_KEY,
  boundedPlayerCount,
  currentConfig,
  roleBalance,
  roleWarnings,
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { PresetChips } from "@/components/lobby/PresetChips";
import { RoleCarousel } from "@/components/lobby/RoleCarousel";
import { RoleDetailModal } from "@/components/lobby/RoleDetailModal";
import { playCue } from "@/lib/sound";

export function StepRoles({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const config = currentConfig(state);
  const warnings = roleWarnings(state);
  const total = countRoles(config.roles);
  const visibleRoles = getRolesForFamily(state.family).filter((role) => {
    const definition = ROLE_DEFINITIONS[role];
    const haystack = `${definition.nameBg} ${definition.shortDescriptionBg} ${definition.tags.join(" ")} ${role}`.toLowerCase();
    const query = state.roleSearch.trim().toLowerCase();
    return (query.length === 0 || haystack.includes(query)) && getRoleRuntimeStatus(role) === state.runtimeFilter;
  });

  function changeRole(role: RoleCode, delta: number) {
    const source = state.manualRolesEnabled ? state.manualRoles : config.roles;
    const next: RoleDistribution = { ...source, [role]: Math.max(0, (source[role] ?? 0) + delta) };
    dispatch({ type: "SET_MANUAL_ROLES", roles: next });
    playCue("vote");
    triggerHaptic(8);
  }

  return (
    <section className="lobby-step lobby-step-roles" aria-labelledby="step-roles-title">
      <div className="roles-step-sticky">
        <div className="lobby-step-heading">
          <p className="section-kicker">стъпка 2</p>
          <h1 id="step-roles-title">Избери ролите</h1>
          <p>{total}/{state.playerCount} роли · баланс {roleBalance(state) > 0 ? `+${roleBalance(state)}` : roleBalance(state)}</p>
        </div>
        <PresetChips state={state} dispatch={dispatch} />
        {warnings.length > 0 ? <div className="roles-warning-banner">{warnings[0]}</div> : null}
      </div>

      <div className="manual-builder-toolbar">
        <input
          className="input"
          value={state.roleSearch}
          onChange={(event) => dispatch({ type: "SET_ROLE_SEARCH", query: event.target.value })}
          placeholder="Търси роля, отбор или таг..."
          aria-label="Търси роля"
        />
        <div className="manual-filter-tabs" aria-label="Филтър на ролите">
          <button
            type="button"
            className={state.runtimeFilter === "playable" ? "is-active" : ""}
            onClick={() => dispatch({ type: "SET_RUNTIME_FILTER", runtimeFilter: "playable" })}
          >
            Работещи
          </button>
          <button
            type="button"
            className={state.runtimeFilter === "manual_only" ? "is-active" : ""}
            onClick={() => dispatch({ type: "SET_RUNTIME_FILTER", runtimeFilter: "manual_only" })}
          >
            Разширени
          </button>
        </div>
      </div>

      <RoleCarousel
        family={state.family}
        roles={state.manualRolesEnabled ? visibleRoles : (Object.keys(config.roles) as RoleCode[])}
        distribution={state.manualRolesEnabled ? state.manualRoles : config.roles}
        readonly={!state.manualRolesEnabled}
        onIncrement={(role) => changeRole(role, 1)}
        onDecrement={(role) => changeRole(role, -1)}
        onOpen={(role) => dispatch({ type: "SET_ROLE_DETAIL", roleDetail: { role, source: "tile" } })}
      />

      <div className="manual-builder-actions">
        {!state.manualRolesEnabled ? (
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: "SET_MANUAL_ROLES_ENABLED", enabled: true })}>
            Настрой ръчно
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={() => saveManualPreset(state, dispatch)}>
              Запази шаблон
            </button>
            <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={() => loadManualPreset(state, dispatch)}>
              Зареди шаблон
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-0 px-4 py-2"
              disabled={state.manualRoleHistory.length === 0}
              onClick={() => dispatch({ type: "UNDO_MANUAL_ROLES" })}
            >
              Назад
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-0 px-4 py-2"
              disabled={state.manualRoleFuture.length === 0}
              onClick={() => dispatch({ type: "REDO_MANUAL_ROLES" })}
            >
              Напред
            </button>
            <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={() => dispatch({ type: "SET_ROLE_SEARCH", query: "" })}>
              Добави роля
            </button>
          </>
        )}
        {state.manualPresetMessage ? <span className="manual-builder-message">{state.manualPresetMessage}</span> : null}
      </div>

      {state.roleDetail ? (
        <RoleDetailModal
          family={state.family}
          role={state.roleDetail.role}
          onClose={() => dispatch({ type: "SET_ROLE_DETAIL", roleDetail: null })}
        />
      ) : null}
    </section>
  );
}

function triggerHaptic(pattern: number | number[]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(pattern);
}

function saveManualPreset(state: LobbyFormState, dispatch: Dispatch<LobbyFormAction>) {
  window.localStorage.setItem(
    `${MANUAL_PRESET_STORAGE_KEY}:${state.family}`,
    JSON.stringify({
      mode: state.mode,
      playerCount: boundedPlayerCount(state),
      roles: state.manualRoles,
      savedAt: Date.now(),
    }),
  );
  dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Шаблонът е запазен на това устройство." });
}

function loadManualPreset(state: LobbyFormState, dispatch: Dispatch<LobbyFormAction>) {
  const raw = window.localStorage.getItem(`${MANUAL_PRESET_STORAGE_KEY}:${state.family}`);
  if (!raw) {
    dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Няма запазен шаблон за тази игра." });
    return;
  }

  try {
    const parsed = JSON.parse(raw) as { roles?: RoleDistribution };
    dispatch({ type: "SET_MANUAL_ROLES", roles: parsed.roles ?? state.manualRoles });
    dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Шаблонът е зареден." });
  } catch {
    dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Запазеният шаблон не може да бъде прочетен." });
  }
}
