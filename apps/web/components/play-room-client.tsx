"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import type { Room } from "@colyseus/sdk";
import { ROLE_DEFINITIONS, type ChatChannel, type CreateRoomOptions, type NightActionCommand, type RoleCode } from "@werewolf/shared";
import { createGameClient, GAME_ROOM_NAME } from "@/lib/colyseus-client";

interface PublicPlayer {
  userId: string;
  displayName: string;
  connected: boolean;
  ready: boolean;
  playing: boolean;
  alive: boolean;
  host: boolean;
  narrator: boolean;
  acceptedFullNarrator: boolean;
  mayor: boolean;
  hasVoted: boolean;
  actedThisPhase: boolean;
  revealedRole: string;
}

interface PublicEvent {
  id: string;
  messageBg: string;
}

interface PublicChatMessage {
  id: string;
  channel: string;
  senderName: string;
  message: string;
}

interface PrivateChatMessage {
  channel: ChatChannel;
  senderUserId: string;
  senderName: string;
  message: string;
  createdAt: number;
}

interface PublicRoleCount {
  role: RoleCode;
  count: number;
}

interface GameSnapshot {
  code: string;
  mode: string;
  playerCount: number;
  narratorMode: string;
  communicationMode: string;
  tempoProfile: string;
  dayDiscussionSeconds: number;
  voteSeconds: number;
  revealRolesOnDeath: boolean;
  loversEnabled: boolean;
  phase: string;
  round: number;
  phaseEndsAt: number;
  winnerTeam: string;
  winnerReasonBg: string;
  players: PublicPlayer[];
  roleCounts: PublicRoleCount[];
  publicEvents: PublicEvent[];
  publicChat: PublicChatMessage[];
}

interface PrivateResult {
  targetUserId: string;
  role?: RoleCode;
  isEvil?: boolean;
  isCommissioner?: boolean;
}

interface PrivateLover {
  loverUserId: string;
  loverName: string;
}

interface NarratorRoleSnapshot {
  roles: Array<{ userId: string; displayName: string; role: RoleCode; roleNameBg: string }>;
}

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
type CueMode = "silent" | "visual" | "audio_vibration";

const CUE_MODE_STORAGE_KEY = "werewolf-cue-mode";

