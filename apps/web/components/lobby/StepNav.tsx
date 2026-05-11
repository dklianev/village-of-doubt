"use client";

import { useEffect, type Dispatch } from "react";
import type { LobbyFormAction, LobbyFormState, LobbyStep } from "@/lib/lobby-form";

const STEPS: { step: LobbyStep; label: string }[] = [
  { step: 1, label: "Стая" },
  { step: 2, label: "Роли" },
  { step: 3, label: "Стил" },
  { step: 4, label: "Преглед" },
];

export function StepNav({
  state,
  dispatch,
  canAdvance,
  onAdvanceBlocked,
  transition,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  canAdvance: boolean;
  onAdvanceBlocked: () => void;
  transition: (update: () => void) => void;
}) {
  const isLast = state.step === 4;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button")) {
        return;
      }
      if (event.key === "ArrowLeft") {
        transition(() => dispatch({ type: "PREVIOUS_STEP" }));
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        if (canAdvance) {
          transition(() => dispatch({ type: "NEXT_STEP" }));
        } else {
          onAdvanceBlocked();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAdvance, dispatch, onAdvanceBlocked, transition]);

  return (
    <nav className="lobby-step-nav" aria-label="Стъпки за създаване на стая">
      <ol>
        {STEPS.map(({ step, label }) => {
          const status = step === state.step ? "active" : step <= state.visitedStep ? "visited" : "future";
          return (
            <li key={step}>
              <button type="button" data-status={status} onClick={() => transition(() => dispatch({ type: "SET_STEP", step }))}>
                <span>{step}</span>
                <strong>{label}</strong>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="lobby-step-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={state.step === 1}
          onClick={() => transition(() => dispatch({ type: "PREVIOUS_STEP" }))}
        >
          Назад
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isLast}
          onClick={() => {
            if (!canAdvance) {
              onAdvanceBlocked();
              return;
            }
            transition(() => dispatch({ type: "NEXT_STEP" }));
          }}
        >
          Напред
        </button>
      </div>
    </nav>
  );
}
