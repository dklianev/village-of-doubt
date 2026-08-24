"use client";

import * as RDialog from "@radix-ui/react-dialog";
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

const DIALOG_RUNTIME_CSS = `
@keyframes ds-dialog-overlay-open {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes ds-dialog-overlay-close {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes ds-dialog-open {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px)) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes ds-dialog-close {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px)) scale(0.98);
  }
}

.ds-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: oklch(0 0 0 / 0.62);
  backdrop-filter: blur(4px);
}

.ds-dialog-overlay[data-state="open"] {
  animation: ds-dialog-overlay-open 180ms ease-out both;
}

.ds-dialog-overlay[data-state="closed"] {
  animation: ds-dialog-overlay-close 180ms ease-in both;
}

.ds-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 101;
  box-sizing: border-box;
  width: min(92vw, calc(100vw - 48px), 480px);
  padding: 28px;
  display: grid;
  gap: 16px;
  background: var(--ds-surface-paper);
  color: var(--ds-ink-primary);
  border-radius: var(--ds-radius-card);
  box-shadow: var(--ds-shadow-scene);
  transform: translate(-50%, -50%);
}

.ds-dialog[data-state="open"] {
  animation: ds-dialog-open 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
  /* Spring approximation preserves the previous responsive settle without runtime JS. */
  animation-timing-function: linear(0.0000 0.0%, 0.0530 3.8%, 0.1751 7.7%, 0.3249 11.5%, 0.4759 15.4%, 0.6130 19.2%, 0.7288 23.1%, 0.8213 26.9%, 0.8914 30.8%, 0.9420 34.6%, 0.9765 38.5%, 0.9985 42.3%, 1.0112 46.2%, 1.0174 50.0%, 1.0192 53.8%, 1.0184 57.7%, 1.0162 61.5%, 1.0133 65.4%, 1.0104 69.2%, 1.0077 73.1%, 1.0054 76.9%, 1.0036 80.8%, 1.0022 84.6%, 1.0012 88.5%, 1.0005 92.3%, 1.0001 96.2%, 0.9998 100.0%);
}

.ds-dialog[data-state="closed"] {
  animation: ds-dialog-close 180ms cubic-bezier(0.32, 0, 0.67, 0) both;
}
`;

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <style>{DIALOG_RUNTIME_CSS}</style>
        <RDialog.Overlay className="ds-dialog-overlay" />
        <RDialog.Content className="ds-dialog" data-ds-dialog>
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
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
