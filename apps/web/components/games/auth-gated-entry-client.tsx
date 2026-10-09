"use client";

import "@/components/games/JoinEntry.module.css";
import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, Gamepad2, KeyRound, LoaderCircle, Martini, Moon, Plus, RefreshCw } from "lucide-react";
import {
  ROOM_CODE_LENGTH,
  ROOM_CODE_REGEX,
  getGameFamily,
  normalizeRoomCodeInput,
  type GameFamily,
  type GameMode,
  type RoomInvitationEligibility,
} from "@werewolf/shared";
import { JoinCodeSlots } from "@/components/games/join-code-slots";
import { useAuthSession, type AuthSessionView } from "@/lib/use-auth-session";
import { useRecentRooms } from "@/lib/use-recent-rooms";

type RoomPreview = RoomInvitationEligibility & {
  code: string;
  status: "lobby" | "in_game" | "finished";
  playerCount: number;
  capacity: number;
  family: GameFamily;
};

type RoomPreviewState =
  | { kind: "idle" }
  | { kind: "loading"; code: string }
  | { kind: "room"; room: RoomPreview }
  | { kind: "missing"; code: string }
  | { kind: "network_error"; code: string };

export const JOIN_PREVIEW_TIMEOUT_MS = 5_000;
export const JOIN_PREVIEW_REFRESH_MS = 10_000;
const JOIN_PREVIEW_FOCUS_THROTTLE_MS = 1_000;

const FAMILY_COPY = {
  mafia: { Icon: Martini, name: "Мафия", heading: "Влез на масата" },
  werewolves: { Icon: Moon, name: "Върколак", heading: "Влез в селото" },
} as const;

