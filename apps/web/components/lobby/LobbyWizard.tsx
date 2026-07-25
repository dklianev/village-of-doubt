"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameFamily, GameMode } from "@werewolf/shared";
import { playCue } from "@/lib/sound";
import {
  MANUAL_PRESET_STORAGE_KEY,
  hrefForState,
  initialState,
  lobbyFormReducer,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { CreateCustomizationSheet } from "@/components/lobby/CreateCustomizationSheet";
import { CreateFamilyChoice } from "@/components/lobby/CreateFamilyChoice";
import { QuickCreateSurface } from "@/components/lobby/QuickCreateSurface";

export function LobbyWizard({
  initialMode = "werewolves_classic",
  family,
  showFamilyChoice = family === undefined,
}: {
  initialMode?: GameMode;
  family?: GameFamily | undefined;
  showFamilyChoice?: boolean;
}) {
  const searchParams = useSearchParams();
  const hasExplicitMode = searchParams.has("mode");

  if (showFamilyChoice && !family && !hasExplicitMode) {
    return (
      <div className="lobby-wizard" data-layout="family-choice">
        <CreateFamilyChoice searchParams={searchParams} />
      </div>
    );
  }

  return <ConfiguredLobbyWizard initialMode={initialMode} family={family} searchParams={searchParams} />;
}

function ConfiguredLobbyWizard({
  initialMode,
  family,
  searchParams,
}: {
  initialMode: GameMode;
  family: GameFamily | undefined;
  searchParams: URLSearchParams;
}) {
  const router = useRouter();
  const initialRef = useRef<LobbyFormState | null>(null);
  if (initialRef.current === null) {
    initialRef.current = initialState({ initialMode, family, urlParams: searchParams });
  }
  const [state, dispatch] = useReducer(lobbyFormReducer, initialRef.current);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const submitTimerRef = useRef<number | null>(null);
  const detailsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const transition = useCallback((update: () => void) => {
    const startViewTransition =
      "startViewTransition" in document
        ? document.startViewTransition.bind(document)
        : undefined;
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
        playerCount: state.playerCount,
        roles: state.manualRoles,
        savedAt: Date.now(),
      }),
    );
  }, [state.family, state.manualRoles, state.manualRolesEnabled, state.mode, state.playerCount]);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  function handleDetailsChange(open: boolean) {
    setDetailsOpen(open);
    if (!open) {
      window.requestAnimationFrame(() => detailsTriggerRef.current?.focus());
    }
  }

  function onSubmit() {
    dispatch({ type: "SET_FORM_ERROR", formError: "" });
    dispatch({ type: "TRIGGER_CONFETTI" });
    playCue("win");
    triggerHaptic([18, 24, 18]);
    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current);
    }
    submitTimerRef.current = window.setTimeout(() => {
      router.push(hrefForState("/play", state));
      submitTimerRef.current = null;
    }, 220);
  }

  return (
    <div
      data-faction={state.family}
      data-family={state.family}
      data-layout="quick"
      className="lobby-wizard"
    >
      <QuickCreateSurface
        state={state}
        dispatch={dispatch}
        onOpenDetails={() => setDetailsOpen(true)}
        onSubmit={onSubmit}
        detailsButtonRef={detailsTriggerRef}
        transition={transition}
      />
      {state.formError ? (
        <p className="lobby-form-error" role="status" aria-live="polite">
          {state.formError}
        </p>
      ) : null}
      <CreateCustomizationSheet
        state={state}
        dispatch={dispatch}
        open={detailsOpen}
        onOpenChange={handleDetailsChange}
      />
      {state.confettiBurst > 0 ? <Confetti key={state.confettiBurst} /> : null}
    </div>
  );
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
  if (!("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(pattern);
}
