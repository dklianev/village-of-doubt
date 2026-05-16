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

  const refresh = useCallback(async () => {
    setPending(true);
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
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    window.addEventListener("focus", refresh);
    window.addEventListener("auth-session-change", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("auth-session-change", refresh);
    };
  }, [refresh]);

  return { data, isPending, refresh };
}
