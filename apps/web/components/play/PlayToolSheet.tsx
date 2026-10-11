import { lazy, Suspense, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { LiveCueSettingsProps } from "./LiveCueSettings";
import { PlayFeatureBoundary } from "./PlayFeatureBoundary";
import styles from "./PlayTools.module.css";

// The settings statically import the surface, so opening has no second import waterfall.
const LiveCueSettings = lazy(() => import("./LiveCueSettings"));

export function PlayToolSheet(props: LiveCueSettingsProps) {
  const [hasOpened, setHasOpened] = useState(props.open);
  if (props.open && !hasOpened) setHasOpened(true);

  // Keep the loaded sheet mounted for Radix's closing animation and focus return.
  return hasOpened ? (
    <PlayFeatureBoundary fallback={<CueSettingsStatus {...props} failed />}>
      <Suspense fallback={<CueSettingsStatus {...props} />}><LiveCueSettings {...props} /></Suspense>
    </PlayFeatureBoundary>
  ) : null;
}

function CueSettingsStatus({ open, onOpenChange, trigger, failed }: Pick<LiveCueSettingsProps, "open" | "onOpenChange" | "trigger"> & { failed?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [open, onOpenChange, trigger]);
  if (!open) return null;
  if (!failed) return <span className="sr-only" role="status">Зареждаме сигналите...</span>;
  return <div className={styles.loadError}>
    <p role="status">Настройките за сигнали не се заредиха.</p>
    <button type="button" className={styles.tool} autoFocus aria-label="Затвори" title="Затвори" onClick={() => {
      onOpenChange(false);
      trigger.current?.focus({ preventScroll: true });
    }}><X size={18} aria-hidden="true" /></button>
  </div>;
}
