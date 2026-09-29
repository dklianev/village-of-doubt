"use client";

import { useEffect, useRef, useState } from "react";

const RETRY_DELAYS_MS = [5_000, 5_000, 10_000, 10_000, 15_000, 20_000, 30_000, 30_000] as const;
const CHECK_TIMEOUT_MS = 2_000;
const RECOVERY_WATCHDOG_MS = 10_000;
const RETRY_IDLE_MS = 5 * 60_000;
const RETRY_STORAGE_KEY = "offline-recovery-attempts";

type ConnectionState = "waiting" | "checking" | "offline" | "unavailable" | "exhausted" | "restoring";

export function useOfflineRecovery() {
  const [state, setState] = useState<ConnectionState>("waiting");
  const checkRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let recovering = false;
    let navigationPending = false;
    let retryIndex = 0;
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(RETRY_STORAGE_KEY) ?? "null");
      if (stored !== null) {
        retryIndex = RETRY_DELAYS_MS.length;
        if (Number.isInteger(stored.attempts) && stored.attempts >= 0 && Number.isFinite(stored.updatedAt)) {
          // Idle expiry is mount-only; a running recovery loop never refills its budget.
          retryIndex = Date.now() - stored.updatedAt >= RETRY_IDLE_MS
            ? 0 : Math.min(stored.attempts, RETRY_DELAYS_MS.length);
        }
      }
    } catch { /* Storage is optional; automatic navigation requires a durable budget. */ }
    let retryTimeout: number | undefined;
    let checkTimeout: number | undefined;
    let recoveryTimeout: number | undefined;
    let controller: AbortController | undefined;

    function saveBudget() {
      try {
        // The idle budget contains no destination, query, credentials or player data.
        const value = JSON.stringify({ attempts: retryIndex, updatedAt: Date.now() });
        window.sessionStorage.setItem(RETRY_STORAGE_KEY, value);
        return window.sessionStorage.getItem(RETRY_STORAGE_KEY) === value;
      } catch {
        return false;
      }
    }

    function clearRetry() {
      window.clearTimeout(retryTimeout);
      retryTimeout = undefined;
    }

    function failedState(): ConnectionState {
      if (retryIndex >= RETRY_DELAYS_MS.length) return "exhausted";
      return navigator.onLine ? "unavailable" : "offline";
    }

    function scheduleRetry() {
      if (disposed || recovering || controller || document.hidden || retryTimeout !== undefined
        || retryIndex >= RETRY_DELAYS_MS.length) return;

      retryTimeout = window.setTimeout(() => {
        retryTimeout = undefined;
        if (document.hidden) return;
        void checkConnection();
      }, RETRY_DELAYS_MS[retryIndex]);
    }

    async function checkConnection(manual = false) {
      if (disposed || recovering || controller || document.hidden) return;
      if (!manual && retryIndex >= RETRY_DELAYS_MS.length) return;
      clearRetry();
      if (navigationPending) {
        // Only a new explicit attempt cancels a still-loading document.
        window.stop();
        navigationPending = false;
      }
      retryIndex = Math.min(retryIndex + 1, RETRY_DELAYS_MS.length);
      const saved = saveBudget();
      const activeController = new AbortController();
      controller = activeController;
      setState("checking");

      try {
        // A browser network hint is not evidence that this site is reachable.
        const response = await Promise.race([
          fetch("/api/health", {
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
            signal: activeController.signal,
          }),
          new Promise<null>((resolve) => {
            checkTimeout = window.setTimeout(() => {
              activeController.abort();
              resolve(null);
            }, CHECK_TIMEOUT_MS);
          }),
        ]);
        if (disposed) return;
        if (!response?.ok || activeController.signal.aborted) {
          setState(failedState());
          return;
        }

        if (!manual && !saved) {
          retryIndex = RETRY_DELAYS_MS.length;
          setState("exhausted");
          return;
        }
        recovering = true;
        navigationPending = true;
        setState("restoring");
        recoveryTimeout = window.setTimeout(() => {
          // Stop automatic work, not the slow navigation. Stop/Escape may have cancelled it.
          recovering = false;
          retryIndex = RETRY_DELAYS_MS.length;
          saveBudget();
          setState("exhausted");
        }, RECOVERY_WATCHDOG_MS);
        if (window.location.pathname === "/offline" || window.location.pathname === "/offline/") {
          window.location.replace("/");
        } else {
          // The worker serves the fallback at the original document URL.
          window.location.reload();
        }
      } catch {
        if (!disposed) {
          recovering = false;
          window.clearTimeout(recoveryTimeout);
          setState(failedState());
        }
      } finally {
        window.clearTimeout(checkTimeout);
        checkTimeout = undefined;
        controller = undefined;
        scheduleRetry();
      }
    }

    const check = () => { void checkConnection(); };
    const handleOffline = () => {
      controller?.abort();
      if (!recovering) setState(retryIndex >= RETRY_DELAYS_MS.length ? "exhausted" : "offline");
    };
    const handleVisibilityChange = () => {
      if (document.hidden) clearRetry();
      else scheduleRetry();
    };
    checkRef.current = () => { void checkConnection(true); };
    if (retryIndex >= RETRY_DELAYS_MS.length) setState("exhausted");
    else if (!navigator.onLine) setState("offline");
    window.addEventListener("online", check);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleRetry();

    return () => {
      disposed = true;
      checkRef.current = () => {};
      clearRetry();
      window.clearTimeout(checkTimeout);
      window.clearTimeout(recoveryTimeout);
      controller?.abort();
      window.removeEventListener("online", check);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { state, checkConnection: () => checkRef.current() };
}
