"use client";

import type { CSSProperties } from "react";
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
    style: {
      color: "#1a1410",
      backgroundColor: "#c8a366",
      backgroundImage:
        'linear-gradient(155deg, rgba(255, 250, 238, 0.45), rgba(238, 222, 196, 0.3)), image-set(url("/game-art/oauth-google-plate.webp") type("image/webp"), url("/game-art/oauth-google-plate.png") type("image/png"))',
      textShadow: "0 1px 0 rgba(255, 240, 200, 0.45)",
    },
  },
  discord: {
    label: "Продължи с Discord",
    accent: "cool",
    style: {
      color: "#f5f6ff",
      backgroundColor: "#5865f2",
      backgroundImage:
        'linear-gradient(155deg, rgba(220, 230, 255, 0.35), rgba(60, 80, 150, 0.2)), image-set(url("/game-art/oauth-discord-plate.webp") type("image/webp"), url("/game-art/oauth-discord-plate.png") type("image/png"))',
      textShadow: "0 1px 0 rgba(20, 30, 80, 0.6)",
    },
  },
} as const;

const OAUTH_PILL_STYLE: CSSProperties = {
  position: "relative",
  justifyContent: "flex-start",
  width: "100%",
  minHeight: "56px",
  gap: "12px",
  padding: "10px 18px",
  fontWeight: 800,
  letterSpacing: "0.02em",
  border: "1px solid rgba(50, 30, 10, 0.5)",
  borderRadius: "var(--ds-radius-chip)",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundBlendMode: "multiply",
  boxShadow:
    "inset 0 1px 0 rgba(255, 240, 200, 0.55), inset 0 -1px 0 rgba(50, 30, 10, 0.4), 0 6px 14px rgba(0, 0, 0, 0.4)",
};

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
      data-provider={provider}
      data-accent={config.accent}
      onClick={start}
      disabled={isPending}
      aria-busy={isPending}
      aria-label={config.label}
      style={{ ...OAUTH_PILL_STYLE, ...config.style }}
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
