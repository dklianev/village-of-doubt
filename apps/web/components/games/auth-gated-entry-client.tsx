"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoorOpen, Eye, Gamepad2, KeyRound, LoaderCircle, Plus, Users } from "lucide-react";
import {
  type CommunicationMode,
  type GameFamily,
  type GameMode,
  type NarratorMode,
  type TempoProfile,
} from "@werewolf/shared";
import { authClient } from "@/lib/auth-client";

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
  const [roomCode, setRoomCode] = useState(cleanRoomCode(initialCode));
  const [spectator, setSpectator] = useState(false);
  const [error, setError] = useState("");
  const isMafia = family === "mafia";
  const gameRoot = isMafia ? "/mafia" : "/werewolf";
  const playerCount = mode === "mafia_sport" ? 10 : isMafia ? 10 : 8;
  const tempo: TempoProfile = mode === "mafia_sport" ? "sport_mafia" : "normal_online";
  const communication: CommunicationMode = "built_in_chat";
  const narrator: NarratorMode = "automatic";

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

  function submit(action: "create" | "join") {
    if (action === "join" && !isValidRoomCode(roomCode)) {
      setError("Невалиден код на стая.");
      return;
    }

    setError("");
    router.push(action === "create" ? `${gameRoot}/create` : playPath);
  }

  if (isPending || !session) {
    return (
      <section className="auth-entry-card join-entry-card" data-theme={family} data-family={family}>
        <span className="join-entry-mark" aria-hidden>
          <LoaderCircle strokeWidth={1.8} />
        </span>
        <p className="section-kicker join-entry-kicker">влез в стаята</p>
        <h2>Проверяваме профила</h2>
        <p>След вход ще те върнем към поканата за тази стая.</p>
      </section>
    );
  }

  return (
    <section className="auth-entry-card join-entry-card" data-theme={family} data-family={family}>
      <header className="join-entry-hero">
        <span className="join-entry-mark" aria-hidden>
          <DoorOpen strokeWidth={1.8} />
        </span>
        <div>
          <p className="section-kicker join-entry-kicker">влез в стаята</p>
          <h2>Добре дошъл, {session.user.name ?? "играч"}.</h2>
          <p>Въведи кода на стаята, за да се присъединиш към играта с твоя профил.</p>
        </div>
      </header>

      <div className="join-entry-code-panel">
        <label className="join-entry-code-field">
          <span>
            <KeyRound aria-hidden strokeWidth={1.8} />
            Код на стая
          </span>
          <input
            className="input"
            value={roomCode}
            maxLength={12}
            onChange={(event) => setRoomCode(cleanRoomCode(event.target.value))}
            placeholder="ABC123"
            aria-label="Код на стая"
          />
        </label>
        <button
          type="button"
          className="join-spectator-toggle"
          data-active={spectator}
          aria-pressed={spectator}
          onClick={() => setSpectator((value) => !value)}
        >
          <span className="join-spectator-dot" aria-hidden />
          {spectator ? <Eye aria-hidden strokeWidth={1.8} /> : <Gamepad2 aria-hidden strokeWidth={1.8} />}
          {spectator ? "Сядам встрани, без роля" : "Влизам да играя"}
        </button>
      </div>

      {error ? <p className="join-entry-error">{error}</p> : null}

      <div className="join-entry-actions">
        <button className="btn btn-primary" type="button" onClick={() => submit("join")} disabled={roomCode.length < 4}>
          <Users aria-hidden strokeWidth={1.8} />
          Влез в стая
        </button>
        <Link className="btn btn-secondary" href={`${gameRoot}/create`}>
          <Plus aria-hidden strokeWidth={1.8} />
          Създай стая
        </Link>
      </div>
    </section>
  );
}

function cleanRoomCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function isValidRoomCode(code: string) {
  return /^[A-Z0-9]{4,12}$/.test(code);
}
