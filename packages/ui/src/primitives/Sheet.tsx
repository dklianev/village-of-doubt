import * as RDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  const MotionContent = motion(RDialog.Content);
  const MotionOverlay = motion(RDialog.Overlay);

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
              style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)", zIndex: 100 }}
            />
            <div className="ds-sheet-frame">
              <MotionContent
                forceMount
                aria-describedby={undefined}
                className="ds-sheet"
                data-ds-sheet
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: "var(--ds-surface-paper)",
                  color: "var(--ds-ink-primary)",
                  display: "grid",
                  gap: "16px",
                }}
              >
                {title && (
                  <RDialog.Title
                    style={{
                      fontFamily: '"Noto Serif Display", "Noto Serif", "Iowan Old Style", serif',
                      fontSize: "var(--ds-type-h3)",
                      letterSpacing: 0,
                      margin: 0,
                    }}
                  >
                    {title}
                  </RDialog.Title>
                )}
                {children}
              </MotionContent>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
