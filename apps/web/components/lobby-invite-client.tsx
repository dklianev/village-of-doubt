"use client";

import "@/components/LobbyInvite.module.css";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Copy, Eye, Share2, Sparkles } from "lucide-react";
import type { GameFamily } from "@werewolf/shared";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useToast } from "@/lib/toast";

interface LobbyInviteClientProps {
  code: string;
  family: GameFamily;
  modeLabel: string;
  playHref: string;
  spectatorHref: string;
  hostName: string;
  routeLabel: string;
}

type LiveRoomPreview = {
  status: "lobby" | "in_game" | "finished";
  playerCount: number;
  capacity: number;
  hostName: string | null;
  players: Array<{
    displayName: string;
    connected: boolean;
    ready: boolean;
    host: boolean;
  }>;
};

export function LobbyInviteClient({
  code,
  family,
  modeLabel,
  playHref,
  spectatorHref,
  hostName,
  routeLabel,
}: LobbyInviteClientProps) {
  const toast = useToast();
  const { preview, liveState } = useLiveRoomPreview(code);
  const visiblePlayers = useMemo(() => {
    if (preview?.players.length) {
      return preview.players.slice(0, 3);
    }
    return [
      {
        displayName: preview?.hostName ?? hostName,
        connected: true,
        ready: false,
        host: true,
      },
    ];
  }, [hostName, preview]);
  const liveSummary = preview ? roomPreviewSummary(preview) : null;

  const copyText = async (value: string, message: string) => {
    try {
      await copyTextToClipboard(value);
      toast({ kind: "success", message });
    } catch {
      toast({ kind: "error", message: "Не успяхме да копираме. Опитай ръчно." });
    }
  };

  const shareInvite = async () => {
    const inviteUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Покана за частна стая",
          text: `Влез в моята стая с код ${code}`,
          url: inviteUrl,
        });
        return;
      }
      await copyText(inviteUrl, "Линкът за покана е копиран.");
    } catch {
      toast({ kind: "info", message: "Поканата остана при теб." });
    }
  };

  return (
    <article className="lobby-invite-v2" data-family={family}>
      <header className="lobby-invite-hero">
        <Image
          src="/game-art/legal/lobby-banner.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 1180px) 100vw, 1180px"
          className="lobby-invite-hero-img"
        />
        <div className="lobby-invite-hero-scrim" aria-hidden />
        <div className="lobby-invite-hero-copy">
          <p className="lobby-invite-kicker">частна стая · {modeLabel}</p>
          <h1>Покана за масата.</h1>
          <p>
            Сподели кода с играчите. Когато всички влязат, домакинът започва играта от общата
            стая.
          </p>
        </div>
      </header>

      <section className="lobby-code-panel" aria-labelledby="room-code-title">
        <div>
          <p className="lobby-code-label" id="room-code-title">
            Кодът на стаята
          </p>
          <div className="lobby-code-display" aria-label={`Код на стаята ${code}`}>
            {code}
          </div>
          <p className="lobby-code-help">Изпрати го на хората, които ще седнат на масата.</p>
        </div>

        <div className="lobby-code-actions" aria-label="Действия с поканата">
          <button type="button" className="btn btn-secondary" onClick={() => copyText(code, "Кодът е копиран.")}>
            <Copy aria-hidden strokeWidth={1.9} />
            <span>Копирай кода</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={shareInvite}>
            <Share2 aria-hidden strokeWidth={1.9} />
            <span>Сподели</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => copyText(window.location.href, "Линкът за покана е копиран.")}
          >
            <Sparkles aria-hidden strokeWidth={1.9} />
            <span>Копирай линка</span>
          </button>
        </div>
      </section>

      <nav className="lobby-invite-cta" aria-label="Действия за стаята">
        <Link href={playHref} className="btn btn-primary" prefetch={false}>
          Към играта
        </Link>
        <Link href={spectatorHref} className="btn btn-secondary" prefetch={false}>
          <Eye aria-hidden strokeWidth={1.9} />
          <span>Наблюдавай</span>
        </Link>
        <Link href="/lobby" className="btn btn-secondary" prefetch={false}>
          <ArrowLeft aria-hidden strokeWidth={1.9} />
          <span>Назад</span>
        </Link>
      </nav>

      <section className="lobby-route-card">
        <p className="lobby-route-kicker">
          {preview ? `${routeLabel} · ${roomStatusLabel(preview.status)}` : routeLabel}
        </p>
        <p>
          {liveSummary ??
          (family === "werewolves"
            ? "Стаята е подготвена за нощни роли, дневно обсъждане и финален вот на селото."
            : "Стаята е подготвена за алибита, тайни действия и напрегнато гласуване.")}
        </p>
        {liveState === "offline" ? (
          <p className="lobby-code-help">Няма връзка на живо в момента. Поканата остава активна.</p>
        ) : null}
      </section>

      <section className="lobby-player-preview" aria-label="Първи играчи в стаята">
        <p className="lobby-route-kicker">
          {preview ? `На живо · ${preview.playerCount}/${preview.capacity}` : "Първи места в стаята"}
        </p>
        <div className="lobby-player-preview-row">
          {visiblePlayers.map((player, index) => (
            <span className="lobby-player-chip" key={`${player.displayName}:${index}`}>
              <strong>{initialFor(player.displayName)}</strong>
              <span>{player.displayName}</span>
              <em>{player.host ? "домакин" : player.ready ? "готов" : player.connected ? "в стаята" : "извън линия"}</em>
            </span>
          ))}
          {Array.from({ length: Math.max(0, 3 - visiblePlayers.length) }).map((_, index) => (
            <span className="lobby-player-chip is-empty" key={`empty-${index}`}>
              <strong>?</strong>
              <span>Очакваме играч</span>
              <em>място</em>
            </span>
          ))}
        </div>
      </section>
    </article>
  );
}

