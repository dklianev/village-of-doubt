import Link from "next/link";
import { parseRoomCreateOptions, roomOptionsToQuery, type RoomSearchParams } from "@/lib/room-options";

export default async function LobbyCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<RoomSearchParams>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const query = roomOptionsToQuery(parseRoomCreateOptions(resolvedSearchParams));

  return (
    <main className="shell lobby-shell">
      <section className="card lobby-invite-card rounded-[2rem] p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#c18a38]">частна стая</p>
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
          <Link href={`/play/${code}${query}`} className="btn btn-primary">
            Влез в играта
          </Link>
        </div>
        <div className="village-map-card mt-7" aria-hidden="true">
          <span>маршрут до площада</span>
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
