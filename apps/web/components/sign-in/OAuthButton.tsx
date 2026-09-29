"use client";

import { type ReactNode, useEffect, useId, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { resolveWelcomeRedirect } from "./welcome-redirect";

interface Props {
  provider: "google" | "discord";
  redirectTo: string;
  label: string;
  pendingLabel: string;
  errorMessage: string;
  children?: ReactNode;
}

export function OAuthButton({ provider, redirectTo, label, pendingLabel, errorMessage, children }: Props) {
  const [isPending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const statusId = useId();

  useEffect(() => {
    if (!isPending) {
      return;
    }

    const timeout = window.setTimeout(() => setPending(false), 15_000);
    const resetPending = () => setPending(false);
    const resetWhenVisible = () => {
      if (document.visibilityState === "visible") {
        resetPending();
      }
    };
    document.addEventListener("visibilitychange", resetWhenVisible);
    window.addEventListener("pageshow", resetPending);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", resetWhenVisible);
      window.removeEventListener("pageshow", resetPending);
    };
  }, [isPending]);

  async function start() {
    setPending(true);
    setStatus("");
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: resolveWelcomeRedirect(redirectTo),
      });
      if (result.error) {
        setStatus(errorMessage);
        setPending(false);
      }
    } catch (error) {
      console.error(`[oauth:${provider}]`, error);
      setStatus(errorMessage);
      setPending(false);
    }
  }

  return (
    <div className="oauth-option">
      <button
        type="button"
        className="oauth-button"
        onClick={start}
        disabled={isPending}
        aria-busy={isPending}
        aria-describedby={status ? statusId : undefined}
      >
        {children}
        <span className="oauth-button-label">{isPending ? pendingLabel : label}</span>
        {isPending ? <span className="oauth-button-spinner" aria-hidden /> : null}
      </button>
      {status ? (
        <p id={statusId} className="oauth-button-status" role="alert">
          {status}
        </p>
      ) : null}
    </div>
  );
}
