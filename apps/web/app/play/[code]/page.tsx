import type { Metadata } from "next";
import { Suspense } from "react";
import { normalizeRoomCode, ROOM_CODE_REGEX } from "@werewolf/shared";
import { PlayRoomClient } from "@/components/play-room-client";
import { RouteLoadingState } from "@/components/system/RouteLoadingState";
import { requireSession } from "@/lib/require-session";
import { parseRoomCreateOptions, type RoomSearchParams } from "@/lib/room-options";

type PlayPageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<RoomSearchParams & { visualGame?: string | string[] }>;
};

type PlayRouteContentProps = {
  params: PlayPageProps["params"];
  searchParams: PlayPageProps["searchParams"];
};

export const instant = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const normalizedCode = normalizeRoomCode(code);
  const roomLabel = ROOM_CODE_REGEX.test(normalizedCode) ? normalizedCode : "частна стая";
  return {
    title: `Игра ${roomLabel}`,
    description: "Игрова стая с авторитетен сървър, тайни роли и български интерфейс.",
    robots: { index: false, follow: false },
  };
}

export default function PlayPage({ params, searchParams }: PlayPageProps) {
  return (
    <Suspense fallback={<RouteLoadingState title="Подреждаме игровата маса" />}>
      <PlayRouteContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlayRouteContent({ params, searchParams }: PlayRouteContentProps) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const query = stringifySearchParams(resolvedSearchParams);
  const visualGame = firstSearchValue(resolvedSearchParams?.visualGame);
  const createOptions = parseRoomCreateOptions(resolvedSearchParams);
  if (process.env.NODE_ENV !== "production" && visualGame === "1") {
    const { VisualPlayRoomClient } = await import("@/hooks/play/visual-game-fixture");
    return (
      <VisualPlayRoomClient
        key={code}
        code={code}
        createOptions={createOptions}
        search={query}
      />
    );
  }

  await requireSession(`/play/${code}${query ? `?${query}` : ""}`);

  return (
    <PlayRoomClient
      key={code}
      code={code}
      createOptions={createOptions}
    />
  );
}

function stringifySearchParams(searchParams: RoomSearchParams | undefined) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }
  return params.toString();
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
