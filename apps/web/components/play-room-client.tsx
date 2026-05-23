"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import type { Room } from "@colyseus/sdk";
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
  type GameFamily,
  type GameMode,
  type GamePhase,
  type NightActionCommand,
  type NarratorVoice,
  type RoleCode,
} from "@werewolf/shared";
import { authClient } from "@/lib/auth-client";
import { createGameClient, GAME_ROOM_NAME } from "@/lib/colyseus-client";
import { playCue, setSoundEnabled } from "@/lib/sound";
import { useToast } from "@/lib/toast";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { LiveCuePanel } from "@/components/play/LiveCuePanel";
import { NarratorDesk } from "@/components/play/NarratorDesk";
import { RulesSummary } from "@/components/play/RulesSummary";
import { isCueMode, triggerDeviceCue } from "@/lib/play/device-cues";
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
import { arePhaseSlicesEqual, arePlayerListsEqual } from "@/lib/play/equality";
import { canFactionKill, isNightPhase } from "@/lib/play/role-rules";
import { phaseBg, phaseSigil } from "@/lib/play/phase-display";
import {
  communicationBg,
  modeBg,
  winnerBg,
} from "@/lib/play/copy";
import type {
  ConnectionStatus,
  CueMode,
  GameSnapshot,
  NarratorRoleSnapshot,
  PhaseSlice,
  PrivateChatMessage,
  PrivateLover,
  PrivateResult,
  PublicChatMessage,
  PublicEvent,
  PublicPlayer,
  PublicRoleCount,
  ShortcutState,
  TypingNotice,
  VoteTallyItem,
} from "@/lib/play/types";

export type { PhaseSlice, PublicPlayer } from "@/lib/play/types";

const CUE_MODE_STORAGE_KEY = "werewolf-cue-mode";
const ROOM_RECONNECT_STORAGE_PREFIX = "room-reconnect";
const MAX_RECONNECT_ATTEMPTS = 5;

function createRoomOptionsSignature(options: CreateRoomOptions | undefined) {
  return JSON.stringify(options ?? null);
}

