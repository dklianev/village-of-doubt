import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCOUNT_EXPORT_DEFAULT_PAGE_SIZE,
  ACCOUNT_EXPORT_DEFAULT_EVENT_PAGE_SIZE,
  ACCOUNT_EXPORT_MAX_EVENT_PAGE_SIZE,
  ACCOUNT_EXPORT_MAX_PAGE,
  ACCOUNT_EXPORT_MAX_PAGE_SIZE,
  createDatabase,
  getAccountExportPage,
  getAchievementsForUser,
} from "@werewolf/database";
import { auth } from "@/lib/auth";

const MAX_EXPORT_BYTES = 5 * 1024 * 1024;
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request?: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Не си влязъл." },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Базата не е достъпна." },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const pagination = parsePagination(request);
  if (!pagination) {
    return NextResponse.json(
      { error: "Невалидна страница за експорт." },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const userId = session.user.id;
    const [achievements, exportPage] = await Promise.all([
      getAchievementsForUser(db, userId),
      getAccountExportPage(db, userId, pagination),
    ]);
    const games = exportPage.games.map((game) => ({
      id: game.id,
      code: game.code,
      isHost: game.isHost,
      config: game.config,
      status: game.status,
      winnerTeam: game.winnerTeam,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      createdAt: game.createdAt,
      player: game.player,
      events: game.events,
      eventCount: game.eventCount,
    }));
    const dump = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: userId,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        avatarId: session.user.avatarId,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt,
      },
      achievements,
      games,
      pagination: {
        page: exportPage.page,
        pageSize: exportPage.pageSize,
        hasMore: exportPage.hasMore,
        eventPage: exportPage.eventPage,
        eventPageSize: exportPage.eventPageSize,
        eventsHasMore: exportPage.eventsHasMore,
      },
      note: "Това е експорт на твоите данни от Върколак и Мафия. Запази файла за твоите архиви.",
    };
    const serialized = JSON.stringify(dump, null, 2);

    if (new TextEncoder().encode(serialized).byteLength > MAX_EXPORT_BYTES) {
      return NextResponse.json(
        { error: "Експортът е твърде голям. Опитай с по-малък размер на страницата." },
        { status: 413, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        ...PRIVATE_NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="werewolf-mafia-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("[account-export]", error);
    return NextResponse.json(
      { error: "Грешка при експорт на данни." },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}

function parsePagination(request?: Request): {
  page: number;
  pageSize: number;
  eventPage: number;
  eventPageSize: number;
} | null {
  const url = new URL(request?.url ?? "http://localhost/api/account/export");
  const page = parseBoundedPositiveInteger(url.searchParams.get("page"), 1, ACCOUNT_EXPORT_MAX_PAGE);
  const pageSize = parseBoundedPositiveInteger(
    url.searchParams.get("pageSize"),
    ACCOUNT_EXPORT_DEFAULT_PAGE_SIZE,
    ACCOUNT_EXPORT_MAX_PAGE_SIZE,
  );
  const eventPage = parseBoundedPositiveInteger(
    url.searchParams.get("eventPage"),
    1,
    ACCOUNT_EXPORT_MAX_PAGE,
  );
  const eventPageSize = parseBoundedPositiveInteger(
    url.searchParams.get("eventPageSize"),
    ACCOUNT_EXPORT_DEFAULT_EVENT_PAGE_SIZE,
    ACCOUNT_EXPORT_MAX_EVENT_PAGE_SIZE,
  );

  return page === null || pageSize === null || eventPage === null || eventPageSize === null
    ? null
    : { page, pageSize, eventPage, eventPageSize };
}

function parseBoundedPositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number | null {
  if (value === null) {
    return fallback;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}
