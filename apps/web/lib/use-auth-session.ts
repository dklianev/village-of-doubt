"use client";

import { useCallback, useEffect, useState } from "react";
export interface AuthSessionView {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function useAuthSession(initialSession: AuthSessionView | null = null) {
  const [data, setData] = useState<AuthSessionView | null>(initialSession ?? null);
  const [isPending, setPending] = useState(false);

  const refresh = useCallback(async (options?: { showPending?: boolean }) => {
    const showPending = options?.showPending ?? true;
    if (showPending) {
      setPending(true);
    }
    try {
      const response = await fetch("/api/auth/get-session", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        setData(null);
        return;
      }
      const body = (await response.json()) as AuthSessionView | null;
      setData(body?.user?.id ? body : null);
    } catch {
      setData(null);
    } finally {
      if (showPending) {
        setPending(false);
      }
    }
  }, []);

  useEffect(() => {
    const refreshOnEvent = () => {
      void refresh();
    };

    window.addEventListener("focus", refreshOnEvent);
    window.addEventListener("auth-session-change", refreshOnEvent);

    if (!initialSession?.user?.id) {
      void refresh({ showPending: false });
    }

    return () => {
      window.removeEventListener("focus", refreshOnEvent);
      window.removeEventListener("auth-session-change", refreshOnEvent);
    };
  }, [initialSession?.user?.id, refresh]);

  return { data, isPending, refresh };
}
