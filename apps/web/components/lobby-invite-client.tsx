"use client";

import "@/components/LegacyLobby.module.css";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Copy, Eye, RefreshCw, Share2, Sparkles } from "lucide-react";
import { getGameFamily, getGameModeNameBg, type GameFamily, type RoomInvitationEligibility } from "@werewolf/shared";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useToast } from "@/lib/toast";

interface LobbyInviteClientProps {
  code: string;
  family?: GameFamily;
}

type LiveRoomPreview = RoomInvitationEligibility & {
  status: "lobby" | "in_game" | "finished";
  playerCount: number;
  capacity: number;
  family: GameFamily;
  hostName: string | null;
  players: Array<{
    displayName: string;
    connected: boolean;
    ready: boolean;
    host: boolean;
  }>;
};

type RoomPreview = LiveRoomPreview | { status: "loading" | "missing" | "unavailable" };

export function LobbyInviteClient({
  code,
  family: familyHint,
}: LobbyInviteClientProps) {
  const toast = useToast();
  const { result, retry } = useLiveRoomPreview(code);
  const preview = "players" in result ? result : null;
  const visiblePlayers = preview?.players.slice(0, 3) ?? [];
  const family = preview?.family ?? familyHint;
  const active = result.status === "lobby" || result.status === "in_game";
  const canEnter = active && preview?.canJoinAsPlayer === true;
  const canSpectate = active && preview?.canSpectate === true;
  const canShare = canEnter || canSpectate;
  const playHref = `/play/${encodeURIComponent(code)}?mode=${preview?.mode ?? ""}`;
  const spectatorHref = `${playHref}&spectator=1`;
  const modeLabel = preview ? getGameModeNameBg(preview.mode) : "покана с код";
  const routeLabel = family === "mafia" ? "досие към задната стая" : family === "werewolves" ? "маршрут до площада" : "покана за масата";
  const joinHref = family === "mafia" ? "/mafia/join" : family === "werewolves" ? "/werewolf/join" : "/";
  const familyLabel = family === "mafia" ? "Мафия" : "Върколак";
  const summary = preview ? roomPreviewSummary(preview)
    : result.status === "missing" ? "Тази стая вече не е достъпна. Поискай нов код от домакина."
    : result.status === "unavailable" ? "Не успяхме да проверим стаята. Провери връзката си и опитай отново."
    : "Проверяваме стаята...";

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
          title: "Покана за масата",
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
    <article className="lobby-invite-v2" data-family={family} data-faction={family}>
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
          <p className="lobby-invite-kicker">{preview ? `${preview.roomVisibility === "public" ? "отворена" : "частна"} стая · ` : ""}{modeLabel}</p>
          <h1>Покана за масата.</h1>
          <p>
            {result.status === "in_game"
              ? "Играта вече върви. Участниците могат да се върнат, а новите гости могат да наблюдават при свободни места."
              : result.status === "lobby"
              ? "Когато всички влязат, домакинът започва играта от общата стая."
              : "Покана за игра с код от домакина."}
          </p>
        </div>
      </header>

      <section className="lobby-route-card" role="status" aria-live="polite" aria-atomic="true">
        <p className="lobby-route-kicker">
          {preview ? `${routeLabel} · ${roomStatusLabel(preview.status)}` : routeLabel}
        </p>
        <p>{summary}</p>
      </section>

      <nav className="lobby-invite-cta" aria-label="Действия за стаята">
        {canEnter ? (
          <Link href={playHref} className="btn btn-primary" prefetch={false}>
            {preview?.viewerMembership === "participant" ? "Върни се в играта" : "Към играта"}
          </Link>
        ) : null}
        {canSpectate ? (
          <Link href={spectatorHref} className="btn btn-secondary" prefetch={false}>
            <Eye aria-hidden strokeWidth={1.9} />
            <span>{preview?.viewerMembership === "spectator" ? "Продължи да наблюдаваш" : "Наблюдавай"}</span>
          </Link>
        ) : null}
        {result.status === "unavailable" ? (
          <button type="button" className="btn btn-primary" onClick={retry}>
            <RefreshCw aria-hidden strokeWidth={1.9} />
            <span>Провери отново</span>
          </button>
        ) : null}
        <Link href={joinHref} className="btn btn-secondary" prefetch={false}>
          <ArrowLeft aria-hidden strokeWidth={1.9} />
          <span>{family ? `Въведи друг код за ${familyLabel}` : "Избери игра"}</span>
        </Link>
      </nav>

      <section className="lobby-code-panel" aria-labelledby="room-code-title">
        <div>
          <p className="lobby-code-label" id="room-code-title">
            Кодът на стаята
          </p>
          <div className="lobby-code-display" aria-label={`Код на стаята ${code}`}>
            {code}
          </div>
          {canShare ? <p className="lobby-code-help">Сподели кода с хората, които искаш да поканиш.</p> : null}
        </div>

        {canShare ? <div className="lobby-code-actions" aria-label="Действия с поканата">
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
        </div> : null}
      </section>

      {preview && visiblePlayers.length > 0 ? <section className="lobby-player-preview" aria-label="Първи играчи в стаята">
        <p className="lobby-route-kicker">
          {`${preview.status === "finished" ? "Участници" : "На живо"} · ${preview.playerCount}/${preview.capacity}`}
        </p>
        <div className="lobby-player-preview-row">
          {visiblePlayers.map((player, index) => (
            <span className="lobby-player-chip" key={`${player.displayName}:${index}`}>
              <strong>{initialFor(player.displayName)}</strong>
              <span>{player.displayName}</span>
              <em>{player.host ? "домакин" : player.ready ? "готов" : player.connected ? "в стаята" : "извън линия"}</em>
            </span>
          ))}
        </div>
      </section> : null}
    </article>
  );
}

