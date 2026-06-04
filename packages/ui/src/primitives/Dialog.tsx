import * as RDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const VISUALLY_HIDDEN_STYLE: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
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
            </RDialog.Overlay>
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
              <RDialog.Content asChild forceMount>
                <motion.div
                  data-ds-dialog
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  style={{
                    width: "min(92vw, 480px)",
                    boxSizing: "border-box",
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
                  {!description && (
                    <RDialog.Description style={VISUALLY_HIDDEN_STYLE}>
                      Диалогов прозорец.
                    </RDialog.Description>
                  )}
                  <div>{children}</div>
                  {footer && (
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "12px" }}>
                      {footer}
                    </div>
                  )}
                </motion.div>
              </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
