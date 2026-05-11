"use client";

import type { LobbyFormAction } from "@/lib/lobby-form";
import type { Dispatch } from "react";

const QUICK_STARTS = [
  { label: "Бърза игра 6 души", detail: "Начинаещи · директен преглед", playerCount: 6, rolePreset: "beginner" as const },
  { label: "Класика 10 души", detail: "Най-познатата маса", playerCount: 10, rolePreset: "classic" as const },
  { label: "Голяма маса 16+", detail: "Разширен състав", playerCount: 16, rolePreset: "advanced" as const },
];

export function QuickStartRow({ dispatch }: { dispatch: Dispatch<LobbyFormAction> }) {
  return (
    <div className="quick-start-row" aria-label="Бързи шаблони">
      {QUICK_STARTS.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() =>
            dispatch({
              type: "APPLY_TEMPLATE",
              template: {
                mode: "werewolves_classic",
                playerCount: item.playerCount,
                rolePreset: item.rolePreset,
                step: 4,
              },
            })
          }
        >
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </button>
      ))}
    </div>
  );
}
