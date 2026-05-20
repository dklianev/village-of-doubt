"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Gamepad2, KeyRound, LoaderCircle, Martini, Moon, Plus, Users } from "lucide-react";
import {
  ROOM_CODE_LENGTH,
  ROOM_CODE_REGEX,
  normalizeRoomCodeInput,
  type CommunicationMode,
  type GameFamily,
  type GameMode,
  type NarratorMode,
  type TempoProfile,
} from "@werewolf/shared";
import { JoinCodeSlots } from "@/components/games/join-code-slots";
import { authClient } from "@/lib/auth-client";
import { useRecentRooms } from "@/lib/use-recent-rooms";

type RoomPreview = {
  code: string;
  status: "lobby" | "in_game" | "finished" | "missing";
  playerCount: number;
  capacity: number;
  family: GameFamily | null;
};

const FAMILY_COPY = {
  mafia: {
    Icon: Martini,
    kicker: "частен бар",
    greeting: (name: string) => `Добре дошъл в бара, ${name}.`,
    sub: "Покажи паролата на бара. Настани се на масата.",
    codeLabel: "Парола на бара",
    submitLabel: "Хлопам на вратата",
    submittingLabel: "Хлопаме на вратата...",
    createLabel: "Създай нов бар",
    createGhostLabel: "Нямам код? Създай нов бар →",
    spectatorOn: "Сядам встрани, без роля",
    spectatorOff: "Влизам да играя",
    spectatorHint: "Гледаш играта, но не получаваш роля. Можеш да следиш масата отстрани.",
    flavorFooter: "Името ти е в списъка. Кодът отваря вратата. Останалото е между нас.",
  },
  werewolves: {
    Icon: Moon,
    kicker: "тихо село",
    greeting: (name: string) => `Добре дошъл в селото, ${name}.`,
    sub: "Покажи знака на селото. Премини през оградата.",
    codeLabel: "Знак на селото",
    submitLabel: "Влизам в селото",
    submittingLabel: "Тръгваме към селото...",
    createLabel: "Създай ново село",
    createGhostLabel: "Нямам знак? Създай ново село →",
    spectatorOn: "Гледам отстрани, без роля",
    spectatorOff: "Влизам да играя",
    spectatorHint: "Гледаш как селото решава, но не получаваш роля.",
    flavorFooter: "Селото е тихо. Покажи знака си преди оградата.",
  },
} as const;

