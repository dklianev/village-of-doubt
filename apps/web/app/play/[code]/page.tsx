import type { Metadata } from "next";
import { PlayRoomClient } from "@/components/play-room-client";
import { parseRoomCreateOptions, type RoomSearchParams } from "@/lib/room-options";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Игра ${code} | Върколак и Мафия`,
    description: "Игрова стая с authoritative сървър, тайни роли и български UI.",
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

  return <PlayRoomClient code={code} createOptions={parseRoomCreateOptions(resolvedSearchParams)} />;
}