function useLiveRoomPreview(code: string) {
  const [snapshot, setSnapshot] = useState<{ code: string; result: RoomPreview } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timerId: number | null = null;
    let controller: AbortController | null = null;
    setSnapshot({ code, result: { status: "loading" } });

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
      const requestController = new AbortController();
      controller = requestController;
      const isCurrentRequest = () => !stopped && controller === requestController;
      const timeoutId = window.setTimeout(() => requestController.abort(), 2500);
      try {
        const response = await fetch(`/api/rooms/${code}/preview`, {
          cache: "no-store",
          signal: requestController.signal,
        });
        const nextPreview = response.ok ? toRoomPreview(await response.json()) : { status: "unavailable" as const };
        if (isCurrentRequest()) {
          setSnapshot({ code, result: nextPreview });
        }
      } catch {
        if (isCurrentRequest()) {
          setSnapshot({ code, result: { status: "unavailable" } });
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (isCurrentRequest()) {
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
  }, [code, attempt]);

  return {
    result: snapshot?.code === code ? snapshot.result : { status: "loading" as const },
    retry: () => setAttempt((value) => value + 1),
  };
}

function toRoomPreview(value: unknown): RoomPreview {
  if (!value || typeof value !== "object") {
    return { status: "unavailable" };
  }
  const record = value as Record<string, unknown>;
  if (record.status === "missing" || record.status === "unavailable") {
    return { status: record.status };
  }
  if (record.status !== "lobby" && record.status !== "in_game" && record.status !== "finished") {
    return { status: "unavailable" };
  }
  if (typeof record.playerCount !== "number" || !Number.isFinite(record.playerCount)
    || typeof record.capacity !== "number" || !Number.isFinite(record.capacity)) {
    return { status: "unavailable" };
  }
  if ((record.mode !== "mafia_free" && record.mode !== "mafia_sport" && record.mode !== "werewolves_classic")
    || (record.family !== "mafia" && record.family !== "werewolves")
    || getGameFamily(record.mode) !== record.family
    || (record.roomVisibility !== "private" && record.roomVisibility !== "public")
    || (record.viewerMembership !== "participant" && record.viewerMembership !== "spectator" && record.viewerMembership !== "none")
    || typeof record.canJoinAsPlayer !== "boolean" || typeof record.canSpectate !== "boolean") {
    return { status: "unavailable" };
  }
  return {
    status: record.status,
    family: record.family,
    mode: record.mode,
    roomVisibility: record.roomVisibility,
    viewerMembership: record.viewerMembership,
    canJoinAsPlayer: record.canJoinAsPlayer,
    canSpectate: record.canSpectate,
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
      return `В стаята има ${preview.playerCount} от ${preview.capacity} играчи.${host}${preview.playerCount >= preview.capacity && !preview.canJoinAsPlayer ? " Стаята е пълна." : ""}`;
    case "in_game":
      return `Играта вече върви с ${preview.playerCount} играчи.${host}`;
    case "finished":
      return `Тази стая вече приключи.${host}`;
  }
}

function initialFor(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase("bg-BG") || "И";
}
