"use client";

import * as RDialog from "@radix-ui/react-dialog";
import { useId, useInsertionEffect, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

// CSS keeps the spring settle without adding an animation runtime to every dialog.
const DIALOG_RUNTIME_CSS = `
@keyframes ds-dialog-overlay-open {
  from { opacity: 0; }
}

@keyframes ds-dialog-overlay-close {
  to { opacity: 0; }
}

@keyframes ds-dialog-open {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px)) scale(0.98);
  }
}

@keyframes ds-dialog-close {
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
  --ds-dialog-block-gutter: max(24px, env(safe-area-inset-top, 0px), env(safe-area-inset-bottom, 0px));
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 101;
  box-sizing: border-box;
  width: min(calc(100vw - 48px), 480px);
  max-height: calc(100vh - 2 * var(--ds-dialog-block-gutter));
  max-height: calc(100dvh - 2 * var(--ds-dialog-block-gutter));
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
  scroll-padding-block: 28px;
  padding: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  background: var(--ds-surface-paper);
  color: var(--ds-ink-primary);
  border-radius: var(--ds-radius-card);
  box-shadow: var(--ds-shadow-scene);
  transform: translate(-50%, -50%);
}

.ds-dialog[data-state="open"] {
  animation: ds-dialog-open 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-timing-function: linear(0 0%, .053 3.8%, .1751 7.7%, .3249 11.5%, .4759 15.4%, .613 19.2%, .7288 23.1%, .8213 26.9%, .8914 30.8%, .942 34.6%, .9765 38.5%, .9985 42.3%, 1.0112 46.2%, 1.0174 50%, 1.0192 53.8%, 1.0184 57.7%, 1.0162 61.5%, 1.0133 65.4%, 1.0104 69.2%, 1.0077 73.1%, 1.0054 76.9%, 1.0036 80.8%, 1.0022 84.6%, 1.0012 88.5%, 1.0005 92.3%, 1.0001 96.2%, .9998 100%);
}

.ds-dialog[data-state="closed"] {
  animation: ds-dialog-close 180ms cubic-bezier(0.32, 0, 0.67, 0) both;
}

@media (prefers-reduced-motion: reduce) {
  .ds-dialog[data-state],
  .ds-dialog-overlay[data-state] {
    animation: none;
  }
}
`;

function useDialogStyles() {
  useInsertionEffect(() => {
    if (document.getElementById("werewolf-ui-dialog-styles")) {
      return;
    }

    // Portal children have separate Presence lifetimes; CSS must survive every exit.
    const style = document.createElement("style");
    style.id = "werewolf-ui-dialog-styles";
    style.textContent = DIALOG_RUNTIME_CSS;
    document.head.append(style);
  }, []);
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  useDialogStyles();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const descriptionId = useId();

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="ds-dialog-overlay" />
        <RDialog.Content
          className="ds-dialog"
          data-ds-dialog
          aria-describedby={description ? descriptionId : undefined}
          onFocusCapture={(event) => {
            const control = event.target;
            if (!event.currentTarget.contains(control)) return;
            const viewport = event.currentTarget.getBoundingClientRect();
            const bounds = control.getBoundingClientRect();
            // Radix wraps focus with preventScroll, including to absolute-positioned controls.
            if (bounds.top < viewport.top || bounds.bottom > viewport.bottom) {
              control.scrollIntoView({ block: "nearest" });
            }
          }}
          onOpenAutoFocus={() => {
            // This controlled wrapper has an external opener, not a Radix Trigger.
            const activeElement = document.activeElement;
            returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus({ preventScroll: true });
            returnFocusRef.current = null;
          }}
        >
          <RDialog.Title
            style={{
              fontFamily: "var(--ds-font-display)",
              fontSize: "var(--ds-type-h3)",
              fontWeight: 600,
              letterSpacing: 0,
              margin: 0,
            }}
          >
            {title}
          </RDialog.Title>
          {description ? (
            <RDialog.Description
              id={descriptionId}
              style={{
                color: "var(--ds-ink-soft)",
                margin: 0,
                fontSize: "var(--ds-type-body)",
                lineHeight: 1.6,
              }}
            >
              {description}
            </RDialog.Description>
          ) : null}
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
