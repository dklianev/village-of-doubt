import { memo, useCallback, type Dispatch } from "react";
import { roleWarnings, type LobbyFormAction, type LobbyFormState } from "@/lib/lobby-form";
import { StickyPreview } from "@/components/lobby/StickyPreview";
import { useModal } from "@/lib/use-modal";

function MobileSummaryChipImpl({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const warnings = roleWarnings(state);
  const closeSummary = useCallback(() => dispatch({ type: "SET_MOBILE_SUMMARY_OPEN", open: false }), [dispatch]);
  const { ref } = useModal({ open: state.mobileSummaryOpen, onClose: closeSummary });

  return (
    <>
      <button type="button" className="mobile-summary-chip" onClick={() => dispatch({ type: "SET_MOBILE_SUMMARY_OPEN", open: true })}>
        <span>{state.playerCount} играчи · {warnings.length > 0 ? `⚠ ${warnings.length}` : "готово"}</span>
        <strong>⌃</strong>
      </button>
      {state.mobileSummaryOpen ? (
        <div ref={ref} className="mobile-summary-overlay" role="dialog" aria-modal="true" aria-label="Преглед на стаята">
          <button
            type="button"
            className="mobile-summary-backdrop"
            aria-label="Затвори прегледа"
            onClick={closeSummary}
          />
          <StickyPreview state={state} dispatch={dispatch} compact />
        </div>
      ) : null}
    </>
  );
}

export const MobileSummaryChip = memo(MobileSummaryChipImpl, (prev, next) => {
  const p = prev.state;
  const n = next.state;
  if (prev.dispatch !== next.dispatch || p.mobileSummaryOpen !== n.mobileSummaryOpen) {
    return false;
  }

  const summaryStable =
    p.playerCount === n.playerCount &&
    p.family === n.family &&
    p.mode === n.mode &&
    p.manualRoles === n.manualRoles &&
    p.manualRolesEnabled === n.manualRolesEnabled &&
    p.rolePreset === n.rolePreset &&
    p.tempoProfile === n.tempoProfile &&
    p.customTimers === n.customTimers &&
    p.customTimersTouched === n.customTimersTouched &&
    p.advanced === n.advanced;

  if (!summaryStable) {
    return false;
  }

  if (!p.mobileSummaryOpen) {
    return true;
  }

  return p.roomName === n.roomName;
});
