"use client";

import { useEffect, type CSSProperties, type Dispatch } from "react";
import { Pill } from "@werewolf/ui";
import type { LobbyFormAction, LobbyFormState, LobbyStep } from "@/lib/lobby-form";

const STEPS: { step: LobbyStep; label: string }[] = [
  { step: 1, label: "Стая" },
  { step: 2, label: "Роли" },
  { step: 3, label: "Стил" },
  { step: 4, label: "Преглед" },
];

type StepStatus = "active" | "visited" | "future";

const STEP_PILL_STYLE: Record<StepStatus, CSSProperties> = {
  active: {
    justifyContent: "flex-start",
    width: "100%",
    border: "1px solid rgba(209, 154, 66, 0.62)",
    background: "rgba(209, 154, 66, 0.18)",
    color: "#fff6e5",
    padding: "8px 10px",
  },
  visited: {
    justifyContent: "flex-start",
    width: "100%",
    border: "1px solid rgba(248, 236, 210, 0.14)",
    background: "rgba(248, 236, 210, 0.06)",
    color: "#ead9ba",
    padding: "8px 10px",
  },
  future: {
    justifyContent: "flex-start",
    width: "100%",
    border: "1px solid rgba(248, 236, 210, 0.14)",
    background: "rgba(248, 236, 210, 0.06)",
    color: "#ead9ba",
    opacity: 0.55,
    padding: "8px 10px",
  },
};

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
          const status: StepStatus = step === state.step ? "active" : step <= state.visitedStep ? "visited" : "future";
          return (
            <li key={step}>
              <Pill
                intent="ghost"
                size="sm"
                data-status={status}
                style={STEP_PILL_STYLE[status]}
                onClick={() => transition(() => dispatch({ type: "SET_STEP", step }))}
              >
                <span>{step}</span>
                <strong>{label}</strong>
              </Pill>
            </li>
          );
        })}
      </ol>

      <div className="lobby-step-actions">
        <Pill
          intent="secondary"
          disabled={state.step === 1}
          onClick={() => transition(() => dispatch({ type: "PREVIOUS_STEP" }))}
        >
          Назад
        </Pill>
        <Pill
          intent="primary"
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
        </Pill>
      </div>
    </nav>
  );
}
