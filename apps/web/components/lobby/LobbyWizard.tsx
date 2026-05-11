"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { countRoles } from "@werewolf/shared";
import type { GameFamily, GameMode } from "@werewolf/shared";
import { ANONYMOUS_DISPLAY_NAME_KEY, saveAnonymousIdentity, validateDisplayNameBg } from "@/lib/anonymous-player";
import {
  MANUAL_PRESET_STORAGE_KEY,
  boundedPlayerCount,
  currentConfig,
  hrefForState,
  initialState,
  lobbyFormReducer,
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

  const transition = useCallback((update: () => void) => {
    const startViewTransition = "startViewTransition" in document ? document.startViewTransition.bind(document) : undefined;
    if (startViewTransition) {
      startViewTransition(update);
      return;
    }
    update();
  }, []);

  useEffect(() => {
    dispatch({ type: "SET_DISPLAY_NAME", displayName: window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) ?? "" });
  }, []);

  useEffect(() => {
    if (!state.displayName.trim()) {
      return;
    }
    window.localStorage.setItem(ANONYMOUS_DISPLAY_NAME_KEY, state.displayName);
  }, [state.displayName]);

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

  function onAdvanceBlocked() {
    dispatch({ type: "SET_FORM_ERROR", formError: validationMessage(state, state.step) });
  }

  function onSubmit(href = hrefForState("/play", state)) {
    const error = validateDisplayNameBg(state.displayName);
    if (error) {
      dispatch({ type: "SET_FORM_ERROR", formError: error });
      transition(() => dispatch({ type: "SET_STEP", step: 1 }));
      return;
    }

    saveAnonymousIdentity(state.displayName);
    dispatch({ type: "SET_FORM_ERROR", formError: "" });
    router.push(href);
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
    </main>
  );
}

function isStepValid(state: LobbyFormState, step: LobbyStep) {
  if (step === 1) {
    return !validateDisplayNameBg(state.displayName);
  }
  if (step === 2) {
    const config = currentConfig(state);
    return countRoles(config.roles) === config.playerCount && roleWarnings(state).length === 0;
  }
  return true;
}

function validationMessage(state: LobbyFormState, step: LobbyStep) {
  if (step === 1) {
    return validateDisplayNameBg(state.displayName) ?? "Провери името преди следващата стъпка.";
  }
  if (step === 2) {
    const warning = roleWarnings(state)[0];
    return warning ?? "Броят роли трябва да съвпада с броя играчи.";
  }
  return "Провери настройките преди следващата стъпка.";
}
