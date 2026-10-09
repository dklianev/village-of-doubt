"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameFamily, GameMode } from "@werewolf/shared";
import {
  createRoomCode,
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

  return <ConfiguredLobbyWizard key={`${family ?? ""}:${initialMode}:${searchParams.toString()}`} initialMode={initialMode} family={family} searchParams={searchParams} />;
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
  const [interactive, setInteractive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
    const root = rootRef.current;
    root?.setAttribute("data-create-active", "");
    setInteractive(true);
    // Activity keeps the DOM but tears down effects while the route is hidden.
    return () => { root?.removeAttribute("data-create-active"); };
  }, []);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  function onSubmit() {
    dispatch({ type: "SET_FORM_ERROR", formError: "" });
    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current);
    }
    submitTimerRef.current = window.setTimeout(() => {
      router.push(hrefForState("/play", state));
      // Activity retains this form after navigation; its next submission needs a fresh room.
      dispatch({ type: "SET_CODE", code: createRoomCode() });
      submitTimerRef.current = null;
    }, 220);
  }

  return (
    <div
      ref={rootRef}
      data-faction={state.family}
      data-family={state.family}
      data-layout="quick"
      className="lobby-wizard"
      inert={!interactive}
    >
      <QuickCreateSurface
        state={state}
        dispatch={dispatch}
        onOpenDetails={(trigger) => {
          detailsTriggerRef.current = trigger;
          setDetailsOpen(true);
        }}
        onSubmit={onSubmit}
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
        onOpenChange={setDetailsOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          detailsTriggerRef.current?.focus({ preventScroll: true });
        }}
      />
    </div>
  );
}
