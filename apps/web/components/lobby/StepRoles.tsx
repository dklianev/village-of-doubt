import {
  ROLE_DEFINITIONS,
  countRoles,
  getRoleRuntimeStatus,
  getRolesForFamily,
  type RoleCode,
  type RoleDistribution,
} from "@werewolf/shared";
import { FolderOpen, Redo2, Save, Undo2, X } from "lucide-react";
import { useMemo, type Dispatch } from "react";
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
import { roleArtPath, roleThumbPath } from "@/lib/role-art";
import { playCue } from "@/lib/sound";

export function StepRoles({
  state,
  dispatch,
  embedded = false,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  embedded?: boolean;
}) {
  const config = currentConfig(state);
  const warnings = roleWarnings(state);
  const total = countRoles(config.roles);
  const balance = roleBalance(state);
  const activeDistribution = state.manualRolesEnabled ? state.manualRoles : config.roles;
  const selectedRoles = getRolesForFamily(state.family).filter(
    (role) => role !== "lovers" && (activeDistribution[role] ?? 0) > 0,
  );
  const visibleRoles = useMemo(() => {
    const query = state.roleSearch.trim().toLowerCase();
    return getRolesForFamily(state.family).filter((role) => {
      const definition = ROLE_DEFINITIONS[role];
      const haystack = `${definition.nameBg} ${definition.shortDescriptionBg} ${definition.tags.join(" ")} ${role}`.toLowerCase();
      return role !== "lovers" && (query.length === 0 || haystack.includes(query)) && getRoleRuntimeStatus(role) === state.runtimeFilter;
    });
  }, [state.family, state.roleSearch, state.runtimeFilter]);

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
          <p className="section-kicker">{embedded ? "състав на вечерта" : "стъпка 2"}</p>
          <h1 id="step-roles-title" tabIndex={-1}>Избери ролите</h1>
          <p>{total}/{state.playerCount} роли · баланс {balance > 0 ? `+${balance}` : balance}</p>
        </div>
        <PresetChips state={state} dispatch={dispatch} />
        {warnings.length > 0 ? <div className="roles-warning-banner">{warnings[0]}</div> : null}
      </div>

      <div className="create-role-workspace">
        <div className="create-role-gallery">
          {state.manualRolesEnabled ? (
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
                  aria-pressed={state.runtimeFilter === "playable"}
                  onClick={() => dispatch({ type: "SET_RUNTIME_FILTER", runtimeFilter: "playable" })}
                >
                  Работещи
                </button>
                <button
                  type="button"
                  className={state.runtimeFilter === "manual_only" ? "is-active" : ""}
                  aria-pressed={state.runtimeFilter === "manual_only"}
                  onClick={() => dispatch({ type: "SET_RUNTIME_FILTER", runtimeFilter: "manual_only" })}
                >
                  Разширени
                </button>
              </div>
            </div>
          ) : null}

          <RoleCarousel
            family={state.family}
            roles={state.manualRolesEnabled ? visibleRoles : selectedRoles}
            distribution={activeDistribution}
            readonly={!state.manualRolesEnabled}
            layout={embedded ? "workspace" : "carousel"}
            onIncrement={(role) => changeRole(role, 1)}
            onDecrement={(role) => changeRole(role, -1)}
            onOpen={(role) => dispatch({ type: "SET_ROLE_DETAIL", roleDetail: { role, source: "tile" } })}
          />
        </div>

        <aside className="create-role-inspector" aria-label="Състав на масата">
          {state.roleDetail && embedded ? (
            <InlineRoleDetail
              family={state.family}
              role={state.roleDetail.role}
              onClose={() => dispatch({ type: "SET_ROLE_DETAIL", roleDetail: null })}
            />
          ) : (
            <>
              <div className="create-role-summary-heading">
                <p className="section-kicker">избрани роли</p>
                <h2>Състав на масата</h2>
                <span>{total} от {state.playerCount} места</span>
              </div>
              <div className="create-role-balance" data-balanced={balance === 0 ? "true" : "false"}>
                <span>Баланс</span>
                <strong>{balance > 0 ? `+${balance}` : balance}</strong>
              </div>
              <ul className="create-selected-role-list">
                {selectedRoles.map((role) => (
                  <li key={role}>
                    <span>{activeDistribution[role] ?? 0}</span>
                    <strong>{ROLE_DEFINITIONS[role].nameBg}</strong>
                  </li>
                ))}
              </ul>
              {warnings[0] ? <p className="create-role-summary-warning">{warnings[0]}</p> : null}
            </>
          )}
        </aside>
      </div>

      <div className="manual-builder-actions">
        {!state.manualRolesEnabled ? (
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: "SET_MANUAL_ROLES_ENABLED", enabled: true })}>
            Настрой ръчно
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={() => saveManualPreset(state, dispatch)}>
              <Save aria-hidden="true" />
              Запази шаблон
            </button>
            <button type="button" className="btn btn-secondary min-h-0 px-4 py-2" onClick={() => loadManualPreset(state, dispatch)}>
              <FolderOpen aria-hidden="true" />
              Зареди шаблон
            </button>
            <button
              type="button"
              className="create-role-history-action"
              aria-label="Отмени последната промяна"
              title="Отмени последната промяна"
              disabled={state.manualRoleHistory.length === 0}
              onClick={() => dispatch({ type: "UNDO_MANUAL_ROLES" })}
            >
              <Undo2 aria-hidden="true" />
            </button>
            <button
              type="button"
              className="create-role-history-action"
              aria-label="Повтори последната промяна"
              title="Повтори последната промяна"
              disabled={state.manualRoleFuture.length === 0}
              onClick={() => dispatch({ type: "REDO_MANUAL_ROLES" })}
            >
              <Redo2 aria-hidden="true" />
            </button>
          </>
        )}
        {state.manualPresetMessage ? <span className="manual-builder-message">{state.manualPresetMessage}</span> : null}
      </div>

      {state.roleDetail && !embedded ? (
          <RoleDetailModal
            family={state.family}
            role={state.roleDetail.role}
            onClose={() => dispatch({ type: "SET_ROLE_DETAIL", roleDetail: null })}
          />
      ) : null}
    </section>
  );
}

function InlineRoleDetail({
  family,
  role,
  onClose,
}: {
  family: LobbyFormState["family"];
  role: RoleCode;
  onClose: () => void;
}) {
  const definition = ROLE_DEFINITIONS[role];
  return (
    <article className="create-inline-role-detail" aria-labelledby="create-inline-role-title">
      <button type="button" className="create-role-detail-close" aria-label="Затвори ролята" onClick={onClose}>
        <X aria-hidden="true" />
      </button>
      <picture aria-hidden="true">
        <source srcSet={roleThumbPath(family, role)} type="image/webp" />
        <img src={roleArtPath(family, role, "png")} alt="" loading="lazy" decoding="async" width={520} height={728} />
      </picture>
      <div>
        <p className="section-kicker">как действа</p>
        <h2 id="create-inline-role-title">{definition.nameBg}</h2>
      </div>
      <p>{definition.fullDescriptionBg}</p>
      <div className="role-detail-tags">
        {definition.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </article>
  );
}

function triggerHaptic(pattern: number | number[]) {
  if (!("vibrate" in navigator)) {
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
