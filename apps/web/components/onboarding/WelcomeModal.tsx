"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenText, DoorOpen, X } from "lucide-react";
import { safeLocalStorage } from "@/lib/safe-storage";
import styles from "./WelcomeModal.module.css";

const STORAGE_KEY = "welcome-modal-shown";

type IsolatedElementState = {
  element: HTMLElement;
  inert: string | null;
  ariaHidden: string | null;
};

function isolatePageBehind(layer: HTMLElement) {
  const isolated: IsolatedElementState[] = [];
  let current: HTMLElement | null = layer;

  while (current && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;

    for (const sibling of parent.children) {
      if (sibling === current || !(sibling instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) {
        continue;
      }

      isolated.push({
        element: sibling,
        inert: sibling.getAttribute("inert"),
        ariaHidden: sibling.getAttribute("aria-hidden"),
      });
      sibling.setAttribute("inert", "");
      sibling.setAttribute("aria-hidden", "true");
    }

    current = parent;
  }

  return () => {
    for (const state of isolated.reverse()) {
      if (state.inert === null) state.element.removeAttribute("inert");
      else state.element.setAttribute("inert", state.inert);

      if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
      else state.element.setAttribute("aria-hidden", state.ariaHidden);
    }
  };
}

export function WelcomeModal({ displayName }: { displayName: string }) {
  const [visible, setVisible] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const primaryActionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (safeLocalStorage.getItem(STORAGE_KEY)) return;
    if (safeLocalStorage.getItem("tutorial-completed")) {
      safeLocalStorage.setItem(STORAGE_KEY, "1");
      return;
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restorePage = backdropRef.current ? isolatePageBehind(backdropRef.current) : () => {};

    document.body.style.overflow = "hidden";
    primaryActionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
        return;
      }

      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
        );
        const first = focusable[0];
        const last = focusable.at(-1);

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restorePage();
      previouslyFocused?.focus();
    };
  }, [visible]);

  function dismiss() {
    safeLocalStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div ref={backdropRef} className={styles.backdrop} role="presentation" onClick={dismiss}>
      <aside
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} aria-label="Затвори приветствието" onClick={dismiss}>
          <X aria-hidden="true" />
        </button>

        <div className={styles.content}>
          <p className={styles.kicker}>добре дошъл, {displayName}</p>
          <h2 id={titleId}>Мястото ти е готово.</h2>
          <div id={descriptionId} className={styles.description}>
            <p className={styles.body}>
              За първа игра отвори краткия наръчник. Ще минеш през нощта, дневния спор и решаващия глас.
            </p>
            <p className={styles.body}>
              Ако вече познаваш правилата, избери своята игра. Приятелите се присъединяват с код.
            </p>
          </div>
          <div className={styles.actions}>
            <Link ref={primaryActionRef} href="/tutorial?welcome=1" className={styles.primaryAction} onClick={dismiss}>
              <BookOpenText aria-hidden="true" />
              <span>Отвори наръчника</span>
            </Link>
            <button type="button" className={styles.secondaryAction} onClick={dismiss}>
              <DoorOpen aria-hidden="true" />
              <span>Към игрите</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
