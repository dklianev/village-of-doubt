import { useEffect, useRef, useState, type CSSProperties } from "react";

export type ToastTone = "info" | "success" | "error";

export interface ToastProps {
  open: boolean;
  tone?: ToastTone;
  message: string;
  onDismiss?: () => void;
  /** Position in a toast stack. Used for CSS-free stagger timing. */
  index?: number;
}

const TONE_BG: Record<ToastTone, string> = {
  info: "var(--ds-surface-scene-deep)",
  success: "var(--ds-accent-green)",
  error: "var(--ds-accent-blood)",
};

const TOAST_STAGGER_STEP = 0.06;
const MAX_STAGGER_INDEX = 6;
const TOAST_EXIT_MS = 140;

const TOAST_RUNTIME_CSS = `
@keyframes ds-toast-open {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ds-toast-close {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-16px);
  }
}

.ds-toast[data-state="open"] {
  animation: ds-toast-open 520ms cubic-bezier(0.16, 1, 0.3, 1) var(--ds-toast-delay, 0s) both;
  /* Spring approximation preserves the previous responsive settle without runtime JS. */
  animation-timing-function: linear(0.0000 0.0%, 0.0476 3.8%, 0.1610 7.7%, 0.3051 11.5%, 0.4555 15.4%, 0.5965 19.2%, 0.7194 23.1%, 0.8201 26.9%, 0.8983 30.8%, 0.9556 34.6%, 0.9950 38.5%, 1.0199 42.3%, 1.0335 46.2%, 1.0389 50.0%, 1.0389 53.8%, 1.0354 57.7%, 1.0302 61.5%, 1.0243 65.4%, 1.0185 69.2%, 1.0132 73.1%, 1.0089 76.9%, 1.0054 80.8%, 1.0027 84.6%, 1.0008 88.5%, 0.9996 92.3%, 0.9989 96.2%, 0.9985 100.0%);
}

.ds-toast[data-state="closed"] {
  animation: ds-toast-close ${TOAST_EXIT_MS}ms cubic-bezier(0.32, 0, 0.67, 0) both;
}
`;

export function Toast({ open, tone = "info", message, onDismiss, index = 0 }: ToastProps) {
  const normalizedIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const staggerDelay = Math.min(normalizedIndex, MAX_STAGGER_INDEX) * TOAST_STAGGER_STEP;
  const [present, setPresent] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (open) {
      setPresent(true);
      setState("open");
      return;
    }

    if (present) {
      setState("closed");
      exitTimerRef.current = setTimeout(() => {
        setPresent(false);
        exitTimerRef.current = null;
      }, TOAST_EXIT_MS + 50);
    }

    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [open, present]);

  const finishExit = () => {
    if (state !== "closed") {
      return;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    setPresent(false);
  };

  if (!present) {
    return null;
  }

  const style = {
    "--ds-toast-delay": `${staggerDelay}s`,
    background: TONE_BG[tone],
    color: "oklch(0.97 0.01 80)",
    padding: "12px 18px",
    borderRadius: "var(--ds-radius-tile)",
    boxShadow: "var(--ds-shadow-scene)",
    display: "inline-flex",
    alignItems: "center",
    gap: "12px",
    maxWidth: "min(92vw, 480px)",
  } as CSSProperties;

  return (
    <>
      <style>{TOAST_RUNTIME_CSS}</style>
      <div
        className="ds-toast"
        role="status"
        aria-live="polite"
        data-ds-toast={tone}
        data-ds-toast-index={normalizedIndex}
        data-state={state}
        style={style}
        onAnimationEnd={finishExit}
      >
        <span>{message}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Затвори"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.2em",
              padding: 0,
            }}
          >
            x
          </button>
        )}
      </div>
    </>
  );
}
