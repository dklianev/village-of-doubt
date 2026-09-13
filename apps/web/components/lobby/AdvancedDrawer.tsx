import { useId, useState, type Dispatch } from "react";
import type { CommissionerResultMode, MajorityMode } from "@werewolf/shared";
import { ArrowRight } from "lucide-react";
import { boundedPlayerCount, type AdvancedFlags, type LobbyFormAction, type LobbyFormState } from "@/lib/lobby-form";

const MAJORITY_LABELS: Record<MajorityMode, string> = {
  simple: "Обикновено мнозинство",
  absolute: "Абсолютно мнозинство",
};

const COMMISSIONER_RESULT_LABELS: Record<CommissionerResultMode, string> = {
  team_only: "Само отбор",
  exact_role: "Точна роля",
};

export function AdvancedDrawer({
  state,
  dispatch,
  onEditRoles,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  onEditRoles?: () => void;
}) {
  const players = boundedPlayerCount(state);
  const capacityHintId = useId();
  const manualRolesHintId = useId();
  const [capacityDraft, setCapacityDraft] = useState<string | null>(null);
  const capacityValue = capacityDraft ?? String(state.advanced.maxPlayers);
  const capacity = capacityValue.trim() === "" ? Number.NaN : Number(capacityValue);
  const capacityInvalid = !Number.isInteger(capacity) || capacity < players || capacity > 30;
  const jesterIncluded = state.manualRolesEnabled ? (state.manualRoles.jester ?? 0) > 0 : state.advanced.jesterEnabled;
  const maniacIncluded = state.manualRolesEnabled ? (state.manualRoles.maniac ?? 0) > 0 : state.advanced.maniacEnabled;

  function setAdvanced<K extends keyof AdvancedFlags>(key: K, value: AdvancedFlags[K]) {
    dispatch({ type: "SET_ADVANCED", key, value });
  }

  function changeCapacity(value: string) {
    setCapacityDraft(value);
    const next = value.trim() === "" ? Number.NaN : Number(value);
    if (Number.isInteger(next) && next >= players && next <= 30) {
      setAdvanced("maxPlayers", next);
    }
  }

  return (
    <details className="advanced-drawer">
      <summary>Покажи още настройки</summary>
      <div className="advanced-drawer-grid">
        <section className="advanced-panel">
          <h3>Правила</h3>
          <Toggle checked={state.advanced.revealRolesOnDeath} label="Разкриване на ролята при смърт" onChange={(value) => setAdvanced("revealRolesOnDeath", value)} />
          {state.mode === "mafia_sport" ? (
            <p className="advanced-panel-note">Спортният формат изисква избор и не допуска пропускане на глас.</p>
          ) : (
            <Toggle checked={state.advanced.allowSkipVote} label="Позволи пропускане на глас" onChange={(value) => setAdvanced("allowSkipVote", value)} />
          )}
          <Toggle checked={state.advanced.autoStart} label="Автоматичен старт, когато всички са готови" onChange={(value) => setAdvanced("autoStart", value)} />
          <label className="lobby-field compact">
            <span>Изискване за гласуване</span>
            <select
              className="input"
              value={state.advanced.majorityMode}
              onChange={(event) => setAdvanced("majorityMode", event.target.value as MajorityMode)}
            >
              {Object.entries(MAJORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="advanced-panel">
          <h3>Капацитет</h3>
          {state.mode === "mafia_sport" ? (
            <p className="advanced-panel-note">Спортната маса е фиксирана за точно 10 играчи.</p>
          ) : (
            <>
              <label className="lobby-field compact">
                <span>Максимум играчи</span>
                <input
                  className="input"
                  type="number"
                  min={players}
                  max={30}
                  step={1}
                  value={capacityValue}
                  aria-invalid={capacityInvalid}
                  aria-describedby={capacityHintId}
                  onChange={(event) => changeCapacity(event.target.value)}
                  onBlur={() => {
                    setAdvanced("maxPlayers", capacity);
                    setCapacityDraft(null);
                  }}
                />
              </label>
              <p id={capacityHintId} className="advanced-panel-note" aria-live="polite">
                {capacityInvalid ? `Въведи цяло число от ${players} до 30.` : `От ${players} до 30 играчи.`}
              </p>
            </>
          )}
        </section>

        {state.family === "werewolves" ? (
          <section className="advanced-panel">
            <h3>Върколак</h3>
            <p className="advanced-panel-note">
              Добави Купидон от картите с роли. През първата нощ той свързва двама Влюбени.
            </p>
            <Toggle
              checked={jesterIncluded}
              disabled={state.manualRolesEnabled}
              describedBy={state.manualRolesEnabled ? manualRolesHintId : undefined}
              label="Добави Шут с лична победа"
              onChange={(value) => setAdvanced("jesterEnabled", value)}
            />
            {state.manualRolesEnabled ? (
              <ManualRolesHint id={manualRolesHintId} onEditRoles={onEditRoles} />
            ) : null}
          </section>
        ) : (
          <section className="advanced-panel">
            <h3>Мафия</h3>
            <Toggle checked={state.advanced.mafiaNightKill} label="Нощно убийство от Мафията" onChange={(value) => setAdvanced("mafiaNightKill", value)} />
            <Toggle checked={state.advanced.doctorCanSelfProtect} label="Докторът може да пази себе си" onChange={(value) => setAdvanced("doctorCanSelfProtect", value)} />
            <label className="lobby-field compact">
              <span>Резултат от Комисаря</span>
              <select
                className="input"
                value={state.advanced.commissionerResultMode}
                onChange={(event) => setAdvanced("commissionerResultMode", event.target.value as CommissionerResultMode)}
              >
                {Object.entries(COMMISSIONER_RESULT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {state.mode === "mafia_sport" ? (
              <div className="advanced-fixed-composition">
                <p className="advanced-panel-note">
                  Фиксиран състав: 6 граждани, 2 мафиоти, Дон и Комисар. Маниак и Шут са достъпни в свободна Мафия.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary advanced-format-switch"
                  onClick={() => dispatch({
                    type: "APPLY_TEMPLATE",
                    template: { mode: "mafia_free", playerCount: players, rolePreset: "free" },
                  })}
                >
                  <span>Премини към свободна Мафия</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <Toggle
                  checked={maniacIncluded}
                  disabled={state.manualRolesEnabled}
                  describedBy={state.manualRolesEnabled ? manualRolesHintId : undefined}
                  label="Добави Маниак като трета страна"
                  onChange={(value) => setAdvanced("maniacEnabled", value)}
                />
                <Toggle
                  checked={jesterIncluded}
                  disabled={state.manualRolesEnabled}
                  describedBy={state.manualRolesEnabled ? manualRolesHintId : undefined}
                  label="Добави Шут с лична победа"
                  onChange={(value) => setAdvanced("jesterEnabled", value)}
                />
                {state.manualRolesEnabled ? (
                  <ManualRolesHint id={manualRolesHintId} onEditRoles={onEditRoles} />
                ) : null}
              </>
            )}
          </section>
        )}
      </div>
    </details>
  );
}

function ManualRolesHint({ id, onEditRoles }: { id: string; onEditRoles: (() => void) | undefined }) {
  return (
    <div>
      <p id={id} className="advanced-panel-note">Ръчният състав се променя от раздел „Роли“.</p>
      {onEditRoles ? (
        <button type="button" className="btn btn-secondary advanced-format-switch" onClick={onEditRoles}>
          <span>Редактирай ролите</span><ArrowRight aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  disabled = false,
  describedBy,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  describedBy?: string | undefined;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="wizard-toggle">
      <input type="checkbox" checked={checked} disabled={disabled} aria-describedby={describedBy} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
