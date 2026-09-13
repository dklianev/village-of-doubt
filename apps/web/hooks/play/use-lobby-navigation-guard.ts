"use client";

import { useEffect } from "react";
import { getHistoryGuard, samePage } from "./lobby-navigation-history";

export { initializeLobbyNavigationGuard } from "./lobby-navigation-history";

export function useLobbyNavigationGuard({ active, host }: { active: boolean; host: boolean }) {
  useEffect(() => {
    // Bookkeeping lasts for this document, not for one lobby mount: later visits
    // must retain Forward entries. Only the confirmation callback owns the lobby.
    const history = getHistoryGuard();
    if (!active) return;
    let confirmedExit = false;
    let confirmedLink: MouseEvent | null = null;
    let resetConfirmation: number | undefined;
    const confirmExit = () => {
      const message = host
        ? "Напускаш стаята. Друг участник може да стане домакин и връщането назад няма да възстанови домакинството ти. Да напуснеш ли?"
        : "Напускаш стаята и освобождаваш мястото си. Да напуснеш ли?";
      if (!window.confirm(message)) return false;
      // Do not ask twice when a confirmed navigation loads a new document.
      confirmedExit = true;
      window.clearTimeout(resetConfirmation);
      resetConfirmation = window.setTimeout(() => { confirmedExit = false; }, 0);
      return true;
    };
    history.href = window.location.href;
    history.confirm = confirmExit;
    const confirmNavigation = (event: MouseEvent) => {
      confirmedLink = null;
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (!/^https?:$/.test(destination.protocol)) return;
      if (samePage(window.location.href, destination.href)) return;

      if (!confirmExit()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      confirmedLink = event;
    };
    const confirmDocumentExit = (event: BeforeUnloadEvent) => {
      // Firefox can deliver this after the click task. Only an unprevented
      // native link keeps its approval; SPA or cancelled handlers do not.
      if (confirmedExit || (confirmedLink && !confirmedLink.defaultPrevented)) {
        confirmedExit = false;
        confirmedLink = null;
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("click", confirmNavigation, true);
    window.addEventListener("beforeunload", confirmDocumentExit);
    return () => {
      if (history.confirm === confirmExit) history.confirm = null;
      window.clearTimeout(resetConfirmation);
      document.removeEventListener("click", confirmNavigation, true);
      window.removeEventListener("beforeunload", confirmDocumentExit);
    };
  }, [active, host]);
}
