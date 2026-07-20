"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // Offline support is progressive enhancement; the app stays usable.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