export function PlayRoomClient({ code, createOptions: createOptionsRaw }: { code: string; createOptions?: CreateRoomOptions }) {
  const createOptionsSignature = createRoomOptionsSignature(createOptionsRaw);
  const createOptionsRef = useRef<{ signature: string; value: CreateRoomOptions | undefined }>({
    signature: createOptionsSignature,
    value: createOptionsRaw,
  });
  if (createOptionsRef.current.signature !== createOptionsSignature) {
    createOptionsRef.current = { signature: createOptionsSignature, value: createOptionsRaw };
  }
  const createOptions = createOptionsRef.current.value;
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [baseSnapshot, setBaseSnapshot] = useState<GameSnapshot | null>(null);
  const [playersSlice, setPlayersSlice] = useState<PublicPlayer[]>([]);
  const [phaseSlice, setPhaseSlice] = useState<PhaseSlice | null>(null);
  const [voteTallySlice, setVoteTallySlice] = useState<VoteTallyItem[]>([]);
  const [publicEventsSlice, setPublicEventsSlice] = useState<PublicEvent[]>([]);
  const [publicChatSlice, setPublicChatSlice] = useState<PublicChatMessage[]>([]);
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
  const [cueMode, setCueMode] = useState<CueMode>("silent");
  const [phasePulse, setPhasePulse] = useState(0);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);
  const previousCuePhaseRef = useRef<string | null>(null);
  const previousEventIdsRef = useRef<Set<string>>(new Set());
  const hasSeenEventsRef = useRef(false);
  const previousWinnerTeamRef = useRef("");
  const suppressNextPhasePulseRef = useRef(false);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const lastTypingSentRef = useRef<Map<ChatChannel, number>>(new Map());
  const startGameTimersRef = useRef<number[]>([]);
  const achievementClearTimerRef = useRef<number | null>(null);
  const shortcutStateRef = useRef<ShortcutState | null>(null);
  const reconnectNowRef = useRef<(() => void) | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const snapshot = useMemo(() => {
    if (!baseSnapshot) {
      return null;
    }
    return {
      ...baseSnapshot,
      ...(phaseSlice ?? {}),
      players: playersSlice,
      voteTally: voteTallySlice,
      publicEvents: publicEventsSlice,
      publicChat: publicChatSlice,
    };
  }, [baseSnapshot, phaseSlice, playersSlice, publicChatSlice, publicEventsSlice, voteTallySlice]);
  const liveMode = (snapshot?.tempoProfile ?? createOptions?.tempoProfile) === "live";

  useEffect(() => {
    let active = true;
    let joinedRoom: Room | null = null;
    let reconnectTimer: number | null = null;
    let reconnecting = false;

    if (sessionPending) {
      return () => {
        active = false;
      };
    }

    if (!session?.user?.id) {
      setStatus("Трябва да влезеш, за да се присъединиш към стаята.");
      setConnectionStatus("disconnected");
      return () => {
        active = false;
      };
    }

    const client = createGameClient();
    setConnectionStatus("connecting");

    setCurrentUserId(session.user.id);

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const waitForReconnectDelay = (ms: number) =>
      new Promise<void>((resolve) => {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          resolve();
        }, ms);
      });

    const bindRoom = (nextRoom: Room) => {
      joinedRoom = nextRoom;
      persistReconnectionToken(code, nextRoom.reconnectionToken);
      setRoom(nextRoom);
      setStatus("Свързан");
      setConnectionStatus("connected");

      nextRoom.onStateChange((state) => {
        const stateView = state as unknown as ColyseusGameState;
        const previousSnapshot = snapshotRef.current;
        const nextPlayers = playersForState(stateView);
        const nextPhaseSlice = phaseSliceForState(stateView);
        const nextVoteTally = voteTallyForState(stateView);
        const nextPublicEvents = publicEventsForState(stateView);
        const nextPublicChat = publicChatForState(stateView);
        const nextRoleCounts = roleCountsForState(stateView);
        const nextBaseSnapshot = snapshotShellForState(stateView, nextRoleCounts, previousSnapshot);

        const playersChanged = !previousSnapshot || !arePlayerListsEqual(previousSnapshot.players, nextPlayers);
        const phaseChanged = !previousSnapshot || !arePhaseSlicesEqual(phaseSliceFor(previousSnapshot), nextPhaseSlice);
        const votesChanged = !previousSnapshot || !areVoteTallyEqual(previousSnapshot.voteTally, nextVoteTally);
        const eventsChanged = !previousSnapshot || !arePublicEventsEqual(previousSnapshot.publicEvents, nextPublicEvents);
        const chatChanged = !previousSnapshot || !arePublicChatEqual(previousSnapshot.publicChat, nextPublicChat);
        const shellChanged = !previousSnapshot || !areSnapshotShellEqual(previousSnapshot, nextBaseSnapshot);

        if (!playersChanged && !phaseChanged && !votesChanged && !eventsChanged && !chatChanged && !shellChanged) {
          return;
        }

        const stableSnapshot = previousSnapshot ?? nextBaseSnapshot;
        const nextSnapshot: GameSnapshot = {
          ...nextBaseSnapshot,
          ...nextPhaseSlice,
          players: playersChanged ? nextPlayers : stableSnapshot.players,
          voteTally: votesChanged ? nextVoteTally : stableSnapshot.voteTally,
          publicEvents: eventsChanged ? nextPublicEvents : stableSnapshot.publicEvents,
          publicChat: chatChanged ? nextPublicChat : stableSnapshot.publicChat,
        };

        snapshotRef.current = nextSnapshot;
        startTransition(() => {
          if (playersChanged) {
            setPlayersSlice(nextPlayers);
          }
          if (phaseChanged) {
            setPhaseSlice(nextPhaseSlice);
          }
          if (votesChanged) {
            setVoteTallySlice(nextVoteTally);
          }
          if (eventsChanged) {
            setPublicEventsSlice(nextPublicEvents);
          }
          if (chatChanged) {
            setPublicChatSlice(nextPublicChat);
          }
          if (shellChanged) {
            setBaseSnapshot(nextBaseSnapshot);
          }
        });
      });

      nextRoom.onMessage("private_role", (message: { role: RoleCode; roleNameBg: string }) => {
        setPrivateRole(message);
      });

      nextRoom.onMessage("private_check_result", (message: PrivateResult) => {
        setPrivateResult(message);
        toast({ message: "Получен е личен резултат от нощното действие.", kind: "info" });
      });

      nextRoom.onMessage("private_lovers", (message: PrivateLover) => {
        setPrivateLover(message);
        toast({ message: "Купидон те свърза с Влюбен.", kind: "success" });
      });

      nextRoom.onMessage("private_blessing", () => {
        setIsBlessed(true);
        toast({ message: "Свещеникът те благослови. Благословията остава върху теб до края на играта.", kind: "success" });
      });

      nextRoom.onMessage("system", (message: { messageBg: string }) => {
        toast({ message: message.messageBg, kind: "info" });
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
        toast({ message: "Получен е пълен преглед за Разказвача.", kind: "info" });
      });

      nextRoom.onMessage("safe_error", (message: { messageBg: string }) => {
        toast({ message: message.messageBg, kind: "error" });
      });

      nextRoom.onMessage("achievements_unlocked", (message: { achievementIds: string[] }) => {
        setUnlockedAchievementIds(message.achievementIds);
        toast({ message: "Отключи ново постижение.", kind: "success" });
        if (achievementClearTimerRef.current !== null) {
          window.clearTimeout(achievementClearTimerRef.current);
        }
        achievementClearTimerRef.current = window.setTimeout(() => {
          setUnlockedAchievementIds([]);
          achievementClearTimerRef.current = null;
        }, 7000);
      });

      nextRoom.onLeave((leaveCode) => {
        if (!active) {
          return;
        }
        if (leaveCode === 1000 || leaveCode === 1001) {
          clearReconnectionToken(code);
          setStatus("Напусна стаята.");
          setConnectionStatus("disconnected");
          return;
        }
        setStatus("Връзката прекъсна. Опитваме да те върнем в стаята.");
        setConnectionStatus("reconnecting");
        suppressNextPhasePulseRef.current = true;
        if (!reconnecting) {
          void attemptReconnect(1);
        }
      });
    };

    const attemptReconnect = async (attempt: number) => {
      const reconnectToken = joinedRoom?.reconnectionToken || readReconnectionToken(code);
      if (!reconnectToken) {
        setStatus("Няма запазен ключ за връщане. Презареди страницата, ако стаята още е активна.");
        setConnectionStatus("lost");
        return;
      }

      reconnecting = true;
      clearReconnectTimer();
      setConnectionStatus("reconnecting");
      setStatus(attempt === 1 ? "Възстановяваме връзката със стаята." : `Възстановяване - опит ${attempt} от ${MAX_RECONNECT_ATTEMPTS}.`);
      await waitForReconnectDelay(Math.min(8000, 1000 * 2 ** (attempt - 1)));
      if (!active) {
        return;
      }

      try {
        const reconnectedRoom = await client.reconnect(reconnectToken);
        if (!active) {
          reconnectedRoom.leave();
          return;
        }
        reconnecting = false;
        bindRoom(reconnectedRoom);
        setStatus("Връзката е възстановена.");
        toast({ message: "Върнахме те в стаята.", kind: "success" });
      } catch {
        if (!active) {
          return;
        }
        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          void attemptReconnect(attempt + 1);
          return;
        }
        reconnecting = false;
        setConnectionStatus("lost");
        setStatus("Не успяхме да възстановим връзката автоматично.");
      }
    };

    const retryReconnect = () => {
      if (!reconnecting) {
        void attemptReconnect(1);
      }
    };
    reconnectNowRef.current = retryReconnect;

    fetch("/api/game-token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Неуспешно издаване на игрови ключ.");
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
        if (!active) {
          nextRoom.leave();
          return;
        }
        bindRoom(nextRoom);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setStatus(error instanceof Error ? error.message : "Неуспешно свързване.");
        setConnectionStatus("error");
      });

    return () => {
      active = false;
      if (reconnectNowRef.current === retryReconnect) {
        reconnectNowRef.current = null;
      }
      clearReconnectTimer();
      joinedRoom?.leave();
    };
  }, [code, createOptions, session?.user?.id, sessionPending, toast]);

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
      clearStartGameTimers();
      if (achievementClearTimerRef.current !== null) {
        window.clearTimeout(achievementClearTimerRef.current);
        achievementClearTimerRef.current = null;
      }
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
    setStatus((current) => (current === "Свързан" || current === "Свързване..." ? "" : current));
  }, [snapshot?.phase]);

  useEffect(() => {
    const nextPhase = snapshot?.phase;
    if (!nextPhase) {
      return;
    }

    if (!previousCuePhaseRef.current) {
      previousCuePhaseRef.current = nextPhase;
      setShowPhaseTransition(false);
      return;
    }
    if (previousCuePhaseRef.current === nextPhase) {
      suppressNextPhasePulseRef.current = false;
      setShowPhaseTransition(false);
      return;
    }

    if (suppressNextPhasePulseRef.current) {
      suppressNextPhasePulseRef.current = false;
      previousCuePhaseRef.current = nextPhase;
      setShowPhaseTransition(false);
      return;
    }

    previousCuePhaseRef.current = nextPhase;
    setShowPhaseTransition(true);
    setPhasePulse((current) => current + 1);
    playCue("phase-change", { forceSilent: liveMode || cueMode === "silent" });
    if (cueMode === "audio_vibration") {
      triggerDeviceCue(nextPhase, liveMode);
    }
  }, [cueMode, liveMode, snapshot?.phase]);

  useEffect(() => {
    const events = snapshot?.publicEvents ?? [];
    if (!hasSeenEventsRef.current) {
      previousEventIdsRef.current = new Set(events.map((event) => event.id));
      hasSeenEventsRef.current = true;
      return;
    }

    const previousIds = previousEventIdsRef.current;
    const newEvents = events.filter((event) => !previousIds.has(event.id));
    previousEventIdsRef.current = new Set(events.map((event) => event.id));

    if (newEvents.some((event) => eventLineClass(event.messageBg) === "event-death")) {
      playCue("kill", { forceSilent: liveMode });
    }
  }, [liveMode, snapshot?.publicEvents]);

  useEffect(() => {
    const winnerTeam = snapshot?.winnerTeam ?? "";
    if (!winnerTeam || previousWinnerTeamRef.current === winnerTeam) {
      return;
    }
    previousWinnerTeamRef.current = winnerTeam;
    playCue("win", { forceSilent: liveMode });
  }, [liveMode, snapshot?.winnerTeam]);

  const players = useMemo(() => snapshot?.players ?? [], [snapshot?.players]);
  const livingPlayers = useMemo(() => players.filter((player) => player.playing && player.alive), [players]);
  const ownPlayer = useMemo(() => players.find((player) => player.userId === currentUserId), [currentUserId, players]);
  const recentPublicEvents = useMemo(() => snapshot?.publicEvents.slice(-7) ?? [], [snapshot?.publicEvents]);
  const recentPublicChat = useMemo(() => snapshot?.publicChat.slice(-5) ?? [], [snapshot?.publicChat]);
  const mode = snapshot?.mode ?? createOptions?.mode ?? "werewolves_classic";
  const family = getGameFamily(mode);
  const phase = snapshot?.phase ?? "lobby";

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

  function requestStartGame() {
    if (!room || startCountdown !== null) {
      return;
    }

    const roomAtStart = room;
    clearStartGameTimers();
    setStartCountdown(3);
    startGameTimersRef.current.push(window.setTimeout(() => setStartCountdown(2), 620));
    startGameTimersRef.current.push(window.setTimeout(() => setStartCountdown(1), 1240));
    startGameTimersRef.current.push(window.setTimeout(() => {
      roomAtStart.send("startGame");
      setStartCountdown(null);
      clearStartGameTimers();
    }, 1860));
  }

  function clearStartGameTimers() {
    for (const timeout of startGameTimersRef.current) {
      window.clearTimeout(timeout);
    }
    startGameTimersRef.current = [];
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
      setSoundEnabled(true);
      triggerDeviceCue(phase, liveMode);
      playCue("phase-change", { forceSilent: liveMode });
    }
    if (mode === "silent") {
      setSoundEnabled(false);
    }
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
          onRetry={() => reconnectNowRef.current?.()}
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

