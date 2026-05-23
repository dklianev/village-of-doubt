import { AnimatePresence, motion } from "motion/react";

export type ToastTone = "info" | "success" | "error";

export interface ToastProps {
  open: boolean;
  tone?: ToastTone;
  message: string;
  onDismiss?: () => void;
}

const TONE_BG: Record<ToastTone, string> = {
  info: "var(--ds-surface-scene-deep)",
  success: "var(--ds-accent-green)",
  error: "var(--ds-accent-blood)",
};

export function Toast({ open, tone = "info", message, onDismiss }: ToastProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-live="polite"
          data-ds-toast={tone}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
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
