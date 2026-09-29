"use client";

import "@/components/LegacyLobby.module.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Copy, Eye, Link2, RefreshCw, Share2 } from "lucide-react";
import { getGameFamily, getGameModeNameBg, ROOM_CODE_REGEX, type GameFamily, type RoomInvitationEligibility } from "@werewolf/shared";
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
  const joinHref = family === "mafia" ? "/mafia/join" : family === "werewolves" ? "/werewolf/join" : "/join";
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
    const inviteUrl = invitationUrl(code);
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
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return;
      await copyText(inviteUrl, "Линкът за покана е копиран.");
    }
  };

  return (
    <article className="lobby-invite-v2" data-family={family} data-faction={family} data-room-status={result.status}>
      <div className="lobby-invite-scene" aria-hidden="true" />
      <div className="lobby-invite-content">
       <div className="lobby-invite-details">
        <header className="lobby-invite-hero-copy">
          <p className="lobby-invite-kicker">{preview ? `${preview.roomVisibility === "public" ? "Отворена" : "Частна"} стая · ` : ""}{modeLabel}</p>
          <h1>Покана <br />за масата.</h1>
          <p>{invitationIntro(preview)}</p>
        </header>

      <section className="lobby-code-panel" aria-labelledby="room-code-title">
        <div>
          <p className="lobby-code-label" id="room-code-title">Код на стаята</p>
          <code className="lobby-code-display" aria-label={`Код на стаята ${code}`}>{code}</code>
        </div>
        {canShare ? <button type="button" className="lobby-invite-icon" aria-label="Копирай кода" title="Копирай кода" onClick={() => copyText(code, "Кодът е копиран.")}><Copy aria-hidden="true" /></button> : null}
      </section>

      <section className="lobby-route-card" role="status" aria-live="polite" aria-atomic="true">
        {preview ? <div className="lobby-room-status-line">
          <p className="lobby-room-status"><span className="lobby-status-dot" aria-hidden="true" />{roomStatusLabel(preview.status)}</p>
          {preview.status === "lobby" ? <p>{preview.playerCount} от {preview.capacity} места заети</p> : null}
        </div> : null}
        {preview?.status === "lobby" ? <>
          {preview.hostName ? <p className="lobby-room-host">Домакин: {preview.hostName}.</p> : null}
          {preview.playerCount >= preview.capacity && !preview.canJoinAsPlayer ? <p>Стаята е пълна.</p> : null}
        </> : <p>{summary}</p>}
      </section>

      {preview && visiblePlayers.length > 0 ? <section className="lobby-player-preview" aria-label="Първи играчи в стаята">
        <p className="lobby-route-kicker">{preview.status === "finished" ? "Участници" : "Вече са тук"}</p>
        <div className="lobby-player-preview-row">
          {visiblePlayers.map((player, index) => (
            <span className="lobby-player-chip" key={`${player.displayName}:${index}`}>
              <strong aria-hidden="true">{initialFor(player.displayName)}</strong>
              <span className="lobby-player-name">{player.displayName}</span>
              <em>{!player.connected ? "извън линия" : player.host ? "домакин" : player.ready ? "готов" : "в стаята"}</em>
            </span>
          ))}
        </div>
        {preview.playerCount > visiblePlayers.length ? <p className="lobby-more-players">И още {preview.playerCount - visiblePlayers.length} в стаята.</p> : null}
      </section> : null}

      <nav className="lobby-invite-cta" aria-label="Действия за стаята">
        {canEnter ? (
          <Link href={playHref} className="btn btn-primary" prefetch={false}>
            {preview?.viewerMembership === "participant" ? "Върни се в играта" : "Към играта"}
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
        {canSpectate ? (
          <Link href={spectatorHref} className={`btn ${canEnter ? "btn-secondary" : "btn-primary"}`} prefetch={false}>
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
      </nav>

      <footer className="lobby-invite-footer">
        {canShare ? <div className="lobby-code-actions" aria-label="Действия с поканата">
          <button type="button" className="lobby-invite-text-action" onClick={shareInvite}><Share2 aria-hidden="true" />Сподели поканата</button>
          <button type="button" className="lobby-invite-icon lobby-copy-link" aria-label="Копирай линка" title="Копирай линка" onClick={() => copyText(invitationUrl(code), "Линкът за покана е копиран.")}><Link2 aria-hidden="true" /></button>
        </div> : null}
        <Link href={joinHref} className="lobby-invite-back" prefetch={false} aria-label={family ? `Въведи друг код за ${familyLabel}` : "Въведи друг код"}>
          <ArrowLeft aria-hidden="true" />
          <span>Друг код</span>
        </Link>
      </footer>
      </div>
      </div>
    </article>
  );
}

function useLiveRoomPreview(code: string) {
  const [snapshot, setSnapshot] = useState<{ code: string; result: RoomPreview } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ROOM_CODE_REGEX.test(code)) {
      setSnapshot({ code, result: { status: "missing" } });
      return;
    }
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

function invitationUrl(code: string) {
  return new URL(`/lobby/${encodeURIComponent(code)}`, window.location.origin).href;
}

function invitationIntro(preview: LiveRoomPreview | null) {
  if (!preview) return "Стая за игра с приятели.";
  if (preview.status === "finished") return "Тази вечер вече е част от историята.";
  if (preview.status === "in_game") {
    if (preview.viewerMembership === "participant") return "Твоето място те чака. Върни се при останалите.";
    return preview.canSpectate
      ? "Играта вече започна. Можеш да проследиш как ще завърши."
      : "Играта вече започна. В момента не приема нови гости.";
  }
  if (preview.canJoinAsPlayer) return <>Влез при останалите. <br />Вечерта започва, когато сте готови.</>;
  return preview.canSpectate
    ? "Можеш да се присъединиш като наблюдател."
    : "В момента стаята не приема нови гости.";
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
      return "Чака играчи";
    case "in_game":
      return "Играта върви";
    case "finished":
      return "Приключила";
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