function snapshotShellForState(
  state: ColyseusGameState,
  roleCounts: PublicRoleCount[],
  previousSnapshot: GameSnapshot | null,
): GameSnapshot {
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
    players: previousSnapshot?.players ?? [],
    roleCounts,
    voteTally: previousSnapshot?.voteTally ?? [],
    publicEvents: previousSnapshot?.publicEvents ?? [],
    publicChat: previousSnapshot?.publicChat ?? [],
  };
}

function playersForState(state: ColyseusGameState): PublicPlayer[] {
  return Array.from(state.players.values()).map((player) => ({
    ...player,
    revealedRole: player.revealedRole ?? "",
  }));
}

function roleCountsForState(state: ColyseusGameState): PublicRoleCount[] {
  return Array.from(state.roleCounts);
}

function voteTallyForState(state: ColyseusGameState): VoteTallyItem[] {
  return Array.from(state.voteTally);
}

function publicEventsForState(state: ColyseusGameState): PublicEvent[] {
  return Array.from(state.publicEvents);
}

function publicChatForState(state: ColyseusGameState): PublicChatMessage[] {
  return Array.from(state.publicChat);
}

function phaseSliceForState(state: ColyseusGameState): PhaseSlice {
  return {
    phase: state.phase,
    round: state.round,
    phaseEndsAt: state.phaseEndsAt,
  };
}

