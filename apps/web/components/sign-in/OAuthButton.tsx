"use client";

import { useEffect, useState } from "react";
import { Pill } from "@werewolf/ui";
import { authClient } from "@/lib/auth-client";
import { resolveWelcomeRedirect } from "./welcome-redirect";

interface Props {
  provider: "google" | "discord";
  redirectTo: string;
}

const CONFIG = {
  google: {
    label: "Продължи с Google",
    accent: "warm",
  },
  discord: {
    label: "Продължи с Discord",
    accent: "cool",
  },
} as const;

export function OAuthButton({ provider, redirectTo }: Props) {
  const [isPending, setPending] = useState(false);
  const config = CONFIG[provider];

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
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: resolveWelcomeRedirect(redirectTo),
      });
    } catch (error) {
      console.error(`[oauth:${provider}]`, error);
      setPending(false);
    }
  }

  return (
    <Pill
      intent="secondary"
      type="button"
      className="oauth-button-pill"
      shimmer
      data-provider={provider}
      data-accent={config.accent}
      onClick={start}
      disabled={isPending}
      aria-busy={isPending}
      aria-label={config.label}
    >
      <span className="oauth-button-logo" data-provider={provider} aria-hidden>
        {provider === "google" ? <GoogleG /> : <DiscordMark />}
      </span>
      <span className="oauth-button-label">{config.label}</span>
      {isPending ? <span className="oauth-button-spinner" aria-hidden /> : null}
    </Pill>
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
