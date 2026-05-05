"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import type { Room } from "@colyseus/sdk";
import {
  GAME_MODE_DEFINITIONS,
  ROLE_DEFINITIONS,
  getRoleAssetKey,
  getRoleShortDescriptionBg,
  getGameFamily,
  getGameModeNameBg,
  phaseLabelBg,
  teamLabelBg,
  NARRATOR_VOICE_LABELS_BG,
  type ChatChannel,
  type CreateRoomOptions,
  type GameFamily,
  type GameMode,
  type GamePhase,
  type NightActionCommand,
  type NarratorVoice,
  type RoleCode,
} from "@werewolf/shared";
import {
  ANONYMOUS_DISPLAY_NAME_KEY,
  ANONYMOUS_USER_ID_KEY,
  getOrCreateAnonymousUserId,
  saveAnonymousIdentity,
  validateDisplayNameBg,
} from "@/lib/anonymous-player";
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

interface TypingNotice {
  channel: ChatChannel;
  senderUserId: string;
  senderName: string;
  active: boolean;
  createdAt: number;
}

interface PublicRoleCount {
  role: RoleCode;
  count: number;
}

interface VoteTallyItem {
  targetUserId: string;
  targetName: string;
  count: number;
  hasMayorVote: boolean;
}

interface GameSnapshot {
  code: string;
  mode: GameMode;
  playerCount: number;
  narratorMode: string;
  communicationMode: string;
  tempoProfile: string;
  dayDiscussionSeconds: number;
  voteSeconds: number;
  revealRolesOnDeath: boolean;
  loversEnabled: boolean;
  allowSkipVote: boolean;
  majorityMode: string;
  narratorVoice: NarratorVoice;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number;
  winnerTeam: string;
  winnerReasonBg: string;
  players: PublicPlayer[];
  roleCounts: PublicRoleCount[];
  voteTally: VoteTallyItem[];
  publicEvents: PublicEvent[];
  publicChat: PublicChatMessage[];
}

interface PrivateResult {
  targetUserId: string;
  targetUserIds?: string[];
  role?: RoleCode;
  isEvil?: boolean;
  isCommissioner?: boolean;
  messageBg?: string;
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
  const [typingNotices, setTypingNotices] = useState<TypingNotice[]>([]);
  const [isBlessed, setIsBlessed] = useState(false);
  const [status, setStatus] = useState("Свързване...");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [identityVersion, setIdentityVersion] = useState(0);
  const [identityError, setIdentityError] = useState("");
  const [cueMode, setCueMode] = useState<CueMode>("silent");
  const [phasePulse, setPhasePulse] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const previousCuePhaseRef = useRef<string | null>(null);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const lastTypingSentRef = useRef<Map<ChatChannel, number>>(new Map());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDisplayNameInput(window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) ?? window.localStorage.getItem("dev-display-name") ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    let joinedRoom: Room | null = null;
    const client = createGameClient();
    setConnectionStatus("connecting");

