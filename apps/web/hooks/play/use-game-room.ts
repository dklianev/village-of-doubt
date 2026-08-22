"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Room } from "@colyseus/sdk";
import type {
  CreateRoomOptions,
  GameMode,
  GamePhase,
  NarratorVoice,
  RoleCode,
} from "@werewolf/shared";
import { authClient } from "@/lib/auth-client";
import { createGameClient, GAME_ROOM_NAME } from "@/lib/colyseus-client";
import type { pushToast } from "@/lib/toast";
import { arePhaseSlicesEqual, arePlayerListsEqual } from "@/lib/play/equality";
import { playCue } from "@/lib/sound";
import { useVisualGameRoomFixture } from "@/hooks/play/visual-game-fixture";
import type {
  ConnectionStatus,
  GameSnapshot,
  NightActionCapabilities,
  NarratorRoleSnapshot,
  PhaseSlice,
  PrivateChatMessage,
  PrivateFactionRoster,
  PrivateLover,
  PrivateResult,
  PublicChatMessage,
  PublicEvent,
  PublicNomination,
  PublicPlayer,
  PublicRoleCount,
  SportDaySlice,
  TypingNotice,
  VoteTallyItem,
} from "@/lib/play/types";

const ROOM_RECONNECT_STORAGE_PREFIX = "room-reconnect";
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseGameRoomOptions {
  code: string;
  createOptions: CreateRoomOptions | undefined;
  visualFixtureSearch?: string | undefined;
  toast: typeof pushToast;
  onReconnectSuppressed?: () => void;
}

export interface UseGameRoomResult {
  room: Room | null;
  snapshot: GameSnapshot | null;
  currentUserId: string;
  privateRole: { role: RoleCode; roleNameBg: string } | null;
  privateResult: PrivateResult | null;
  privateFactionRoster: PrivateFactionRoster | null;
  privateLover: PrivateLover | null;
  nightActionCapabilities: NightActionCapabilities | null;
  narratorSnapshot: NarratorRoleSnapshot | null;
  privateChats: PrivateChatMessage[];
  typingNotices: TypingNotice[];
  isBlessed: boolean;
  connectionMessage: string;
  connectionStatus: ConnectionStatus;
  unlockedAchievementIds: string[];
  setUnlockedAchievementIds: Dispatch<SetStateAction<string[]>>;
  recordedGameId: string | null;
  reconnectNow: () => void;
  isPending: boolean;
}

