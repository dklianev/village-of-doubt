export type ReplayTimelineVisibility = "all" | "public" | "none";

type GameMembership = {
  has(gameId: string): boolean;
};

type ReplayVisibilityInput = {
  gameId: string;
  status: string;
  endedAt: Date | null;
  hostId: string | null;
  roomVisibility: "private" | "public";
  viewerUserId: string | null | undefined;
  participantGameIds: GameMembership;
};

export function resolveReplayTimelineVisibility({
  gameId,
  status,
  endedAt,
  hostId,
  roomVisibility,
  viewerUserId,
  participantGameIds,
}: ReplayVisibilityInput): ReplayTimelineVisibility {
  const isEndedGame = status === "ended" && endedAt !== null;
  const isHost = Boolean(viewerUserId && hostId === viewerUserId);
  const isParticipant = Boolean(viewerUserId && participantGameIds.has(gameId));

  if (isEndedGame && (isHost || isParticipant)) {
    return "all";
  }

  return isEndedGame && roomVisibility === "public" ? "public" : "none";
}

export function filterReplayTimelineByVisibility<T extends { visibility: string }>(
  timeline: readonly T[],
  visibility: ReplayTimelineVisibility,
): T[] {
  return visibility === "all"
    ? [...timeline]
    : visibility === "public"
      ? timeline.filter((event) => event.visibility === "public")
      : [];
}

type ReplayTimelineLoaderInput<T extends { visibility: string }> = {
  game: {
    gameId: string;
    status: string;
    endedAt: Date | null;
    hostId: string | null;
    roomVisibility: "private" | "public";
  };
  viewerUserId: string | null | undefined;
  loadParticipantGameIds: (viewerUserId: string, gameId: string) => Promise<GameMembership>;
  loadTimeline: (visibility: ReplayTimelineVisibility) => Promise<readonly T[]>;
};

export async function loadReplayTimelineForViewer<T extends { visibility: string }>({
  game,
  viewerUserId,
  loadParticipantGameIds,
  loadTimeline,
}: ReplayTimelineLoaderInput<T>): Promise<T[]> {
  const participantGameIds = viewerUserId
    ? await loadParticipantGameIds(viewerUserId, game.gameId)
    : new Set<string>();
  const visibility = resolveReplayTimelineVisibility({
    gameId: game.gameId,
    status: game.status,
    endedAt: game.endedAt,
    hostId: game.hostId,
    roomVisibility: game.roomVisibility,
    viewerUserId,
    participantGameIds,
  });
  if (visibility === "none") {
    return [];
  }
  const timeline = await loadTimeline(visibility);

  return filterReplayTimelineByVisibility(timeline, visibility);
}
