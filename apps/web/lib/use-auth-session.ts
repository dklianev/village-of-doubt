"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface AuthSessionView {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    avatarId?: string | null;
  };
}

export const SESSION_BOOTSTRAP_CACHE_TTL_MS = 2_000;
export const SESSION_BOOTSTRAP_REQUEST_TIMEOUT_MS = 3_000;

interface SessionBootstrapSnapshot {
  data: AuthSessionView | null;
  expiresAt: number;
}

type SessionRequestResult =
  | { kind: "success"; data: AuthSessionView | null }
  | { kind: "error" };

let inFlightSessionRequest: Promise<SessionRequestResult> | null = null;
let inFlightFreshSessionRequest: Promise<SessionRequestResult> | null = null;
let sessionBootstrapSnapshot: SessionBootstrapSnapshot | null = null;
let latestSessionRequest = 0;

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export function invalidateAuthSessionBootstrapCache() {
  sessionBootstrapSnapshot = null;
}

function readSessionBootstrapSnapshot(): SessionBootstrapSnapshot | null {
  if (typeof window === "undefined" || !sessionBootstrapSnapshot) {
    return null;
  }
  if (sessionBootstrapSnapshot.expiresAt <= Date.now()) {
    sessionBootstrapSnapshot = null;
    return null;
  }
  return sessionBootstrapSnapshot;
}

function writeSessionBootstrapSnapshot(data: AuthSessionView | null) {
  if (typeof window === "undefined") {
    return;
  }
  sessionBootstrapSnapshot = {
    data,
    expiresAt: Date.now() + SESSION_BOOTSTRAP_CACHE_TTL_MS,
  };
}

function fetchSession(): Promise<SessionRequestResult> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SessionRequestResult>((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve({ kind: "error" });
    }, SESSION_BOOTSTRAP_REQUEST_TIMEOUT_MS);
  });
  const request = fetch("/api/auth/get-session", {
    cache: "no-store",
    credentials: "include",
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        return { kind: "error" } as const;
      }

      const body = (await response.json()) as AuthSessionView | null;
      if (body === null) {
        return { kind: "success", data: null } as const;
      }
      return body.user?.id
        ? { kind: "success", data: body } as const
        : { kind: "error" } as const;
    })
    .catch(() => ({ kind: "error" }) as const);

  return Promise.race([request, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}

function startSessionRequest() {
  const requestId = latestSessionRequest + 1;
  latestSessionRequest = requestId;
  return fetchSession().then((result) => {
    if (requestId === latestSessionRequest && result.kind === "success") {
      writeSessionBootstrapSnapshot(result.data);
    }
    return result;
  });
}

function requestSession(options?: { fresh?: boolean }) {
  if (options?.fresh) {
    if (!inFlightFreshSessionRequest) {
      const request = startSessionRequest().finally(() => {
        if (inFlightFreshSessionRequest === request) {
          inFlightFreshSessionRequest = null;
        }
      });
      inFlightFreshSessionRequest = request;
    }
    return inFlightFreshSessionRequest;
  }

  if (inFlightFreshSessionRequest) {
    return inFlightFreshSessionRequest;
  }

  if (!inFlightSessionRequest) {
    const request = startSessionRequest()
      .finally(() => {
        if (inFlightSessionRequest === request) {
          inFlightSessionRequest = null;
        }
      });
    inFlightSessionRequest = request;
  }

  return inFlightSessionRequest;
}

export function useAuthSession(initialSession?: AuthSessionView | null) {
  const hasInitialSession = Boolean(initialSession?.user?.id);
  const canReadClientCache = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const cachedSnapshot = canReadClientCache && !hasInitialSession
    ? readSessionBootstrapSnapshot()
    : null;
  const [data, setData] = useState<AuthSessionView | null>(hasInitialSession ? initialSession ?? null : null);
  const [isError, setError] = useState(false);
  const [isPending, setPending] = useState(!hasInitialSession);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async (options?: { showPending?: boolean; fresh?: boolean }) => {
    const showPending = options?.showPending ?? true;
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    if (showPending) {
      setPending(true);
    }
    setError(false);
    try {
      const result = await requestSession(options?.fresh ? { fresh: true } : undefined);
      if (generation === refreshGeneration.current) {
        if (result.kind === "success") {
          setData(result.data);
        } else {
          setError(true);
        }
      }
    } finally {
      if (showPending && generation === refreshGeneration.current) {
        setPending(false);
      }
    }
  }, []);

  useEffect(() => {
    const refreshOnFocus = () => {
      invalidateAuthSessionBootstrapCache();
      void refresh({ showPending: false });
    };
    const refreshOnAuthChange = () => {
      invalidateAuthSessionBootstrapCache();
      void refresh({ fresh: true });
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("auth-session-change", refreshOnAuthChange);

    if (!hasInitialSession) {
      const snapshot = readSessionBootstrapSnapshot();
      if (snapshot) {
        setData(snapshot.data);
        setPending(false);
      } else {
        void refresh();
      }
    }

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("auth-session-change", refreshOnAuthChange);
    };
  }, [hasInitialSession, refresh]);

  return {
    data: cachedSnapshot ? cachedSnapshot.data : data,
    isError: cachedSnapshot ? false : isError,
    isPending: cachedSnapshot ? false : isPending,
    refresh,
  };
}
