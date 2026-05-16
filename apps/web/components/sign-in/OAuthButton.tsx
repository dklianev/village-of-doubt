"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

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

  async function start() {
    setPending(true);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
      });
    } catch (error) {
      console.error(`[oauth:${provider}]`, error);
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="oauth-button"
      data-provider={provider}
      data-accent={config.accent}
      onClick={start}
      disabled={isPending}
      aria-label={config.label}
    >
      <span className="oauth-button-logo" data-provider={provider} aria-hidden>
        {provider === "google" ? <GoogleG /> : <DiscordMark />}
      </span>
      <span className="oauth-button-label">{config.label}</span>
      {isPending ? <span className="oauth-button-spinner" aria-hidden /> : null}
    </button>
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
