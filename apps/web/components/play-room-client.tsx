"use client";

import Link from "next/link";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  ScrollText,
  Play,
  Users,
} from "lucide-react";
import {
  ROLE_DEFINITIONS,
  getGameFamily,
  type ChatChannel,
  type CreateRoomOptions,
  type GameFamily,
  type GamePhase,
  type NightActionCommand,
  type RoleCode,
} from "@werewolf/shared";
import "@/components/play/PlayRoom.module.css";
import { useToast } from "@/lib/toast";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { LiveCuePanel } from "@/components/play/LiveCuePanel";
import { NarratorDesk } from "@/components/play/NarratorDesk";
import { PlayReference } from "@/components/play/PlayReference";
import { PublicEventLine } from "@/components/play/PublicEventLine";
import { HunterRevengePanel } from "@/components/play/HunterRevengePanel";
import { LoverCard } from "@/components/play/LoverCard";
import { NarratorSnapshotPanel } from "@/components/play/NarratorSnapshotPanel";
import { PrivateChatPanel, type PrivateChatScrollPosition } from "@/components/play/PrivateChatPanel";
import { PublicChatComposer } from "@/components/play/PublicChatComposer";
import { PublicChatHistory } from "@/components/play/PublicChatHistory";
import { ConnectionBanner } from "@/components/play/ConnectionBanner";
import { DeathRevealCinematic } from "@/components/play/DeathRevealCinematic";
import { Timer } from "@/components/play/Timer";
import { phaseBg } from "@/lib/play/phase-display";
import { PhaseTransitionOverlay } from "@/components/play/PhaseTransitionOverlay";
import { PlayActionDock } from "@/components/play/PlayActionDock";
import { PlayStage } from "@/components/play/PlayStage";
import { DeferredPostGameExtras } from "@/components/play/DeferredPostGameExtras";
import { PreGameCountdown } from "@/components/play/PreGameCountdown";
import { ReconnectModal } from "@/components/play/ReconnectModal";
import { NightActionPanel } from "@/components/play/NightActionPanel";
import { NominationPanel } from "@/components/play/NominationPanel";
import {
  buildPrimaryNightAction,
  needsSecondNightTarget,
  requiresExplicitNightActionChoice,
  roleHasNightAction,
  secondaryShortcutTargets,
  shortcutTargets,
} from "@/lib/play/night-actions";
import { VotingPanel } from "@/components/play/VotingPanel";
import { isNightPhase } from "@/lib/play/role-rules";
import { useCueMode } from "@/hooks/play/use-cue-mode";
import { useActionReceipt } from "@/hooks/play/use-action-receipt";
import { useLobbyNavigationGuard } from "@/hooks/play/use-lobby-navigation-guard";
import { useGameRoom, type UseGameRoomOptions, type UseGameRoomResult } from "@/hooks/play/use-game-room";
import { usePhaseTransitions } from "@/hooks/play/use-phase-transitions";
import type { AuthSessionView } from "@/lib/use-auth-session";
import { nightTargetHeadingBg, winnerBg } from "@/lib/play/copy";
import { nextPhaseTransitionArtHref } from "@/lib/play/phase-art";
import type { PhaseSlice, PublicPlayer, ShortcutState } from "@/lib/play/types";

export type { PhaseSlice, PublicPlayer } from "@/lib/play/types";

const AchievementUnlockModal = lazy(() => import("@/components/play/AchievementUnlockModal").then((module) => ({ default: module.AchievementUnlockModal })));
const RoleCard = lazy(() => import("@/components/play/RoleCard").then((module) => ({ default: module.RoleCard })));

interface PlayRoomClientProps {
  code: string;
  createOptions?: CreateRoomOptions;
  initialSession?: AuthSessionView | null;
}

type PlayRoomHook = (options: UseGameRoomOptions) => UseGameRoomResult;

export function PlayRoomClient(props: PlayRoomClientProps) {
  return <PlayRoomClientCore {...props} useRoom={useGameRoom} />;
}

