"use client";

import type { Dispatch } from "react";
import type { CommissionerResultMode, MajorityMode } from "@werewolf/shared";
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
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const players = boundedPlayerCount(state);

  function setAdvanced<K extends keyof AdvancedFlags>(key: K, value: AdvancedFlags[K]) {
    dispatch({ type: "SET_ADVANCED", key, value });
  }

  return (
    <details className="advanced-drawer">
      <summary>Покажи още настройки</summary>
      <div className="advanced-drawer-grid">
        <section className="advanced-panel">
          <h3>Правила</h3>
          <Toggle checked={state.advanced.revealRolesOnDeath} label="Разкриване на ролята при смърт" onChange={(value) => setAdvanced("revealRolesOnDeath", value)} />
          <Toggle checked={state.advanced.allowSkipVote} label="Позволи пропускане на глас" onChange={(value) => setAdvanced("allowSkipVote", value)} />
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
          <label className="lobby-field compact">
            <span>Максимум играчи</span>
            <input
              className="input"
              type="number"
              min={players}
              value={state.advanced.maxPlayers}
              onChange={(event) => setAdvanced("maxPlayers", Number(event.target.value))}
            />
          </label>
        </section>

        {state.family === "werewolves" ? (
          <section className="advanced-panel">
            <h3>Върколак</h3>
            <Toggle checked={state.advanced.loversEnabled} label="Включи Купидон и Влюбени, когато разпределението го позволява" onChange={(value) => setAdvanced("loversEnabled", value)} />
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
            <Toggle checked={state.advanced.maniacEnabled} label="Добави Маниак като трета страна" onChange={(value) => setAdvanced("maniacEnabled", value)} />
            <Toggle checked={state.advanced.jesterEnabled} label="Добави Шут с лична победа" onChange={(value) => setAdvanced("jesterEnabled", value)} />
          </section>
        )}
      </div>
    </details>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="wizard-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
