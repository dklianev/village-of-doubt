import * as RDialog from "@radix-ui/react-dialog";
import { useInsertionEffect, type CSSProperties, type ReactNode } from "react";

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
@keyframes ds-sheet-overlay-open {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes ds-sheet-overlay-close {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes ds-sheet-open {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes ds-sheet-close {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}

.ds-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: oklch(0 0 0 / 0.5);
}

.ds-sheet-overlay[data-state="open"] {
  animation: ds-sheet-overlay-open 180ms ease-out both;
}

.ds-sheet-overlay[data-state="closed"] {
  animation: ds-sheet-overlay-close 180ms ease-in both;
}

.ds-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 101;
  box-sizing: border-box;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 28px;
  border-top-left-radius: var(--ds-radius-card);
  border-top-right-radius: var(--ds-radius-card);
  box-shadow: 0 -20px 40px oklch(0 0 0 / 0.4);
  background: var(--ds-surface-paper);
  color: var(--ds-ink-primary);
  display: grid;
  gap: 16px;
}

.ds-sheet[data-state="open"] {
  animation: ds-sheet-open 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ds-sheet[data-state="closed"] {
  animation: ds-sheet-close 280ms cubic-bezier(0.32, 0, 0.67, 0) both;
}

@media (min-width: 768px) {
  @keyframes ds-sheet-open {
    from { transform: translate(-50%, 50%); }
    to { transform: translate(-50%, -50%); }
  }

  @keyframes ds-sheet-close {
    from { transform: translate(-50%, -50%); }
    to { transform: translate(-50%, 50%); }
  }

  .ds-sheet {
    top: 50%;
    right: auto;
    bottom: auto;
    left: 50%;
    width: min(92vw, 600px);
    border-radius: var(--ds-radius-card);
    box-shadow: var(--ds-shadow-scene);
    transform: translate(-50%, -50%);
  }
}
`;

function useSheetStyles() {
  useInsertionEffect(() => {
    if (document.getElementById("werewolf-ui-sheet-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "werewolf-ui-sheet-styles";
    style.textContent = SHEET_RUNTIME_CSS;
    document.head.append(style);
  }, []);
}

export function Sheet({ open, onOpenChange, title, description = "Допълнителен панел.", children }: SheetProps) {
  useSheetStyles();

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="ds-sheet-overlay" />
        <RDialog.Content className="ds-sheet" data-ds-sheet>
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
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
