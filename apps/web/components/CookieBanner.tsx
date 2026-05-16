"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const [state, setState] = useState<"unknown" | "visible" | "hidden">("unknown");

  useEffect(() => {
    setState(window.localStorage.getItem(STORAGE_KEY) ? "hidden" : "visible");
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setState("hidden");
  }

  if (state !== "visible") {
    return null;
  }

  return (
    <aside className="cookie-banner" role="dialog" aria-label="Бисквитки">
      <p>
        Използваме само необходими бисквитки за вход и сесия. Прочети{" "}
        <Link href="/privacy">политиката за поверителност</Link>.
      </p>
      <button type="button" className="btn btn-primary" onClick={accept}>
        Разбрах
      </button>
    </aside>
  );
}
