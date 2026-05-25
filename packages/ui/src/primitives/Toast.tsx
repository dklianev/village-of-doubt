import { AnimatePresence, motion } from "motion/react";

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

export function Toast({ open, tone = "info", message, onDismiss, index = 0 }: ToastProps) {
  const normalizedIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const staggerDelay = Math.min(normalizedIndex, MAX_STAGGER_INDEX) * TOAST_STAGGER_STEP;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-live="polite"
          data-ds-toast={tone}
          data-ds-toast-index={normalizedIndex}
          initial={{ opacity: 0, y: -16 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { delay: staggerDelay, type: "spring", stiffness: 280, damping: 24 },
          }}
          exit={{
            opacity: 0,
            y: -16,
            transition: { duration: 0.14, ease: [0.32, 0, 0.67, 0] },
          }}
          style={{
            background: TONE_BG[tone],
            color: "oklch(0.97 0.01 80)",
            padding: "12px 18px",
            borderRadius: "var(--ds-radius-tile)",
            boxShadow: "var(--ds-shadow-scene)",
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            maxWidth: "min(92vw, 480px)",
          }}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
