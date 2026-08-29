"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { safeLocalStorage } from "@/lib/safe-storage";
import styles from "./CookieBanner.module.css";

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const [state, setState] = useState<"unknown" | "visible" | "hidden">("unknown");
  const descriptionId = useId();

  useEffect(() => {
    setState(safeLocalStorage.getItem(STORAGE_KEY) ? "hidden" : "visible");
  }, []);

  function accept() {
    safeLocalStorage.setItem(STORAGE_KEY, "1");
    setState("hidden");
  }

  if (state !== "visible") {
    return null;
  }

  return (
    <div
      className={styles.banner}
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
}
