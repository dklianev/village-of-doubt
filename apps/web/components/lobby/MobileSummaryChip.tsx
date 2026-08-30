import { Sheet } from "@werewolf/ui";
import { ChevronUp } from "lucide-react";
import { memo, useCallback, useRef, type Dispatch } from "react";
import { roleWarnings, type LobbyFormAction, type LobbyFormState } from "@/lib/lobby-form";
import { StickyPreview } from "@/components/lobby/StickyPreview";

function MobileSummaryChipImpl({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const warnings = roleWarnings(state);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const setSummaryOpen = useCallback(
    (open: boolean) => {
      dispatch({ type: "SET_MOBILE_SUMMARY_OPEN", open });
      if (!open) {
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    },
    [dispatch],
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="mobile-summary-chip"
        aria-expanded={state.mobileSummaryOpen}
        aria-haspopup="dialog"
        onClick={() => setSummaryOpen(true)}
      >
        <span>{state.playerCount} играчи · {warnings.length > 0 ? `⚠ ${warnings.length}` : "готово"}</span>
        <ChevronUp aria-hidden />
      </button>
      <Sheet
        open={state.mobileSummaryOpen}
        onOpenChange={setSummaryOpen}
        title="Преглед на стаята"
        description="Обобщение на избраните играчи, роли и настройки."
        closeLabel="Затвори прегледа"
      >
        <div className="mobile-summary-sheet">
          <StickyPreview state={state} dispatch={dispatch} compact />
        </div>
      </Sheet>
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
