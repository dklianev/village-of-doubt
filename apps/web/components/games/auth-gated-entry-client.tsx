"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      <section className="paper-card auth-entry-card rounded-[2rem] p-7" data-theme={family} data-family={family}>
        <p className="section-kicker text-[#842f2b]">влез в стаята</p>
        <h2 className="mt-3 text-4xl font-black">Проверяваме профила</h2>
        <p className="mt-3 leading-7">След вход ще те върнем към поканата за тази стая.</p>
      </section>
    );
  }

  return (
    <section className="paper-card auth-entry-card rounded-[2rem] p-7" data-theme={family} data-family={family}>
      <p className="section-kicker text-[#842f2b]">влез в стаята</p>
      <h2 className="mt-3 text-4xl font-black">Добре дошъл, {session.user.name ?? "играч"}.</h2>
      <p className="mt-3 leading-7">Въведи кода на стаята, за да се присъединиш към играта с твоя профил.</p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-[#842f2b]">Код на стая</span>
          <input
            className="input"
            value={roomCode}
            maxLength={12}
            onChange={(event) => setRoomCode(cleanRoomCode(event.target.value))}
            placeholder="ABC123"
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
          {spectator ? "Сядам встрани, без роля" : "Влизам да играя"}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-[#842f2b]/10 p-4 font-bold text-[#842f2b]">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" type="button" onClick={() => submit("join")} disabled={roomCode.length < 4}>
          Влез в стая
        </button>
        <Link className="btn btn-secondary" href={`${gameRoot}/create`}>
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
