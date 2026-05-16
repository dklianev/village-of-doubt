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
    <svg viewBox="0 0 48 48" width="24" height="24" focusable="false" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41.4 35.7 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 71 55" width="28" height="22" fill="currentColor" focusable="false" aria-hidden>
      <path d="M60.1 4.9A58.5 58.5 0 0 0 45.7.5l-.6 1.3a52.7 52.7 0 0 1 11.7 4.4 41.2 41.2 0 0 0-31.9-2.4 41.9 41.9 0 0 0-9.7 4.4A52 52 0 0 1 27 .5L26.4.5A58.5 58.5 0 0 0 12 4.9 60.5 60.5 0 0 0 .5 45.3a59 59 0 0 0 18 9 43.6 43.6 0 0 0 3.8-6.2A38.5 38.5 0 0 1 16 45a30.7 30.7 0 0 0 1.5-1.2 41.5 41.5 0 0 0 35.6 0 30.7 30.7 0 0 0 1.5 1.2 38.5 38.5 0 0 1-6.3 3.1c1.2 2.2 2.5 4.3 3.8 6.2a59 59 0 0 0 18-9 60.5 60.5 0 0 0-11.5-40.4ZM23.7 36.6c-3.6 0-6.5-3.3-6.5-7.3s2.9-7.3 6.5-7.3 6.5 3.3 6.5 7.3-2.9 7.3-6.5 7.3Zm23.6 0c-3.6 0-6.5-3.3-6.5-7.3s2.9-7.3 6.5-7.3 6.5 3.3 6.5 7.3-2.9 7.3-6.5 7.3Z" />
    </svg>
  );
}
