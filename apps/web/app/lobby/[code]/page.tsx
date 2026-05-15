import type { Metadata } from "next";
import Link from "next/link";
import { getGameFamily, getGameModeNameBg } from "@werewolf/shared";
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
  await requireSession(`/lobby/${code}${rawQuery ? `?${rawQuery}` : ""}`);
  const options = parseRoomCreateOptions(resolvedSearchParams);
  const query = roomOptionsToQuery(options);
  const mode = options.mode ?? "werewolves_classic";
  const family = getGameFamily(mode);
  const inviteSceneLabel = family === "mafia" ? "досие към задната стая" : "маршрут до площада";

  return (
    <main className="shell lobby-shell" data-theme={family} data-family={family}>
      <section className="card lobby-invite-card rounded-[2rem] p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#c18a38]">частна стая · {getGameModeNameBg(mode)}</p>
            <h1 className="mt-3 text-5xl font-black">Покана за масата</h1>
            <p className="mt-4 max-w-2xl text-[#ead9ba]">
              Сподели кода с групата. Преди старт всички виждат настройките, но ролите остават
              заключени до разкриването.
            </p>
          </div>
          <div className="code-seal" aria-label={`Код на стаята ${code}`}>
            <span>код</span>
            <strong>{code}</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/play/${code}${query}`} className="btn btn-primary">
              Влез в играта
            </Link>
            <Link href={`/play/${code}${withSpectatorQuery(query)}`} className="btn btn-secondary">
              Наблюдавай
            </Link>
          </div>
        </div>
        <div className="invite-scene-card mt-7" aria-hidden="true">
          <span>{inviteSceneLabel}</span>
        </div>
        <div className="mt-8 rounded-3xl border border-[#f4e8d1]/15 bg-[#f4e8d1]/8 p-6 text-[#ead9ba]">
          <p className="text-sm uppercase tracking-[0.25em] text-[#c18a38]">следваща стъпка</p>
          <p className="mt-3 text-lg leading-7">
            Сподели кода с групата и натисни „Влез в играта“. Списъкът на играчите се появява в реално време,
            щом всички се присъединят към стаята.
          </p>
        </div>
      </section>
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
