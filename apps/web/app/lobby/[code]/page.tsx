import type { Metadata } from "next";
import { normalizeRoomCode, ROOM_CODE_REGEX } from "@werewolf/shared";
import { LobbyInviteClient } from "@/components/lobby-invite-client";
import { requireSession } from "@/lib/require-session";
import type { RoomSearchParams } from "@/lib/room-options";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const normalizedCode = normalizeRoomCode(code);
  const roomLabel = ROOM_CODE_REGEX.test(normalizedCode) ? normalizedCode : "частна стая";
  return {
    title: `Лоби ${roomLabel}`,
    description: "Покана за частна стая с отделни настройки за Върколак или Мафия.",
    robots: { index: false, follow: false },
  };
}

export default async function LobbyCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<RoomSearchParams & { visualAuth?: string | string[] }>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const rawQuery = stringifySearchParams(resolvedSearchParams);
  const visualAuth = firstSearchValue(resolvedSearchParams?.visualAuth);
  if (!(process.env.NODE_ENV !== "production" && visualAuth === "1")) {
    await requireSession(`/lobby/${code}${rawQuery ? `?${rawQuery}` : ""}`);
  }

  return (
    <main className="shell lobby-shell framed-shell">
      <div className="framed-shell-inner">
        <LobbyInviteClient code={normalizeRoomCode(code)} />
      </div>
    </main>
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
