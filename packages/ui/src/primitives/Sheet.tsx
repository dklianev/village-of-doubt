"use client";

import * as RDialog from "@radix-ui/react-dialog";
import { useEffect, useInsertionEffect, type CSSProperties, type ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: "default" | "workspace";
  closeLabel?: string;
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

.ds-sheet[data-size="workspace"] {
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0;
  height: min(92dvh, 900px);
  max-height: 92dvh;
  overflow: hidden;
  padding: 0;
}

.ds-sheet[data-size="workspace"] > .ds-sheet-title {
  position: relative;
  z-index: 2;
  padding: 22px clamp(76px, 7vw, 92px) 22px clamp(20px, 3vw, 32px);
  border-bottom: 1px solid var(--ds-border-subtle, oklch(0.42 0.04 65 / 0.2));
  background: var(--ds-surface-paper);
}

.ds-sheet-title {
  margin: 0;
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-size: var(--ds-type-h3);
  letter-spacing: 0;
}

.ds-sheet-close {
  position: absolute;
  top: 18px;
  right: clamp(18px, 2vw, 28px);
  z-index: 4;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--ds-border-subtle, oklch(0.42 0.04 65 / 0.22));
  border-radius: 999px;
  background: color-mix(in oklab, var(--ds-surface-paper) 88%, var(--ds-ink-primary) 12%);
  color: var(--ds-ink-primary);
  cursor: pointer;
  font: inherit;
}

.ds-sheet-close:hover {
  border-color: currentColor;
  transform: translateY(-1px);
}

.ds-sheet-close > span {
  font-size: 1.55rem;
  font-weight: 400;
  line-height: 1;
}

.ds-sheet[data-state="open"] {
  animation: ds-sheet-open 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ds-sheet[data-state="closed"] {
  animation: ds-sheet-close 280ms cubic-bezier(0.32, 0, 0.67, 0) both;
}

@media (max-width: 767px) {
  .ds-sheet[data-size="workspace"] {
    inset: 0;
    width: 100vw;
    height: 100dvh;
    min-height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    box-shadow: none;
  }

  .ds-sheet[data-size="workspace"] > .ds-sheet-title {
    display: flex;
    min-height: 58px;
    align-items: center;
    padding: 12px 62px 12px 16px;
    font-size: 1.25rem;
    line-height: 1.1;
  }

  .ds-sheet[data-size="workspace"] > .ds-sheet-close {
    top: 9px;
    right: 12px;
    width: 40px;
    height: 40px;
  }
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

  .ds-sheet[data-size="workspace"] {
    width: min(96vw, 1480px);
    height: min(92dvh, 940px);
    max-height: 92dvh;
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

export function Sheet({
  open,
  onOpenChange,
  title,
  description = "Допълнителен панел.",
  size = "default",
  closeLabel,
  children,
}: SheetProps) {
  useSheetStyles();

  useEffect(() => {
    if (!open || size !== "workspace") {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const rootOverflow = root.style.overflow;
    const bodyOverflow = body.style.overflow;
    const bodyPosition = body.style.position;
    const bodyTop = body.style.top;
    const bodyWidth = body.style.width;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      root.style.overflow = rootOverflow;
      body.style.overflow = bodyOverflow;
      body.style.position = bodyPosition;
      body.style.top = bodyTop;
      body.style.width = bodyWidth;
      if (scrollY > 0) {
        window.scrollTo({ top: scrollY, behavior: "auto" });
      }
    };
  }, [open, size]);

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="ds-sheet-overlay" />
        <RDialog.Content className="ds-sheet" data-ds-sheet data-size={size}>
          <RDialog.Title className="ds-sheet-title">
            {title}
          </RDialog.Title>
          {closeLabel ? (
            <RDialog.Close className="ds-sheet-close" aria-label={closeLabel}>
              <span aria-hidden="true">×</span>
            </RDialog.Close>
          ) : null}
          <RDialog.Description style={VISUALLY_HIDDEN_STYLE}>
            {description}
          </RDialog.Description>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
