import { PlayRoomClient } from "@/components/play-room-client";
import { parseRoomCreateOptions, type RoomSearchParams } from "@/lib/room-options";

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
