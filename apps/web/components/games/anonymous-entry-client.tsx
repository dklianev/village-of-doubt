"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type CommunicationMode,
  type GameFamily,
  type GameMode,
  type NarratorMode,
  type TempoProfile,
} from "@werewolf/shared";
import {
  ANONYMOUS_DISPLAY_NAME_KEY,
  saveAnonymousIdentity,
  validateDisplayNameBg,
} from "@/lib/anonymous-player";

export function AnonymousEntryClient({
  family,
  mode,
  initialCode = "",
}: {
  family: GameFamily;
  mode: GameMode;
  initialCode?: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState(cleanRoomCode(initialCode));
  const [error, setError] = useState("");
  const isMafia = family === "mafia";
  const gameRoot = isMafia ? "/mafia" : "/werewolf";
  const playerCount = mode === "mafia_sport" ? 10 : isMafia ? 10 : 8;
  const tempo: TempoProfile = mode === "mafia_sport" ? "sport_mafia" : "normal_online";
  const communication: CommunicationMode = "built_in_chat";
  const narrator: NarratorMode = "automatic";

  useEffect(() => {
    setDisplayName(window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) ?? "");
  }, []);

  const playPath = useMemo(() => {
    const params = new URLSearchParams({
      mode,
      players: String(playerCount),
      communication,
      narrator,
      tempo,
    });
    return `/play/${roomCode}?${params.toString()}`;
  }, [communication, mode, narrator, playerCount, roomCode, tempo]);

  function submit(action: "create" | "join") {
    const nameError = validateDisplayNameBg(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (action === "join" && !isValidRoomCode(roomCode)) {
      setError("Невалиден код на стая.");
      return;
    }

    saveAnonymousIdentity(displayName);
    setError("");
    router.push(action === "create" ? `${gameRoot}/create` : playPath);
  }

  return (
    <section className="paper-card anonymous-entry-card rounded-[2rem] p-7" data-theme={family} data-family={family}>
      <p className="section-kicker text-[#842f2b]">без регистрация</p>
      <h2 className="mt-3 text-4xl font-black">Влез с име</h2>
      <p className="mt-3 leading-7">
        Името важи само за тази машина и се пази локално. Ако в стаята вече има играч със същото име,
        сървърът ще поиска друго.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-[#842f2b]">Потребителско име</span>
          <input
            className="input"
            value={displayName}
            maxLength={24}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Например: Мила"
          />
        </label>
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
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-[#842f2b]/10 p-4 font-bold text-[#842f2b]">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" type="button" onClick={() => submit("join")}>
          Влез в стая
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => submit("create")}>
          Създай стая
        </button>
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