export function PlayRoomClient({ code, createOptions }: { code: string; createOptions?: CreateRoomOptions }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [privateRole, setPrivateRole] = useState<{ role: RoleCode; roleNameBg: string } | null>(null);
  const [privateResult, setPrivateResult] = useState<PrivateResult | null>(null);
  const [privateLover, setPrivateLover] = useState<PrivateLover | null>(null);
  const [narratorSnapshot, setNarratorSnapshot] = useState<NarratorRoleSnapshot | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [secondTargetId, setSecondTargetId] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [privateChatMessage, setPrivateChatMessage] = useState("");
  const [privateChats, setPrivateChats] = useState<PrivateChatMessage[]>([]);
  const [isBlessed, setIsBlessed] = useState(false);
  const [status, setStatus] = useState("Свързване...");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [cueMode, setCueMode] = useState<CueMode>("silent");
  const [phasePulse, setPhasePulse] = useState(0);
  const previousCuePhaseRef = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    let joinedRoom: Room | null = null;
    const client = createGameClient();
    setConnectionStatus("connecting");

    // Dev fallback identity is only meaningful when the API allows dev auth.
    // In production the /api/game-token route ignores these values and uses the
    // Better Auth session, so we keep them out of localStorage entirely.
    const isLocalHost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const userId = isLocalHost
      ? window.localStorage.getItem("dev-user-id") ?? crypto.randomUUID()
      : crypto.randomUUID();
    if (isLocalHost) {
      window.localStorage.setItem("dev-user-id", userId);
    }
    setCurrentUserId(userId);

    const displayName = isLocalHost
      ? window.localStorage.getItem("dev-display-name") ?? `Играч ${userId.slice(0, 4).toUpperCase()}`
      : `Играч ${userId.slice(0, 4).toUpperCase()}`;
    if (isLocalHost) {
      window.localStorage.setItem("dev-display-name", displayName);
    }

    fetch("/api/game-token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code,
        devUserId: userId,
        devDisplayName: displayName,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Неуспешно издаване на game token.");
        }
        return response.json() as Promise<{ token: string; userId: string; displayName: string; roomCode: string }>;
      })
      .then((tokenResponse) => {
        setCurrentUserId(tokenResponse.userId);
        return client.joinOrCreate(GAME_ROOM_NAME, {
          ...createOptions,
          code: tokenResponse.roomCode,
          token: tokenResponse.token,
        });
      })
      .then((nextRoom) => {
        joinedRoom = nextRoom;
        if (!active) {
          nextRoom.leave();
          return;
        }

        setRoom(nextRoom);
        setStatus("Свързан");
        setConnectionStatus("connected");

        nextRoom.onStateChange((state) => {
          startTransition(() => setSnapshot(toSnapshot(state as unknown as ColyseusGameState)));
        });

        nextRoom.onMessage("private_role", (message: { role: RoleCode; roleNameBg: string }) => {
          setPrivateRole(message);
        });

        nextRoom.onMessage("private_check_result", (message: PrivateResult) => {
          setPrivateResult(message);
          setStatus("Получен е личен резултат от нощното действие.");
        });

        nextRoom.onMessage("private_lovers", (message: PrivateLover) => {
          setPrivateLover(message);
          setStatus("Купидон те свърза с Влюбен.");
        });

        nextRoom.onMessage("private_blessing", () => {
          setIsBlessed(true);
          setStatus("Свещеникът те благослови. Благословията ще спре първата нощна смърт срещу теб.");
        });

        nextRoom.onMessage("system", (message: { messageBg: string }) => {
          if (message.messageBg.includes("Благословията те спаси")) {
            setIsBlessed(false);
          }
          setStatus(message.messageBg);
        });

        nextRoom.onMessage("private_chat", (message: PrivateChatMessage) => {
          setPrivateChats((current) => [...current.slice(-30), message]);
        });

        nextRoom.onMessage("narrator_role_snapshot", (message: NarratorRoleSnapshot) => {
          setNarratorSnapshot(message);
          setStatus("Получен е пълен snapshot за Разказвача.");
        });

        nextRoom.onMessage("safe_error", (message: { messageBg: string }) => {
          setStatus(message.messageBg);
        });

        nextRoom.onLeave((leaveCode) => {
          if (!active) {
            return;
          }
          setStatus(leaveCode === 1000 ? "Напусна стаята." : "Връзката прекъсна.");
          setConnectionStatus(leaveCode === 1000 ? "disconnected" : "reconnecting");
        });
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "Неуспешно свързване.");
        setConnectionStatus("error");
      });

    return () => {
      active = false;
      joinedRoom?.leave();
    };
  }, [code, createOptions]);

  useEffect(() => {
    function handleOffline() {
      setConnectionStatus("reconnecting");
      setStatus("Устройството изглежда офлайн. Опитваме да запазим мястото ти в играта.");
    }

    function handleOnline() {
      setStatus("Интернет връзката се върна. Ако стаята не се обнови, презареди страницата.");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (createOptions?.tempoProfile === "live") {
      setCueMode("silent");
      return;
    }

    const saved = window.localStorage.getItem(CUE_MODE_STORAGE_KEY);
    if (isCueMode(saved)) {
      setCueMode(saved);
      return;
    }

    setCueMode("visual");
  }, [createOptions?.tempoProfile]);

  // When the phase changes, drop stale action-feedback strings so the previous
  // "Нощното действие е изпратено" or boilerplate "Свързан" don't linger past
  // the moment they are relevant. Players still get fresh status when they act.
  useEffect(() => {
    const nextPhase = snapshot?.phase;
    if (!nextPhase) {
      return;
    }
    setStatus((current) => (current === "" ? "" : ""));
  }, [snapshot?.phase]);

  useEffect(() => {
    const nextPhase = snapshot?.phase;
    if (!nextPhase) {
      return;
    }

    if (!previousCuePhaseRef.current) {
      previousCuePhaseRef.current = nextPhase;
      return;
    }
    if (previousCuePhaseRef.current === nextPhase) {
      return;
    }

    previousCuePhaseRef.current = nextPhase;
    if (cueMode === "silent") {
      return;
    }

    setPhasePulse((current) => current + 1);
    if (cueMode === "audio_vibration") {
      triggerDeviceCue(nextPhase);
    }
  }, [cueMode, snapshot?.phase]);

  const players = snapshot?.players ?? [];
  const livingPlayers = players.filter((player) => player.playing && player.alive);
  const ownPlayer = players.find((player) => player.userId === currentUserId);
  const phase = snapshot?.phase ?? "lobby";

  function sendReady() {
    room?.send("ready", { ready: !ownPlayer?.ready });
  }

  function sendNightAction(action: NightActionCommand) {
    room?.send("submitNightAction", { action });
    setStatus("Нощното действие е изпратено.");
  }

  function sendVote(targetUserId: string) {
    room?.send("submitVote", { targetUserId });
    setStatus("Гласът е изпратен.");
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatMessage.trim();
    if (!message) {
      return;
    }
    room?.send("sendChat", { channel: "public", message });
    setChatMessage("");
  }

  function sendPrivateChat(channel: ChatChannel) {
    const message = privateChatMessage.trim();
    if (!message) {
      return;
    }
    room?.send("sendChat", { channel, message });
    setPrivateChatMessage("");
  }

  function changeCueMode(mode: CueMode) {
    setCueMode(mode);
    window.localStorage.setItem(CUE_MODE_STORAGE_KEY, mode);
    if (mode === "audio_vibration") {
      triggerDeviceCue(phase);
    }
  }

  const fullNarratorAccepted = snapshot?.narratorMode !== "full_human" || players.every((player) => player.acceptedFullNarrator);
  const privateChatChannel = getAvailablePrivateChatChannel(privateRole?.role, ownPlayer, phase, snapshot?.communicationMode);
  const liveMode = (snapshot?.tempoProfile ?? createOptions?.tempoProfile) === "live";
  // Connection state already lives in the ConnectionBanner; the phase-status
  // line is only useful for transient action feedback. Hide the boilerplate
  // "Свързан" / "Свързване..." strings so the player doesn't see them linger.
  const isStatusInformative = status.length > 0 && status !== "Свързан" && status !== "Свързване...";

  return (
    <main className={`shell game-shell phase-${phase}`} data-phase={phase}>
      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="card rounded-[2rem] p-5 md:p-7">
          <ConnectionBanner status={connectionStatus} message={status} />

          <div className="phase-hero">
            <div>
              <p className="phase-kicker">стая {code} · рунд {snapshot?.round ?? 0}</p>
              <h1 className="phase-title mt-5 font-black">{phaseBg(phase)}</h1>
              {isStatusInformative || isPending ? (
                <p className="phase-status mt-6" aria-live="polite" aria-atomic="true">
                  {isStatusInformative ? status : ""}
                  {isPending ? " Обновяване..." : ""}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#f4e8d1]/15 bg-[#f4e8d1]/10 px-3 py-2 text-sm font-bold text-[#ead9ba]">
                  {players.filter((player) => player.playing && player.alive).length} живи
                </span>
                <span className="rounded-full border border-[#f4e8d1]/15 bg-[#f4e8d1]/10 px-3 py-2 text-sm font-bold text-[#ead9ba]">
                  {modeBg(snapshot?.mode ?? "werewolves_classic")}
                </span>
                <span className="rounded-full border border-[#f4e8d1]/15 bg-[#f4e8d1]/10 px-3 py-2 text-sm font-bold text-[#ead9ba]">
                  {communicationBg(snapshot?.communicationMode ?? "built_in_chat")}
                </span>
              </div>
            </div>
            <div className="relative z-[1] grid gap-4 justify-self-end">
              <div className="phase-sigil" aria-hidden="true">
                {phaseSigil(phase)}
              </div>
              <Timer endsAt={snapshot?.phaseEndsAt ?? 0} />
            </div>
          </div>

          {phase === "lobby" ? (
            <div className="action-bar">
              <div className="action-bar-inner">
                <button className="btn btn-secondary" type="button" onClick={sendReady} disabled={!room}>
                  {ownPlayer?.ready ? "Не съм готов" : "Готов"}
                </button>
                {ownPlayer?.host ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => room?.send("startGame")}
                    disabled={!room || !fullNarratorAccepted}
                  >
                    Започни игра
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <LiveCuePanel
            cueMode={cueMode}
            liveMode={liveMode}
            phase={phase}
            pulseKey={phasePulse}
            onChange={changeCueMode}
          />

          <PhaseRail phase={phase} />

          {snapshot ? <RulesSummary snapshot={snapshot} /> : null}

          {snapshot ? <PhaseGuide phase={phase} privateRole={privateRole?.role} ownPlayer={ownPlayer} /> : null}

          {snapshot && (ownPlayer?.host || ownPlayer?.narrator) ? (
            <NarratorDesk
              room={room}
              snapshot={snapshot}
              phase={phase}
              isHost={Boolean(ownPlayer?.host)}
              isNarrator={Boolean(ownPlayer?.narrator)}
              fullNarratorAccepted={fullNarratorAccepted}
            />
          ) : null}

          {snapshot?.narratorMode === "full_human" && ownPlayer && !ownPlayer.acceptedFullNarrator ? (
            <article className="narrator-warning-card mt-8 rounded-[2rem] border border-[#842f2b]/50 bg-[#842f2b]/25 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-[#c18a38]">важно предупреждение</p>
              <h2 className="mt-2 text-3xl font-black">Пълен Разказвач вижда всички роли</h2>
              <p className="mt-3 text-[#ead9ba]">
                При този режим човекът Разказвач може да види тайните роли и действия, за да води играта ръчно.
                Натисни приемане само ако си съгласен с това.
              </p>
              <button className="btn btn-primary mt-5" type="button" onClick={() => room?.send("acceptFullNarrator")}>
                Приемам
              </button>
            </article>
          ) : null}

          {narratorSnapshot && ownPlayer?.narrator ? (
            <NarratorSnapshotPanel snapshot={narratorSnapshot} />
          ) : null}

          {privateLover ? <LoverCard lover={privateLover} /> : null}

          {isBlessed ? (
            <article className="paper-card mt-8 rounded-[2rem] border-2 border-[#c18a38]/45 p-5">
              <p className="section-kicker text-[#842f2b]">тайна закрила</p>
              <h2 className="mt-2 text-2xl font-black">Свещеникът те благослови</h2>
              <p className="mt-2 text-sm text-[#4f3829]">
                Благословията ще спре първото нощно убийство срещу теб. Ще изчезне щом те защити веднъж.
              </p>
            </article>
          ) : null}

          <RoleCard role={privateRole} result={privateResult} players={players} />

          {isNightPhase(phase) && privateRole ? (
            <NightActionPanel
              currentUserId={currentUserId}
              livingPlayers={livingPlayers}
              phase={phase}
              privateRole={privateRole.role}
              selectedTargetId={selectedTargetId}
              secondTargetId={secondTargetId}
              setSelectedTargetId={setSelectedTargetId}
              setSecondTargetId={setSecondTargetId}
              sendNightAction={sendNightAction}
            />
          ) : null}

          {phase === "voting" ? (
            <VotingPanel currentUserId={currentUserId} livingPlayers={livingPlayers} sendVote={sendVote} />
          ) : null}

          {phase === "hunter_revenge" && privateRole?.role === "hunter" ? (
            <HunterRevengePanel
              currentUserId={currentUserId}
              livingPlayers={livingPlayers}
              sendHunterRevenge={(targetUserId) => room?.send("submitHunterRevenge", { targetUserId })}
            />
          ) : null}

          {privateChatChannel ? (
            <PrivateChatPanel
              channel={privateChatChannel}
              messages={privateChats.filter((message) => message.channel === privateChatChannel)}
              value={privateChatMessage}
              setValue={setPrivateChatMessage}
              sendPrivateChat={sendPrivateChat}
            />
          ) : null}

          {snapshot?.winnerTeam ? (
            <article className={`winner-card paper-card mt-8 rounded-[2rem] p-6 faction-${snapshot.winnerTeam}`}>
              <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">край на играта</p>
              <h2 className="mt-2 text-4xl font-black">{winnerBg(snapshot.winnerTeam)}</h2>
              <p className="mt-3 text-[#4f3829]">{snapshot.winnerReasonBg}</p>
            </article>
          ) : null}
        </div>

        <aside className="paper-card rounded-[2rem] p-5 md:p-7 lg:sticky lg:top-6 lg:self-start">
          <p className="section-kicker text-[#842f2b]">площадът</p>
          <h2 className="mt-3 text-3xl font-black">Играчите на площада</h2>
          <div className="mt-6 grid gap-3">
            {players.length === 0 ? (
              <div className="empty-state-card empty-players-card rounded-[2rem] p-5">
                <span aria-hidden="true" />
                <strong>Площадът още е празен</strong>
                <p>Поканата чака първите телефони около масата.</p>
              </div>
            ) : null}
            {players.map((player) => (
              <div key={player.userId} className={playerTokenClass(player)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="player-avatar" aria-hidden="true">
                      {playerInitials(player.displayName)}
                    </span>
                    <div>
                      <strong className="block leading-tight">{player.displayName}</strong>
                      <small className="font-bold uppercase tracking-[0.16em] text-[#842f2b]/80">
                        {playerStatusBadge(player, phase)}
                      </small>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#221611]/10 px-3 py-1 text-sm font-bold">
                    {player.playing
                      ? player.alive
                        ? "жив"
                        : player.revealedRole
                          ? `† ${ROLE_DEFINITIONS[player.revealedRole as RoleCode]?.nameBg ?? "елиминиран"}`
                          : "елиминиран"
                      : "извън играта"}
                  </span>
                </div>
                <small className="mt-3 block text-[#4f3829]">
                  {player.connected ? "онлайн" : "прекъсната връзка"}
                  {player.host ? " · host" : ""}
                  {player.narrator ? " · Разказвач" : ""}
                  {player.mayor ? " · Кмет" : ""}
                  {player.ready ? " · готов" : ""}
                  {snapshot?.narratorMode === "full_human" ? ` · ${player.acceptedFullNarrator ? "приел" : "чака приемане"}` : ""}
                  {player.actedThisPhase ? " · действал" : ""}
                  {player.hasVoted ? " · гласувал" : ""}
                </small>
                {ownPlayer?.host && snapshot?.narratorMode !== "automatic" && phase === "lobby" ? (
                  <button
                    className="btn btn-secondary mt-3 min-h-0 px-3 py-2 text-sm"
                    type="button"
                    onClick={() => room?.send("setNarrator", { targetUserId: player.userId, narrator: true })}
                  >
                    Направи Разказвач
                  </button>
                ) : null}
                {(ownPlayer?.host || ownPlayer?.narrator) &&
                snapshot?.mode === "werewolves_classic" &&
                (phase === "lobby" || phase === "mayor_successor") &&
                player.playing &&
                player.alive ? (
                  <button
                    className="btn btn-secondary mt-3 min-h-0 px-3 py-2 text-sm"
                    type="button"
                    onClick={() => room?.send("setMayor", { targetUserId: player.userId })}
                  >
                    Направи Кмет
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {phase === "day_discussion" && snapshot?.communicationMode === "built_in_chat" ? (
            ownPlayer?.playing && ownPlayer?.alive ? (
              <form className="mt-8 grid gap-3" onSubmit={sendChat}>
                <h3 className="font-black">Дневен чат</h3>
                <div className="grid gap-1">
                  <input
                    className="input"
                    value={chatMessage}
                    onChange={(event) => setChatMessage(event.target.value.slice(0, 500))}
                    placeholder="Напиши обвинение, защита или блъф..."
                    maxLength={500}
                    aria-describedby="chat-counter"
                  />
                  <span
                    id="chat-counter"
                    className={`text-right text-xs ${chatMessage.length >= 480 ? "text-[#c18a38]" : "text-[#ead9ba]/60"}`}
                  >
                    {chatMessage.length}/500
                  </span>
                </div>
                <button className="btn btn-primary" type="submit" disabled={chatMessage.trim().length === 0}>
                  Изпрати
                </button>
              </form>
            ) : (
              <div className="mt-8 rounded-2xl bg-[#221611]/15 p-4 text-sm font-bold text-[#842f2b]">
                {ownPlayer?.playing
                  ? "Елиминираните играчи могат да четат, но не и да пишат в дневния чат."
                  : "Разказвачите и наблюдателите не пишат в дневния чат."}
              </div>
            )
          ) : null}

          {phase === "day_discussion" && snapshot?.communicationMode !== "built_in_chat" ? (
            <div className="mt-8 rounded-2xl bg-[#842f2b]/10 p-4 text-sm font-bold text-[#842f2b]">
              В тази стая публичният чат е изключен. Използвайте Discord, разговор на живо или указанията на Разказвача.
            </div>
          ) : null}

          <div className="mt-8">
            <h3 className="font-black" id="events-heading">Събития</h3>
            <div
              className="mt-3 grid gap-2 text-sm"
              role="log"
              aria-labelledby="events-heading"
              aria-live="polite"
              aria-relevant="additions"
            >
              {(snapshot?.publicEvents ?? []).length === 0 ? (
                <p className="event-line event-line-empty rounded-xl px-3 py-2">
                  Събитията ще се появят тук, когато ритуалът започне.
                </p>
              ) : null}
              {(snapshot?.publicEvents ?? []).slice(-7).map((event) => (
                <p key={event.id} className={`event-line ${eventLineClass(event.messageBg)} rounded-xl px-3 py-2`}>
                  {event.messageBg}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="font-black" id="chat-heading">Чат лог</h3>
            <div
              className="mt-3 grid gap-2 text-sm"
              role="log"
              aria-labelledby="chat-heading"
              aria-live="polite"
              aria-relevant="additions"
            >
              {(snapshot?.publicChat ?? []).length === 0 ? (
                <p className="chat-line rounded-xl px-3 py-2">Още няма публични реплики.</p>
              ) : null}
              {(snapshot?.publicChat ?? []).slice(-5).map((message) => (
                <p key={message.id} className="chat-line rounded-xl px-3 py-2">
                  <strong>{message.senderName}:</strong> {message.message}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function RulesSummary({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">правила преди старт</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SummaryPill label="Режим" value={modeBg(snapshot.mode)} />
        <SummaryPill
          label="Играчи"
          value={`${snapshot.players.filter((player) => player.playing).length}/${snapshot.playerCount}`}
        />
        <SummaryPill label="Разказвач" value={narratorBg(snapshot.narratorMode)} />
        <SummaryPill label="Комуникация" value={communicationBg(snapshot.communicationMode)} />
        <SummaryPill label="Темпо" value={tempoBg(snapshot.tempoProfile)} />
        <SummaryPill label="Ден/гласуване" value={`${snapshot.dayDiscussionSeconds}s / ${snapshot.voteSeconds}s`} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {snapshot.roleCounts.map((item) => (
          <div key={item.role} className={`role-count-chip role-${item.role} is-dark`}>
            <dt>
              <span className="role-count-art" aria-hidden="true" />
              <span>{ROLE_DEFINITIONS[item.role]?.nameBg ?? item.role}</span>
            </dt>
            <dd>{item.count}</dd>
          </div>
        ))}
      </div>

      {snapshot.narratorMode === "full_human" ? (
        <p className="mt-4 rounded-2xl bg-[#842f2b]/25 p-4 font-bold text-[#fff6e5]">
          В тази стая Пълният Разказвач вижда всички роли и действия.
        </p>
      ) : null}
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-pill rounded-2xl px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.2em] text-[#c18a38]">{label}</span>
      <strong className="mt-1 block">{value}</strong>
    </div>
  );
}

function PhaseRail({ phase }: { phase: string }) {
  return (
    <nav className="phase-rail" aria-label="Фази на играта">
      {PHASE_RAIL.map((step, index) => {
        const active = step.phases.includes(phase);
        return (
          <div key={step.label} className={`phase-rail-step ${active ? "is-active" : ""}`}>
            <span className="phase-rail-index">{String(index + 1).padStart(2, "0")}</span>
            <span className={`phase-rail-icon phase-${step.iconPhase}`} aria-hidden="true" />
            <span className="phase-rail-label">{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

function ConnectionBanner({ status, message }: { status: ConnectionStatus; message: string }) {
  if (status === "connected") {
    return null;
  }

  const title: Record<ConnectionStatus, string> = {
    connecting: "Свързване със стаята",
    connected: "Свързан",
    reconnecting: "Връзката се възстановява",
    disconnected: "Напусна стаята",
    error: "Проблем със свързването",
  };

  return (
    <div
      className={`connection-banner connection-${status} mb-6 p-4 text-[#fff6e5]`}
      role={status === "error" ? "alert" : "status"}
      aria-live={status === "error" ? "assertive" : "polite"}
      aria-busy={status === "connecting" || status === "reconnecting"}
    >
      <strong className="block">{title[status]}</strong>
      <span className="mt-1 block text-sm text-[#ead9ba]">{message}</span>
    </div>
  );
}

function LiveCuePanel({
  cueMode,
  liveMode,
  phase,
  pulseKey,
  onChange,
}: {
  cueMode: CueMode;
  liveMode: boolean;
  phase: string;
  pulseKey: number;
  onChange: (mode: CueMode) => void;
}) {
  return (
    <section className={`cue-panel cue-${cueMode} ${liveMode ? "is-live" : ""} mt-6 rounded-[2rem] p-4`}>
      <div className="cue-orb" aria-hidden="true">
        <span key={pulseKey} />
      </div>
      <div>
        <p className="section-kicker">събуждане</p>
        <h2 className="mt-1 text-2xl font-black">Лични сигнали за фазите</h2>
        <p className="mt-2 text-sm text-[#ead9ba]">
          {liveMode
            ? "Игра на живо: звукът и вибрацията са изключени по подразбиране, защото телефоните са близо един до друг."
            : "Онлайн игра: визуалният pulse е включен по подразбиране; звук/вибрация се включват само от това устройство."}
        </p>
      </div>
      <div className="cue-actions">
        <button className="btn btn-secondary" type="button" aria-pressed={cueMode === "silent"} onClick={() => onChange("silent")}>
          Тихо
        </button>
        <button className="btn btn-secondary" type="button" aria-pressed={cueMode === "visual"} onClick={() => onChange("visual")}>
          Визуално
        </button>
        <button
          className="btn btn-primary"
          type="button"
          aria-pressed={cueMode === "audio_vibration"}
          onClick={() => onChange("audio_vibration")}
        >
          Звук + вибрация
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => triggerDeviceCue(phase)} disabled={cueMode === "silent"}>
          Тест
        </button>
      </div>
    </section>
  );
}

function NarratorDesk({
  room,
  snapshot,
  phase,
  isHost,
  isNarrator,
  fullNarratorAccepted,
}: {
  room: Room | null;
  snapshot: GameSnapshot;
  phase: string;
  isHost: boolean;
  isNarrator: boolean;
  fullNarratorAccepted: boolean;
}) {
  const pendingConsent = snapshot.players.filter((player) => !player.acceptedFullNarrator).length;
  const activePlayers = snapshot.players.filter((player) => player.playing);
  const actedCount = activePlayers.filter((player) => player.actedThisPhase).length;
  const votedCount = activePlayers.filter((player) => player.hasVoted).length;

  return (
    <section className="narrator-desk mt-8 rounded-[2rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker">панел на Разказвача</p>
          <h2 className="mt-2 text-3xl font-black">{isNarrator ? "Водиш ритуала" : "Host контрол"}</h2>
          <p className="mt-3 max-w-2xl text-[#ead9ba]">
            Управлявай темпото без скрити client-side решения. Всички действия се записват като narrator audit events.
          </p>
        </div>
        <div className="narrator-phase-seal">
          <span>{phaseBg(phase)}</span>
          <Timer endsAt={snapshot.phaseEndsAt} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryPill label="Активни" value={`${activePlayers.length}/${snapshot.playerCount}`} />
        <SummaryPill label="Действали" value={`${actedCount}/${activePlayers.length}`} />
        <SummaryPill label="Гласували" value={`${votedCount}/${activePlayers.length}`} />
        <SummaryPill label="Режим" value={narratorBg(snapshot.narratorMode)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {isHost && phase === "lobby" ? (
          <button className="btn btn-primary" type="button" onClick={() => room?.send("startGame")} disabled={!room || !fullNarratorAccepted}>
            Започни игра
          </button>
        ) : null}
        <button className="btn btn-secondary" type="button" onClick={() => room?.send("narratorPause")} disabled={!room || phase === "paused"}>
          Пауза
        </button>
        <button className="btn btn-primary" type="button" onClick={() => room?.send("narratorAdvance")} disabled={!room}>
          Следваща фаза
        </button>
        {[30, 60, 180].map((seconds) => (
          <button
            key={seconds}
            className="btn btn-secondary"
            type="button"
            onClick={() => room?.send("narratorExtendTimer", { seconds })}
            disabled={!room || phase === "paused" || phase === "game_over"}
          >
            +{seconds} сек.
          </button>
        ))}
      </div>

      {snapshot.narratorMode === "full_human" && pendingConsent > 0 ? (
        <p className="mt-5 rounded-2xl bg-[#842f2b]/25 p-4 font-bold text-[#fff6e5]">
          Изчакват се {pendingConsent} играчи да приемат, че Пълният Разказвач вижда всички роли.
        </p>
      ) : null}
    </section>
  );
}

function PhaseGuide({
  phase,
  privateRole,
  ownPlayer,
}: {
  phase: string;
  privateRole: RoleCode | undefined;
  ownPlayer: PublicPlayer | undefined;
}) {
  const guide = PHASE_GUIDE_BG[phase] ?? {
    title: phaseBg(phase),
    body: "Следвай указанията на екрана. Сървърът пази реда на фазите и валидира действията.",
    wakes: "Няма специално събуждане в тази фаза.",
  };
  const personalHint = privateRole ? roleWakeHint(privateRole, phase, ownPlayer) : "Ролята ти още не е разкрита на това устройство.";

  return (
    <section className="phase-guide-card ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">водене на рунда</p>
      <h2 className="mt-2 text-3xl font-black">{guide.title}</h2>
      <p className="mt-3 text-[#ead9ba]">{guide.body}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-[#f4e8d1]/10 px-4 py-3">
          <span className="block text-xs uppercase tracking-[0.2em] text-[#c18a38]">кой се буди</span>
          <strong className="mt-1 block">{guide.wakes}</strong>
        </div>
        <div className="rounded-2xl bg-[#f4e8d1]/10 px-4 py-3">
          <span className="block text-xs uppercase tracking-[0.2em] text-[#c18a38]">за теб</span>
          <strong className="mt-1 block">{personalHint}</strong>
        </div>
      </div>
    </section>
  );
}

function NarratorSnapshotPanel({ snapshot }: { snapshot: NarratorRoleSnapshot }) {
  return (
    <section className="narrator-kit-card paper-card mt-8 rounded-[2rem] p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">само за Пълния Разказвач</p>
      <h2 className="mt-2 text-3xl font-black">Тайни роли</h2>
      <p className="mt-3 text-[#4f3829]">
        Това табло се изпраща само като private event към избрания Пълен Разказвач.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {snapshot.roles.map((item) => (
          <div key={item.userId} className="rounded-2xl bg-white/40 px-4 py-3">
            <strong className="block">{item.displayName}</strong>
            <span>{item.roleNameBg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoverCard({ lover }: { lover: PrivateLover }) {
  return (
    <article className="winner-card faction-lovers paper-card mt-8 rounded-[2rem] p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">само за теб</p>
      <h2 className="mt-2 text-3xl font-black">Влюбен си в {lover.loverName}</h2>
      <p className="mt-3 text-[#4f3829]">
        Ако един от вас умре, другият умира от разбито сърце. Ако останете последните двама от различни страни, печелите заедно.
      </p>
    </article>
  );
}

function RoleCard({
  role,
  result,
  players,
}: {
  role: { role: RoleCode; roleNameBg: string } | null;
  result: PrivateResult | null;
  players: PublicPlayer[];
}) {
  if (!role) {
    return null;
  }

  const guide = ROLE_GUIDE_BG[role.role];

  return (
    <article className={`role-card paper-card mt-8 rounded-[2rem] p-6 role-${role.role}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker text-[#842f2b]">само за теб</p>
          <h2 className="mt-2 text-4xl font-black">{role.roleNameBg}</h2>
        </div>
        <div className="role-sigil" aria-hidden="true">
          {roleSigil(role.role)}
        </div>
      </div>
      {guide ? (
        <div className="mt-4 grid gap-3">
          <p className="text-[#4f3829]">{guide.summary}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <RoleFact label="Отбор" value={guide.team} />
            <RoleFact label="Кога действа" value={guide.timing} />
            <RoleFact label="Цел" value={guide.win} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[#4f3829]">
          Тази карта идва през private server event. Тя не съществува в публичния synchronized state.
        </p>
      )}
      <p className="mt-4 rounded-2xl bg-[#221611]/10 px-4 py-3 text-sm font-bold text-[#4f3829]">
        Сигурност: чуждите тайни роли не са в публичния state и не трябва да се виждат през DevTools/network.
      </p>
      {result ? (
        <p className="mt-4 rounded-2xl bg-[#842f2b]/10 px-4 py-3 text-[#4f3829]">
          {formatPrivateResult(result, players)}
        </p>
      ) : null}
    </article>
  );
}

function RoleFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/35 px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.2em] text-[#842f2b]">{label}</span>
      <strong className="mt-1 block text-[#221611]">{value}</strong>
    </div>
  );
}

function HunterRevengePanel({
  currentUserId,
  livingPlayers,
  sendHunterRevenge,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  sendHunterRevenge: (targetUserId: string) => void;
}) {
  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">отмъщение на Ловеца</p>
      <h2 className="mt-2 text-3xl font-black">Последен изстрел</h2>
      <p className="mt-3 text-[#ead9ba]">Ловецът падна, но може да вземе един жив играч със себе си.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {livingPlayers
          .filter((player) => player.userId !== currentUserId)
          .map((player) => (
            <button className="btn btn-primary action-btn ability-hunter" type="button" key={player.userId} onClick={() => sendHunterRevenge(player.userId)}>
              Застреляй {player.displayName}
            </button>
          ))}
      </div>
    </section>
  );
}

function PrivateChatPanel({
  channel,
  messages,
  value,
  setValue,
  sendPrivateChat,
}: {
  channel: ChatChannel;
  messages: PrivateChatMessage[];
  value: string;
  setValue: (value: string) => void;
  sendPrivateChat: (channel: ChatChannel) => void;
}) {
  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">{privateChannelBg(channel)}</p>
      <h2 className="mt-2 text-3xl font-black">Таен канал</h2>
      <div className="mt-4 grid gap-2 text-sm">
        {messages.slice(-6).map((message) => (
          <p key={`${message.createdAt}-${message.senderUserId}`} className="rounded-xl bg-[#f4e8d1]/10 px-3 py-2">
            <strong>{message.senderName}:</strong> {message.message}
          </p>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="input w-full"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Съобщение само за този канал..."
        />
        <button className="btn btn-primary" type="button" onClick={() => sendPrivateChat(channel)}>
          Изпрати
        </button>
      </div>
    </section>
  );
}

function NightActionPanel({
  currentUserId,
  livingPlayers,
  phase,
  privateRole,
  selectedTargetId,
  secondTargetId,
  setSelectedTargetId,
  setSecondTargetId,
  sendNightAction,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  phase: string;
  privateRole: RoleCode;
  selectedTargetId: string;
  secondTargetId: string;
  setSelectedTargetId: (value: string) => void;
  setSecondTargetId: (value: string) => void;
  sendNightAction: (action: NightActionCommand) => void;
}) {
  const defaultTarget =
    privateRole === "healer"
      ? livingPlayers.find((player) => player.userId === currentUserId)?.userId
      : livingPlayers.find((player) => player.userId !== currentUserId)?.userId;
  const targetId = selectedTargetId || defaultTarget || "";
  const secondId = secondTargetId || livingPlayers.find((player) => player.userId !== targetId)?.userId || "";

  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">нощно действие</p>
      <h2 className="mt-2 text-3xl font-black">{nightInstructionBg(privateRole)}</h2>
      <p className="mt-3 text-[#ead9ba]">{nightActionHelpBg(privateRole)}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select className="input" value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)}>
          <option value="">Избери цел</option>
          {livingPlayers.map((player) => (
            <option key={player.userId} value={player.userId}>
              {player.displayName}
            </option>
          ))}
        </select>

        {privateRole === "cupid" ? (
          <select className="input" value={secondTargetId} onChange={(event) => setSecondTargetId(event.target.value)}>
            <option value="">Втори влюбен</option>
            {livingPlayers.map((player) => (
              <option key={player.userId} value={player.userId}>
                {player.displayName}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {canFactionKill(privateRole) ? (
          <button
            className={`btn btn-primary action-btn ${privateRole === "vampire" ? "ability-vampire" : "ability-kill"}`}
            type="button"
            onClick={() => targetId && sendNightAction({ kind: "faction_kill", targetUserId: targetId })}
          >
            Потвърди жертва
          </button>
        ) : null}
        {privateRole === "commissioner" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "check_alignment", targetUserId: targetId })}>
            Провери дали е от Мафията
          </button>
        ) : null}
        {privateRole === "don" ? (
          <button className="btn btn-secondary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "check_commissioner", targetUserId: targetId })}>
            Търси Комисаря
          </button>
        ) : null}
        {privateRole === "seer" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "check_role", targetUserId: targetId })}>
            Виж ролята
          </button>
        ) : null}
        {privateRole === "witch" ? (
          <>
            <button className="btn btn-secondary action-btn ability-heal" type="button" onClick={() => targetId && sendNightAction({ kind: "witch_heal", targetUserId: targetId })}>
              Лекувай
            </button>
            <button className="btn btn-primary action-btn ability-kill" type="button" onClick={() => targetId && sendNightAction({ kind: "witch_poison", targetUserId: targetId })}>
              Отрови
            </button>
          </>
        ) : null}
        {privateRole === "healer" ? (
          <button className="btn btn-primary action-btn ability-heal" type="button" onClick={() => targetId && sendNightAction({ kind: "healer_protect", targetUserId: targetId })}>
            Пази тази нощ
          </button>
        ) : null}
        {privateRole === "priest" ? (
          <button className="btn btn-primary action-btn ability-bless" type="button" onClick={() => targetId && sendNightAction({ kind: "priest_bless", targetUserId: targetId })}>
            Дай благословия
          </button>
        ) : null}
        {privateRole === "thief" && phase === "first_night" ? (
          <button className="btn btn-primary action-btn ability-steal" type="button" onClick={() => targetId && sendNightAction({ kind: "thief_steal", targetUserId: targetId })}>
            Открадни карта
          </button>
        ) : null}
        {privateRole === "cupid" && phase === "first_night" ? (
          <button
            className="btn btn-primary action-btn ability-lovers"
            type="button"
            onClick={() => targetId && secondId && sendNightAction({ kind: "cupid_link", firstUserId: targetId, secondUserId: secondId })}
          >
            Свържи Влюбените
          </button>
        ) : null}
        <button className="btn btn-secondary" type="button" onClick={() => sendNightAction({ kind: "skip" })}>
          Пропусни
        </button>
      </div>
    </section>
  );
}

function VotingPanel({
  currentUserId,
  livingPlayers,
  sendVote,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  sendVote: (targetUserId: string) => void;
}) {
  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">гласуване</p>
      <h2 className="mt-2 text-3xl font-black">Кого ще изгоните от площада?</h2>
      <div className="mt-5 flex flex-wrap gap-3">
        {livingPlayers
          .filter((player) => player.userId !== currentUserId)
          .map((player) => (
            <button className="btn btn-primary" type="button" key={player.userId} onClick={() => sendVote(player.userId)}>
              {player.displayName}
            </button>
          ))}
      </div>
    </section>
  );
}

function Timer({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");

  return (
    <div className="timer-dial">
      <span className="block text-xs uppercase tracking-[0.25em] text-[#c18a38]">таймер</span>
      <strong className="text-3xl">{endsAt ? `${minutes}:${seconds}` : "--:--"}</strong>
    </div>
  );
}

function phaseSigil(phase: string) {
  const sigils: Record<string, string> = {
    lobby: "◇",
    role_reveal: "✦",
    first_night: "☾",
    night: "☾",
    day_announcement: "◉",
    day_discussion: "☼",
    nomination: "△",
    defense: "▱",
    voting: "◆",
    resolution: "✣",
    hunter_revenge: "✕",
    mayor_successor: "♜",
    paused: "Ⅱ",
    game_over: "◈",
  };

  return sigils[phase] ?? "◇";
}

function roleSigil(role: RoleCode) {
  const sigils: Record<RoleCode, string> = {
    civilian: "Г",
    commissioner: "К",
    mafioso: "М",
    don: "Д",
    ordinary_villager: "С",
    werewolf: "В",
    seer: "Я",
    witch: "В",
    healer: "Л",
    priest: "С",
    hunter: "Л",
    cupid: "К",
    vampire: "В",
    jester: "Ш",
    little_girl: "М",
    thief: "К",
  };

  return sigils[role];
}

function playerStatusBadge(player: PublicPlayer, phase: string): string {
  if (player.host) {
    return "host";
  }
  if (player.narrator) {
    return "разказвач";
  }
  if (phase === "lobby") {
    return player.ready ? "готов" : "чака";
  }
  if (!player.playing) {
    return "извън играта";
  }
  if (!player.alive) {
    return "елиминиран";
  }
  if (phase === "voting") {
    return player.hasVoted ? "гласувал" : "обмисля";
  }
  if (phase === "first_night" || phase === "night") {
    return player.actedThisPhase ? "действал" : "буден";
  }
  if (phase === "day_discussion") {
    return "говори";
  }
  if (phase === "day_announcement") {
    return "слуша";
  }
  if (phase === "resolution") {
    return "развръзка";
  }
  if (phase === "hunter_revenge") {
    return "ловецът стреля";
  }
  if (phase === "mayor_successor") {
    return "избор на кмет";
  }
  if (phase === "paused") {
    return "пауза";
  }
  if (phase === "game_over") {
    return "край";
  }
  return "играе";
}

function playerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isCueMode(value: string | null): value is CueMode {
  return value === "silent" || value === "visual" || value === "audio_vibration";
}

function triggerDeviceCue(phase: string) {
  if (typeof window === "undefined") {
    return;
  }

  if ("vibrate" in navigator) {
    const pattern = phase === "voting" ? [90, 50, 90] : phase === "night" || phase === "first_night" ? [130] : [70];
    navigator.vibrate(pattern);
  }

  playPhaseTone(phase);
}

function playPhaseTone(phase: string) {
  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = phaseFrequency(phase);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    window.setTimeout(() => void context.close(), 320);
  } catch {
    // Some mobile browsers block Web Audio until a gesture; the UI still keeps visual cues.
  }
}

function phaseFrequency(phase: string) {
  if (phase === "night" || phase === "first_night") {
    return 196;
  }
  if (phase === "voting") {
    return 392;
  }
  if (phase === "game_over") {
    return 247;
  }
  return 523;
}

function eventLineClass(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("ловец") || normalized.includes("изстрел") || normalized.includes("застрел")) {
    return "event-hunter-shot";
  }
  if (normalized.includes("умря") || normalized.includes("смърт") || normalized.includes("елимини")) {
    return "event-death";
  }
  if (normalized.includes("разкри") || normalized.includes("роля") || normalized.includes("провер")) {
    return "event-reveal";
  }
  return "event-generic";
}

function playerTokenClass(player: PublicPlayer) {
  return [
    "player-token rounded-2xl px-4 py-3",
    player.ready ? "is-ready" : "",
    !player.connected ? "is-offline" : "",
    player.playing && !player.alive ? "is-dead" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface ColyseusGameStatePlayer extends Omit<PublicPlayer, "revealedRole"> {
  revealedRole?: string;
}

interface ColyseusGameState {
  code: string;
  mode: string;
  playerCount: number;
  narratorMode: string;
  communicationMode: string;
  tempoProfile: string;
  dayDiscussionSeconds: number;
  voteSeconds: number;
  revealRolesOnDeath: boolean;
  loversEnabled: boolean;
  phase: string;
  round: number;
  phaseEndsAt: number;
  winnerTeam: string;
  winnerReasonBg: string;
  players: { values(): IterableIterator<ColyseusGameStatePlayer> };
  roleCounts: Iterable<PublicRoleCount>;
  publicEvents: Iterable<PublicEvent>;
  publicChat: Iterable<PublicChatMessage>;
}

function toSnapshot(state: ColyseusGameState): GameSnapshot {
  return {
    code: state.code,
    mode: state.mode,
    playerCount: state.playerCount,
    narratorMode: state.narratorMode,
    communicationMode: state.communicationMode,
    tempoProfile: state.tempoProfile,
    dayDiscussionSeconds: state.dayDiscussionSeconds,
    voteSeconds: state.voteSeconds,
    revealRolesOnDeath: state.revealRolesOnDeath,
    loversEnabled: state.loversEnabled,
    phase: state.phase,
    round: state.round,
    phaseEndsAt: state.phaseEndsAt,
    winnerTeam: state.winnerTeam,
    winnerReasonBg: state.winnerReasonBg,
    players: Array.from(state.players.values()).map((player) => ({
      ...player,
      revealedRole: player.revealedRole ?? "",
    })),
    roleCounts: Array.from(state.roleCounts),
    publicEvents: Array.from(state.publicEvents),
    publicChat: Array.from(state.publicChat),
  };
}

function isNightPhase(phase: string) {
  return phase === "first_night" || phase === "night";
}

function canFactionKill(role: RoleCode) {
  const team = ROLE_DEFINITIONS[role].team;
  return team === "mafia" || team === "werewolves" || team === "vampires";
}

function getAvailablePrivateChatChannel(
  role: RoleCode | undefined,
  ownPlayer: PublicPlayer | undefined,
  phase: string,
  communicationMode: string | undefined,
): ChatChannel | null {
  if (communicationMode === "no_chat" || communicationMode === "system_only") {
    return null;
  }
  if (ownPlayer && ownPlayer.playing && !ownPlayer.alive) {
    return "dead";
  }
  if (!role || !isNightPhase(phase)) {
    return null;
  }

  const team = ROLE_DEFINITIONS[role].team;
  if (team === "mafia") {
    return "mafia";
  }
  if (team === "werewolves") {
    return "werewolves";
  }
  if (team === "vampires") {
    return "vampires";
  }
  return null;
}

const ROLE_GUIDE_BG: Record<RoleCode, { summary: string; team: string; timing: string; win: string }> = {
  civilian: {
    summary: "Нямаш нощно действие. Силата ти е в дневното обсъждане, логиката и гласа.",
    team: "Мирни граждани",
    timing: "Ден и гласуване",
    win: "Елиминирайте Мафията",
  },
  commissioner: {
    summary: "Всяка нощ проверяваш играч и разбираш дали е от Мафията. Резултатът е само за теб.",
    team: "Мирни граждани",
    timing: "Всяка нощ",
    win: "Открий Мафията без да се издадеш твърде рано",
  },
  mafioso: {
    summary: "Будиш се с Мафията и участваш в избора на нощна жертва.",
    team: "Мафия",
    timing: "Всяка нощ",
    win: "Мафията да достигне паритет с мирните",
  },
  don: {
    summary: "Водиш Мафията. Можеш да участваш в убийството или да търсиш Комисаря.",
    team: "Мафия",
    timing: "Всяка нощ",
    win: "Открий Комисаря и пази Мафията скрита",
  },
  ordinary_villager: {
    summary: "Нямаш нощно действие. Наблюдавай реакциите, пази логиката и гласувай внимателно.",
    team: "Село",
    timing: "Ден и гласуване",
    win: "Всички Върколаци и други зли роли да бъдат елиминирани",
  },
  werewolf: {
    summary: "Будиш се с Върколаците и избирате една нощна жертва.",
    team: "Върколаци",
    timing: "Всяка нощ",
    win: "Върколаците да достигнат паритет със селото",
  },
  seer: {
    summary: "Всяка нощ виждаш точната роля на избран играч. Информацията е силна, но опасна за разкриване.",
    team: "Село",
    timing: "Всяка нощ",
    win: "Насочи селото към злите роли",
  },
  witch: {
    summary: "Имаш една лечебна отвара и една отрова. Всяка може да се използва само веднъж.",
    team: "Село",
    timing: "Нощ, докато имаш отвара",
    win: "Спаси ключов играч или елиминирай подозрителен",
  },
  healer: {
    summary: "Всяка нощ пазиш един играч от убийство. Можеш да пазиш себе си и същия играч в поредни нощи.",
    team: "Село",
    timing: "Всяка нощ",
    win: "Прекъсвай нощните убийства без да се издаваш",
  },
  priest: {
    summary: "Веднъж благославяш играч. Благословията остава до края и спира първото убийство срещу него.",
    team: "Село",
    timing: "Една нощ в играта",
    win: "Дай трайна защита на най-ценния съюзник",
  },
  hunter: {
    summary: "Ако умреш, получаваш последен изстрел и можеш да вземеш друг жив играч със себе си.",
    team: "Село",
    timing: "При смърт",
    win: "Накарай злите роли да се страхуват да те елиминират",
  },
  cupid: {
    summary: "Първата нощ избираш двама Влюбени. Ако единият умре, другият умира от разбито сърце.",
    team: "Село",
    timing: "Само първата нощ",
    win: "Селото печели, освен ако Влюбените не останат последни",
  },
  vampire: {
    summary: "Вампирите са отделна зла фракция. Будите се заедно и избирате нощна жертва.",
    team: "Вампири",
    timing: "Всяка нощ",
    win: "Вампирите да достигнат паритет с всички останали",
  },
  jester: {
    summary: "Искаш да те изгонят чрез дневното гласуване. Ако селото те линчува, печелиш лична победа.",
    team: "Самостоятелен",
    timing: "Ден и гласуване",
    win: "Бъди изгонен през гласуване",
  },
  little_girl: {
    summary: "Advanced роля за ръчно водени игри. Наднича, докато Върколаците са будни, но рискува да бъде разкрита.",
    team: "Село",
    timing: "Нощ, ръчно/advanced",
    win: "Събирай информация без да бъдеш хваната",
  },
  thief: {
    summary: "Първата нощ крадеш карта веднъж. Ти ставаш откраднатата роля, а целта става Обикновен селянин.",
    team: "Променлив",
    timing: "Само първата нощ",
    win: "След кражбата печелиш с новия си отбор",
  },
};

const PHASE_RAIL = [
  { label: "Лоби", iconPhase: "lobby", phases: ["lobby"] },
  { label: "Роля", iconPhase: "role_reveal", phases: ["role_reveal"] },
  { label: "Нощ", iconPhase: "night", phases: ["first_night", "night"] },
  {
    label: "Ден",
    iconPhase: "day_discussion",
    phases: ["day_announcement", "day_discussion", "nomination", "defense"],
  },
  { label: "Вот", iconPhase: "voting", phases: ["voting"] },
  {
    label: "Развръзка",
    iconPhase: "resolution",
    phases: ["resolution", "hunter_revenge", "mayor_successor", "game_over"],
  },
];

const PHASE_GUIDE_BG: Record<string, { title: string; body: string; wakes: string }> = {
  lobby: {
    title: "Настройка на стаята",
    body: "Хостът избира режим, роли, таймери, комуникация и Разказвач. Всички трябва да са готови преди старт.",
    wakes: "Никой още не се буди.",
  },
  role_reveal: {
    title: "Виж тайно ролята си",
    body: "Всеки играч получава само своята карта като private event. Не показвай телефона си, ако играете на живо.",
    wakes: "Всеки гледа само собствената си роля.",
  },
  first_night: {
    title: "Първа нощ",
    body: "Първата нощ разрешава еднократните стартови роли преди обикновените нощни действия.",
    wakes: "Крадец, Купидон, фракции, проверки и защитни роли.",
  },
  night: {
    title: "Нощ",
    body: "Играчите с нощни действия избират цел. Сървърът пази действията тайни и ги разрешава в фиксиран ред.",
    wakes: "Мафия/Върколаци/Вампири, Комисар/Ясновидка, Вещица, Лечител, Свещеник.",
  },
  day_announcement: {
    title: "Събуждане и обявяване",
    body: "Системата обявява публичните резултати от нощта, без да разкрива скрита информация.",
    wakes: "Всички се събуждат.",
  },
  day_discussion: {
    title: "Дневно обсъждане",
    body: "Всички живи играчи спорят, блъфират и събират подозрения. Таймерът е само видимият ритъм; сървърът е source of truth.",
    wakes: "Всички живи играчи говорят.",
  },
  nomination: {
    title: "Номинации",
    body: "При спортна или ръчно водена игра тук се избират кандидати за гласуване.",
    wakes: "Всички живи играчи участват.",
  },
  defense: {
    title: "Защита",
    body: "Номинираните получават време за последна защита преди гласуване.",
    wakes: "Говорят номинираните.",
  },
  voting: {
    title: "Гласуване",
    body: "Всеки жив играч избира кого да елиминира. Кметът има по-силен глас, ако е активен.",
    wakes: "Всички живи играчи гласуват.",
  },
  resolution: {
    title: "Развръзка",
    body: "Сървърът прилага елиминацията, евентуално разкрива роля и проверява условията за победа.",
    wakes: "Никой не действа, освен ако не се задейства специална роля.",
  },
  hunter_revenge: {
    title: "Последен изстрел",
    body: "Ако Ловецът умре, той избира един жив играч за отмъщение.",
    wakes: "Буден е само Ловецът.",
  },
  mayor_successor: {
    title: "Наследник на Кмета",
    body: "Ако Кметът умре, Разказвачът или хостът избира наследник според настройките.",
    wakes: "Разказвачът/хостът управлява избора.",
  },
  paused: {
    title: "Пауза",
    body: "Фазата е спряна временно от Разказвача или хоста.",
    wakes: "Никой няма задължително действие.",
  },
  game_over: {
    title: "Край на играта",
    body: "Победителят е изчислен и историята може да се прегледа след края.",
    wakes: "Всички роли вече са приключили.",
  },
};

function roleWakeHint(role: RoleCode, phase: string, ownPlayer: PublicPlayer | undefined) {
  if (ownPlayer && ownPlayer.playing && !ownPlayer.alive) {
    return "Ти си елиминиран. Следи играта, но не влияеш на живите играчи.";
  }
  if (role === "thief" && phase === "first_night") {
    return "Сега е твоят единствен шанс да откраднеш карта.";
  }
  if (role === "cupid" && phase === "first_night") {
    return "Сега избираш двамата Влюбени.";
  }
  if (isNightPhase(phase)) {
    if (canFactionKill(role) || ["commissioner", "don", "seer", "witch", "healer", "priest"].includes(role)) {
      return "Тази фаза може да имаш активно нощно действие.";
    }
    return "В тази нощ нямаш задължително действие.";
  }
  if (phase === "hunter_revenge" && role === "hunter") {
    return "Ако си мъртъв Ловец, избери последния си изстрел.";
  }
  if (phase === "voting") {
    return "Гласувай според информацията и блъфовете от деня.";
  }
  return "Следвай публичната фаза и пази тайните си.";
}

function nightActionHelpBg(role: RoleCode) {
  const labels: Partial<Record<RoleCode, string>> = {
    mafioso: "Координирайте се в тайния канал. Ако има равенство, сървърът няма да измисля произволна жертва.",
    don: "Можеш да помогнеш за убийството или да провериш дали някой е Комисарят.",
    werewolf: "Изберете жертва като фракция. Лечител, Вещица или благословия могат да спрат смъртта.",
    vampire: "Вампирите действат като отделна зла фракция и имат собствена жертва.",
    commissioner: "Проверката казва дали целта е от Мафията, не показва точната роля.",
    seer: "Ясновидката вижда точната роля, но резултатът не е публичен.",
    witch: "Лечението и отровата са еднократни. Ако ги изразходваш, после вече не са налични.",
    healer: "Лечителят може да пази себе си и може да пази един и същ играч в поредни нощи.",
    priest: "Благословията е еднократна като действие, но защитата остава до първото убийство срещу целта.",
    thief: "След кражбата ти ставаш новата роля, а целта става Обикновен селянин.",
    cupid: "Влюбените са тайно свързани. Смъртта на единия повлича другия.",
  };

  return labels[role] ?? "Ако нямаш действие, спокойно можеш да пропуснеш фазата.";
}

function privateChannelBg(channel: ChatChannel) {
  const labels: Record<ChatChannel, string> = {
    public: "публичен чат",
    mafia: "чат на Мафията",
    werewolves: "чат на Върколаците",
    vampires: "чат на Вампирите",
    dead: "чат на мъртвите",
    system: "системен канал",
  };

  return labels[channel];
}

function nightInstructionBg(role: RoleCode) {
  const labels: Partial<Record<RoleCode, string>> = {
    mafioso: "Мафията избира жертва",
    don: "Донът избира жертва или търси Комисаря",
    werewolf: "Върколаците избират жертва",
    vampire: "Вампирите избират жертва",
    commissioner: "Комисарят проверява подозрителен играч",
    seer: "Ясновидката вижда тайна роля",
    witch: "Вещицата решава дали да лекува или отрови",
    healer: "Лечителят пази един играч за тази нощ",
    priest: "Свещеникът дава една трайна благословия",
    thief: "Крадецът краде карта веднъж през първата нощ",
    cupid: "Купидон избира двама Влюбени",
  };

  return labels[role] ?? "Тази роля няма задължително нощно действие";
}

function formatPrivateResult(result: PrivateResult, players: PublicPlayer[]) {
  const targetName = players.find((player) => player.userId === result.targetUserId)?.displayName ?? "избрания играч";

  if (result.role) {
    return `${targetName} е ${ROLE_DEFINITIONS[result.role].nameBg}.`;
  }
  if (typeof result.isEvil === "boolean") {
    return result.isEvil ? `${targetName} е от злата страна.` : `${targetName} не е от злата страна.`;
  }
  if (typeof result.isCommissioner === "boolean") {
    return result.isCommissioner ? `${targetName} е Комисарят.` : `${targetName} не е Комисарят.`;
  }

  return `Получен е резултат за ${targetName}.`;
}

function phaseBg(phase: string) {
  const labels: Record<string, string> = {
    lobby: "Лоби",
    role_reveal: "Разкриване на роля",
    first_night: "Първа нощ",
    night: "Нощ",
    day_announcement: "Събуждане",
    day_discussion: "Дневно обсъждане",
    nomination: "Номинации",
    defense: "Защита",
    voting: "Гласуване",
    resolution: "Развръзка",
    hunter_revenge: "Отмъщение на Ловеца",
    mayor_successor: "Наследник на Кмета",
    paused: "Пауза",
    game_over: "Край",
  };

  return labels[phase] ?? phase;
}

function modeBg(mode: string) {
  const labels: Record<string, string> = {
    werewolves_classic: "Класически Върколаци",
    mafia_sport: "Спортна Мафия",
    mafia_free: "Свободна Мафия",
  };

  return labels[mode] ?? mode;
}

function narratorBg(mode: string) {
  const labels: Record<string, string> = {
    automatic: "Автоматичен",
    honest_human: "Честен човек",
    full_human: "Пълен човек",
  };

  return labels[mode] ?? mode;
}

function communicationBg(mode: string) {
  const labels: Record<string, string> = {
    built_in_chat: "Вграден чат",
    no_chat: "Без чат",
    system_only: "Само системни",
    secret_channels: "Тайни канали",
  };

  return labels[mode] ?? mode;
}

function tempoBg(mode: string) {
  const labels: Record<string, string> = {
    fast_online: "Бърза онлайн",
    normal_online: "Нормална онлайн",
    live: "На живо",
    sport_mafia: "Спортна Мафия",
    manual: "Ръчно водене",
  };

  return labels[mode] ?? mode;
}

function winnerBg(winner: string) {
  const labels: Record<string, string> = {
    village: "Селото печели",
    werewolves: "Върколаците печелят",
    vampires: "Вампирите печелят",
    mafia: "Мафията печели",
    lovers: "Влюбените печелят",
    draw: "Никой не печели",
  };

  return labels[winner] ?? winner;
}