function phaseSliceFor(snapshot: GameSnapshot): PhaseSlice {
  return {
    phase: snapshot.phase,
    round: snapshot.round,
    phaseEndsAt: snapshot.phaseEndsAt,
  };
}

function areSnapshotShellEqual(a: GameSnapshot, b: GameSnapshot) {
  return a.code === b.code
    && a.mode === b.mode
    && a.playerCount === b.playerCount
    && a.narratorMode === b.narratorMode
    && a.communicationMode === b.communicationMode
    && a.tempoProfile === b.tempoProfile
    && a.dayDiscussionSeconds === b.dayDiscussionSeconds
    && a.voteSeconds === b.voteSeconds
    && a.revealRolesOnDeath === b.revealRolesOnDeath
    && a.loversEnabled === b.loversEnabled
    && a.allowSkipVote === b.allowSkipVote
    && a.majorityMode === b.majorityMode
    && a.narratorVoice === b.narratorVoice
    && a.winnerTeam === b.winnerTeam
    && a.winnerReasonBg === b.winnerReasonBg
    && areRoleCountsEqual(a.roleCounts, b.roleCounts);
}

function areRoleCountsEqual(a: PublicRoleCount[], b: PublicRoleCount[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right || left.role !== right.role || left.count !== right.count) {
      return false;
    }
  }
  return true;
}

