"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  EyeOff,
  MessageSquare,
  Play,
  Settings,
  Users,
} from "lucide-react";
import {
  ROLE_DEFINITIONS,
  getGameFamily,
  phaseLabelBg,
  type ChatChannel,
  type CreateRoomOptions,
  type GamePhase,
  type NightActionCommand,
  type RoleCode,
} from "@werewolf/shared";
import "@/components/play/PlayRoom.module.css";
import "@/components/play/PlayerToken.module.css";
import { playCue } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { LiveCuePanel } from "@/components/play/LiveCuePanel";
import { NarratorDesk } from "@/components/play/NarratorDesk";
import { RulesSummary } from "@/components/play/RulesSummary";
import { eventLineClass } from "@/lib/play/event-log";
import { HunterRevengePanel } from "@/components/play/HunterRevengePanel";
import { LoverCard } from "@/components/play/LoverCard";
import { NarratorSnapshotPanel } from "@/components/play/NarratorSnapshotPanel";
import { PhaseGuide } from "@/components/play/PhaseGuide";
import { PrivateChatPanel } from "@/components/play/PrivateChatPanel";
import { RoleCard } from "@/components/play/RoleCard";
import { SummaryPill } from "@/components/play/SummaryPill";
import { TypingIndicator } from "@/components/play/TypingIndicator";
import { AchievementUnlockModal } from "@/components/play/AchievementUnlockModal";
import { ConnectionBanner } from "@/components/play/ConnectionBanner";
import { DeathRevealCinematic } from "@/components/play/DeathRevealCinematic";
import { PhaseRail } from "@/components/play/PhaseRail";
import { PhaseTransitionOverlay } from "@/components/play/PhaseTransitionOverlay";
import { PlayerTile } from "@/components/play/PlayerTile";
import { PostGameStory } from "@/components/play/PostGameStory";
import { PreGameCountdown } from "@/components/play/PreGameCountdown";
import { ReconnectModal } from "@/components/play/ReconnectModal";
import { Timer } from "@/components/play/Timer";
import { NightActionPanel } from "@/components/play/NightActionPanel";
import { buildPrimaryNightAction, shortcutTargets } from "@/lib/play/night-actions";
import { VotingPanel } from "@/components/play/VotingPanel";
import { PlayerTokensSkeleton } from "@/components/skeleton";
import { canFactionKill, isNightPhase } from "@/lib/play/role-rules";
import { phaseBg, phaseSigil } from "@/lib/play/phase-display";
import { useCueMode } from "@/hooks/play/use-cue-mode";
import { useGameRoom } from "@/hooks/play/use-game-room";
import { usePhaseTransitions } from "@/hooks/play/use-phase-transitions";
import {
  communicationBg,
  modeBg,
  winnerBg,
} from "@/lib/play/copy";
import type { PhaseSlice, PublicPlayer, ShortcutState } from "@/lib/play/types";

export type { PhaseSlice, PublicPlayer } from "@/lib/play/types";

interface PlayRoomClientProps {
  code: string;
  createOptions?: CreateRoomOptions;
  visualFixtureSearch?: string | undefined;
}

