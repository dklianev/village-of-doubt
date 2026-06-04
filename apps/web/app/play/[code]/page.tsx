import type { Metadata } from "next";
import { PlayRoomClient } from "@/components/play-room-client";
import { requireSession } from "@/lib/require-session";
import { parseRoomCreateOptions, type RoomSearchParams } from "@/lib/room-options";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Игра ${code}`,
    description: "Игрова стая с авторитетен сървър, тайни роли и български интерфейс.",
  };
}

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<RoomSearchParams & { visualGame?: string | string[] }>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const query = stringifySearchParams(resolvedSearchParams);
  const visualGame = firstSearchValue(resolvedSearchParams?.visualGame);
  if (process.env.NODE_ENV === "production" || visualGame !== "1") {
    await requireSession(`/play/${code}${query ? `?${query}` : ""}`);
  }
  const visualFixtureSearch =
    process.env.NODE_ENV !== "production" && visualGame === "1" ? query : undefined;

  return (
    <PlayRoomClient
      code={code}
      createOptions={parseRoomCreateOptions(resolvedSearchParams)}
      visualFixtureSearch={visualFixtureSearch}
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