export function AuthGatedEntryClient({
  family,
  mode,
  initialCode = "",
}: {
  family: GameFamily;
  mode: GameMode;
  initialCode?: string;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const normalizedInitialCode = normalizeRoomCodeInput(initialCode);
  const [roomCode, setRoomCode] = useState(normalizedInitialCode);
  const [spectator, setSpectator] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isJoining, startTransition] = useTransition();
  const isMafia = family === "mafia";
  const copy = FAMILY_COPY[isMafia ? "mafia" : "werewolves"];
  const FamilyIcon = copy.Icon;
  const gameRoot = isMafia ? "/mafia" : "/werewolf";
  const playerCount = mode === "mafia_sport" ? 10 : isMafia ? 10 : 8;
  const tempo: TempoProfile = mode === "mafia_sport" ? "sport_mafia" : "normal_online";
  const communication: CommunicationMode = "built_in_chat";
  const narrator: NarratorMode = "automatic";
  const hasInviteCode = Boolean(normalizedInitialCode);
  const { rooms: recentRooms, remember } = useRecentRooms(family);

  const playPath = useMemo(() => {
    const params = new URLSearchParams({
      mode,
      players: String(playerCount),
      communication,
      narrator,
      tempo,
    });
    if (spectator) {
      params.set("spectator", "1");
    }
    return `/play/${roomCode}?${params.toString()}`;
  }, [communication, mode, narrator, playerCount, roomCode, spectator, tempo]);

  const createPath = useMemo(() => {
    if (!spectator) {
      return `${gameRoot}/create`;
    }
    const params = new URLSearchParams({ spectator: "1" });
    return `${gameRoot}/create?${params.toString()}`;
  }, [gameRoot, spectator]);

  useEffect(() => {
    if (!ROOM_CODE_REGEX.test(roomCode)) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/rooms/${roomCode}/preview`)
      .then((response) => (response.ok ? (response.json() as Promise<RoomPreview>) : Promise.reject()))
      .then((data) => {
        if (!cancelled) {
          setPreview(data.status === "missing" ? null : data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  useEffect(() => {
    if (preview?.status === "in_game") {
      setSpectator(true);
    }
  }, [preview?.status]);

  function handleCodeChange(next: string) {
    setRoomCode(normalizeRoomCodeInput(next));
    if (error) {
      setError("");
    }
  }

  function submit(action: "create" | "join") {
    if (action === "join") {
      const validationError = getRoomCodeError(roomCode);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError("");
    if (action === "join") {
      remember(roomCode);
    }

    startTransition(() => {
      router.push(action === "create" ? createPath : playPath);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit("join");
  }

  if (isPending || !session) {
    return (
      <section className="auth-entry-card join-entry-card join-entry-card--skeleton" data-theme={family} data-family={family}>
        <span className="join-entry-mark" aria-hidden>
          <LoaderCircle strokeWidth={1.8} className="spin" />
        </span>
        <p className="section-kicker join-entry-kicker">{copy.kicker}</p>
        <h2>Проверяваме профила...</h2>
        <p>След вход ще те върнем към поканата за тази стая.</p>
      </section>
    );
  }

  const friendlyName = session.user.name?.trim() || "приятел";
  const canSubmit = !isJoining;

  return (
    <section className="auth-entry-card join-entry-card" data-theme={family} data-family={family}>
      <form className="join-entry-form" onSubmit={onSubmit} noValidate>
        <header className="join-entry-hero">
          <span className="join-entry-mark" aria-hidden>
            <FamilyIcon strokeWidth={1.8} />
          </span>
          <div>
            <p className="section-kicker join-entry-kicker">{copy.kicker}</p>
            <h2>{copy.greeting(friendlyName)}</h2>
            <p>{copy.sub}</p>
          </div>
        </header>

        {error ? (
          <p className="join-entry-error" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}

        <div className="join-entry-code-panel">
          <div className="join-entry-code-field">
            <span>
              <KeyRound aria-hidden strokeWidth={1.8} />
              {copy.codeLabel}
            </span>
            <JoinCodeSlots value={roomCode} onChange={handleCodeChange} invalid={Boolean(error)} autoFocus={!initialCode} />
            <span className="join-codeslots-hint">
              {ROOM_CODE_LENGTH} знака - главни латински букви без I и O, цифри 2-9 без 0 и 1
            </span>
          </div>

          {recentRooms.length > 0 && !roomCode ? (
            <div className="join-recent">
              <span className="join-recent-label">Последни стаи:</span>
              {recentRooms.map((room) => (
                <button key={`${room.family}:${room.code}`} type="button" className="join-recent-chip" onClick={() => handleCodeChange(room.code)}>
                  {room.code}
                </button>
              ))}
            </div>
          ) : null}

          {preview ? <RoomPreviewBanner preview={preview} /> : null}
          {previewLoading && !preview ? <p className="join-preview-loading">Проверяваме стаята...</p> : null}

          <div className="join-spectator-row">
            <button
              type="button"
              className="join-spectator-toggle"
              data-active={spectator}
              aria-pressed={spectator}
              onClick={() => setSpectator((value) => !value)}
            >
              <span className="join-spectator-dot" aria-hidden />
              {spectator ? <Eye aria-hidden strokeWidth={1.8} /> : <Gamepad2 aria-hidden strokeWidth={1.8} />}
              {spectator ? copy.spectatorOn : copy.spectatorOff}
            </button>
            <p className="join-spectator-hint">{copy.spectatorHint}</p>
          </div>
        </div>

        <div className="join-entry-actions" data-mode={hasInviteCode ? "invite" : "cold"}>
          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            {isJoining ? <LoaderCircle className="spin" aria-hidden strokeWidth={1.8} /> : <Users aria-hidden strokeWidth={1.8} />}
            {isJoining ? copy.submittingLabel : copy.submitLabel}
          </button>
          {hasInviteCode ? (
            <Link className="btn-ghost-link" href={createPath}>
              {copy.createGhostLabel}
            </Link>
          ) : (
            <Link className="btn btn-secondary" href={createPath}>
              <Plus aria-hidden strokeWidth={1.8} />
              {copy.createLabel}
            </Link>
          )}
        </div>
      </form>

      <footer className="join-entry-footer">
        <p className="join-entry-flavor">{copy.flavorFooter}</p>
        <p className="join-entry-trust">
          <Link href="/faq">Помощ</Link>
          <span aria-hidden>·</span>
          <Link href={`${gameRoot}/rules`}>Правила</Link>
          <span aria-hidden>·</span>
          Безплатно, без реклами, на български
        </p>
      </footer>
    </section>
  );
}

function RoomPreviewBanner({ preview }: { preview: RoomPreview }) {
  return (
    <div className="join-preview-banner" data-status={preview.status}>
      <span className="join-preview-dot" aria-hidden />
      <div className="join-preview-text">
        {preview.status === "lobby" ? (
          <>
            <strong>Стая {preview.code}</strong> · {preview.playerCount}/{preview.capacity} {playerCountLabel(preview.playerCount)} в лобито
          </>
        ) : preview.status === "in_game" ? (
          <>
            <strong>Стая {preview.code}</strong> · играта вече тече. Влизаш като наблюдател.
          </>
        ) : (
          <>
            <strong>Стая {preview.code}</strong> · приключила
          </>
        )}
      </div>
    </div>
  );
}

function getRoomCodeError(code: string) {
  if (!code) {
    return "Въведи кода на стаята.";
  }
  if (code.length < ROOM_CODE_LENGTH) {
    return `Кодът е ${ROOM_CODE_LENGTH} знака. Имаш ${code.length}.`;
  }
  if (!ROOM_CODE_REGEX.test(code)) {
    return "Неправилен формат - само главни латински букви без I и O, и цифри 2-9 без 0 и 1.";
  }
  return "";
}

function playerCountLabel(count: number) {
  return count === 1 ? "играч" : "играчи";
}