export function PlayRoomClient({ code, createOptions: createOptionsRaw, visualFixtureSearch }: PlayRoomClientProps) {
  const createOptions = createOptionsRaw;
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [secondTargetId, setSecondTargetId] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [privateChatMessage, setPrivateChatMessage] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const suppressNextPhasePulseRef = useRef(false);
  const lastTypingSentRef = useRef<Map<ChatChannel, number>>(new Map());
  const shortcutStateRef = useRef<ShortcutState | null>(null);
  const toast = useToast();
  const {
    room,
    snapshot,
    currentUserId,
    privateRole,
    privateResult,
    privateLover,
    narratorSnapshot,
    privateChats,
    typingNotices,
    isBlessed,
    status,
    setStatus,
    connectionStatus,
    unlockedAchievementIds,
    setUnlockedAchievementIds,
    reconnectNow,
    isPending,
  } = useGameRoom({
    code,
    createOptions,
    visualFixtureSearch,
    toast,
    onReconnectSuppressed: () => {
      suppressNextPhasePulseRef.current = true;
    },
  });
  const liveMode = (snapshot?.tempoProfile ?? createOptions?.tempoProfile) === "live";
  const { cueMode, changeCueMode } = useCueMode({
    tempoProfile: createOptions?.tempoProfile,
    phase: snapshot?.phase ?? "lobby",
    liveMode,
  });

  // When the phase changes, drop stale action-feedback strings so the previous
  // "Нощното действие е изпратено" or boilerplate "Свързан" don't linger past
  // the moment they are relevant. Players still get fresh status when they act.
  useEffect(() => {
    const nextPhase = snapshot?.phase;
    if (!nextPhase) {
      return;
    }
    setStatus((current) => (current === "Свързан" || current === "Свързване..." ? "" : current));
  }, [snapshot?.phase]);

  const players = useMemo(() => snapshot?.players ?? [], [snapshot?.players]);
  const livingPlayers = useMemo(() => players.filter((player) => player.playing && player.alive), [players]);
  const ownPlayer = useMemo(() => players.find((player) => player.userId === currentUserId), [currentUserId, players]);
  const recentPublicEvents = useMemo(() => snapshot?.publicEvents.slice(-7) ?? [], [snapshot?.publicEvents]);
  const recentPublicChat = useMemo(() => snapshot?.publicChat.slice(-5) ?? [], [snapshot?.publicChat]);
  const mode = snapshot?.mode ?? createOptions?.mode ?? "werewolves_classic";
  const family = getGameFamily(mode);
  const phase = snapshot?.phase ?? "lobby";
  const {
    phasePulse,
    showPhaseTransition,
    startCountdown,
    requestStartGame,
  } = usePhaseTransitions({
    room,
    phase: snapshot?.phase ?? null,
    publicEvents: snapshot?.publicEvents ?? [],
    winnerTeam: snapshot?.winnerTeam ?? "",
    liveMode,
    cueMode,
    suppressNextPhasePulseRef,
  });

  useEffect(() => {
    shortcutStateRef.current = {
      room,
      phase,
      selectedTargetId,
      secondTargetId,
      privateRole,
      players,
      livingPlayers,
      currentUserId,
      ownPlayer,
      showShortcuts,
      liveMode,
    };
  });

  function sendReady() {
    room?.send("ready", { ready: !ownPlayer?.ready });
  }

  function sendNightAction(action: NightActionCommand) {
    room?.send("submitNightAction", { action });
    toast({ message: "Нощното действие е изпратено.", kind: "success" });
    if (!liveMode && "vibrate" in navigator) {
      navigator.vibrate([24]);
    }
  }

  function sendVote(targetUserId: string) {
    room?.send("submitVote", { targetUserId });
    toast({ message: "Гласът е изпратен.", kind: "success" });
    playCue("vote", { forceSilent: liveMode });
  }

  const submitCurrentShortcutAction = useCallback(() => {
    const current = shortcutStateRef.current;
    if (!current?.room) {
      return;
    }

    if (current.phase === "voting" && current.selectedTargetId) {
      current.room.send("submitVote", { targetUserId: current.selectedTargetId });
      toast({ message: "Гласът е изпратен.", kind: "success" });
      playCue("vote", { forceSilent: current.liveMode });
      return;
    }

    if (current.phase === "hunter_revenge" && current.privateRole?.role === "hunter" && current.selectedTargetId) {
      current.room.send("submitHunterRevenge", { targetUserId: current.selectedTargetId });
      toast({ message: "Последният изстрел е изпратен.", kind: "success" });
      return;
    }

    if (isNightPhase(current.phase) && current.privateRole) {
      const action = buildPrimaryNightAction(
        current.privateRole.role,
        current.selectedTargetId,
        current.secondTargetId,
        current.phase,
      );
      if (action) {
        current.room.send("submitNightAction", { action });
        toast({ message: "Нощното действие е изпратено.", kind: "success" });
        if (!current.liveMode && "vibrate" in navigator) {
          navigator.vibrate([24]);
        }
      }
    }
  }, [toast]);

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

  const fullNarratorAccepted = useMemo(
    () => snapshot?.narratorMode !== "full_human" || players.every((player) => player.acceptedFullNarrator),
    [players, snapshot?.narratorMode],
  );
  const privateChatChannel = getAvailablePrivateChatChannel(privateRole?.role, ownPlayer, phase, snapshot?.communicationMode);
  const publicTypers = useMemo(
    () => typingNotices.filter((notice) => notice.channel === "public" && notice.senderUserId !== currentUserId),
    [currentUserId, typingNotices],
  );
  const privateTypers = useMemo(
    () => typingNotices.filter((notice) => notice.channel === privateChatChannel && notice.senderUserId !== currentUserId),
    [currentUserId, privateChatChannel, typingNotices],
  );
  const privateChannelMessages = useMemo(
    () => privateChats.filter((message) => message.channel === privateChatChannel),
    [privateChatChannel, privateChats],
  );
  // Connection state already lives in the ConnectionBanner; the phase-status
  // line is only useful for transient action feedback. Hide the boilerplate
  // "Свързан" / "Свързване..." strings so the player doesn't see them linger.
  const isStatusInformative = status.length > 0 && status !== "Свързан" && status !== "Свързване...";
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

      if (event.key === "Escape") {
        const current = shortcutStateRef.current;
        if (current?.showShortcuts) {
          setShowShortcuts(false);
        } else {
          setSelectedTargetId("");
          setSecondTargetId("");
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        submitCurrentShortcutAction();
        return;
      }

      const current = shortcutStateRef.current;
      if (!current) {
        return;
      }

      if (
        event.key === " " &&
        (current.ownPlayer?.host || current.ownPlayer?.narrator) &&
        current.phase !== "paused" &&
        current.phase !== "game_over"
      ) {
        event.preventDefault();
        current.room?.send("narratorPause");
        return;
      }

      if ((current.phase === "voting" || current.phase === "hunter_revenge" || isNightPhase(current.phase)) && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const targetPlayer = shortcutTargets(
          current.phase,
          current.privateRole?.role,
          current.players,
          current.livingPlayers,
          current.currentUserId,
        )[index];
        if (targetPlayer) {
          event.preventDefault();
          setSelectedTargetId(targetPlayer.userId);
          if (current.phase === "voting") {
            current.room?.send("submitVote", { targetUserId: targetPlayer.userId });
            toast({ message: "Гласът е изпратен.", kind: "success" });
            playCue("vote", { forceSilent: current.liveMode });
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitCurrentShortcutAction, toast]);

  const renderPlayersPanel = () => {
    const eventsHeadingId = "events-heading";
    const chatHeadingId = "chat-heading";

    return (
      <aside className="play-section play-players-panel">
        <p className="section-kicker play-section-kicker">
          <Users className="play-section-icon" aria-hidden strokeWidth={1.8} />
          <span>площадът</span>
        </p>
        <h2 className="mt-3 text-3xl font-black">Играчите на площада</h2>
        <div className="mt-6 grid gap-3">
          {!snapshot ? <PlayerTokensSkeleton /> : null}
          {snapshot && players.length === 0 ? (
            <div className="empty-state-card empty-players-card rounded-[2rem] p-5">
              <span aria-hidden="true" />
              <strong>Площадът още е празен</strong>
              <p>Поканата чака първите телефони около масата.</p>
            </div>
          ) : null}
          {snapshot
            ? players.map((player) => (
                <PlayerTile
                  key={player.userId}
                  player={player}
                  phase={phase}
                  narratorMode={snapshot.narratorMode}
                  canManageNarrator={Boolean(ownPlayer?.host && snapshot.narratorMode !== "automatic" && phase === "lobby")}
                  canManageMayor={Boolean(
                    (ownPlayer?.host || ownPlayer?.narrator)
                      && snapshot.mode === "werewolves_classic"
                      && (phase === "lobby" || phase === "mayor_successor")
                      && player.playing
                      && player.alive,
                  )}
                  onMakeNarrator={() => room?.send("setNarrator", { targetUserId: player.userId, narrator: true })}
                  onMakeMayor={() => room?.send("setMayor", { targetUserId: player.userId })}
                />
              ))
            : null}
        </div>

        {phase === "day_discussion" && snapshot?.communicationMode === "built_in_chat" ? (
          ownPlayer?.playing && ownPlayer?.alive ? (
            <form className="mt-8 grid gap-3" onSubmit={sendChat}>
              <h3 className="play-panel-subhead">
                <MessageSquare className="play-section-icon" aria-hidden strokeWidth={1.8} />
                <span>Дневен чат</span>
              </h3>
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
                <MessageSquare className="play-button-icon" aria-hidden strokeWidth={1.8} />
                <span>Изпрати</span>
              </button>
            </form>
          ) : (
            <div className="play-muted-note mt-8">
              <EyeOff className="play-section-icon" aria-hidden strokeWidth={1.8} />
              <span>
                {ownPlayer?.playing
                  ? "Елиминираните играчи могат да четат, но не и да пишат в дневния чат."
                  : "Разказвачите и наблюдателите не пишат в дневния чат."}
              </span>
            </div>
          )
        ) : null}

        {phase === "day_discussion" && snapshot?.communicationMode !== "built_in_chat" ? (
          <div className="play-muted-note mt-8">
            <EyeOff className="play-section-icon" aria-hidden strokeWidth={1.8} />
            <span>В тази стая публичният чат е изключен. Използвайте външен разговор, игра на живо или указанията на Разказвача.</span>
          </div>
        ) : null}

        <div className="mt-8">
          <h3 className="play-panel-subhead" id={eventsHeadingId}>
            <Settings className="play-section-icon" aria-hidden strokeWidth={1.8} />
            <span>Събития</span>
          </h3>
          <div
            className="mt-3 grid gap-2 text-sm"
            role="log"
            aria-labelledby={eventsHeadingId}
            aria-live="polite"
            aria-relevant="additions"
          >
            {(snapshot?.publicEvents ?? []).length === 0 ? (
              <p className="event-line event-line-empty rounded-xl px-3 py-2">
                Събитията ще се появят тук, когато играта започне.
              </p>
            ) : null}
            {recentPublicEvents.map((event) => (
              <p key={event.id} className={`event-line ${eventLineClass(event.messageBg)} rounded-xl px-3 py-2`}>
                {event.messageBg}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="play-panel-subhead" id={chatHeadingId}>
            <MessageSquare className="play-section-icon" aria-hidden strokeWidth={1.8} />
            <span>Чат лог</span>
          </h3>
          <div
            className="mt-3 grid gap-2 text-sm"
            role="log"
            aria-labelledby={chatHeadingId}
            aria-live="polite"
            aria-relevant="additions"
          >
            {(snapshot?.publicChat ?? []).length === 0 ? (
              <p className="chat-line rounded-xl px-3 py-2">Още няма публични реплики.</p>
            ) : null}
            {recentPublicChat.map((message) => (
              <p key={message.id} className="chat-line rounded-xl px-3 py-2">
                <strong>{message.senderName}:</strong> {message.message}
              </p>
            ))}
            <TypingIndicator notices={publicTypers} compact />
          </div>
        </div>
      </aside>
    );
  };

  return (
    <main className="shell game-shell play-shell framed-shell" data-phase={phase} data-family={family}>
      {showPhaseTransition ? (
        <PhaseTransitionOverlay phase={phase} mode={mode} narratorVoice={snapshot?.narratorVoice ?? "classic"} pulseKey={phasePulse} />
      ) : null}
      <PreGameCountdown value={startCountdown} />
      {connectionStatus === "reconnecting" || connectionStatus === "lost" ? (
        <ReconnectModal
          status={connectionStatus}
          message={status}
          onRetry={reconnectNow}
        />
      ) : null}
      {showShortcuts ? <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} /> : null}
      {unlockedAchievementIds.length > 0 ? (
        <AchievementUnlockModal achievementIds={unlockedAchievementIds} onClose={() => setUnlockedAchievementIds([])} />
      ) : null}
      <div className="framed-shell-inner play-shell-inner">
      <section className="play-layout">
        <div className="card play-main-stack play-section rounded-[2rem] p-5 md:p-7">
          <ConnectionBanner status={connectionStatus} message={status} />

          <div className="phase-hero">
            <div>
              <p className="phase-kicker">стая {code} · рунд {snapshot?.round ?? 0}</p>
              <div className="play-phase-pill" aria-label={`Фаза: ${phaseBg(phase, mode)}`}>
                <span className="play-phase-dot" aria-hidden />
                <span>Фаза: {phaseBg(phase, mode)}</span>
              </div>
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
                  <Users className="play-button-icon" aria-hidden strokeWidth={1.8} />
                  {ownPlayer?.ready ? "Не съм готов" : "Готов"}
                </button>
                {ownPlayer?.host ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={requestStartGame}
                    disabled={!room || !fullNarratorAccepted || startCountdown !== null}
                  >
                    <Play className="play-button-icon" aria-hidden strokeWidth={1.8} />
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
              isNarrator={Boolean(ownPlayer?.narrator)}
              onOpenShortcuts={() => setShowShortcuts(true)}
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
              messages={privateChannelMessages}
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

        {renderPlayersPanel()}
      </section>
      </div>
    </main>
  );
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
