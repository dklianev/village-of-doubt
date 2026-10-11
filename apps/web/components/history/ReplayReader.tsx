"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

/** Enhance the server-rendered document without shipping its presentation or data helpers. */
export function ReplayReader({ children, defaultChapter }: { children: ReactNode; defaultChapter: string }) {
  const root = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const documentRef = useRef<{ children: ReactNode; defaultChapter: string } | null>(null);

  function select(target: string) {
    const container = root.current;
    if (!container) return;
    const destination = document.getElementById(target);
    const chapter = destination && container.contains(destination) ? destination.closest<HTMLElement>("[data-replay-chapter]") : null;
    const landmark = destination && container.contains(destination) && destination.hasAttribute("data-replay-landmark");
    if (landmark && initialized.current) return destination;
    const active = chapter?.id ?? defaultChapter;
    for (const panel of container.querySelectorAll<HTMLElement>("[data-replay-chapter]")) panel.hidden = panel.id !== active;
    const links = [...container.querySelectorAll<HTMLAnchorElement>("[data-replay-nav] a")];
    const current = links.some((link) => link.hash === `#${target}`) ? target : active;
    for (const link of links) {
      if (link.hash === `#${current}`) {
        link.setAttribute("aria-current", "location");
        const strip = link.parentElement?.parentElement;
        if (strip && strip.scrollWidth > strip.clientWidth) {
          strip.scrollLeft += link.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - link.clientWidth) / 2;
        }
      } else link.removeAttribute("aria-current");
    }
    initialized.current = true;
    return chapter || landmark ? destination : undefined;
  }

  useEffect(() => {
    // Activity resumes the same document on Back; only new RSC content resets it.
    if (!documentRef.current || documentRef.current.children !== children || documentRef.current.defaultChapter !== defaultChapter) {
      initialized.current = false;
      documentRef.current = { children, defaultChapter };
    }
    const restore = () => {
      const destination = select(window.location.hash.slice(1));
      if (destination) {
        destination.focus({ preventScroll: true });
        destination.scrollIntoView({ block: "start", behavior: "instant" });
      }
    };
    restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
    // RSC navigation can replace the whole authorized document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, defaultChapter]);

  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    const target = link?.hash.slice(1);
    if (!target) return;
    const destination = select(target);
    if (!destination) return;
    event.preventDefault();
    if (window.location.hash !== `#${target}`) window.history.pushState(null, "", `#${target}`);
    destination.focus({ preventScroll: true });
    if (destination.hasAttribute("data-replay-phase")) {
      destination.scrollIntoView({ block: "nearest" });
    } else {
      const top = destination.getBoundingClientRect().top;
      const inset = parseFloat(getComputedStyle(destination).scrollMarginTop) || 0;
      if (top < inset || top + 44 > window.innerHeight) {
        destination.scrollIntoView({ block: "start", behavior: "instant" });
      }
    }
  }

  return <div ref={root} onClick={navigate}>{children}</div>;
}