    const legacyDisplayName = window.localStorage.getItem("dev-display-name") ?? "";
    const storedDisplayName = window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) ?? legacyDisplayName;
    if (!storedDisplayName) {
      setStatus("Въведи потребителско име, за да влезеш в стаята.");
      setConnectionStatus("disconnected");
      return;
    }

    const legacyUserId = window.localStorage.getItem("dev-user-id") ?? "";
    if (!window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) && legacyDisplayName) {
      saveAnonymousIdentity(legacyDisplayName);
      if (legacyUserId) {
        window.localStorage.setItem(ANONYMOUS_USER_ID_KEY, legacyUserId);
      }
    }

    const userId = window.localStorage.getItem(ANONYMOUS_USER_ID_KEY) ?? getOrCreateAnonymousUserId();
    setCurrentUserId(userId);
    const displayName = storedDisplayName;

    fetch("/api/game-token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code,
        anonymousUserId: userId,
        anonymousDisplayName: displayName,
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
          setStatus("Свещеникът те благослови. Благословията остава върху теб до края на играта.");
        });

        nextRoom.onMessage("system", (message: { messageBg: string }) => {
          setStatus(message.messageBg);
        });

        nextRoom.onMessage("private_chat", (message: PrivateChatMessage) => {
          setPrivateChats((current) => [...current.slice(-30), message]);
        });

        nextRoom.onMessage("typing", (message: TypingNotice) => {
          const key = `${message.channel}:${message.senderUserId}`;
          setTypingNotices((current) => {
            const withoutCurrent = current.filter((item) => `${item.channel}:${item.senderUserId}` !== key);
            if (!message.active) {
              return withoutCurrent;
            }
            return [...withoutCurrent, message].slice(-12);
          });

          const existingTimeout = typingTimeoutsRef.current.get(key);
          if (existingTimeout) {
            window.clearTimeout(existingTimeout);
          }
          if (message.active) {
            const timeout = window.setTimeout(() => {
              setTypingNotices((current) => current.filter((item) => `${item.channel}:${item.senderUserId}` !== key));
              typingTimeoutsRef.current.delete(key);
            }, 2600);
            typingTimeoutsRef.current.set(key, timeout);
          }
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
  }, [code, createOptions, identityVersion]);

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
    return () => {
      for (const timeout of typingTimeoutsRef.current.values()) {
        window.clearTimeout(timeout);
      }
      typingTimeoutsRef.current.clear();
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
    setPhasePulse((current) => current + 1);
    if (cueMode === "silent") {
      return;
    }

    if (cueMode === "audio_vibration") {
      triggerDeviceCue(nextPhase);
    }
  }, [cueMode, snapshot?.phase]);

  const players = snapshot?.players ?? [];
  const livingPlayers = players.filter((player) => player.playing && player.alive);
  const ownPlayer = players.find((player) => player.userId === currentUserId);
  const mode = snapshot?.mode ?? createOptions?.mode ?? "werewolves_classic";
  const family = getGameFamily(mode);
  const phase = snapshot?.phase ?? "lobby";

  function sendReady() {
    room?.send("ready", { ready: !ownPlayer?.ready });
  }

  function sendNightAction(action: NightActionCommand) {
    room?.send("submitNightAction", { action });
    setStatus("Нощното действие е изпратено.");
    if ("vibrate" in navigator) {
      navigator.vibrate([24]);
    }
  }

  function sendVote(targetUserId: string) {
    room?.send("submitVote", { targetUserId });
    setStatus("Гласът е изпратен.");
  }

  function requestStartGame() {
    if (!room || startCountdown !== null) {
      return;
    }

    setStartCountdown(3);
    window.setTimeout(() => setStartCountdown(2), 620);
    window.setTimeout(() => setStartCountdown(1), 1240);
    window.setTimeout(() => {
      room.send("startGame");
      setStartCountdown(null);
    }, 1860);
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatMessage.trim();
    if (!message) {
      return;
    }
    room?.send("sendChat", { channel: "public", message });
    sendTypingSignal("public", false);
    setChatMessage("");
  }

  function sendPrivateChat(channel: ChatChannel) {
    const message = privateChatMessage.trim();
    if (!message) {
      return;
    }
    room?.send("sendChat", { channel, message });
    sendTypingSignal(channel, false);
    setPrivateChatMessage("");
  }

  function updatePublicChatMessage(value: string) {
    const nextValue = value.slice(0, 500);
    setChatMessage(nextValue);
    sendTypingSignal("public", nextValue.trim().length > 0);
  }

  function updatePrivateChatMessage(channel: ChatChannel | null, value: string) {
    const nextValue = value.slice(0, 500);
    setPrivateChatMessage(nextValue);
    if (channel) {
      sendTypingSignal(channel, nextValue.trim().length > 0);
    }
  }

  function sendTypingSignal(channel: ChatChannel, active: boolean) {
    if (!room) {
      return;
    }

    if (active) {
      const lastSentAt = lastTypingSentRef.current.get(channel) ?? 0;
      if (Date.now() - lastSentAt < 1400) {
        return;
      }
      lastTypingSentRef.current.set(channel, Date.now());
    } else {
      lastTypingSentRef.current.delete(channel);
    }

    room.send("typing", { channel, active });
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
  const publicTypers = typingNotices.filter((notice) => notice.channel === "public" && notice.senderUserId !== currentUserId);
  const privateTypers = typingNotices.filter(
    (notice) => notice.channel === privateChatChannel && notice.senderUserId !== currentUserId,
  );
  const liveMode = (snapshot?.tempoProfile ?? createOptions?.tempoProfile) === "live";
  // Connection state already lives in the ConnectionBanner; the phase-status
  // line is only useful for transient action feedback. Hide the boilerplate
  // "Свързан" / "Свързване..." strings so the player doesn't see them linger.
  const isStatusInformative = status.length > 0 && status !== "Свързан" && status !== "Свързване...";
  const needsIdentity = !room && !snapshot && status.startsWith("Въведи потребителско име");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShowShortcuts((value) => !value);
        return;
      }

      if (event.key === " " && (ownPlayer?.host || ownPlayer?.narrator)) {
        event.preventDefault();
        room?.send(phase === "paused" ? "narratorAdvance" : "narratorPause");
        return;
      }

      if (phase === "voting" && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const targetPlayer = livingPlayers.filter((player) => player.userId !== currentUserId)[index];
        if (targetPlayer) {
          event.preventDefault();
          sendVote(targetPlayer.userId);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentUserId, livingPlayers, ownPlayer?.host, ownPlayer?.narrator, phase, room]);

  function submitDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateDisplayNameBg(displayNameInput);
    if (error) {
      setIdentityError(error);
      return;
    }

    saveAnonymousIdentity(displayNameInput);
    setIdentityError("");
    setIdentityVersion((version) => version + 1);
  }

  if (needsIdentity) {
    return (
      <main className="shell game-shell" data-theme={family} data-family={family}>
        <section className="paper-card anonymous-entry-card rounded-[2rem] p-7">
          <p className="section-kicker text-[#842f2b]">без регистрация</p>
          <h1 className="mt-3 text-4xl font-black">Въведи потребителско име</h1>
          <p className="mt-3 leading-7">
            Нужно е само име за тази стая. То се пази локално и не създава акаунт.
          </p>
          <form className="mt-6 grid gap-4" onSubmit={submitDisplayName}>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-[#842f2b]">Потребителско име</span>
              <input
                className="input"
                value={displayNameInput}
                maxLength={24}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                placeholder="Например: Мила"
              />
            </label>
            {identityError ? <p className="rounded-2xl bg-[#842f2b]/10 p-4 font-bold text-[#842f2b]">{identityError}</p> : null}
            <button className="btn btn-primary" type="submit">
              Влез в стаята
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={`shell game-shell phase-${phase}`} data-phase={phase} data-theme={family} data-family={family}>
      <PhaseTransitionOverlay phase={phase} mode={mode} narratorVoice={snapshot?.narratorVoice ?? "classic"} pulseKey={phasePulse} />
      <PreGameCountdown value={startCountdown} />
      {showShortcuts ? <ShortcutSheet onClose={() => setShowShortcuts(false)} /> : null}
      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="card rounded-[2rem] p-5 md:p-7">
          <ConnectionBanner status={connectionStatus} message={status} />

          <div className="phase-hero">
            <div>
              <p className="phase-kicker">стая {code} · рунд {snapshot?.round ?? 0}</p>
              <h1 className="phase-title mt-5 font-black">{phaseBg(phase, mode)}</h1>
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
                  {modeBg(mode)}
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
                <button data-testid="ready-toggle" className="btn btn-secondary" type="button" onClick={sendReady} disabled={!room}>
                  {ownPlayer?.ready ? "Не съм готов" : "Готов"}
                </button>
                {ownPlayer?.host ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={requestStartGame}
                    disabled={!room || !fullNarratorAccepted || startCountdown !== null}
                  >
                    {startCountdown ? "Започваме..." : "Започни игра"}
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

          {snapshot ? <PhaseGuide phase={phase} mode={mode} privateRole={privateRole?.role} ownPlayer={ownPlayer} /> : null}

          {snapshot && (ownPlayer?.host || ownPlayer?.narrator) ? (
            <NarratorDesk
              room={room}
              snapshot={snapshot}
              phase={phase}
              family={family}
              isHost={Boolean(ownPlayer?.host)}
              isNarrator={Boolean(ownPlayer?.narrator)}
              fullNarratorAccepted={fullNarratorAccepted}
              onStartGame={requestStartGame}
              startCountdownActive={startCountdown !== null}
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
                Благословията остава върху теб до края на играта и спира нощни убийства срещу теб.
              </p>
            </article>
          ) : null}

          <RoleCard role={privateRole} result={privateResult} players={players} />
          <DeathRevealCinematic players={players} />

          {isNightPhase(phase) && privateRole ? (
            <NightActionPanel
              currentUserId={currentUserId}
              players={players}
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
            <VotingPanel
              currentUserId={currentUserId}
              livingPlayers={livingPlayers}
              voteTally={snapshot?.voteTally ?? []}
              allowSkipVote={Boolean(snapshot?.allowSkipVote)}
              sendVote={sendVote}
            />
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
              setValue={(value) => updatePrivateChatMessage(privateChatChannel, value)}
              sendPrivateChat={sendPrivateChat}
              typingNotices={privateTypers}
            />
          ) : null}

          {snapshot?.winnerTeam ? (
            <article className={`winner-card paper-card mt-8 rounded-[2rem] p-6 faction-${snapshot.winnerTeam}`}>
              <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">край на играта</p>
              <h2 className="mt-2 text-4xl font-black">{winnerBg(snapshot.winnerTeam)}</h2>
              <p className="mt-3 text-[#4f3829]">{snapshot.winnerReasonBg}</p>
            </article>
          ) : null}
          {snapshot?.winnerTeam ? <PostGameStory snapshot={snapshot} /> : null}
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
                    onChange={(event) => updatePublicChatMessage(event.target.value)}
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
                <TypingIndicator notices={publicTypers} />
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
              В тази стая публичният чат е изключен. Използвайте външен разговор, игра на живо или указанията на Разказвача.
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
                  Събитията ще се появят тук, когато играта започне.
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
              <TypingIndicator notices={publicTypers} compact />
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
        <SummaryPill label="Глас" value={NARRATOR_VOICE_LABELS_BG[snapshot.narratorVoice]} />
        <SummaryPill label="Гласуване" value={`${snapshot.allowSkipVote ? "може пропуск" : "без пропуск"} · ${majorityModeBg(snapshot.majorityMode)}`} />
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

function PhaseTransitionOverlay({
  phase,
  mode,
  narratorVoice,
  pulseKey,
}: {
  phase: GamePhase;
  mode: GameMode;
  narratorVoice: NarratorVoice;
  pulseKey: number;
}) {
  if (pulseKey === 0 || phase === "lobby") {
    return null;
  }

  return (
    <div key={`${phase}-${pulseKey}`} className={`phase-transition-overlay transition-${phase}`} aria-hidden="true">
      <div>
        <span>{phaseSigil(phase)}</span>
        <strong>{phaseBg(phase, mode)}</strong>
        <small>{phaseNarratorLine(phase, mode, narratorVoice)}</small>
      </div>
    </div>
  );
}

function PreGameCountdown({ value }: { value: number | null }) {
  if (value === null) {
    return null;
  }

  return (
    <div className="pre-game-countdown" aria-live="assertive" aria-atomic="true">
      <span>ролите се разбъркват</span>
      <strong>{value}</strong>
      <small>Не показвай екрана си на другите.</small>
    </div>
  );
}

function DeathRevealCinematic({ players }: { players: PublicPlayer[] }) {
  const revealed = [...players].reverse().find((player) => player.playing && !player.alive && player.revealedRole);
  if (!revealed?.revealedRole) {
    return null;
  }

  const role = revealed.revealedRole as RoleCode;
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) {
    return null;
  }

  const family = definition.availableInFamilies[0] ?? "werewolves";
  const prefix = family === "mafia" ? "/game-art/mafia" : "/game-art";
  const slug = `role-${getRoleAssetKey(role)}`;

  return (
    <article className={`death-reveal-card mt-8 rounded-[2rem] p-5 role-${role}`}>
      <picture aria-hidden="true">
        <source srcSet={`${prefix}/${slug}.webp`} type="image/webp" />
        <img src={`${prefix}/${slug}.png`} alt="" loading="lazy" width={280} height={392} />
      </picture>
      <div>
        <p className="section-kicker">разкрита карта</p>
        <h2>{revealed.displayName} беше {definition.nameBg}</h2>
        <p>{definition.shortDescriptionBg}</p>
      </div>
    </article>
  );
}

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <aside className="shortcut-sheet" role="dialog" aria-modal="false" aria-label="Клавишни команди">
      <button type="button" onClick={onClose} aria-label="Затвори клавишните команди">
        затвори
      </button>
      <p className="section-kicker">клавиши</p>
      <h2>Бързи действия</h2>
      <dl>
        <div>
          <dt>?</dt>
          <dd>отваря и затваря този лист</dd>
        </div>
        <div>
          <dt>1-9</dt>
          <dd>гласува за съответния жив играч във фаза Гласуване</dd>
        </div>
        <div>
          <dt>Space</dt>
          <dd>пауза/продължи за host или Разказвач</dd>
        </div>
      </dl>
    </aside>
  );
}

function PostGameStory({ snapshot }: { snapshot: GameSnapshot }) {
  const deaths = snapshot.players.filter((player) => player.playing && !player.alive).length;
  const finalLiving = snapshot.players.filter((player) => player.playing && player.alive).length;
  const lastEvents = snapshot.publicEvents.slice(-5);

  return (
    <section className="post-game-story mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">история на нощта</p>
      <h2 className="mt-2 text-3xl font-black">Как ще я разказвате след играта</h2>
      <div className="post-game-badges mt-5">
        <span>оцеляха {finalLiving}</span>
        <span>паднаха {deaths}</span>
        <span>рундове {snapshot.round}</span>
      </div>
      <ol className="mt-5">
        {lastEvents.map((event) => (
          <li key={event.id}>{event.messageBg}</li>
        ))}
      </ol>
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
  family,
  isHost,
  isNarrator,
  fullNarratorAccepted,
  onStartGame,
  startCountdownActive,
}: {
  room: Room | null;
  snapshot: GameSnapshot;
  phase: GamePhase;
  family: GameFamily;
  isHost: boolean;
  isNarrator: boolean;
  fullNarratorAccepted: boolean;
  onStartGame: () => void;
  startCountdownActive: boolean;
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
          <h2 className="mt-2 text-3xl font-black">{isNarrator ? "Водиш играта" : "Контрол на водещия"}</h2>
          <p className="mt-3 max-w-2xl text-[#ead9ba]">
            Управлявай темпото без скрити клиентски решения. Всички действия се записват като събития за проверка на Разказвача.
          </p>
        </div>
        <div className="narrator-phase-seal">
          <span>{phaseBg(phase, family)}</span>
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
          <button className="btn btn-primary" type="button" onClick={onStartGame} disabled={!room || !fullNarratorAccepted || startCountdownActive}>
            {startCountdownActive ? "Започваме..." : "Започни игра"}
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
  mode,
  privateRole,
  ownPlayer,
}: {
  phase: GamePhase;
  mode: GameMode;
  privateRole: RoleCode | undefined;
  ownPlayer: PublicPlayer | undefined;
}) {
  const guide = phaseGuideBg(phase, mode);
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
        Това табло се изпраща само като лично събитие към избрания Пълен Разказвач.
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

  const definition = ROLE_DEFINITIONS[role.role];
  const family = definition.availableInFamilies[0] ?? "werewolves";
  const guide = ROLE_GUIDE_BG[role.role] ?? {
    summary: getRoleShortDescriptionBg(role.role),
    team: teamLabelBg(definition.team, family),
    timing: definition.nightAction ? "Нощна фаза" : "Ден и гласуване",
    win: "winConditionBg" in definition ? definition.winConditionBg : "Следвай целта на своя отбор",
  };

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
      <div className="mt-4 grid gap-3">
        <p className="text-[#4f3829]">{guide.summary}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <RoleFact label="Отбор" value={guide.team} />
          <RoleFact label="Кога действа" value={guide.timing} />
          <RoleFact label="Цел" value={guide.win} />
        </div>
      </div>
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

function TypingIndicator({ notices, compact = false }: { notices: TypingNotice[]; compact?: boolean }) {
  const names = [...new Set(notices.map((notice) => notice.senderName))].slice(0, 3);
  if (names.length === 0) {
    return null;
  }

  const label =
    names.length === 1
      ? `${names[0]} пише...`
      : names.length === 2
        ? `${names[0]} и ${names[1]} пишат...`
        : `${names[0]}, ${names[1]} и още ${notices.length - 2} пишат...`;

  return (
    <p className={`typing-indicator ${compact ? "typing-indicator-compact" : ""}`} aria-live="polite">
      <span aria-hidden="true" />
      {label}
    </p>
  );
}

function PrivateChatPanel({
  channel,
  messages,
  value,
  setValue,
  sendPrivateChat,
  typingNotices,
}: {
  channel: ChatChannel;
  messages: PrivateChatMessage[];
  value: string;
  setValue: (value: string) => void;
  sendPrivateChat: (channel: ChatChannel) => void;
  typingNotices: TypingNotice[];
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
        <TypingIndicator notices={typingNotices} compact />
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
  players,
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
  players: PublicPlayer[];
  livingPlayers: PublicPlayer[];
  phase: string;
  privateRole: RoleCode;
  selectedTargetId: string;
  secondTargetId: string;
  setSelectedTargetId: (value: string) => void;
  setSecondTargetId: (value: string) => void;
  sendNightAction: (action: NightActionCommand) => void;
}) {
  const selectableTargets =
    privateRole === "medium"
      ? players.filter((player) => player.playing && !player.alive)
      : livingPlayers;
  const defaultTarget = selectableTargets.find((player) => player.userId !== currentUserId)?.userId;
  const selectedTargetStillAvailable = selectableTargets.some((player) => player.userId === selectedTargetId);
  const targetId = selectedTargetStillAvailable ? selectedTargetId : defaultTarget || "";
  const secondId = secondTargetId || livingPlayers.find((player) => player.userId !== targetId)?.userId || "";

  return (
    <section className="night-action-sheet ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">нощно действие</p>
      <h2 className="mt-2 text-3xl font-black">{nightInstructionBg(privateRole)}</h2>
      <p className="mt-3 text-[#ead9ba]">{nightActionHelpBg(privateRole)}</p>
      <p className="mt-2 text-sm font-bold text-[#c18a38]">
        Можеш да промениш избора си до края на таймера. Сървърът пази последното изпратено действие.
      </p>
      {privateRole === "medium" && selectableTargets.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-[#c18a38]/35 bg-[#c18a38]/10 p-3 text-sm font-bold text-[#ead9ba]">
          Медиумът няма елиминиран играч, с когото да се свърже тази нощ.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select className="input" value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)}>
          <option value="">Избери цел</option>
          {selectableTargets.map((player) => (
            <option key={player.userId} value={player.userId}>
              {player.displayName}
            </option>
          ))}
        </select>

        {privateRole === "cupid" || privateRole === "lovers" || privateRole === "blacksmith" ? (
          <select className="input" value={secondTargetId} onChange={(event) => setSecondTargetId(event.target.value)}>
            <option value="">{privateRole === "blacksmith" ? "Кой получава меча" : "Втори влюбен"}</option>
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
        {privateRole === "detective" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "check_alignment", targetUserId: targetId })}>
            Разследвай целта
          </button>
        ) : null}
        {privateRole === "informant" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "check_role", targetUserId: targetId })}>
            Отвори досие
          </button>
        ) : null}
        {privateRole === "roleblocker" ? (
          <button className="btn btn-primary action-btn ability-kill-alt" type="button" onClick={() => targetId && sendNightAction({ kind: "roleblock", targetUserId: targetId })}>
            Блокирай действие
          </button>
        ) : null}
        {privateRole === "lawyer" ? (
          <button className="btn btn-secondary action-btn ability-bless" type="button" onClick={() => targetId && sendNightAction({ kind: "lawyer_cover", targetUserId: targetId })}>
            Подготви алиби
          </button>
        ) : null}
        {privateRole === "medium" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "medium_contact", targetUserId: targetId })}>
            Свържи се с елиминиран
          </button>
        ) : null}
        {privateRole === "don" ? (
          <button className="btn btn-secondary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "check_commissioner", targetUserId: targetId })}>
            Търси Комисаря
          </button>
        ) : null}
        {privateRole === "seer" || privateRole === "oracle" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "check_role", targetUserId: targetId })}>
            Провери заплахата
          </button>
        ) : null}
        {privateRole === "investigator" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "investigator_check", targetUserId: targetId })}>
            Провери тройка
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
        {privateRole === "healer" || privateRole === "doctor" || privateRole === "bodyguard" ? (
          <button className="btn btn-primary action-btn ability-heal" type="button" onClick={() => targetId && sendNightAction({ kind: "healer_protect", targetUserId: targetId })}>
            Пази тази нощ
          </button>
        ) : null}
        {privateRole === "priest" ? (
          <button className="btn btn-primary action-btn ability-bless" type="button" onClick={() => targetId && sendNightAction({ kind: "priest_bless", targetUserId: targetId })}>
            Дай благословия
          </button>
        ) : null}
        {privateRole === "blacksmith" ? (
          <button
            className="btn btn-primary action-btn ability-kill"
            type="button"
            onClick={() => targetId && secondId && sendNightAction({ kind: "blacksmith_sword", receiverUserId: secondId, targetUserId: targetId })}
          >
            Изкови меч
          </button>
        ) : null}
        {privateRole === "stray_cat" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" onClick={() => targetId && sendNightAction({ kind: "stray_cat_choose", targetUserId: targetId })}>
            Избери дом
          </button>
        ) : null}
        {privateRole === "thief" && phase === "first_night" ? (
          <button className="btn btn-primary action-btn ability-steal" type="button" onClick={() => targetId && sendNightAction({ kind: "thief_steal", targetUserId: targetId })}>
            Открадни карта
          </button>
        ) : null}
        {(privateRole === "cupid" || privateRole === "lovers") && phase === "first_night" ? (
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
  voteTally,
  allowSkipVote,
  sendVote,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  voteTally: VoteTallyItem[];
  allowSkipVote: boolean;
  sendVote: (targetUserId: string) => void;
}) {
  const maxVotes = Math.max(1, ...voteTally.map((item) => item.count));

  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">гласуване</p>
      <h2 className="mt-2 text-3xl font-black">Кого ще изгоните от площада?</h2>
      <VoteTallyBar items={voteTally} maxVotes={maxVotes} />
      <div className="mt-5 flex flex-wrap gap-3">
        {livingPlayers
          .filter((player) => player.userId !== currentUserId)
          .map((player) => (
            <button className="btn btn-primary" type="button" key={player.userId} onClick={() => sendVote(player.userId)}>
              {player.displayName}
            </button>
          ))}
        {allowSkipVote ? (
          <button className="btn btn-secondary" type="button" onClick={() => sendVote("skip")}>
            Пропусни глас
          </button>
        ) : null}
      </div>
    </section>
  );
}

