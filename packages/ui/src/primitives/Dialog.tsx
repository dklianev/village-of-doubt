import * as RDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const MotionContent = motion.create(RDialog.Content);
const MotionOverlay = motion.create(RDialog.Overlay);

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <MotionOverlay
              forceMount
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                position: "fixed",
                inset: 0,
                background: "oklch(0 0 0 / 0.62)",
                backdropFilter: "blur(4px)",
                zIndex: 100,
              }}
            />
            <div
              style={{
                position: "fixed",
                inset: 0,
                display: "grid",
                placeItems: "center",
                padding: "24px",
                pointerEvents: "none",
                zIndex: 101,
              }}
            >
              <MotionContent
                forceMount
                aria-describedby={description ? undefined : undefined}
                data-ds-dialog
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  width: "min(92vw, 480px)",
                  background: "var(--ds-surface-paper)",
                  color: "var(--ds-ink-primary)",
                  borderRadius: "var(--ds-radius-card)",
                  boxShadow: "var(--ds-shadow-scene)",
                  padding: "28px",
                  display: "grid",
                  gap: "16px",
                  pointerEvents: "auto",
                }}
              >
                <RDialog.Title
                  style={{
                    fontFamily: '"Noto Serif Display", "Noto Serif", "Iowan Old Style", serif',
                    fontSize: "var(--ds-type-h3)",
                    fontWeight: 800,
                    letterSpacing: 0,
                    margin: 0,
                  }}
                >
                  {title}
                </RDialog.Title>
                {description && (
                  <RDialog.Description
                    style={{
                      color: "var(--ds-ink-soft)",
                      margin: 0,
                      fontSize: "var(--ds-type-body)",
                      lineHeight: 1.6,
                    }}
                  >
                    {description}
                  </RDialog.Description>
                )}
                <div>{children}</div>
                {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>{footer}</div>}
              </MotionContent>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