export function AuthGatedEntryClient({
  family,
  initialCode = "",
  initialSession,
}: {
  family?: GameFamily;
  mode?: GameMode;
  initialCode?: string;
  initialSession?: AuthSessionView | null;
}) {
  const router = useRouter();
  const { data: session, isError: sessionError, isPending, refresh: refreshSession } = useAuthSession(initialSession);
  const normalizedInitialCode = normalizeRoomCodeInput(initialCode);
  const [roomCode, setRoomCode] = useState(normalizedInitialCode);
  const [spectatorChoice, setSpectatorChoice] = useState<{ key: string; value: boolean } | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ key: string; state: RoomPreviewState } | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [isJoining, startTransition] = useTransition();
  const errorId = useId();
  const modeId = useId();
  const viewerId = session?.user.id;
  const choiceKey = JSON.stringify([viewerId, roomCode]);
  const requestKey = JSON.stringify([viewerId, roomCode, previewAttempt]);
  const validCode = ROOM_CODE_REGEX.test(roomCode);
  // Eligibility belongs to this code and this viewer, never the previous response.
  const previewState: RoomPreviewState = preview?.key === requestKey
    ? preview.state
    : validCode && viewerId ? { kind: "loading", code: roomCode } : { kind: "idle" };
  const previewRoom = previewState.kind === "room" ? previewState.room : null;
  const activeRoom = Boolean(previewRoom && previewRoom.status !== "finished");
  const canPlay = activeRoom && Boolean(previewRoom?.canJoinAsPlayer);
  const canWatch = activeRoom && Boolean(previewRoom?.canSpectate) && previewRoom?.viewerMembership !== "participant";
  const defaultSpectator = previewRoom?.viewerMembership === "spectator" || !canPlay;
  const spectator = spectatorChoice?.key === choiceKey ? spectatorChoice.value : defaultSpectator;
  const joinsAsSpectator = canWatch && (spectator || !canPlay);
  const roomAcceptsEntry = joinsAsSpectator ? canWatch : canPlay;
  const effectiveFamily = previewRoom?.family ?? family;
  const { rooms, remember } = useRecentRooms(effectiveFamily ?? "werewolves");
  const recentRooms = effectiveFamily ? rooms : [];
  const copy = effectiveFamily ? FAMILY_COPY[effectiveFamily] : { Icon: KeyRound, name: "Сенките", heading: "Влез с код" };
  const FamilyIcon = copy.Icon;
  const gameRoot = effectiveFamily === "mafia" ? "/mafia" : effectiveFamily === "werewolves" ? "/werewolf" : "";
  const entryRoot = family === "mafia" ? "/mafia" : family === "werewolves" ? "/werewolf" : "";
  const redirectCode = [roomCode, normalizedInitialCode].find((code) => ROOM_CODE_REGEX.test(code));
  const joinPath = entryRoot
    ? `${entryRoot}/join${redirectCode ? `/${redirectCode}` : ""}`
    : `/join${redirectCode ? `?${new URLSearchParams({ code: redirectCode })}` : ""}`;
  const signInPath = `/sign-in?redirect=${encodeURIComponent(joinPath)}`;

  useEffect(() => {
    if (!ROOM_CODE_REGEX.test(roomCode) || !viewerId) return;

    let disposed = false;
    let inFlight: AbortController | null = null;
    let requestTimeout: ReturnType<typeof setTimeout> | undefined;
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastRequestAt = -Infinity;
    const canRefresh = () => !disposed && document.visibilityState === "visible" && navigator.onLine;
    setPreview({ key: requestKey, state: { kind: navigator.onLine ? "loading" : "network_error", code: roomCode } });

    function scheduleRefresh(delay = JOIN_PREVIEW_REFRESH_MS) {
      clearTimeout(refreshTimeout);
      if (canRefresh()) refreshTimeout = setTimeout(() => void loadPreview(), delay);
    }

    function cancelPreview() {
      clearTimeout(refreshTimeout);
      clearTimeout(requestTimeout);
      inFlight?.abort();
      inFlight = null;
    }

    async function loadPreview() {
      if (!canRefresh() || inFlight) return;
      clearTimeout(refreshTimeout);
      const controller = new AbortController();
      inFlight = controller;
      lastRequestAt = Date.now();

      function finishRequest() {
        // A cancelled request may settle after its replacement has already started.
        if (inFlight !== controller) return;
        clearTimeout(requestTimeout);
        inFlight = null;
        scheduleRefresh();
      }

      requestTimeout = setTimeout(() => {
        controller.abort();
        setPreview({ key: requestKey, state: { kind: "network_error", code: roomCode } });
        finishRequest();
      }, JOIN_PREVIEW_TIMEOUT_MS);

      try {
        const response = await fetch(`/api/rooms/${roomCode}/preview`, {
          signal: controller.signal,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Room preview unavailable");
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (data && typeof data === "object" && "status" in data && data.status === "missing") {
          setPreview({ key: requestKey, state: { kind: "missing", code: roomCode } });
          return;
        }
        const room = parseJoinRoomPreview(data, roomCode);
        if (!room) throw new Error("Invalid room preview");
        setPreview({ key: requestKey, state: { kind: "room", room } });
      } catch {
        if (!controller.signal.aborted) {
          setPreview({ key: requestKey, state: { kind: "network_error", code: roomCode } });
        }
      } finally {
        finishRequest();
      }
    }

    function recheckPreview() {
      if (!canRefresh()) {
        cancelPreview();
        return;
      }
      if (inFlight) return;
      const delay = Math.max(0, lastRequestAt + JOIN_PREVIEW_FOCUS_THROTTLE_MS - Date.now());
      if (delay > 0) scheduleRefresh(delay);
      else void loadPreview();
    }

    document.addEventListener("visibilitychange", recheckPreview);
    window.addEventListener("focus", recheckPreview);
    window.addEventListener("online", recheckPreview);
    window.addEventListener("offline", recheckPreview);
    void loadPreview();
    return () => {
      disposed = true;
      cancelPreview();
      document.removeEventListener("visibilitychange", recheckPreview);
      window.removeEventListener("focus", recheckPreview);
      window.removeEventListener("online", recheckPreview);
      window.removeEventListener("offline", recheckPreview);
    };
  }, [requestKey, roomCode, viewerId]);

  function handleCodeChange(next: string) {
    if (next === roomCode) return;
    setRoomCode(next);
    setPreview(null);
    setSpectatorChoice(null);
    setError("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isJoining || !session) return;
    const validationError = getRoomCodeError(roomCode);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!roomAcceptsEntry || !previewRoom) return;
    setError("");
    remember(roomCode);
    const params = new URLSearchParams({ mode: previewRoom.mode });
    if (joinsAsSpectator) params.set("spectator", "1");
    startTransition(() => router.push(`/play/${roomCode}?${params}`));
  }

  if (isPending || !session) {
    return (
      <section className="join-entry-card" data-family={effectiveFamily}>
        <header className="join-entry-hero">
          <p className="join-entry-kicker"><FamilyIcon aria-hidden strokeWidth={1.5} />{copy.name}</p>
          <h1>{isPending ? copy.heading : sessionError ? "Не успяхме да потвърдим сесията" : "Сесията ти е приключила"}</h1>
          {isPending ? (
            <p role="status"><LoaderCircle className="spin" aria-hidden />Проверяваме сесията...</p>
          ) : <p>{sessionError ? "Провери връзката и опитай отново." : "Влез отново, за да продължиш към стаята."}</p>}
        </header>
        {!isPending && (sessionError ? (
          <button type="button" className="btn btn-primary join-submit" onClick={() => void refreshSession({ fresh: true })}>
            <RefreshCw aria-hidden />Провери сесията отново
          </button>
        ) : (
          <Link className="btn btn-primary join-submit" href={signInPath}><KeyRound aria-hidden />Влез отново</Link>
        ))}
      </section>
    );
  }

  return (
    <section className="join-entry-card" data-family={effectiveFamily}>
      {/* Firefox must not restore stale disabled/checked state over fresh eligibility. */}
      <form className="join-entry-form" onSubmit={onSubmit} autoComplete="off" noValidate>
        <header className="join-entry-hero">
          <p className="join-entry-kicker"><FamilyIcon aria-hidden strokeWidth={1.5} />{copy.name}</p>
          <h1>{copy.heading}</h1>
        </header>

        <div className="join-entry-code-panel">
          <div className="join-entry-code-field">
            <span className="join-entry-label">Код на стаята</span>
            <JoinCodeSlots value={roomCode} onChange={handleCodeChange} invalid={Boolean(error)} {...(error ? { describedBy: errorId } : {})} />
            {error && <p id={errorId} className="join-entry-error" role="alert">{error}</p>}
          </div>

          {recentRooms.length > 0 && !roomCode && (
            <div className="join-recent">
              <span className="join-recent-label">Последни стаи</span>
              {recentRooms.map((room) => (
                <button key={`${room.family}:${room.code}`} type="button" className="join-recent-chip" onClick={() => handleCodeChange(room.code)}>{room.code}</button>
              ))}
            </div>
          )}

          <fieldset className="join-mode">
            <legend>Влизаш като</legend>
            <div className="join-mode-options">
              <label>
                <input type="radio" name={modeId} value="player" checked={!joinsAsSpectator} disabled={!canPlay} onChange={() => setSpectatorChoice({ key: choiceKey, value: false })} />
                <span><Gamepad2 aria-hidden />Играч</span>
              </label>
              <label>
                <input type="radio" name={modeId} value="spectator" checked={joinsAsSpectator} disabled={!canWatch} onChange={() => setSpectatorChoice({ key: choiceKey, value: true })} />
                <span><Eye aria-hidden />Наблюдател</span>
              </label>
            </div>
          </fieldset>
          <div className="join-preview" aria-busy={previewState.kind === "loading"}>
            <RoomPreviewStatus state={previewState} onRetry={() => setPreviewAttempt((attempt) => attempt + 1)} />
          </div>
        </div>

        <div className="join-entry-actions">
          <button className="btn btn-primary join-submit" type="submit" disabled={isJoining || (validCode && !roomAcceptsEntry)}>
            {isJoining ? <LoaderCircle className="spin" aria-hidden /> : joinsAsSpectator ? <Eye aria-hidden /> : <ArrowRight aria-hidden />}
            {isJoining ? "Влизаме..." : joinsAsSpectator ? "Наблюдавай" : "Влез в стаята"}
          </button>
          <Link className="join-create-link" href={`${gameRoot}/create${spectatorChoice?.key === choiceKey && spectatorChoice.value ? "?spectator=1" : ""}`}><Plus aria-hidden />Създай стая</Link>
        </div>
      </form>
      <footer className="join-entry-footer">
        <Link href="/faq">Помощ</Link>
        {effectiveFamily && <Link href={`${gameRoot}/rules`}>Правила</Link>}
      </footer>
    </section>
  );
}

function RoomPreviewStatus({ state, onRetry }: { state: RoomPreviewState; onRetry: () => void }) {
  if (state.kind === "idle") return null;
  if (state.kind === "loading") return <p className="join-preview-loading" role="status"><LoaderCircle className="spin" aria-hidden />Проверяваме стаята...</p>;
  if (state.kind === "missing") {
    return <p className="join-preview-banner" data-status="missing" role="status">Не открихме стая {state.code}. Провери кода или поискай нов.</p>;
  }
  if (state.kind === "network_error") {
    return (
      <div className="join-preview-banner" data-status="network_error">
        <p role="status">Не успяхме да проверим стаята.</p>
        <button type="button" className="join-preview-retry" onClick={onRetry}><RefreshCw aria-hidden />Провери отново</button>
      </div>
    );
  }
  const room = state.room;
  const detail = room.status === "finished" ? "Играта е приключила."
    : !room.canJoinAsPlayer && !room.canSpectate ? "В момента няма свободни места."
    : room.viewerMembership === "participant" && room.canJoinAsPlayer ? "Връщаш се на мястото си."
    : room.viewerMembership === "spectator" && room.canSpectate ? "Връщаш се като наблюдател."
    : room.status === "in_game" ? "Играта вече тече."
    : !room.canJoinAsPlayer ? "Местата за игра са заети."
    : `${room.playerCount} / ${room.capacity} ${room.playerCount === 1 ? "играч" : "играчи"}`;
  return (
    <div className="join-preview-banner" data-status={room.status} role="status">
      <strong>{room.mode === "mafia_sport" ? "Спортна Мафия" : FAMILY_COPY[room.family].name}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function parseJoinRoomPreview(value: unknown, expectedCode: string): RoomPreview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.code !== "string" || record.code !== expectedCode || !ROOM_CODE_REGEX.test(record.code) ||
    (record.status !== "lobby" && record.status !== "in_game" && record.status !== "finished") ||
    typeof record.playerCount !== "number" || !Number.isSafeInteger(record.playerCount) || record.playerCount < 0 ||
    typeof record.capacity !== "number" || !Number.isSafeInteger(record.capacity) || record.capacity <= 0 ||
    (record.family !== "mafia" && record.family !== "werewolves") ||
    (record.mode !== "mafia_free" && record.mode !== "mafia_sport" && record.mode !== "werewolves_classic") ||
    getGameFamily(record.mode) !== record.family ||
    (record.roomVisibility !== "private" && record.roomVisibility !== "public") ||
    (record.viewerMembership !== "participant" && record.viewerMembership !== "spectator" && record.viewerMembership !== "none") ||
    typeof record.canJoinAsPlayer !== "boolean" || typeof record.canSpectate !== "boolean"
  ) return null;
  return {
    code: record.code, status: record.status, playerCount: record.playerCount, capacity: record.capacity,
    family: record.family, mode: record.mode, roomVisibility: record.roomVisibility,
    viewerMembership: record.viewerMembership, canJoinAsPlayer: record.canJoinAsPlayer, canSpectate: record.canSpectate,
  };
}

function getRoomCodeError(code: string) {
  const length = code.replace(/\s/g, "").length;
  if (!length) return "Въведи кода на стаята.";
  if (length < ROOM_CODE_LENGTH) return `Кодът е ${ROOM_CODE_LENGTH} знака. Имаш ${length}.`;
  if (!ROOM_CODE_REGEX.test(code)) return "Неправилен код. Използвай латински букви без I и O и цифри от 2 до 9.";
  return "";
}
