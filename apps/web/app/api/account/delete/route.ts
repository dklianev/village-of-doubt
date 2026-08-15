import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createDatabase, deleteUserAccountAtomically } from "@werewolf/database";
import { ACCOUNT_DELETE_FRESH_AGE_SECONDS, auth } from "@/lib/auth";
import { IntakeBodyError, readBoundedJson } from "@/lib/intake-security";
import { revokeActiveGameSessions } from "@/lib/game-session-revocation";

const DELETE_INTENT = "delete-account";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Заявката за изтриване не е разрешена." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJson(request, 512);
  } catch (error) {
    const status = error instanceof IntakeBodyError && error.kind === "too_large" ? 413 : 400;
    return NextResponse.json({ error: "Невалидно потвърждение за изтриване." }, { status });
  }

  if (body.intent !== DELETE_INTENT) {
    return NextResponse.json({ error: "Потвърди изрично изтриването на досието." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }

  if (!isFreshSession(session.session?.createdAt)) {
    return NextResponse.json(
      { error: "Влез отново, преди да изтриеш досието си." },
      { status: 403 },
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: "Изтриването на досие временно не е налично." }, { status: 503 });
  }

  try {
    await revokeActiveGameSessions(session.user.id, { requireRealtime: true });
    const deleted = await deleteUserAccountAtomically(createDatabase(databaseUrl), session.user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Досието вече не съществува." }, { status: 401 });
    }
  } catch (error) {
    console.error("[account-delete] deletion failed", safeErrorMetadata(error));
    return NextResponse.json({ error: "Не успяхме да изтрием досието." }, { status: 500 });
  }

  revalidateTag("public-leaderboard", "max");
  revalidateTag("public-game-history", "max");

  return NextResponse.json({ ok: true });
}

function isFreshSession(createdAt: Date | string | undefined): boolean {
  if (!createdAt) {
    return false;
  }

  const createdAtMs = new Date(createdAt).getTime();
  return (
    Number.isFinite(createdAtMs) &&
    Date.now() - createdAtMs < ACCOUNT_DELETE_FRESH_AGE_SECONDS * 1_000
  );
}

function safeErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: "UnknownError", code: null, status: null };
  }

  const record = error as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : "UnknownError",
    code: typeof record.code === "string" ? record.code : null,
    status: typeof record.status === "number" ? record.status : null,
  };
}

function isAllowedOrigin(request: Request): boolean {
  const origin = normalizeOrigin(request.headers.get("origin") ?? undefined);
  if (!origin) {
    return false;
  }

  const allowedOrigins = [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL];
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return allowedOrigins.some((candidate) => {
    const allowedOrigin = normalizeOrigin(candidate);
    return allowedOrigin !== null && allowedOrigin === origin;
  });
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
