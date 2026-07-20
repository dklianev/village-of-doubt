"use client";

import { useEffect, useId, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { resolveWelcomeRedirect } from "./welcome-redirect";

interface Props {
  provider: "google" | "discord";
  redirectTo: string;
}

const CONFIG = {
  google: {
    label: "Продължи с Google",
    pendingLabel: "Отваряме Google...",
    error: "Не успяхме да отворим Google. Опитай отново.",
    accent: "warm",
  },
  discord: {
    label: "Продължи с Discord",
    pendingLabel: "Отваряме Discord...",
    error: "Не успяхме да отворим Discord. Опитай отново.",
    accent: "cool",
  },
} as const;

export function OAuthButton({ provider, redirectTo }: Props) {
  const [isPending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const config = CONFIG[provider];
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
        setStatus(config.error);
        setPending(false);
      }
    } catch (error) {
      console.error(`[oauth:${provider}]`, error);
      setStatus(config.error);
      setPending(false);
    }
  }

  return (
    <div className="oauth-option">
      <button
        type="button"
        className="oauth-button"
        data-provider={provider}
        data-accent={config.accent}
        onClick={start}
        disabled={isPending}
        aria-busy={isPending}
        aria-label={isPending ? config.pendingLabel : config.label}
        aria-describedby={status ? statusId : undefined}
      >
        <span className="oauth-button-logo" data-provider={provider} aria-hidden>
          {provider === "google" ? <GoogleG /> : <DiscordMark />}
        </span>
        <span className="oauth-button-label">{isPending ? config.pendingLabel : config.label}</span>
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

function GoogleG() {
  return (
    <img src="/brand/google-g.svg" alt="" width={24} height={24} aria-hidden />
  );
}

function DiscordMark() {
  return (
    <img src="/brand/discord-mark.svg" alt="" width={28} height={22} aria-hidden />
  );
}
