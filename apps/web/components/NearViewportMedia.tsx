"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Decorative media only; the parent must reserve its own dimensions. */
export function NearViewportMedia({ children }: { children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = anchor.current?.parentElement;
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      setReady(true);
      return;
    }

    // Observe the existing layout box, not the boxless media wrapper.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span ref={anchor} style={{ display: "contents" }}>
        {ready ? children : null}
      </span>
      <noscript>{children}</noscript>
    </>
  );
}