function areVoteTallyEqual(a: VoteTallyItem[], b: VoteTallyItem[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      !left
      || !right
      || left.targetUserId !== right.targetUserId
      || left.targetName !== right.targetName
      || left.count !== right.count
      || left.hasMayorVote !== right.hasMayorVote
    ) {
      return false;
    }
  }
  return true;
}

function arePublicEventsEqual(a: PublicEvent[], b: PublicEvent[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right || left.id !== right.id || left.messageBg !== right.messageBg) {
      return false;
    }
  }
  return true;
}

function arePublicChatEqual(a: PublicChatMessage[], b: PublicChatMessage[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      !left
      || !right
      || left.id !== right.id
      || left.channel !== right.channel
      || left.senderName !== right.senderName
      || left.message !== right.message
    ) {
      return false;
    }
  }
  return true;
}

function reconnectStorageKey(code: string) {
  return `${ROOM_RECONNECT_STORAGE_PREFIX}:${code}`;
}

function persistReconnectionToken(code: string, token: string | undefined) {
  if (!token) {
    return;
  }
  try {
    window.sessionStorage.setItem(reconnectStorageKey(code), token);
  } catch {
    // sessionStorage can be unavailable in hardened browser modes.
  }
}

function readReconnectionToken(code: string) {
  try {
    return window.sessionStorage.getItem(reconnectStorageKey(code));
  } catch {
    return null;
  }
}

function clearReconnectionToken(code: string) {
  try {
    window.sessionStorage.removeItem(reconnectStorageKey(code));
  } catch {
    // sessionStorage can be unavailable in hardened browser modes.
  }
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
