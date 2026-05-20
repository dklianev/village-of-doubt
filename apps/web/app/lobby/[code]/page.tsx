import type { Metadata } from "next";
import { getGameFamily, getGameModeNameBg } from "@werewolf/shared";
import { LobbyInviteClient } from "@/components/lobby-invite-client";
import { requireSession } from "@/lib/require-session";
import { parseRoomCreateOptions, roomOptionsToQuery, type RoomSearchParams } from "@/lib/room-options";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Лоби ${code} | Върколак и Мафия`,
    description: "Покана за частна стая с отделни настройки за Върколак или Мафия.",
  };
}

export default async function LobbyCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<RoomSearchParams>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const rawQuery = stringifySearchParams(resolvedSearchParams);
  const session = await requireSession(`/lobby/${code}${rawQuery ? `?${rawQuery}` : ""}`);
  const options = parseRoomCreateOptions(resolvedSearchParams);
  const query = roomOptionsToQuery(options);
  const mode = options.mode ?? "werewolves_classic";
  const family = getGameFamily(mode);
  const playHref = `/play/${code}${query}`;
  const spectatorHref = `/play/${code}${withSpectatorQuery(query)}`;

  return (
    <main className="shell lobby-shell framed-shell" data-theme={family} data-family={family}>
      <div className="framed-shell-inner">
        <LobbyInviteClient
          code={code}
          family={family}
          modeLabel={getGameModeNameBg(mode)}
          playHref={playHref}
          spectatorHref={spectatorHref}
          hostName={session.user.name ?? "Домакин"}
        />
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

function withSpectatorQuery(query: string) {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  params.set("spectator", "1");
  const nextQuery = params.toString();
  return nextQuery ? `?${nextQuery}` : "?spectator=1";
}
