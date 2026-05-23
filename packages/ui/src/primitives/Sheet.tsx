import * as RDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
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

const SHEET_RUNTIME_CSS = `
.ds-sheet-frame {
  position: fixed;
  inset: 0;
  z-index: 101;
  display: grid;
  align-items: end;
  justify-items: stretch;
  pointer-events: none;
}

.ds-sheet {
  box-sizing: border-box;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 28px;
  border-top-left-radius: var(--ds-radius-card);
  border-top-right-radius: var(--ds-radius-card);
  box-shadow: 0 -20px 40px oklch(0 0 0 / 0.4);
  pointer-events: auto;
}

@media (min-width: 768px) {
  .ds-sheet-frame {
    align-items: center;
    justify-items: center;
    padding: 24px;
  }

  .ds-sheet {
    width: min(92vw, 600px);
    border-radius: var(--ds-radius-card);
    box-shadow: var(--ds-shadow-scene);
  }
}
`;

export function Sheet({ open, onOpenChange, title, description = "Допълнителен панел.", children }: SheetProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <style>{SHEET_RUNTIME_CSS}</style>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)", zIndex: 100 }}
              />
            </RDialog.Overlay>
            <div className="ds-sheet-frame">
              <RDialog.Content asChild forceMount>
                <motion.div
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
                  <RDialog.Description style={VISUALLY_HIDDEN_STYLE}>
                    {description}
                  </RDialog.Description>
                  {children}
                </motion.div>
              </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
