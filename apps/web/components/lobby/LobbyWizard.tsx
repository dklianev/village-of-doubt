"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { countRoles } from "@werewolf/shared";
import type { GameFamily, GameMode } from "@werewolf/shared";
import { playCue } from "@/lib/sound";
import {
  MANUAL_PRESET_STORAGE_KEY,
  boundedPlayerCount,
  currentConfig,
  hrefForState,
  initialState,
  lobbyFormReducer,
  criticalRoleWarnings,
  roleWarnings,
  type LobbyFormState,
  type LobbyStep,
} from "@/lib/lobby-form";
import { MobileSummaryChip } from "@/components/lobby/MobileSummaryChip";
import { StepNav } from "@/components/lobby/StepNav";
import { StepPreview } from "@/components/lobby/StepPreview";
import { StepRoles } from "@/components/lobby/StepRoles";
import { StepRoom } from "@/components/lobby/StepRoom";
import { StepStyle } from "@/components/lobby/StepStyle";
import { StickyPreview } from "@/components/lobby/StickyPreview";

export function LobbyWizard({
  initialMode = "werewolves_classic",
  family,
}: {
  initialMode?: GameMode;
  family?: GameFamily | undefined;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = useMemo(() => initialState({ initialMode, family, urlParams: searchParams }), [family, initialMode, searchParams]);
  const [state, dispatch] = useReducer(lobbyFormReducer, initial);
  const canAdvance = isStepValid(state, state.step);
  const previousStep = useRef(state.step);

  const transition = useCallback((update: () => void) => {
    const startViewTransition = "startViewTransition" in document ? document.startViewTransition.bind(document) : undefined;
    if (startViewTransition) {
      startViewTransition(update);
      return;
    }
    update();
  }, []);

  useEffect(() => {
    if (!state.manualRolesEnabled) {
      return;
    }
    window.localStorage.setItem(
      `${MANUAL_PRESET_STORAGE_KEY}:${state.family}`,
      JSON.stringify({
        mode: state.mode,
        playerCount: boundedPlayerCount(state),
        roles: state.manualRoles,
        savedAt: Date.now(),
      }),
    );
  }, [state.family, state.manualRoles, state.manualRolesEnabled, state.mode, state.playerCount]);

  useEffect(() => {
    if (previousStep.current === state.step) {
      return;
    }
    previousStep.current = state.step;
    playCue("phase-change");
    triggerHaptic([12]);
  }, [state.step]);

  function onAdvanceBlocked() {
    dispatch({ type: "SET_FORM_ERROR", formError: validationMessage(state, state.step) });
  }

  function onSubmit(href = hrefForState("/play", state)) {
    dispatch({ type: "SET_FORM_ERROR", formError: "" });
    dispatch({ type: "TRIGGER_CONFETTI" });
    playCue("win");
    triggerHaptic([18, 24, 18]);
    const delay = prefersReducedMotion() ? 0 : 220;
    window.setTimeout(() => router.push(href), delay);
  }

  return (
    <main data-theme={state.family} data-family={state.family} className="lobby-wizard">
      <div className="lobby-wizard-main">
        <StepNav state={state} dispatch={dispatch} canAdvance={canAdvance} onAdvanceBlocked={onAdvanceBlocked} transition={transition} />
        <div className="lobby-step-pane" style={{ viewTransitionName: "lobby-step" }}>
          {state.step === 1 ? <StepRoom state={state} dispatch={dispatch} /> : null}
          {state.step === 2 ? <StepRoles state={state} dispatch={dispatch} /> : null}
          {state.step === 3 ? <StepStyle state={state} dispatch={dispatch} /> : null}
          {state.step === 4 ? <StepPreview state={state} dispatch={dispatch} onSubmit={onSubmit} /> : null}
        </div>
        {state.formError ? <p className="lobby-form-error">{state.formError}</p> : null}
      </div>
      <StickyPreview state={state} />
      <MobileSummaryChip state={state} dispatch={dispatch} />
      {state.confettiBurst > 0 ? <Confetti key={state.confettiBurst} /> : null}
    </main>
  );
}

function isStepValid(state: LobbyFormState, step: LobbyStep) {
  if (step === 1) {
    return cleanRoomStepValid(state);
  }
  if (step === 2) {
    const config = currentConfig(state);
    return countRoles(config.roles) === config.playerCount && criticalRoleWarnings(state).length === 0;
  }
  return true;
}

function validationMessage(state: LobbyFormState, step: LobbyStep) {
  if (step === 1) {
    return cleanRoomStepValid(state) ? "" : "Провери името на стаята и кода.";
  }
  if (step === 2) {
    const warning = criticalRoleWarnings(state)[0] ?? roleWarnings(state)[0];
    return warning ?? "Броят роли трябва да съвпада с броя играчи.";
  }
  return "Провери настройките преди следващата стъпка.";
}

function cleanRoomStepValid(state: LobbyFormState) {
  return state.roomName.trim().length > 0 && state.code.trim().length >= 4;
}

function Confetti() {
  return (
    <div className="lobby-confetti" aria-hidden="true">
      {Array.from({ length: 30 }, (_, index) => (
        <i
          key={index}
          style={
            {
              "--i": index,
              "--x": `${(index * 37) % 100}%`,
              "--dx": `${((index % 5) - 2) * 28}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function triggerHaptic(pattern: number | number[]) {
  if (prefersReducedMotion() || !("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(pattern);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