function useLiveRoomPreview(code: string) {
  const [preview, setPreview] = useState<LiveRoomPreview | null>(null);
  const [liveState, setLiveState] = useState<"idle" | "online" | "offline">("idle");

  useEffect(() => {
    let stopped = false;
    let timerId: number | null = null;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const schedule = () => {
      clearTimer();
      timerId = window.setTimeout(loadPreview, 5000);
    };

    const loadPreview = async () => {
      if (stopped) {
        return;
      }
      if (document.hidden) {
        schedule();
        return;
      }

      controller?.abort();
      controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller?.abort(), 2500);
      try {
        const response = await fetch(`/api/rooms/${code}/preview`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("missing");
        }
        const nextPreview = toLiveRoomPreview(await response.json());
        if (!nextPreview) {
          throw new Error("invalid");
        }
        if (!stopped) {
          setPreview(nextPreview);
          setLiveState("online");
        }
      } catch {
        if (!stopped) {
          setPreview(null);
          setLiveState("offline");
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!stopped) {
          schedule();
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        return;
      }
      clearTimer();
      void loadPreview();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    void loadPreview();

    return () => {
      stopped = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [code]);

  return { preview, liveState };
}

function toLiveRoomPreview(value: unknown): LiveRoomPreview | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.status !== "lobby" && record.status !== "in_game" && record.status !== "finished") {
    return null;
  }
  if (typeof record.playerCount !== "number" || typeof record.capacity !== "number") {
    return null;
  }
  return {
    status: record.status,
    playerCount: Math.max(0, Math.floor(record.playerCount)),
    capacity: Math.max(0, Math.floor(record.capacity)),
    hostName: typeof record.hostName === "string" ? record.hostName : null,
    players: Array.isArray(record.players) ? record.players.flatMap(toLiveRoomPlayer).slice(0, 6) : [],
  };
}

function toLiveRoomPlayer(value: unknown): LiveRoomPreview["players"] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const displayName = typeof record.displayName === "string" ? record.displayName.trim() : "";
  if (!displayName) {
    return [];
  }
  return [
    {
      displayName,
      connected: record.connected === true,
      ready: record.ready === true,
      host: record.host === true,
    },
  ];
}

function roomStatusLabel(status: LiveRoomPreview["status"]) {
  switch (status) {
    case "lobby":
      return "чака играчи";
    case "in_game":
      return "играта върви";
    case "finished":
      return "приключила";
  }
}

function roomPreviewSummary(preview: LiveRoomPreview) {
  const host = preview.hostName ? ` Домакин: ${preview.hostName}.` : "";
  switch (preview.status) {
    case "lobby":
      return `В стаята има ${preview.playerCount} от ${preview.capacity} играчи.${host}`;
    case "in_game":
      return `Играта вече върви с ${preview.playerCount} играчи.${host}`;
    case "finished":
      return `Тази стая вече приключи.${host}`;
  }
}

function initialFor(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase("bg-BG") || "И";
}
