"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AuthSessionView {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    avatarId?: string | null;
  };
}

let inFlightSessionRequest: Promise<AuthSessionView | null> | null = null;

function fetchSession() {
  return fetch("/api/auth/get-session", {
    cache: "no-store",
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as AuthSessionView | null;
      return body?.user?.id ? body : null;
    })
    .catch(() => null);
}

function requestSession(options?: { fresh?: boolean }) {
  if (options?.fresh) {
    return fetchSession();
  }

  if (!inFlightSessionRequest) {
    const request = fetchSession()
      .finally(() => {
        if (inFlightSessionRequest === request) {
          inFlightSessionRequest = null;
        }
      });
    inFlightSessionRequest = request;
  }

  return inFlightSessionRequest;
}

export function useAuthSession(initialSession: AuthSessionView | null = null) {
  const [data, setData] = useState<AuthSessionView | null>(initialSession ?? null);
  const [isPending, setPending] = useState(false);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async (options?: { showPending?: boolean; fresh?: boolean }) => {
    const showPending = options?.showPending ?? true;
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    if (showPending) {
      setPending(true);
    }
    try {
      const nextSession = await requestSession(options?.fresh ? { fresh: true } : undefined);
      if (generation === refreshGeneration.current) {
        setData(nextSession);
      }
    } finally {
      if (showPending && generation === refreshGeneration.current) {
        setPending(false);
      }
    }
  }, []);

  useEffect(() => {
    const refreshOnFocus = () => {
      void refresh();
    };
    const refreshOnAuthChange = () => {
      void refresh({ fresh: true });
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("auth-session-change", refreshOnAuthChange);

    if (!initialSession?.user?.id) {
      void refresh({ showPending: false });
    }

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("auth-session-change", refreshOnAuthChange);
    };
  }, [initialSession?.user?.id, refresh]);

  return { data, isPending, refresh };
}