export function useGameRoom({
  code,
  createOptions,
  visualFixtureSearch,
  toast,
  onReconnectSuppressed,
}: UseGameRoomOptions): UseGameRoomResult {
  const createOptionsSignature = createRoomOptionsSignature(createOptions);
  const createOptionsRef = useRef<{ signature: string; value: CreateRoomOptions | undefined }>({
    signature: createOptionsSignature,
    value: createOptions,
  });
  if (createOptionsRef.current.signature !== createOptionsSignature) {
    createOptionsRef.current = { signature: createOptionsSignature, value: createOptions };
  }
  const stableCreateOptions = createOptionsRef.current.value;
  const visualFixture = useVisualGameRoomFixture({
    code,
    createOptions: stableCreateOptions,
    search: visualFixtureSearch,
  });
  const hasVisualFixture = visualFixture !== null;
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [baseSnapshot, setBaseSnapshot] = useState<GameSnapshot | null>(null);
  const [playersSlice, setPlayersSlice] = useState<PublicPlayer[]>([]);
  const [phaseSlice, setPhaseSlice] = useState<PhaseSlice | null>(null);
  const [sportDaySlice, setSportDaySlice] = useState<SportDaySlice | null>(null);
  const [voteTallySlice, setVoteTallySlice] = useState<VoteTallyItem[]>([]);
  const [publicEventsSlice, setPublicEventsSlice] = useState<PublicEvent[]>([]);
  const [publicChatSlice, setPublicChatSlice] = useState<PublicChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [privateRole, setPrivateRole] = useState<{ role: RoleCode; roleNameBg: string } | null>(null);
  const [privateResult, setPrivateResult] = useState<PrivateResult | null>(null);
  const [privateFactionRoster, setPrivateFactionRoster] = useState<PrivateFactionRoster | null>(null);
  const [privateLover, setPrivateLover] = useState<PrivateLover | null>(null);
  const [nightActionCapabilities, setNightActionCapabilities] = useState<NightActionCapabilities | null>(null);
  const [narratorSnapshot, setNarratorSnapshot] = useState<NarratorRoleSnapshot | null>(null);
  const [privateChats, setPrivateChats] = useState<PrivateChatMessage[]>([]);
  const [typingNotices, setTypingNotices] = useState<TypingNotice[]>([]);
  const [isBlessed, setIsBlessed] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("Свързване...");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);
  const [recordedGameId, setRecordedGameId] = useState<string | null>(null);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const achievementClearTimerRef = useRef<number | null>(null);
  const reconnectNowRef = useRef<(() => void) | null>(null);
  const onReconnectSuppressedRef = useRef<(() => void) | undefined>(onReconnectSuppressed);
  const [isPending, startTransition] = useTransition();

  const snapshot = useMemo(() => {
    if (!baseSnapshot) {
      return null;
    }
    return {
      ...baseSnapshot,
      ...(phaseSlice ?? {}),
      ...(sportDaySlice ?? {}),
      players: playersSlice,
      voteTally: voteTallySlice,
      publicEvents: publicEventsSlice,
      publicChat: publicChatSlice,
    };
  }, [baseSnapshot, phaseSlice, playersSlice, publicChatSlice, publicEventsSlice, sportDaySlice, voteTallySlice]);

  const reconnectNow = useCallback(() => {
    reconnectNowRef.current?.();
  }, []);

  const clearViewerPrivateState = useCallback(() => {
    setCurrentUserId("");
    setPrivateRole(null);
    setPrivateResult(null);
    setPrivateFactionRoster(null);
    setPrivateLover(null);
    setNightActionCapabilities(null);
    setNarratorSnapshot(null);
    setPrivateChats([]);
    setTypingNotices([]);
    setIsBlessed(false);
    for (const timeout of typingTimeoutsRef.current.values()) {
      window.clearTimeout(timeout);
    }
    typingTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    onReconnectSuppressedRef.current = onReconnectSuppressed;
  }, [onReconnectSuppressed]);

  useEffect(() => {
    if (!sessionPending && !hasVisualFixture) {
      clearViewerPrivateState();
      setRoom(null);
    }
  }, [clearViewerPrivateState, code, hasVisualFixture, session?.user?.id, sessionPending]);

  useEffect(() => {
    let active = true;
    let joinedRoom: Room | null = null;
    let reconnectTimer: number | null = null;
    let reconnecting = false;

    if (hasVisualFixture) {
      reconnectNowRef.current = visualFixture.reconnectNow;
      return () => {
        active = false;
      };
    }

    if (sessionPending) {
      return () => {
        active = false;
      };
    }

    if (!session?.user?.id) {
      setConnectionMessage("Трябва да влезеш, за да се присъединиш към стаята.");
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
      setConnectionMessage("Свързан");
      setConnectionStatus("connected");

      nextRoom.onStateChange((state) => {
        const stateView = state as unknown as ColyseusGameState;
        const previousSnapshot = snapshotRef.current;
        const nextPlayers = playersForState(stateView);
        const nextPhaseSlice = phaseSliceForState(stateView);
        const nextSportDaySlice = sportDaySliceForState(stateView);
        const nextVoteTally = voteTallyForState(stateView);
        const nextPublicEvents = publicEventsForState(stateView);
        const nextPublicChat = publicChatForState(stateView);
        const nextRoleCounts = roleCountsForState(stateView);
        const nextBaseSnapshot = snapshotShellForState(stateView, nextRoleCounts, previousSnapshot);

        const playersChanged = !previousSnapshot || !arePlayerListsEqual(previousSnapshot.players, nextPlayers);
        const phaseChanged = !previousSnapshot || !arePhaseSlicesEqual(phaseSliceFor(previousSnapshot), nextPhaseSlice);
        const sportDayChanged = !previousSnapshot || !areSportDaySlicesEqual(sportDaySliceFor(previousSnapshot), nextSportDaySlice);
        const votesChanged = !previousSnapshot || !areVoteTallyEqual(previousSnapshot.voteTally, nextVoteTally);
        const eventsChanged = !previousSnapshot || !arePublicEventsEqual(previousSnapshot.publicEvents, nextPublicEvents);
        const chatChanged = !previousSnapshot || !arePublicChatEqual(previousSnapshot.publicChat, nextPublicChat);
        const shellChanged = !previousSnapshot || !areSnapshotShellEqual(previousSnapshot, nextBaseSnapshot);

        if (!playersChanged && !phaseChanged && !sportDayChanged && !votesChanged && !eventsChanged && !chatChanged && !shellChanged) {
          return;
        }

        const stableSnapshot = previousSnapshot ?? nextBaseSnapshot;
        const nextSnapshot: GameSnapshot = {
          ...nextBaseSnapshot,
          ...nextPhaseSlice,
          ...nextSportDaySlice,
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
          if (sportDayChanged) {
            setSportDaySlice(nextSportDaySlice);
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
        setPrivateFactionRoster(null);
      });

      nextRoom.onMessage("private_check_result", (message: PrivateResult) => {
        setPrivateResult(message);
        toast({ message: "Получен е личен резултат от нощното действие.", kind: "info" });
      });

      nextRoom.onMessage("private_lovers", (message: PrivateLover) => {
        setPrivateLover(message);
        toast({ message: "Купидон те свърза с Влюбен.", kind: "success" });
      });

      nextRoom.onMessage("private_faction_roster", (message: PrivateFactionRoster) => {
        setPrivateFactionRoster(message);
      });

      nextRoom.onMessage("night_action_capabilities", (message: { capabilities: NightActionCapabilities }) => {
        setNightActionCapabilities(message.capabilities);
      });

      nextRoom.onMessage("night_action_ack", () => {
        toast({ message: "Нощното действие е прието.", kind: "success" });
        if (snapshotRef.current?.tempoProfile !== "live" && "vibrate" in navigator) {
          navigator.vibrate([24]);
        }
      });

      nextRoom.onMessage("vote_ack", () => {
        toast({ message: "Гласът е приет.", kind: "success" });
        playCue("vote", { forceSilent: snapshotRef.current?.tempoProfile === "live" });
      });

      nextRoom.onMessage("nomination_ack", (message: { replaced: boolean }) => {
        toast({
          message: message.replaced ? "Номинацията е сменена." : "Номинацията е приета.",
          kind: "success",
        });
      });

      nextRoom.onMessage("hunter_revenge_ack", () => {
        toast({ message: "Последният изстрел е приет.", kind: "success" });
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
        toast({ message: "Отключи нова легенда.", kind: "success" });
        if (achievementClearTimerRef.current !== null) {
          window.clearTimeout(achievementClearTimerRef.current);
        }
        achievementClearTimerRef.current = window.setTimeout(() => {
          setUnlockedAchievementIds([]);
          achievementClearTimerRef.current = null;
        }, 7000);
      });

      nextRoom.onMessage("game_recorded", (message: { gameId: string }) => {
        setRecordedGameId(message.gameId);
      });

      nextRoom.onLeave((leaveCode) => {
        if (!active) {
          return;
        }
        if (leaveCode === 1000 || leaveCode === 1001) {
          clearReconnectionToken(code);
          clearViewerPrivateState();
          setConnectionMessage("Напусна стаята.");
          setConnectionStatus("disconnected");
          return;
        }
        setConnectionMessage("Връзката прекъсна. Опитваме да те върнем в стаята.");
        setConnectionStatus("reconnecting");
        onReconnectSuppressedRef.current?.();
        if (!reconnecting) {
          void attemptReconnect(1);
        }
      });
    };

    const attemptReconnect = async (attempt: number) => {
      const reconnectToken = joinedRoom?.reconnectionToken || readReconnectionToken(code);
      if (!reconnectToken) {
        setConnectionMessage("Няма запазен ключ за връщане. Презареди страницата, ако стаята още е активна.");
        setConnectionStatus("lost");
        return;
      }

      reconnecting = true;
      clearReconnectTimer();
      setConnectionStatus("reconnecting");
      setConnectionMessage(attempt === 1 ? "Възстановяваме връзката със стаята." : `Възстановяване - опит ${attempt} от ${MAX_RECONNECT_ATTEMPTS}.`);
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
        setConnectionMessage("Връзката е възстановена.");
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
        setConnectionMessage("Не успяхме да възстановим връзката автоматично.");
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
          ...stableCreateOptions,
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
        setConnectionMessage(error instanceof Error ? error.message : "Неуспешно свързване.");
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
  }, [clearViewerPrivateState, code, hasVisualFixture, session?.user?.id, sessionPending, stableCreateOptions, toast, visualFixture]);

  useEffect(() => {
    function handleOffline() {
      setConnectionStatus("reconnecting");
      setConnectionMessage("Устройството изглежда офлайн. Опитваме да запазим мястото ти в играта.");
    }

    function handleOnline() {
      setConnectionMessage("Интернет връзката се върна. Ако стаята не се обнови, презареди страницата.");
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
      if (achievementClearTimerRef.current !== null) {
        window.clearTimeout(achievementClearTimerRef.current);
        achievementClearTimerRef.current = null;
      }
    };
  }, []);

  if (visualFixture) {
    return { ...visualFixture, privateFactionRoster: null };
  }

  return {
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
  };
}

function createRoomOptionsSignature(options: CreateRoomOptions | undefined) {
  return JSON.stringify(options ?? null);
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
  playerSpeechSeconds?: number;
  voteSeconds: number;
  revealRolesOnDeath: boolean;
  loversEnabled: boolean;
  doctorCanSelfProtect?: boolean;
  allowSkipVote: boolean;
  majorityMode: string;
  narratorVoice: NarratorVoice;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number;
  currentSpeakerUserId?: string;
  currentDefenseUserId?: string;
  winnerTeam: string;
  winnerReasonBg: string;
  players: { values(): IterableIterator<ColyseusGameStatePlayer> };
  roleCounts: Iterable<PublicRoleCount>;
  voteTally: Iterable<VoteTallyItem>;
  nominations?: Iterable<PublicNomination>;
  revoteEligibleUserIds?: Iterable<string>;
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
    ...(state.playerSpeechSeconds === undefined ? {} : { playerSpeechSeconds: state.playerSpeechSeconds }),
    voteSeconds: state.voteSeconds,
    revealRolesOnDeath: state.revealRolesOnDeath,
    loversEnabled: state.loversEnabled,
    ...(state.doctorCanSelfProtect === undefined ? {} : { doctorCanSelfProtect: state.doctorCanSelfProtect }),
    allowSkipVote: state.allowSkipVote,
    majorityMode: state.majorityMode,
    narratorVoice: state.narratorVoice,
    phase: state.phase,
    round: state.round,
    phaseEndsAt: state.phaseEndsAt,
    winnerTeam: state.winnerTeam,
    winnerReasonBg: state.winnerReasonBg,
    revoteEligibleUserIds: Array.from(state.revoteEligibleUserIds ?? []),
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

function sportDaySliceForState(state: ColyseusGameState): SportDaySlice {
  return {
    currentSpeakerUserId: state.currentSpeakerUserId ?? "",
    currentDefenseUserId: state.currentDefenseUserId ?? "",
    nominations: Array.from(state.nominations ?? [], (nomination) => ({
      nominatorUserId: nomination.nominatorUserId,
      targetUserId: nomination.targetUserId,
    })),
  };
}

function sportDaySliceFor(snapshot: GameSnapshot): SportDaySlice {
  return {
    currentSpeakerUserId: snapshot.currentSpeakerUserId ?? "",
    currentDefenseUserId: snapshot.currentDefenseUserId ?? "",
    nominations: snapshot.nominations ?? [],
  };
}

function areSportDaySlicesEqual(a: SportDaySlice, b: SportDaySlice) {
  if (
    a.currentSpeakerUserId !== b.currentSpeakerUserId
    || a.currentDefenseUserId !== b.currentDefenseUserId
    || a.nominations.length !== b.nominations.length
  ) {
    return false;
  }
  for (let index = 0; index < a.nominations.length; index += 1) {
    const left = a.nominations[index];
    const right = b.nominations[index];
    if (
      !left
      || !right
      || left.nominatorUserId !== right.nominatorUserId
      || left.targetUserId !== right.targetUserId
    ) {
      return false;
    }
  }
  return true;
}

function areSnapshotShellEqual(a: GameSnapshot, b: GameSnapshot) {
  return a.code === b.code
    && a.mode === b.mode
    && a.playerCount === b.playerCount
    && a.narratorMode === b.narratorMode
    && a.communicationMode === b.communicationMode
    && a.tempoProfile === b.tempoProfile
    && a.dayDiscussionSeconds === b.dayDiscussionSeconds
    && a.playerSpeechSeconds === b.playerSpeechSeconds
    && a.voteSeconds === b.voteSeconds
    && a.revealRolesOnDeath === b.revealRolesOnDeath
    && a.loversEnabled === b.loversEnabled
    && a.doctorCanSelfProtect === b.doctorCanSelfProtect
    && a.allowSkipVote === b.allowSkipVote
    && a.majorityMode === b.majorityMode
    && a.narratorVoice === b.narratorVoice
    && a.winnerTeam === b.winnerTeam
    && a.winnerReasonBg === b.winnerReasonBg
    && areStringListsEqual(a.revoteEligibleUserIds ?? [], b.revoteEligibleUserIds ?? [])
    && areRoleCountsEqual(a.roleCounts, b.roleCounts);
}

function areStringListsEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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