function VoteTallyBar({ items, maxVotes }: { items: VoteTallyItem[]; maxVotes: number }) {
  if (items.length === 0) {
    return (
      <div className="vote-tally-card mt-5">
        <p>Още няма подадени гласове. Първият глас често задава посоката на целия ден.</p>
      </div>
    );
  }

  return (
    <div className="vote-tally-card mt-5" aria-label="Текущо броене на гласовете">
      {items.map((item) => (
        <div key={item.targetUserId} className="vote-tally-row">
          <span>{item.targetName}</span>
          <div>
            <i style={{ width: `${Math.max(10, Math.round((item.count / maxVotes) * 100))}%` }} />
          </div>
          <strong>{item.count}</strong>
          {item.hasMayorVote ? <small>кметски глас при равенство</small> : null}
        </div>
      ))}
    </div>
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

function phaseNarratorLine(phase: GamePhase, mode: GameMode, narratorVoice: NarratorVoice = "classic") {
  const mafia = getGameFamily(mode) === "mafia";
  if (narratorVoice !== "classic") {
    const voiceLines = narratorVoiceLineBg(narratorVoice, mafia);
    if (voiceLines[phase]) {
      return voiceLines[phase];
    }
  }
  const lines: Partial<Record<GamePhase, string>> = mafia
    ? {
        role_reveal: "Досиетата се раздават. Градът още не знае кой държи ножа.",
        first_night: "Първият договор се подписва без свидетели.",
        night: "Неонът трепти, а алибитата чакат сутринта.",
        day_announcement: "Градът се буди и брои липсващите.",
        day_discussion: "Сега всяка дума тежи повече от факт.",
        voting: "Обвинението вече има име.",
        resolution: "Присъдата влиза в протокола.",
        game_over: "Последната версия остана единствената.",
      }
    : {
        role_reveal: "Картите се обръщат само пред очите на собственика си.",
        first_night: "Мъглата пада ниско. Първите сенки се будят.",
        night: "Селото спи, но гората не.",
        day_announcement: "Утрото казва какво е оцеляло.",
        day_discussion: "Площадът търси глас, който звучи като истина.",
        voting: "Сега подозрението става решение.",
        resolution: "Картата пада на масата.",
        hunter_revenge: "Ловецът не си тръгва сам.",
        game_over: "Последната песен е за победителите.",
      };

  return lines[phase] ?? "Разказвачът обръща следващата страница.";
}

function narratorVoiceLineBg(voice: NarratorVoice, mafia: boolean): Partial<Record<GamePhase, string>> {
  if (voice === "old_villager") {
    return {
      first_night: "Слушай старите греди. Те винаги знаят кой не спи.",
      night: "Никой не става по това време без причина.",
      day_discussion: "Не бързайте с обвиненията. Лъжата обича шум.",
      voting: "Сега ръката тежи повече от думите.",
    };
  }
  if (voice === "inspector") {
    return mafia
      ? {
          first_night: "Първият протокол започва без свидетели.",
          night: "Всички алибита ще бъдат проверени сутринта.",
          day_discussion: "Запишете фактите. После ще останат само версиите.",
          voting: "Обвинението влиза в делото.",
        }
      : {
          first_night: "Първата нощ се записва като особено рискова.",
          night: "Движението в селото се наблюдава.",
          day_discussion: "Съберете показанията преди присъдата.",
          voting: "Решението трябва да издържи на съмнение.",
        };
  }
  if (voice === "witch") {
    return {
      first_night: "Имената кипват като билки в черна вода.",
      night: "Тъмното не крие всичко. Само това, което още не си готов да видиш.",
      day_discussion: "Думите оставят следи по-силни от кръв.",
      voting: "Изберете внимателно. Всяка присъда има вкус.",
    };
  }
  return {};
}

function roleSigil(role: RoleCode) {
  const sigils: Partial<Record<RoleCode, string>> = {
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

  return sigils[role] ?? ROLE_DEFINITIONS[role].nameBg.slice(0, 1);
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
  mode: GameMode;
  playerCount: number;
  narratorMode: string;
  communicationMode: string;
  tempoProfile: string;
  dayDiscussionSeconds: number;
  voteSeconds: number;
  revealRolesOnDeath: boolean;
  loversEnabled: boolean;
  allowSkipVote: boolean;
  majorityMode: string;
  narratorVoice: NarratorVoice;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number;
  winnerTeam: string;
  winnerReasonBg: string;
  players: { values(): IterableIterator<ColyseusGameStatePlayer> };
  roleCounts: Iterable<PublicRoleCount>;
  voteTally: Iterable<VoteTallyItem>;
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
    allowSkipVote: state.allowSkipVote,
    majorityMode: state.majorityMode,
    narratorVoice: state.narratorVoice,
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
    voteTally: Array.from(state.voteTally),
    publicEvents: Array.from(state.publicEvents),
    publicChat: Array.from(state.publicChat),
  };
}

function isNightPhase(phase: string) {
  return phase === "first_night" || phase === "night";
}

function canFactionKill(role: RoleCode) {
  const team = ROLE_DEFINITIONS[role].team;
  return team === "mafia" || team === "werewolves" || team === "vampires" || role === "vigilante" || role === "maniac" || role === "vampire_hunter";
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

const ROLE_GUIDE_BG: Partial<Record<RoleCode, { summary: string; team: string; timing: string; win: string }>> = {
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
    summary: "Разширена роля за ръчно водени игри. Наднича, докато Върколаците са будни, но рискува да бъде разкрита.",
    team: "Село",
    timing: "Нощ, ръчно/разширено",
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
  { label: "Глас", iconPhase: "voting", phases: ["voting"] },
  {
    label: "Развръзка",
    iconPhase: "resolution",
    phases: ["resolution", "hunter_revenge", "mayor_successor", "game_over"],
  },
];

interface PhaseGuideCopy {
  title: string;
  body: string;
  wakes: string;
}

const PHASE_GUIDE_BG: Partial<Record<GamePhase, PhaseGuideCopy>> = {
  lobby: {
    title: "Настройка на стаята",
    body: "Водещият избира режим, роли, таймери, комуникация и Разказвач. Всички трябва да са готови преди старт.",
    wakes: "Никой още не се буди.",
  },
  role_reveal: {
    title: "Виж тайно ролята си",
    body: "Всеки играч получава само своята карта като лично събитие. Не показвай телефона си, ако играете на живо.",
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
    body: "Всички живи играчи спорят, блъфират и събират подозрения. Таймерът е само видимият ритъм; сървърът е източникът на истината.",
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
    body: "Всеки жив играч избира кого да елиминира. Кметът решава само ако водещите кандидати са с равен брой гласове.",
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

const MAFIA_PHASE_GUIDE_BG: Partial<Record<GamePhase, Partial<PhaseGuideCopy>>> = {
  role_reveal: {
    title: "Виж тайно досието си",
    body: "Всеки играч получава само своята карта като лично събитие. Не показвай телефона си, ако играете на живо.",
    wakes: "Всеки гледа само собствената си роля.",
  },
  first_night: {
    body: "Първият договор подрежда началните действия преди редовните нощни решения.",
    wakes: "Мафията, Донът и Комисарят според избраните роли.",
  },
  night: {
    body: "Мафията избира жертва, Донът може да търси Комисаря, а Комисарят проверява подозрителен играч.",
    wakes: "Мафията, Донът и Комисарят.",
  },
  day_announcement: {
    body: "Системата обявява публичните резултати от нощта, без да разкрива скрита информация.",
    wakes: "Градът се събужда.",
  },
  day_discussion: {
    body: "Играчите защитават версии, притискат противоречия и събират подозрения. Таймерът е видимият ритъм; сървърът е източникът на истината.",
    wakes: "Всички живи играчи говорят.",
  },
  nomination: {
    title: "Обвинения",
    body: "При спортна или ръчно водена Мафия тук се избират кандидати за гласуване.",
    wakes: "Всички живи играчи участват.",
  },
  defense: {
    title: "Последна защита",
    body: "Номинираните получават време да защитят версията си преди присъдата.",
    wakes: "Говорят номинираните.",
  },
  voting: {
    body: "Всеки жив играч избира кого градът да елиминира. Сървърът валидира гласа и брои резултата.",
    wakes: "Всички живи играчи гласуват.",
  },
  resolution: {
    body: "Сървърът прилага присъдата, евентуално разкрива роля и проверява условията за победа.",
    wakes: "Никой не действа, освен ако не се задейства специална роля.",
  },
};

function phaseGuideBg(phase: GamePhase, mode: GameMode): PhaseGuideCopy {
  const base = PHASE_GUIDE_BG[phase] ?? {
    title: phaseLabelBg(phase, mode),
    body: "Следвай указанията на екрана. Сървърът пази реда на фазите и валидира действията.",
    wakes: "Няма специално събуждане в тази фаза.",
  };

  if (getGameFamily(mode) !== "mafia") {
    return base;
  }

  const override = MAFIA_PHASE_GUIDE_BG[phase] ?? {};
  return {
    ...base,
    title: override.title ?? phaseLabelBg(phase, mode),
    ...override,
  };
}

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
    if (
      canFactionKill(role) ||
      [
        "commissioner",
        "detective",
        "don",
        "seer",
        "oracle",
        "witch",
        "healer",
        "doctor",
        "bodyguard",
        "priest",
        "blacksmith",
        "investigator",
        "stray_cat",
        "informant",
        "roleblocker",
        "lawyer",
        "medium",
      ].includes(role)
    ) {
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
    detective: "Разследването дава личен резултат според настройките на Мафия.",
    informant: "Доносникът вижда точна карта, освен ако някой не е прикрит.",
    roleblocker: "Избраният играч няма да може да изпълни нощното си действие.",
    lawyer: "Адвокатът прави целта да изглежда чиста пред разследващите.",
    medium: "Медиумът може да пита вече елиминиран играч каква е била ролята му.",
    seer: "Ясновидката вижда точната роля, но резултатът не е публичен.",
    oracle: "Оракулът проверява дали целта е Върколак или Вампир.",
    witch: "Лечението и отровата са еднократни. Ако ги изразходваш, после вече не са налични.",
    healer: "Лечителят не може да пази себе си и не може да пази един и същ играч две нощи поред.",
    doctor: "Докторът пази един играч от нощното убийство на Мафията.",
    bodyguard: "Бодигардът пази цел с риск за себе си според настройките.",
    vigilante: "Вигилантето може да атакува, но грешният избор помага на Мафията.",
    maniac: "Маниакът играе сам и може да елиминира през нощта.",
    vampire_hunter: "Убиецът на вампири може да ловува, но губи умението си при грешна жертва.",
    priest: "Благословията е еднократна като действие, но защитата остава до края на играта.",
    blacksmith: "Ковачът избира кой получава меча и срещу кого се използва. Мечът е еднократен.",
    investigator: "Следователката проверява избран играч и двамата му живи съседи като една тройка.",
    insomniac: "Неспящата получава личен резултат в края на нощта, ако около нея е имало движение.",
    stray_cat: "Уличната котка избира дом. Ако попадне при чудовище, и двамата излизат от играта.",
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
    detective: "Детективът разследва подозрителен играч",
    informant: "Доносникът отваря чуждо досие",
    roleblocker: "Блокиращият спира нощно действие",
    lawyer: "Адвокатът подготвя алиби",
    medium: "Медиумът говори с елиминиран играч",
    seer: "Ясновидката вижда тайна роля",
    oracle: "Оракулът проверява заплахата",
    witch: "Вещицата решава дали да лекува или отрови",
    healer: "Лечителят пази един играч за тази нощ",
    doctor: "Докторът пази един играч за тази нощ",
    bodyguard: "Бодигардът охранява един играч",
    vigilante: "Вигилантето избира цел",
    maniac: "Маниакът избира жертва",
    vampire_hunter: "Убиецът на вампири ловува",
    priest: "Свещеникът дава една трайна благословия",
    blacksmith: "Ковачът изковава един меч",
    investigator: "Следователката проверява тройка",
    insomniac: "Неспящата чака края на нощта",
    stray_cat: "Уличната котка избира дом",
    thief: "Крадецът краде карта веднъж през първата нощ",
    cupid: "Купидон избира двама Влюбени",
  };

  return labels[role] ?? "Тази роля няма задължително нощно действие";
}

function formatPrivateResult(result: PrivateResult, players: PublicPlayer[]) {
  if (result.messageBg) {
    return result.messageBg;
  }

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

function phaseBg(phase: string, familyOrMode: GameFamily | GameMode = "werewolves") {
  return isKnownPhase(phase) ? phaseLabelBg(phase, familyOrMode) : phase;
}

function modeBg(mode: string) {
  return isKnownMode(mode) ? getGameModeNameBg(mode) : mode;
}

function isKnownMode(mode: string): mode is GameMode {
  return mode in GAME_MODE_DEFINITIONS;
}

function isKnownPhase(phase: string): phase is GamePhase {
  return [
    "lobby",
    "role_reveal",
    "first_night",
    "night",
    "day_announcement",
    "day_discussion",
    "nomination",
    "defense",
    "voting",
    "resolution",
    "hunter_revenge",
    "mayor_successor",
    "paused",
    "game_over",
  ].includes(phase);
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

function majorityModeBg(mode: string) {
  const labels: Record<string, string> = {
    simple: "обикновено мнозинство",
    absolute: "абсолютно мнозинство",
  };

  return labels[mode] ?? mode;
}

function winnerBg(winner: string) {
  const labels: Record<string, string> = {
    village: "Селото печели",
    werewolves: "Върколаците печелят",
    vampires: "Вампирите печелят",
    mafia: "Мафията печели",
    maniac: "Маниакът печели",
    lovers: "Влюбените печелят",
    draw: "Никой не печели",
  };

  return labels[winner] ?? winner;
}
