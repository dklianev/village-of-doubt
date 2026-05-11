"use client";

import { ROLE_PRESET_LABELS_BG, type RolePreset } from "@werewolf/shared";
import { rolePresetsForMode, type LobbyFormAction, type LobbyFormState } from "@/lib/lobby-form";
import type { Dispatch } from "react";

export function PresetChips({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  return (
    <div className="preset-chips" aria-label="Шаблони за роли">
      {rolePresetsForMode(state.mode).map((preset) => (
        <button
          key={preset}
          type="button"
          data-active={(state.manualRolesEnabled ? "manual" : state.rolePreset) === preset}
          onClick={() => dispatch({ type: "SET_ROLE_PRESET", rolePreset: preset })}
        >
          {shortPresetLabel(preset)}
        </button>
      ))}
    </div>
  );
}

function shortPresetLabel(preset: RolePreset) {
  if (preset === "beginner") {
    return "Начинаещи";
  }
  if (preset === "advanced") {
    return "Хаос";
  }
  if (preset === "manual") {
    return "Ръчно";
  }
  return ROLE_PRESET_LABELS_BG[preset];
}
