"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { safeLocalStorage } from "@/lib/safe-storage";
import styles from "./CookieBanner.module.css";

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<"unknown" | "visible" | "hidden">("unknown");
  const [homeSlot, setHomeSlot] = useState<HTMLDivElement | null>(null);
  const descriptionId = useId();

  useEffect(() => {
    setState(safeLocalStorage.getItem(STORAGE_KEY) ? "hidden" : "visible");
  }, []);

  useEffect(() => {
    if (pathname !== "/" || state !== "visible") {
      setHomeSlot(null);
      return;
    }

    const main = document.getElementById("main-content");
    if (!main) return;

    // Keep the notice before the footer without shifting the homepage's main content.
    const slot = document.createElement("div");
    slot.className = styles.homeSlot ?? "";
    main.after(slot);
    setHomeSlot(slot);
    return () => slot.remove();
  }, [pathname, state]);

  function accept() {
    safeLocalStorage.setItem(STORAGE_KEY, "1");
    setState("hidden");
  }

  if (state !== "visible") {
    return null;
  }

  const isHomepage = pathname === "/";
  const notice = (
    <div
      className={isHomepage ? `${styles.banner} ${styles.homepage}` : styles.banner}
      role="region"
      aria-label="Бисквитки"
      aria-describedby={descriptionId}
      aria-live="polite"
      data-cookie-banner
    >
      <p id={descriptionId}>
        Ползваме само необходими бисквитки за вход и сесия. Виж{" "}
        <Link href="/privacy" prefetch={false}>политиката за поверителност</Link>.
      </p>
      <button type="button" className="btn btn-primary" onClick={accept}>
        Разбрах
      </button>
    </div>
  );

  return isHomepage ? (homeSlot ? createPortal(notice, homeSlot) : null) : notice;
}