export function PlayRoomClientCore({
  code,
  createOptions: createOptionsRaw,
  initialSession,
  useRoom,
}: PlayRoomClientProps & { useRoom: PlayRoomHook }) {
  const createOptions = createOptionsRaw;
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [secondTargetId, setSecondTargetId] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [actionDockExpanded, setActionDockExpanded] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [viewportModeReady, setViewportModeReady] = useState(false);
  const [mobileRailTab, setMobileRailTab] = useState<"events" | "chat">("events");
  const [mobileView, setMobileView] = useState<"table" | "conversation">("table");
  const [privateDrafts, setPrivateDrafts] = useState<Partial<Record<ChatChannel, string>>>({});
  const privateDraftRevisions = useRef<Partial<Record<ChatChannel, number>>>({});
  const privateSendRequests = useRef(new Map<ChatChannel, symbol>());
  const [pendingPrivateSends, setPendingPrivateSends] = useState<Partial<Record<ChatChannel, boolean>>>({});
  const [privateChatOpen, setPrivateChatOpen] = useState(false);
  const [privateVisibility, setPrivateVisibility] = useState<{ identity: string; visible: boolean } | null>(null);
  const [lastReadPrivateMessages, setLastReadPrivateMessages] = useState<Partial<Record<ChatChannel, string>>>({});
  const privateChatScrollPositions = useRef<Partial<Record<string, PrivateChatScrollPosition>>>({});
  const actionDockToggleRef = useRef<HTMLButtonElement>(null);
  const winnerHeadingRef = useRef<HTMLHeadingElement>(null);
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
    privateFactionRoster,
    privateLover,
    nightActionCapabilities,
    narratorSnapshot,
    privateChats,
    typingNotices,
    isBlessed,
    connectionMessage,
    connectionStatus,
    unlockedAchievementIds,
    setUnlockedAchievementIds,
    recordedGameId,
    reconnectNow,
    isPending,
  } = useRoom({
    code,
    createOptions,
    ...(initialSession === undefined ? {} : { initialSession }),
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

  const players = useMemo(() => snapshot?.players ?? [], [snapshot?.players]);
  const livingPlayers = useMemo(() => players.filter((player) => player.playing && player.alive), [players]);
  const ownPlayer = useMemo(() => players.find((player) => player.userId === currentUserId), [currentUserId, players]);
  const recentPublicEvents = useMemo(() => snapshot?.publicEvents.slice(-7) ?? [], [snapshot?.publicEvents]);
  const mode = snapshot?.mode ?? createOptions?.mode ?? "werewolves_classic";
  const family = getGameFamily(mode);
  const phase = snapshot?.phase ?? "lobby";
  const privateIdentity = `${code}:${currentUserId}`;
  const personalVisible = privateVisibility?.identity === privateIdentity
    ? privateVisibility.visible
    : !liveMode && phase !== "role_reveal";
  const actionReceipt = useActionReceipt(room, phase, snapshot?.round ?? 0, {
    viewerId: currentUserId,
    hasVoted: ownPlayer?.hasVoted,
    revoteEligibleUserIds: snapshot?.revoteEligibleUserIds,
    votingCycle: snapshot?.votingCycle,
  });
  const acceptedTargetName = actionReceipt && "targetUserId" in actionReceipt
    ? players.find((player) => player.userId === actionReceipt.targetUserId)?.displayName
    : null;
  useEffect(() => {
    setMobileView("table");
    setMobileRailTab(phase === "day_discussion" ? "chat" : "events");
  }, [phase]);
  useEffect(() => {
    for (const channel of Object.keys(privateDraftRevisions.current) as ChatChannel[]) {
      privateDraftRevisions.current[channel] = (privateDraftRevisions.current[channel] ?? 0) + 1;
    }
    setPrivateDrafts({});
    privateSendRequests.current.clear();
    setPendingPrivateSends({});
    setLastReadPrivateMessages({});
    privateChatScrollPositions.current = {};
    setPrivateChatOpen(false);
  }, [code, currentUserId]);
  useLobbyNavigationGuard({
    active: phase === "lobby" && connectionStatus === "connected" && Boolean(ownPlayer),
    host: Boolean(ownPlayer?.host),
  });
  const doctorCanSelfProtect =
    snapshot?.doctorCanSelfProtect ?? createOptions?.doctorCanSelfProtect ?? false;
  const nominations = snapshot?.nominations ?? [];
  const nomineeIds = useMemo(
    () => new Set(nominations.map((nomination) => nomination.targetUserId)),
    [nominations],
  );
  const revoteEligibleIds = useMemo(
    () => new Set(snapshot?.revoteEligibleUserIds ?? []),
    [snapshot?.revoteEligibleUserIds],
  );
  const isSportDayFlow = mode === "mafia_sport"
    && (phase === "day_discussion" || phase === "nomination" || phase === "defense" || phase === "voting");
  const canNominate = mode === "mafia_sport"
    && phase === "day_discussion"
    && snapshot?.currentSpeakerUserId === currentUserId
    && Boolean(ownPlayer?.playing && ownPlayer.alive);
  const canVote = phase === "voting" && Boolean(ownPlayer?.playing && ownPlayer.alive);
  const canUseHunterRevenge =
    phase === "hunter_revenge"
    && privateRole?.role === "hunter"
    && Boolean(ownPlayer?.playing && !ownPlayer.alive);
  const canUseNightAction = isNightPhase(phase)
    && Boolean(
      privateRole
        && ownPlayer?.playing
        && ownPlayer.alive
      && roleHasNightAction(privateRole.role, phase),
    );
  const eligibleVotingPlayers = useMemo(
    () => livingPlayers.filter((player) => {
      if (player.userId === privateLover?.loverUserId) {
        return false;
      }
      if (revoteEligibleIds.size > 0 && !revoteEligibleIds.has(player.userId)) {
        return false;
      }
      return mode !== "mafia_sport" || nomineeIds.has(player.userId);
    }),
    [livingPlayers, mode, nomineeIds, privateLover?.loverUserId, revoteEligibleIds],
  );
  const actionTargets = useMemo(() => {
    if (!canVote && !canNominate && !canUseHunterRevenge && !canUseNightAction) {
      return [];
    }
    if (canNominate) {
      return livingPlayers.filter((player) => player.userId !== currentUserId);
    }
    return shortcutTargets(phase, privateRole?.role, players, canVote ? eligibleVotingPlayers : livingPlayers, currentUserId, {
      doctorCanSelfProtect,
      nightActionCapabilities,
    });
  }, [canNominate, canUseHunterRevenge, canUseNightAction, canVote, currentUserId, doctorCanSelfProtect, eligibleVotingPlayers, livingPlayers, nightActionCapabilities, phase, players, privateRole?.role]);
  const secondaryActionTargets = useMemo(() => {
    if (!canUseNightAction || !needsSecondNightTarget(privateRole?.role, phase) || !selectedTargetId) {
      return [];
    }

    return secondaryShortcutTargets(phase, privateRole?.role, livingPlayers, currentUserId, selectedTargetId, {
      nightActionCapabilities,
    });
  }, [canUseNightAction, currentUserId, livingPlayers, nightActionCapabilities, phase, privateRole?.role, selectedTargetId]);
  const targetableIds = useMemo(() => {
    const primaryIds = new Set(actionTargets.map((player) => player.userId));
    if (needsSecondNightTarget(privateRole?.role, phase) && selectedTargetId && primaryIds.has(selectedTargetId)) {
      const ids = new Set(secondaryActionTargets.map((player) => player.userId));
      ids.add(selectedTargetId);
      return ids;
    }

    return primaryIds;
  }, [actionTargets, phase, privateRole?.role, secondaryActionTargets, selectedTargetId]);
  const keyboardActionTargets = useMemo(() => {
    if (
      needsSecondNightTarget(privateRole?.role, phase)
      && selectedTargetId
      && actionTargets.some((player) => player.userId === selectedTargetId)
    ) {
      return secondaryActionTargets;
    }

    return actionTargets;
  }, [actionTargets, phase, privateRole?.role, secondaryActionTargets, selectedTargetId]);
  const shortcutNumbers = useMemo(
    () => new Map(keyboardActionTargets.slice(0, 9).map((player, index) => [player.userId, index + 1])),
    [keyboardActionTargets],
  );
  const voteCounts = useMemo(
    () => new Map((snapshot?.voteTally ?? []).map((item) => [item.targetUserId, item.count])),
    [snapshot?.voteTally],
  );

  useEffect(() => {
    const preloadHref = nextPhaseArtPreloadHref(phase, family);
    if (!preloadHref || typeof window.Image !== "function") {
      return;
    }

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
      return;
    }

    const preload = () => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = preloadHref;
    };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(preload, { timeout: 2_500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(preload, 1_500);
    return () => window.clearTimeout(timeoutId);
  }, [family, phase]);

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(max-width: 1023px)");
    const updateCompactViewport = () => {
      setIsCompactViewport(query.matches);
      setViewportModeReady(true);
    };

    updateCompactViewport();
    query.addEventListener("change", updateCompactViewport);

    return () => query.removeEventListener("change", updateCompactViewport);
  }, []);

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
      actionTargets: keyboardActionTargets,
      currentUserId,
      ownPlayer,
      canNominate,
      showShortcuts,
      liveMode,
    };
  });

  function sendReady() {
    room?.send("ready", { ready: !ownPlayer?.ready });
  }

  function sendNightAction(action: NightActionCommand) {
    room?.send("submitNightAction", { action });
  }

  function sendVote(targetUserId: string) {
    room?.send("submitVote", { targetUserId });
  }

  function sendNomination(targetUserId: string) {
    room?.send("submitNomination", { targetUserId });
  }

  // Keep the seat-selection logic in a ref so the callback identity is stable.
  // Seats are memoised and the keyboard handler is bound once; a closure that
  // captured stale selectedTargetId/secondTargetId would break two-target roles
  // (the second click would overwrite the primary instead of setting a second).
  const seatSelectionRef = useRef({
    selectedTargetId,
    secondTargetId,
    role: privateRole?.role,
    phase,
    targetableIds,
  });
  seatSelectionRef.current = {
    selectedTargetId,
    secondTargetId,
    role: privateRole?.role,
    phase,
    targetableIds,
  };

  const selectSeatTarget = useCallback((targetUserId: string) => {
    const { selectedTargetId, secondTargetId, role, phase, targetableIds } = seatSelectionRef.current;
    if (!targetableIds.has(targetUserId)) {
      return;
    }

    const needsSecondSeat = needsSecondNightTarget(role, phase);

    if (needsSecondSeat && selectedTargetId && selectedTargetId !== targetUserId) {
      setSecondTargetId((current) => (current === targetUserId ? "" : targetUserId));
      return;
    }

    if (selectedTargetId === targetUserId) {
      setSelectedTargetId("");
      setSecondTargetId("");
      return;
    }

    setSelectedTargetId(targetUserId);
    if (secondTargetId === targetUserId) {
      setSecondTargetId("");
    }
  }, []);

  const resetPrimaryNightTarget = useCallback(() => {
    setSelectedTargetId("");
    setSecondTargetId("");
    if (isCompactViewport) {
      setActionDockExpanded(false);
      window.requestAnimationFrame(() => actionDockToggleRef.current?.focus());
    }
  }, [isCompactViewport]);

  // Stable management callbacks (seats are memoised and ignore callback props, so
  // these must keep a constant identity and read the live room from a ref).
  const roomRef = useRef(room);
  roomRef.current = room;
  const handleMakeNarrator = useCallback((targetUserId: string) => {
    roomRef.current?.send("setNarrator", { targetUserId, narrator: true });
  }, []);
  const handleMakeMayor = useCallback((targetUserId: string) => {
    roomRef.current?.send("setMayor", { targetUserId });
  }, []);

  useEffect(() => {
    if (!viewportModeReady) {
      return;
    }
    const phaseHasPrimaryDockAction =
      phase === "lobby"
      || canVote
      || canNominate
      || canUseHunterRevenge
      || canUseNightAction
      || isSportDayFlow;
    const isAwaitingSecondTarget =
      isCompactViewport
      && needsSecondNightTarget(privateRole?.role, phase)
      && Boolean(selectedTargetId)
      && !secondTargetId;
    const shouldForceExpandDock =
      phase === "role_reveal"
      || Boolean(secondTargetId)
      || (Boolean(selectedTargetId) && !isAwaitingSecondTarget);
    const shouldAutoExpand =
      shouldForceExpandDock
      || (!isCompactViewport && phaseHasPrimaryDockAction);

    if (shouldAutoExpand) {
      setActionDockExpanded(true);
    } else if (isCompactViewport && phaseHasPrimaryDockAction
      && !actionDockToggleRef.current?.closest("[data-play-command-surface]")?.contains(document.activeElement)) {
      // Clearing an inline choice must not hide the focused control.
      setActionDockExpanded(false);
    }
  }, [canNominate, canUseHunterRevenge, canUseNightAction, canVote, isCompactViewport, isSportDayFlow, phase, privateRole?.role, secondTargetId, selectedTargetId, viewportModeReady]);

  useEffect(() => {
    if (selectedTargetId && !targetableIds.has(selectedTargetId)) {
      setSelectedTargetId("");
    }
    if (secondTargetId && !targetableIds.has(secondTargetId)) {
      setSecondTargetId("");
    }
  }, [secondTargetId, selectedTargetId, targetableIds]);

  const submitCurrentShortcutAction = useCallback(() => {
    const current = shortcutStateRef.current;
    if (!current?.room) {
      return;
    }

    if (current.phase === "voting" && current.selectedTargetId) {
      current.room.send("submitVote", { targetUserId: current.selectedTargetId });
      return;
    }

    if (current.canNominate && current.selectedTargetId) {
      current.room.send("submitNomination", { targetUserId: current.selectedTargetId });
      return;
    }

    if (current.phase === "hunter_revenge" && current.privateRole?.role === "hunter" && current.selectedTargetId) {
      current.room.send("submitHunterRevenge", { targetUserId: current.selectedTargetId });
      return;
    }

    if (isNightPhase(current.phase) && current.privateRole) {
      const action = buildPrimaryNightAction(
        current.privateRole.role,
        current.selectedTargetId,
        current.secondTargetId,
        current.phase,
        { nightActionCapabilities },
      );
      if (action) {
        current.room.send("submitNightAction", { action });
      } else if (current.selectedTargetId && requiresExplicitNightActionChoice(current.privateRole.role, current.phase)) {
        toast({ message: "Избери конкретния бутон за това нощно действие.", kind: "info" });
      }
    }
  }, [nightActionCapabilities, toast]);

  async function sendChatMessage(channel: ChatChannel, message: string) {
    if (!room) {
      toast({ message: "Съобщението остана в полето, защото връзката със стаята е прекъсната.", kind: "error" });
      return false;
    }

    try {
      const response = await room.request("sendChat", { channel, message }) as { accepted?: unknown } | undefined;
      if (response?.accepted !== true) {
        return false;
      }
      return true;
    } catch (error) {
      console.error("Chat delivery request failed", error);
      toast({ message: "Съобщението не беше изпратено. Текстът е запазен, за да опиташ отново.", kind: "error" });
      return false;
    }
  }

  async function sendPrivateChatMessage(channel: ChatChannel, message: string) {
    if (privateSendRequests.current.has(channel)) return false;
    const request = Symbol();
    privateSendRequests.current.set(channel, request);
    setPendingPrivateSends((pending) => ({ ...pending, [channel]: true }));
    try {
      return await sendChatMessage(channel, message);
    } finally {
      if (privateSendRequests.current.get(channel) === request) {
        privateSendRequests.current.delete(channel);
        setPendingPrivateSends((pending) => ({ ...pending, [channel]: false }));
      }
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
  const startDisabledReason = !room
    ? "Изчакай връзката със стаята да се възстанови."
    : !fullNarratorAccepted
      ? "Всички играчи трябва да приемат, че Разказвачът ще вижда тайните роли."
      : startCountdown !== null
        ? "Стартът вече е заявен."
        : null;
  const privateChatChannel = getAvailablePrivateChatChannel(privateRole?.role, ownPlayer, phase, snapshot?.communicationMode);
  const privateChatIdentity = `${privateIdentity}:${privateChatChannel}`;
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
  const privateChatActive = privateChatOpen && personalVisible && (!isCompactViewport || mobileView === "table");
  const markPrivateMessageRead = useCallback((messageId: string) => {
    if (!privateChatActive || !privateChatChannel || document.visibilityState !== "visible") return;
    setLastReadPrivateMessages((read) => {
      const nextIndex = privateChannelMessages.findIndex((message) => message.id === messageId);
      const previousIndex = privateChannelMessages.findIndex((message) => message.id === read[privateChatChannel]);
      return nextIndex > previousIndex ? { ...read, [privateChatChannel]: messageId } : read;
    });
  }, [privateChatActive, privateChatChannel, privateChannelMessages]);
  const lastReadPrivateMessage = privateChatChannel ? lastReadPrivateMessages[privateChatChannel] : undefined;
  const lastReadIndex = privateChannelMessages.findIndex((message) => message.id === lastReadPrivateMessage);
  const unreadPrivateMessages = privateChannelMessages.slice(lastReadIndex + 1)
    .filter((message) => message.senderUserId !== currentUserId).length;
  const hasStageTakeover = Boolean(snapshot?.winnerTeam);

  useEffect(() => {
    if (hasStageTakeover) {
      winnerHeadingRef.current?.focus();
    }
  }, [hasStageTakeover, snapshot?.winnerTeam]);
  const hasNarratorDesk = Boolean(snapshot && phase !== "lobby" && (ownPlayer?.host || ownPlayer?.narrator));
  const hasNarratorWarning = Boolean(
    snapshot?.narratorMode === "full_human" && ownPlayer && !ownPlayer.acceptedFullNarrator,
  );
  const hasNarratorSnapshotPanel = Boolean(narratorSnapshot && ownPlayer?.narrator);
  const hasNarratorDeck = Boolean(
    !hasStageTakeover && (hasNarratorDesk || hasNarratorWarning || hasNarratorSnapshotPanel),
  );
  const hasDockRitualPanel = Boolean(
    canVote || canNominate || canUseHunterRevenge || canUseNightAction || privateChatChannel || isSportDayFlow,
  );
  const hasPrimaryDockContent = Boolean(
    phase === "lobby" || canVote || canNominate || canUseHunterRevenge || canUseNightAction || isSportDayFlow,
  );
  const hasActionDock = !hasStageTakeover && hasPrimaryDockContent;
  const actionDockKind =
    canVote || canNominate || canUseHunterRevenge || canUseNightAction
      ? "action"
      : phase === "lobby"
        ? "lobby"
        : "quiet";
  const selectedActionTargetName = players.find((player) => player.userId === selectedTargetId)?.displayName;
  const currentDefenseName = players.find((player) => player.userId === snapshot?.currentDefenseUserId)?.displayName;
  const actionDockHeading = canNominate
    ? `Твоята ${snapshot?.playerSpeechSeconds ?? 60}-секундна реч`
    : canVote
      ? "Твоят глас"
      : canUseHunterRevenge
      ? selectedActionTargetName
        ? `Последен изстрел срещу ${selectedActionTargetName}`
        : "Последен изстрел · избери цел"
      : canUseNightAction
        ? selectedActionTargetName && privateRole
          ? nightTargetHeadingBg(privateRole.role, selectedActionTargetName)
          : "Нощен ход · избери цел"
        : phase === "lobby"
          ? ownPlayer?.ready
            ? "Готов си за началото"
            : "Потвърди готовност"
          : phase === "nomination"
            ? "Номинациите са отворени"
            : phase === "defense"
              ? currentDefenseName
                ? `${currentDefenseName} защитава мястото си`
                : "Защита на номинираните"
          : phase === "role_reveal"
            ? "Картата ти е раздадена"
          : ownPlayer?.playing && !ownPlayer.alive
            ? "Твоята игра продължава отстрани"
          : privateChatChannel
            ? "Тайният разговор е отворен"
            : "Твоето досие";
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const current = shortcutStateRef.current;

      if (event.defaultPrevented || target?.closest('[role="dialog"]')) {
        return;
      }

      if (event.key === "Escape") {
        if (isTextEntryShortcutTarget(target)) {
          return;
        }
        event.preventDefault();
        if (current?.showShortcuts) {
          setShowShortcuts(false);
        } else {
          setSelectedTargetId("");
          setSecondTargetId("");
        }
        return;
      }

      const focusedSeatId = target
        ?.closest<HTMLElement>("[data-seat-user-id]")
        ?.dataset.seatUserId;
      if (
        event.key === "Enter"
        && focusedSeatId
        && current
        && (current.selectedTargetId === focusedSeatId || current.secondTargetId === focusedSeatId)
      ) {
        event.preventDefault();
        submitCurrentShortcutAction();
        return;
      }

      if (isInteractiveShortcutTarget(target)) {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShowShortcuts((value) => !value);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        submitCurrentShortcutAction();
        return;
      }

      if (!current) {
        return;
      }

      if (
        event.code === "KeyP" &&
        !event.repeat &&
        (current.ownPlayer?.host || current.ownPlayer?.narrator) &&
        current.phase !== "paused" &&
        current.phase !== "game_over"
      ) {
        event.preventDefault();
        current.room?.send("narratorPause");
        return;
      }

      if ((current.canNominate || current.phase === "voting" || current.phase === "hunter_revenge" || isNightPhase(current.phase)) && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const targetPlayer = current.actionTargets[index];
        if (targetPlayer) {
          event.preventDefault();
          selectSeatTarget(targetPlayer.userId);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectSeatTarget, submitCurrentShortcutAction, toast]);

  const renderPlayersPanel = () => {
    const eventsTabId = "play-rail-tab-events";
    const chatTabId = "play-rail-tab-chat";
    const eventsPanelId = "play-rail-panel-events";
    const chatPanelId = "play-rail-panel-chat";
    const chatInputId = "play-public-chat-input";
    const showRailDeathReveal = phase === "day_announcement" || phase === "resolution" || phase === "hunter_revenge";
    const handleRailTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const nextTab = event.key === "ArrowLeft" || event.key === "Home" ? "events" : "chat";
      setMobileRailTab(nextTab);
      window.requestAnimationFrame(() => {
        document.getElementById(nextTab === "events" ? eventsTabId : chatTabId)?.focus();
      });
    };

    return (
      <section className="play-section play-players-panel play-side-rail" aria-label="Разговор и събития">
        <div className="play-rail-tabs" role="tablist" aria-label="Хроника и разговор">
          <button
            id={eventsTabId}
            className="play-rail-tab"
            type="button"
            role="tab"
            aria-selected={mobileRailTab === "events"}
            aria-controls={eventsPanelId}
            tabIndex={mobileRailTab === "events" ? 0 : -1}
            onClick={() => setMobileRailTab("events")}
            onKeyDown={handleRailTabKeyDown}
          >
            <ScrollText aria-hidden strokeWidth={1.8} />
            Събития
          </button>
          <button
            id={chatTabId}
            className="play-rail-tab"
            type="button"
            role="tab"
            aria-selected={mobileRailTab === "chat"}
            aria-controls={chatPanelId}
            tabIndex={mobileRailTab === "chat" ? 0 : -1}
            onClick={() => setMobileRailTab("chat")}
            onKeyDown={handleRailTabKeyDown}
          >
            <MessageSquare aria-hidden strokeWidth={1.8} />
            Разговор
          </button>
        </div>

        <div
          id={eventsPanelId}
          className="play-rail-panel mt-8"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={eventsTabId}
          hidden={mobileRailTab !== "events"}
          data-mobile-panel="events"
          data-active={mobileRailTab === "events" ? "true" : undefined}
        >
          <div
            className="mt-3 grid gap-2 text-sm"
            role="log"
            aria-label="Събития"
            aria-live="polite"
            aria-relevant="additions"
          >
            {(snapshot?.publicEvents ?? []).length === 0 ? (
              <p className="event-line event-line-empty rounded-xl px-3 py-2">
                Събитията ще се появят тук, когато играта започне.
              </p>
            ) : null}
            {recentPublicEvents.map((event) => (
              <PublicEventLine key={event.id} event={event} />
            ))}
          </div>
        </div>

        <div
          id={chatPanelId}
          className="play-rail-panel mt-8"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={chatTabId}
          hidden={mobileRailTab !== "chat"}
          data-mobile-panel="chat"
          data-active={mobileRailTab === "chat" ? "true" : undefined}
        >
          {phase === "day_discussion" && snapshot?.communicationMode === "built_in_chat" ? (
            ownPlayer?.playing && ownPlayer?.alive ? (
              <PublicChatComposer
                key={`${code}:${currentUserId}`}
                inputId={chatInputId}
                typingNotices={publicTypers}
                onSend={(message) => sendChatMessage("public", message)}
                onTyping={(active) => sendTypingSignal("public", active)}
              />
            ) : (
              <div className="play-muted-note">
                <EyeOff className="play-section-icon" aria-hidden strokeWidth={1.8} />
                <span>
                  {ownPlayer?.playing
                    ? "Елиминираните играчи могат да четат, но не и да пишат в дневния разговор."
                    : "Разказвачите и наблюдателите не пишат в дневния разговор."}
                </span>
              </div>
            )
          ) : null}

          {phase === "day_discussion" && snapshot?.communicationMode !== "built_in_chat" ? (
            <div className="play-muted-note">
              <EyeOff className="play-section-icon" aria-hidden strokeWidth={1.8} />
              <span>В тази стая публичният разговор е изключен. Използвайте външен разговор, игра на живо или указанията на Разказвача.</span>
            </div>
          ) : null}

          {phase !== "day_discussion" && snapshot?.communicationMode === "built_in_chat" ? (
            <div className="play-muted-note">
              <MessageSquare className="play-section-icon" aria-hidden strokeWidth={1.8} />
              <span>Писането в публичния разговор се отваря през дневната дискусия.</span>
            </div>
          ) : null}

          <PublicChatHistory key={code} messages={snapshot?.publicChat ?? []} />
        </div>

        {showRailDeathReveal ? <DeathRevealCinematic family={family} players={players} /> : null}
        <div className="play-console-tools">
          {snapshot ? <PlayReference snapshot={snapshot} privateRole={privateRole?.role} ownPlayer={ownPlayer} /> : null}
          <LiveCuePanel cueMode={cueMode} liveMode={liveMode} phase={phase} pulseKey={phasePulse} onChange={changeCueMode} />
        </div>
      </section>
    );
  };

  const renderLobbyReadiness = () => (
    <>
      <div className="play-lobby-ready-actions">
        <button
          data-testid="ready-toggle"
          className={`btn ${ownPlayer?.ready || ownPlayer?.host ? "btn-secondary" : "btn-primary"}`}
          type="button"
          onClick={sendReady}
          disabled={!room}
          aria-pressed={Boolean(ownPlayer?.ready)}
        >
          <Users className="play-button-icon" aria-hidden strokeWidth={1.8} />
          {ownPlayer?.ready ? "Не съм готов" : "Готов"}
        </button>
        {ownPlayer?.host ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={requestStartGame}
            disabled={startDisabledReason !== null}
            aria-describedby={startDisabledReason ? "play-start-disabled-reason" : undefined}
          >
            <Play className="play-button-icon" aria-hidden strokeWidth={1.8} />
            {startCountdown ? "Започваме..." : "Започни игра"}
          </button>
        ) : null}
      </div>
      {ownPlayer?.host && startDisabledReason ? (
        <p id="play-start-disabled-reason" className="play-start-disabled-reason" role="status">
          {startDisabledReason}
        </p>
      ) : null}
    </>
  );

  const renderLobbyControls = () => {
    if (phase !== "lobby") {
      return null;
    }

    return (
      <div className="play-lobby-dock-actions">
        {!isCompactViewport ? renderLobbyReadiness() : null}
        <button className="btn btn-secondary" type="button" onClick={async () => {
          try {
            const invite = new URL(`/lobby/${encodeURIComponent(code)}`, window.location.origin);
            await navigator.clipboard.writeText(invite.href);
            toast({ message: "Поканата е копирана.", kind: "success" });
          } catch {
            toast({ message: `Не успяхме да копираме поканата. Кодът на стаята е ${code}.`, kind: "error" });
          }
        }}>
          <Copy className="play-button-icon" aria-hidden /> Копирай покана
        </button>
        {ownPlayer?.host && players.some((player) => player.playing && !player.ready) ? (
          <p className="play-lobby-readiness-note">Не всички са готови. Като домакин можеш да започнеш и без потвърждението им.</p>
        ) : null}
        <p className="play-lobby-navigation-note">
          {ownPlayer?.host
            ? "При напускане друг участник може да стане домакин. Връщането назад не възстановява домакинството."
            : "При напускане освобождаваш мястото си в стаята."}
          {" "}<a href="/faq" target="_blank" rel="noopener noreferrer">
            Помощ (нов раздел) <ExternalLink className="play-button-icon" aria-hidden />
          </a>
        </p>
      </div>
    );
  };

  const renderStageTakeover = () => {
    if (!hasStageTakeover || !snapshot?.winnerTeam) {
      return null;
    }

    return (
      <div className="play-stage-takeover" data-family={family} data-winner={snapshot.winnerTeam} role="status" aria-live="polite" aria-atomic="true">
        <div className="play-winner-scene" aria-hidden="true" />
        <article className={`play-winner faction-${snapshot.winnerTeam}`} data-winner={snapshot.winnerTeam}>
          <p className="play-winner-kicker">край на играта · стая {code}</p>
          <h1 ref={winnerHeadingRef} className="play-winner-title" tabIndex={-1}>{winnerBg(snapshot.winnerTeam, family)}</h1>
          {snapshot.winnerReasonBg ? <p className="play-winner-reason">{snapshot.winnerReasonBg}</p> : null}
          <DeferredPostGameExtras section="actions" snapshot={snapshot} recordedGameId={recordedGameId} currentUserId={currentUserId} />
        </article>
        <DeferredPostGameExtras section="story" snapshot={snapshot} recordedGameId={recordedGameId} currentUserId={currentUserId} />
      </div>
    );
  };

  const renderActionDock = () => {
    if (!hasActionDock) {
      return null;
    }

    return (
      <PlayActionDock
        eyebrow={phase === "lobby" ? "преди началото" : isSportDayFlow || canVote ? "дневен ред" : "личен ход"}
        privateAction={canUseNightAction}
        heading={actionDockHeading}
        kind={actionDockKind}
        compact={isCompactViewport}
        expanded={actionDockExpanded}
        onExpandedChange={setActionDockExpanded}
        toggleRef={actionDockToggleRef}
        compactSummary={phase === "lobby" ? renderLobbyReadiness() : null}
        primaryContent={hasPrimaryDockContent ? (
          <>
            {actionReceipt ? (
              <div className="play-action-receipt" role="status" aria-live="polite">
                <Check aria-hidden />
                <div>
                  <strong>{actionReceipt.kind === "night"
                    ? "Нощният ход е приет"
                    : actionReceipt.targetUserId === "skip"
                      ? "Пропускането на гласа е прието"
                      : `${actionReceipt.kind === "vote" ? "Приет глас" : actionReceipt.kind === "nomination" ? "Приета номинация" : "Приет изстрел"}${acceptedTargetName ? `: ${acceptedTargetName}` : ""}`}</strong>
                  {actionReceipt.kind !== "revenge" ? <p>Нов избор на масата не променя изпратения ход, докато не го потвърдиш.</p> : null}
                </div>
              </div>
            ) : null}
            {renderLobbyControls()}

            {isSportDayFlow ? (
              <NominationPanel
                phase={phase}
                players={players}
                currentUserId={currentUserId}
                currentSpeakerUserId={snapshot?.currentSpeakerUserId ?? ""}
                currentDefenseUserId={snapshot?.currentDefenseUserId ?? ""}
                nominations={nominations}
                canNominate={canNominate}
                selectedTargetId={selectedTargetId}
                onNominate={sendNomination}
                onSelectNominee={canVote ? selectSeatTarget : undefined}
                selectableNomineeIds={targetableIds}
              />
            ) : null}

            {canUseNightAction && privateRole ? (
              <NightActionPanel
                players={players}
                livingPlayers={livingPlayers}
                currentUserId={currentUserId}
                doctorCanSelfProtect={doctorCanSelfProtect}
                phase={phase}
                privateRole={privateRole.role}
                privateFactionRoster={privateFactionRoster}
                nightActionCapabilities={nightActionCapabilities}
                selectedTargetId={selectedTargetId}
                secondTargetId={secondTargetId}
                onResetPrimaryTarget={resetPrimaryNightTarget}
                sendNightAction={sendNightAction}
              />
            ) : null}

            {canVote ? (
              <VotingPanel
                currentUserId={currentUserId}
                livingPlayers={eligibleVotingPlayers}
                selectedTargetId={selectedTargetId}
                voteTally={snapshot?.voteTally ?? []}
                allowSkipVote={Boolean(snapshot?.allowSkipVote) && revoteEligibleIds.size === 0}
                sendVote={sendVote}
              />
            ) : null}

            {canUseHunterRevenge ? (
              <HunterRevengePanel
                currentUserId={currentUserId}
                livingPlayers={livingPlayers}
                selectedTargetId={selectedTargetId}
                sendHunterRevenge={(targetUserId) => room?.send("submitHunterRevenge", { targetUserId })}
              />
            ) : null}
          </>
        ) : null}
      />
    );
  };

  const renderPersonalArea = () => {
    if (phase === "lobby" || hasStageTakeover || !(privateRole || privateLover || isBlessed || privateChatChannel)) return null;
    const draftRevision = privateChatChannel ? privateDraftRevisions.current[privateChatChannel] ?? 0 : 0;
    const rolePlaceholder = <p className="play-personal-loading" role="status">Зарежда се картата...</p>;
    return (
      <section className="play-personal-area" aria-label="Твоята роля" data-concealed={!personalVisible || undefined}>
        <button
          className="play-personal-toggle"
          type="button"
          aria-label={personalVisible ? "Скрий ролята" : "Виж ролята си"}
          title={personalVisible ? "Скрий ролята" : "Виж ролята си"}
          aria-expanded={personalVisible}
          aria-controls="play-personal-content"
          onClick={() => setPrivateVisibility({ identity: privateIdentity, visible: !personalVisible })}
        >
          {personalVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {!personalVisible ? <span>Виж ролята си</span> : null}
        </button>
        {!personalVisible ? <p className="play-personal-concealed">Твоята карта е скрита.</p> : null}
        <div id="play-personal-content" hidden={!personalVisible}>
          {personalVisible ? <>
            <Suspense fallback={rolePlaceholder}>
              {viewportModeReady
                ? <RoleCard role={privateRole} result={privateResult} players={players} family={family} presentation={isCompactViewport ? "mini" : "compact"} />
                : rolePlaceholder}
            </Suspense>
            {privateLover ? <LoverCard lover={privateLover} /> : null}

            {isBlessed ? (
              <article className="play-personal-context play-blessed-card">
                <p className="section-kicker">тайна закрила</p>
                <h2>Свещеникът те благослови</h2>
                <p>
                  Благословията остава върху теб до края на играта и спира нощни убийства срещу теб.
                </p>
              </article>
            ) : null}

            {privateChatChannel ? (
              <details className="play-private-conversation" open={privateChatOpen} onToggle={(event) => setPrivateChatOpen(event.currentTarget.open)}>
                <summary><MessageSquare aria-hidden /> Личен разговор{unreadPrivateMessages > 0 ? <span className="play-private-unread">{unreadPrivateMessages} {unreadPrivateMessages === 1 ? "ново" : "нови"}</span> : null}</summary>
              <PrivateChatPanel
                key={privateChatIdentity}
                channel={privateChatChannel}
                messages={privateChannelMessages}
                active={privateChatActive}
                initialScrollPosition={privateChatScrollPositions.current[privateChatIdentity]}
                onScrollPositionChange={(position) => { privateChatScrollPositions.current[privateChatIdentity] = position; }}
                onRead={markPrivateMessageRead}
                onSend={sendPrivateChatMessage}
                sending={pendingPrivateSends[privateChatChannel] ?? false}
                onTyping={sendTypingSignal}
                typingNotices={privateTypers}
                value={privateDrafts[privateChatChannel] ?? ""}
                onValueChange={(value) => {
                  privateDraftRevisions.current[privateChatChannel] = (privateDraftRevisions.current[privateChatChannel] ?? 0) + 1;
                  setPrivateDrafts((drafts) => ({ ...drafts, [privateChatChannel]: value }));
                }}
                onAccepted={(submittedValue) => {
                  // A hidden chat can still receive its acknowledgement; only clear that exact draft revision.
                  if ((privateDraftRevisions.current[privateChatChannel] ?? 0) !== draftRevision) return;
                  privateDraftRevisions.current[privateChatChannel] = draftRevision + 1;
                  setPrivateDrafts((drafts) => drafts[privateChatChannel] === submittedValue
                    ? { ...drafts, [privateChatChannel]: "" }
                    : drafts);
                  sendTypingSignal(privateChatChannel, false);
                }}
              />
              </details>
            ) : null}
          </> : null}
        </div>
      </section>
    );
  };

  const renderNarratorDeck = () => {
    if (!hasNarratorDeck) {
      return null;
    }

    return (
      <section className="play-narrator-deck" aria-label="Команден панел на Разказвача">
        <div className="play-narrator-deck-scroll">
          {hasNarratorDesk && snapshot ? (
            <NarratorDesk
              room={room}
              snapshot={snapshot}
              phase={phase}
              family={family}
              isNarrator={Boolean(ownPlayer?.narrator)}
              onOpenShortcuts={() => setShowShortcuts(true)}
            />
          ) : null}

          {hasNarratorWarning ? (
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

          {hasNarratorSnapshotPanel && narratorSnapshot ? (
            <NarratorSnapshotPanel snapshot={narratorSnapshot} />
          ) : null}
        </div>
      </section>
    );
  };

  return (
    <main className="shell game-shell play-shell framed-shell" data-phase={phase} data-family={family}>
      {showPhaseTransition ? (
        <PhaseTransitionOverlay phase={phase} mode={mode} narratorVoice={snapshot?.narratorVoice ?? "classic"} pulseKey={phasePulse} />
      ) : null}
      <PreGameCountdown value={startCountdown} />
      {connectionStatus === "reconnecting" || connectionStatus === "lost" || connectionStatus === "error" ? (
        <ReconnectModal
          status={connectionStatus}
          message={connectionMessage}
          onRetry={reconnectNow}
        />
      ) : null}
      {showShortcuts ? <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} /> : null}
      {unlockedAchievementIds.length > 0 ? (
        <Suspense fallback={null}>
          <AchievementUnlockModal achievementIds={unlockedAchievementIds} onClose={() => setUnlockedAchievementIds([])} />
        </Suspense>
      ) : null}
      <div className="framed-shell-inner play-shell-inner">
        <ConnectionBanner status={connectionStatus} message={connectionMessage} />
        {!hasStageTakeover ? (
          <nav className="play-mobile-navigation" aria-label="Изглед на играта">
            <button type="button" aria-label="Към масата" aria-pressed={mobileView === "table"} onClick={() => setMobileView("table")}>
              <Users aria-hidden /> Масата
            </button>
            <button type="button" aria-label="Към разговора" aria-pressed={mobileView === "conversation"} onClick={() => {
              setMobileView("conversation");
              setMobileRailTab("chat");
              setActionDockExpanded(false);
            }}>
              <MessageSquare aria-hidden /> Разговор
            </button>
          </nav>
        ) : null}
        <section
          className="play-layout"
          data-mobile-view={mobileView}
          data-dock-expanded={actionDockExpanded ? "true" : undefined}
          data-has-narrator-deck={hasNarratorDeck ? "true" : undefined}
          data-dock-has-ritual={hasDockRitualPanel ? "true" : undefined}
          data-stage-takeover={hasStageTakeover ? "true" : undefined}
        >
          <div className="play-primary-column">
            {hasStageTakeover ? null : <PlayStage
              code={code}
              phase={phase}
              mode={mode}
              family={family}
              round={snapshot?.round ?? 0}
              phaseEndsAt={snapshot?.phaseEndsAt ?? 0}
              isPending={isPending}
              players={players}
              hasSnapshot={Boolean(snapshot)}
              narratorMode={snapshot?.narratorMode ?? "automatic"}
              communicationMode={snapshot?.communicationMode ?? "built_in_chat"}
              ownPlayer={ownPlayer}
              targetableIds={targetableIds}
              shortcutNumbers={shortcutNumbers}
              selectedTargetId={selectedTargetId}
              secondTargetId={secondTargetId}
              voteCounts={voteCounts}
              currentSpeakerUserId={snapshot?.currentSpeakerUserId ?? ""}
              currentDefenseUserId={snapshot?.currentDefenseUserId ?? ""}
              nomineeIds={nomineeIds}
              onSelectSeat={selectSeatTarget}
              onMakeNarrator={handleMakeNarrator}
              onMakeMayor={handleMakeMayor}
            />}
            {renderStageTakeover()}
            {renderPersonalArea()}
            {renderNarratorDeck()}
          </div>
          {hasStageTakeover ? null : (
            <div className="play-interaction-column" data-has-command={hasActionDock || undefined}>
              {renderActionDock()}
              {isCompactViewport && mobileView === "conversation" ? (
                <div className="play-conversation-context">
                  <div><span>Стая {code} · рунд {snapshot?.round ?? 0}</span><h1>{phaseBg(phase, mode)}</h1></div>
                  <Timer endsAt={snapshot?.phaseEndsAt ?? 0} />
                </div>
              ) : null}
              {renderPlayersPanel()}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function isInteractiveShortcutTarget(target: HTMLElement | null) {
  if (!target) {
    return false;
  }

  return Boolean(target.closest(
    "a, button, input, textarea, select, summary, [role='button'], [role='tab'], [role='switch'], [role='menuitem'], [contenteditable='true']",
  ));
}

function isTextEntryShortcutTarget(target: HTMLElement | null) {
  if (!target) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
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

function nextPhaseArtPreloadHref(phase: GamePhase, family: GameFamily) {
  const isMobile = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 720px)").matches;
  return nextPhaseTransitionArtHref(phase, family, isMobile);
}
