"use client";

import { useEffect, useEffectEvent, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let scrollLockCount = 0;
let previousBodyOverflow = "";

export function useModal<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<T | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const closeModal = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const dialog = ref.current instanceof HTMLDialogElement ? ref.current : null;
    dialog?.showModal();
    // Overlapping modals share the overflow captured by the first lock owner.
    if (!dialog) {
      if (scrollLockCount === 0) previousBodyOverflow = document.body.style.overflow;
      scrollLockCount += 1;
      document.body.style.overflow = "hidden";
    }

    const focusable = getFocusable(ref.current);
    focusable[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dialog) event.stopPropagation();
        closeModal();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusable(ref.current);
      if (focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0]!;
      const last = focusableElements[focusableElements.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const keyTarget = dialog ? window : document;
    keyTarget.addEventListener("keydown", onKeyDown as EventListener, Boolean(dialog));
    return () => {
      keyTarget.removeEventListener("keydown", onKeyDown as EventListener, Boolean(dialog));
      dialog?.close();
      if (!dialog) {
        scrollLockCount -= 1;
        if (scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
      }
      previousActiveElement.current?.focus();
    };
  }, [open]);

  return { ref };
}

function getFocusable(root: HTMLElement | null) {
  if (!root) {
    return [];
  }
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}
