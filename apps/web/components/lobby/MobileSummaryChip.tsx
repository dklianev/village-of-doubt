"use client";

import { useEffect, type Dispatch } from "react";
import { roleWarnings, type LobbyFormAction, type LobbyFormState } from "@/lib/lobby-form";
import { StickyPreview } from "@/components/lobby/StickyPreview";

export function MobileSummaryChip({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const warnings = roleWarnings(state);

  useEffect(() => {
    if (!state.mobileSummaryOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "SET_MOBILE_SUMMARY_OPEN", open: false });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, state.mobileSummaryOpen]);

  return (
    <>
      <button type="button" className="mobile-summary-chip" onClick={() => dispatch({ type: "SET_MOBILE_SUMMARY_OPEN", open: true })}>
        <span>{state.playerCount} играчи · {warnings.length > 0 ? `⚠ ${warnings.length}` : "готово"}</span>
        <strong>⌃</strong>
      </button>
      {state.mobileSummaryOpen ? (
        <div className="mobile-summary-overlay" role="dialog" aria-modal="true">
          <button
            type="button"
            className="mobile-summary-backdrop"
            aria-label="Затвори прегледа"
            onClick={() => dispatch({ type: "SET_MOBILE_SUMMARY_OPEN", open: false })}
          />
          <StickyPreview state={state} dispatch={dispatch} compact />
        </div>
      ) : null}
    </>
  );
}
