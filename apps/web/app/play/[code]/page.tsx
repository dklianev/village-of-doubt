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
    title: `Игра ${code} | Върколак и Мафия`,
    description: "Игрова стая с авторитетен сървър, тайни роли и български интерфейс.",
  };
}

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<RoomSearchParams>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const query = stringifySearchParams(resolvedSearchParams);
  await requireSession(`/play/${code}${query ? `?${query}` : ""}`);

  return <PlayRoomClient code={code} createOptions={parseRoomCreateOptions(resolvedSearchParams)} />;
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
