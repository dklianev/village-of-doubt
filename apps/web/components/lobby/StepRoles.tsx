import {
  ROLE_DEFINITIONS,
  countRoles,
  getRoleRuntimeStatus,
  getRolesForFamily,
  type RoleCode,
  type RoleDistribution,
} from "@werewolf/shared";
import { ChevronDown, FolderOpen, Redo2, Save, Search, Undo2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type Dispatch } from "react";
import {
  MANUAL_PRESET_STORAGE_KEY,
  adjustManualRoleRoster,
  boundedPlayerCount,
  currentConfig,
  replaceManualRoleInRoster,
  roleBalance,
  roleWarnings,
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { PresetChips } from "@/components/lobby/PresetChips";
import { RoleCarousel } from "@/components/lobby/RoleCarousel";
import { RoleDetailModal } from "@/components/lobby/RoleDetailModal";
import Image from "next/image";
import { coverImageSizes, roleArtSource } from "@/lib/role-art";
import { playCue } from "@/lib/sound";
import { Sheet } from "@werewolf/ui";

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
  const reserveRole: RoleCode = state.family === "werewolves" ? "ordinary_villager" : "civilian";
  const [pendingReplacement, setPendingReplacement] = useState<RoleCode | null>(null);
  const [roleChangeMessage, setRoleChangeMessage] = useState("");
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const summaryId = useId();
  const filtersId = useId();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [compact, setCompact] = useState(false);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!state.manualRolesEnabled) {
      setPendingReplacement(null);
      setRoleChangeMessage("");
    }
  }, [state.manualRolesEnabled]);

  function changeRole(role: RoleCode, delta: number) {
    const source = state.manualRolesEnabled ? state.manualRoles : config.roles;
    const result = adjustManualRoleRoster({
      family: state.family,
      roles: source,
      playerCount: state.playerCount,
      role,
      delta: delta > 0 ? 1 : -1,
    });

    if (result.status === "replacement-required") {
      setPendingReplacement(role);
      setSummaryExpanded(true);
      setRoleChangeMessage(`Избери коя роля да замени ${ROLE_DEFINITIONS[role].nameBg}.`);
      return;
    }

    if (result.status === "unchanged") {
      setRoleChangeMessage(
        role === reserveRole
          ? `${ROLE_DEFINITIONS[reserveRole].nameBg} запълва свободните места автоматично.`
          : `Достигнат е максималният брой за ${ROLE_DEFINITIONS[role].nameBg}.`,
      );
      return;
    }

    dispatch({ type: "SET_MANUAL_ROLES", roles: result.roles });
    setPendingReplacement(null);
    setRoleChangeMessage(
      roleChangeCopy(result.addedRole, result.removedRole, delta < 0 && result.addedRole === reserveRole),
    );
    playCue("vote");
    triggerHaptic(8);
  }

  function replaceRole(removeRole: RoleCode) {
    if (!pendingReplacement) {
      return;
    }
    dispatch({
      type: "SET_MANUAL_ROLES",
      roles: replaceManualRoleInRoster({
        roles: activeDistribution,
        addRole: pendingReplacement,
        removeRole,
      }),
    });
    setRoleChangeMessage(`${ROLE_DEFINITIONS[pendingReplacement].nameBg} замени ${ROLE_DEFINITIONS[removeRole].nameBg}.`);
    setPendingReplacement(null);
    playCue("vote");
    triggerHaptic([8, 24, 8]);
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
        {!embedded && warnings.length > 0 ? <div className="roles-warning-banner">{warnings[0]}</div> : null}
      </div>

      <div className="create-role-workspace">
        <div className="create-role-gallery">
          {state.manualRolesEnabled ? (
            <div id={filtersId} className="manual-builder-toolbar" data-expanded={filtersExpanded}>
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
                  Автоматични
                </button>
                <button
                  type="button"
                  className={state.runtimeFilter === "manual_only" ? "is-active" : ""}
                  aria-pressed={state.runtimeFilter === "manual_only"}
                  onClick={() => dispatch({ type: "SET_RUNTIME_FILTER", runtimeFilter: "manual_only" })}
                >
                  Ръчно водени
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
            {...(state.manualRolesEnabled ? { reserveRole } : {})}
            onIncrement={(role) => changeRole(role, 1)}
            onDecrement={(role) => changeRole(role, -1)}
            onOpen={(role) => {
              detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              dispatch({ type: "SET_ROLE_DETAIL", roleDetail: { role, source: "tile" } });
            }}
            filterControl={state.manualRolesEnabled ? (
              <button
                type="button"
                aria-label="Търсене и филтри"
                title="Търсене и филтри"
                aria-expanded={filtersExpanded}
                aria-controls={filtersId}
                onClick={() => setFiltersExpanded((expanded) => !expanded)}
              >
                <Search aria-hidden="true" />
              </button>
            ) : null}
          />
        </div>

        <section className="create-role-inspector" aria-label="Състав на масата" tabIndex={0} data-expanded={summaryExpanded || Boolean(pendingReplacement)}>
          {state.roleDetail && embedded && !compact ? (
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
              <div className="create-role-balance" data-balanced={Math.abs(balance) <= 3 ? "true" : "false"}>
                <span>
                  <b>Баланс</b>
                  <small>{roleBalanceCopy(state.family, balance)}</small>
                </span>
                <strong>{balance > 0 ? `+${balance}` : balance}</strong>
              </div>
              <button
                type="button"
                className="create-role-summary-toggle"
                aria-label={summaryExpanded ? "Скрий състава" : "Покажи състава"}
                aria-expanded={summaryExpanded || Boolean(pendingReplacement)}
                aria-controls={summaryId}
                disabled={Boolean(pendingReplacement)}
                onClick={() => setSummaryExpanded((expanded) => !expanded)}
              >
                <ChevronDown aria-hidden="true" />
              </button>
              {state.manualRolesEnabled && !roleChangeMessage ? (
                <p className="create-role-roster-rule">
                  Специалните роли заменят {ROLE_DEFINITIONS[reserveRole].nameBg}. Броят места остава точен.
                </p>
              ) : null}
              {pendingReplacement ? (
                <div className="create-role-swap-panel">
                  <strong>Коя роля отстъпва място?</strong>
                  <span>{ROLE_DEFINITIONS[pendingReplacement].nameBg} ще заеме избраното място.</span>
                  <button type="button" onClick={() => setPendingReplacement(null)}>Откажи</button>
                </div>
              ) : null}
              <ul id={summaryId} className="create-selected-role-list" data-replacing={pendingReplacement ? "true" : "false"}>
                {selectedRoles.map((role) => (
                  <li key={role}>
                    {pendingReplacement && role !== pendingReplacement ? (
                      <button
                        type="button"
                        title={ROLE_DEFINITIONS[role].nameBg}
                        aria-label={`Замени ${ROLE_DEFINITIONS[role].nameBg} с ${ROLE_DEFINITIONS[pendingReplacement].nameBg}`}
                        onClick={() => replaceRole(role)}
                      >
                        <span>{activeDistribution[role] ?? 0}</span>
                        <strong>{ROLE_DEFINITIONS[role].nameBg}</strong>
                      </button>
                    ) : (
                      <div title={ROLE_DEFINITIONS[role].nameBg}>
                        <span>{activeDistribution[role] ?? 0}</span>
                        <strong>{ROLE_DEFINITIONS[role].nameBg}</strong>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {roleChangeMessage ? <p className="create-role-change-message" role="status" aria-live="polite">{roleChangeMessage}</p> : null}
              {warnings[0] ? <p className="create-role-summary-warning">{warnings[0]}</p> : null}
            </>
          )}
        </section>
      </div>

      <div className="manual-builder-actions">
        {!state.manualRolesEnabled ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setRoleChangeMessage("");
                dispatch({ type: "SET_MANUAL_ROLES_ENABLED", enabled: true });
              }}
            >
              Настрой ръчно
            </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary create-role-preset-action min-h-0 px-4 py-2" aria-label="Запази шаблон" title="Запази шаблон" onClick={() => saveManualPreset(state, dispatch)}>
              <Save aria-hidden="true" />
              <span>Запази шаблон</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary create-role-preset-action min-h-0 px-4 py-2"
              aria-label="Зареди шаблон"
              title="Зареди шаблон"
              onClick={() => {
                setPendingReplacement(null);
                setRoleChangeMessage("");
                loadManualPreset(state, dispatch);
              }}
            >
              <FolderOpen aria-hidden="true" />
              <span>Зареди шаблон</span>
            </button>
            <button
              type="button"
              className="create-role-history-action"
              aria-label="Отмени последната промяна"
              title="Отмени последната промяна"
              disabled={state.manualRoleHistory.length === 0}
              onClick={() => {
                setPendingReplacement(null);
                setRoleChangeMessage("");
                dispatch({ type: "UNDO_MANUAL_ROLES" });
              }}
            >
              <Undo2 aria-hidden="true" />
            </button>
            <button
              type="button"
              className="create-role-history-action"
              aria-label="Повтори последната промяна"
              title="Повтори последната промяна"
              disabled={state.manualRoleFuture.length === 0}
              onClick={() => {
                setPendingReplacement(null);
                setRoleChangeMessage("");
                dispatch({ type: "REDO_MANUAL_ROLES" });
              }}
            >
              <Redo2 aria-hidden="true" />
            </button>
          </>
        )}
        {state.manualPresetMessage ? <span className="manual-builder-message" role="status">{state.manualPresetMessage}</span> : null}
      </div>

      {state.roleDetail && !embedded ? (
          <RoleDetailModal
            family={state.family}
            role={state.roleDetail.role}
            onClose={() => dispatch({ type: "SET_ROLE_DETAIL", roleDetail: null })}
          />
      ) : null}
      {state.roleDetail && embedded && compact ? (
        <Sheet open onOpenChange={(open) => { if (!open) dispatch({ type: "SET_ROLE_DETAIL", roleDetail: null }); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            detailTriggerRef.current?.focus({ preventScroll: true });
          }}
          title={ROLE_DEFINITIONS[state.roleDetail.role].nameBg} description="Карта и умение на ролята.">
          <div className="create-mobile-role-detail">
            <InlineRoleDetail family={state.family} role={state.roleDetail.role} heading={false}
              onClose={() => dispatch({ type: "SET_ROLE_DETAIL", roleDetail: null })} />
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

function roleChangeCopy(
  addedRole: RoleCode | undefined,
  removedRole: RoleCode | undefined,
  restoredReserve = false,
) {
  if (addedRole && removedRole && restoredReserve) {
    return `${ROLE_DEFINITIONS[removedRole].nameBg} е премахнат. ${ROLE_DEFINITIONS[addedRole].nameBg} запълни мястото.`;
  }
  if (addedRole && removedRole) {
    return `${ROLE_DEFINITIONS[addedRole].nameBg} замени ${ROLE_DEFINITIONS[removedRole].nameBg}.`;
  }
  if (addedRole) {
    return `${ROLE_DEFINITIONS[addedRole].nameBg} е добавен към състава.`;
  }
  if (removedRole) {
    return `${ROLE_DEFINITIONS[removedRole].nameBg} е премахнат от състава.`;
  }
  return "Съставът е обновен.";
}

function roleBalanceCopy(family: LobbyFormState["family"], balance: number) {
  if (family === "mafia") {
    return "готов състав";
  }
  if (Math.abs(balance) <= 3) {
    return "равновесие";
  }
  return balance > 0 ? "преднина за селото" : "преднина за заплахата";
}

function InlineRoleDetail({
  family,
  role,
  onClose,
  heading = true,
}: {
  family: LobbyFormState["family"];
  role: RoleCode;
  onClose: () => void;
  heading?: boolean;
}) {
  const definition = ROLE_DEFINITIONS[role];
  const source = roleArtSource(family, role);
  return (
    <article className="create-inline-role-detail" aria-labelledby={heading ? "create-inline-role-title" : undefined} aria-label={heading ? undefined : definition.nameBg}>
      <button type="button" className="create-role-detail-close" aria-label="Затвори ролята" onClick={onClose}>
        <X aria-hidden="true" />
      </button>
      <picture className="role-art-frame" data-frame-family={family}
        style={{ aspectRatio: source.width / source.height, width: `min(100%, calc(var(--role-detail-art-height) * ${source.width / source.height}))` }}
        aria-hidden="true">
        <Image
          {...source}
          alt=""
          loading="lazy"
          quality={85}
          sizes={coverImageSizes(source, [
            { media: "(max-width: 380px)", width: "calc(100vw - 56px)", aspectRatio: 1 },
            { media: "(max-width: 720px)", width: "calc(100vw - 60px)", aspectRatio: 1 },
            { media: "(max-width: 960px)", width: 192, aspectRatio: 1 },
            { media: "(max-width: 1100px)", width: 262, aspectRatio: 1 },
            { width: 254, aspectRatio: 1 },
          ])}
        />
      </picture>
      {heading ? <div>
        <p className="section-kicker">как действа</p>
        <h2 id="create-inline-role-title">{definition.nameBg}</h2>
      </div> : null}
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
  try {
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
  } catch {
    dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Шаблонът не може да бъде запазен в този браузър." });
  }
}

function loadManualPreset(state: LobbyFormState, dispatch: Dispatch<LobbyFormAction>) {
  try {
    const raw = window.localStorage.getItem(`${MANUAL_PRESET_STORAGE_KEY}:${state.family}`);
    if (raw === null) {
      dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Няма запазен шаблон за тази игра." });
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" || parsed === null || Array.isArray(parsed) ||
      !("roles" in parsed) || typeof parsed.roles !== "object" ||
      parsed.roles === null || Array.isArray(parsed.roles)
    ) {
      throw new Error("Invalid saved role template");
    }

    const familyRoles = getRolesForFamily(state.family);
    const roles: RoleDistribution = {};
    for (const [key, count] of Object.entries(parsed.roles)) {
      const role = familyRoles.find((candidate) => candidate === key);
      if (
        !role || typeof count !== "number" || !Number.isInteger(count) ||
        count < 0 || count > ROLE_DEFINITIONS[role].maxCopies
      ) {
        throw new Error("Invalid saved role template");
      }
      roles[role] = count;
    }

    const total = countRoles(roles);
    const validTotal = boundedPlayerCount({
      ...state,
      mode: state.family === "werewolves" ? "werewolves_classic" : "mafia_free",
      playerCount: total,
    });
    if (total !== validTotal) {
      throw new Error("Invalid saved role template total");
    }

    const playerCount = boundedPlayerCount(state);
    const reserveRole = state.family === "werewolves" ? "ordinary_villager" : "civilian";
    const reserveCount = (roles[reserveRole] ?? 0) + playerCount - total;
    if (reserveCount < 0) {
      dispatch({
        type: "SET_MANUAL_PRESET_MESSAGE",
        message: `Шаблонът не може да се зареди за ${playerCount} играчи без премахване на специални роли. Избери повече играчи или друг шаблон.`,
      });
      return;
    }
    if (reserveCount > ROLE_DEFINITIONS[reserveRole].maxCopies) {
      dispatch({
        type: "SET_MANUAL_PRESET_MESSAGE",
        message: `Шаблонът не може да се зареди за ${playerCount} играчи, защото ще се надвиши допустимият брой за ${ROLE_DEFINITIONS[reserveRole].nameBg}. Избери друг шаблон.`,
      });
      return;
    }
    roles[reserveRole] = reserveCount;

    dispatch({ type: "SET_MANUAL_ROLES", roles });
    dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Шаблонът е зареден." });
  } catch {
    dispatch({ type: "SET_MANUAL_PRESET_MESSAGE", message: "Запазеният шаблон не може да бъде прочетен." });
  }
}
