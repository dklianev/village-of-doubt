"use client";

import { useEffect, type Dispatch } from "react";
import { Pill } from "@werewolf/ui";
import type { LobbyFormAction, LobbyFormState, LobbyStep } from "@/lib/lobby-form";
import styles from "./StepNav.module.css";

const STEPS: { step: LobbyStep; numeral: string; label: string }[] = [
  { step: 1, numeral: "I", label: "Стая" },
  { step: 2, numeral: "II", label: "Роли" },
  { step: 3, numeral: "III", label: "Стил" },
  { step: 4, numeral: "IV", label: "Преглед" },
];

type StepStatus = "active" | "visited" | "future";

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
    <nav className={styles.stepNav} aria-label="Стъпки за създаване на стая">
      <ol className={styles.stepList}>
        {STEPS.map(({ step, numeral, label }) => {
          const status: StepStatus = step === state.step ? "active" : step <= state.visitedStep ? "visited" : "future";
          const disabled = status === "future";
          return (
            <li key={step} className={styles.stepItem}>
              <button
                type="button"
                className={styles.stepChip}
                data-status={status}
                disabled={disabled}
                aria-current={status === "active" ? "step" : undefined}
                onClick={() => {
                  if (disabled) {
                    return;
                  }
                  transition(() => dispatch({ type: "SET_STEP", step }));
                }}
              >
                <span className={styles.stepNumeral} aria-hidden="true">
                  {status === "visited" ? "✓" : numeral}
                </span>
                <span className={styles.stepLabel}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.stepActions}>
        <Pill
          intent="secondary"
          disabled={state.step === 1}
          onClick={() => transition(() => dispatch({ type: "PREVIOUS_STEP" }))}
        >
          Назад
        </Pill>
        <Pill
          intent="faction"
          shimmer
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
