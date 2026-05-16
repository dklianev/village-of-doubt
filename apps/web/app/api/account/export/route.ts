import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createDatabase, getAchievementsForUser, getGameHistoryForUser } from "@werewolf/database";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Базата не е достъпна." }, { status: 503 });
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const userId = session.user.id;
    const [achievements, games] = await Promise.all([
      getAchievementsForUser(db, userId),
      getGameHistoryForUser(db, userId, 500),
    ]);

    const dump = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: userId,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt,
      },
      achievements,
      games,
      note: "Това е експорт на твоите данни от Върколак и Мафия. Запази файла за твоите архиви.",
    };

    return new NextResponse(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="werewolf-mafia-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("[account-export]", error);
    return NextResponse.json({ error: "Грешка при експорт на данни." }, { status: 500 });
  }
}
