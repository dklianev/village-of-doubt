import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createDatabase, getAchievementsForUser } from "@werewolf/database";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ achievements: [] });
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const achievements = await getAchievementsForUser(db, session.user.id);
    return NextResponse.json({
      achievements: achievements.map((achievement) => ({
        achievementId: achievement.achievementId,
        gameId: achievement.gameId,
        unlockedAt: achievement.unlockedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[achievements]", error);
    return NextResponse.json({ error: "Грешка при зареждане на постижения." }, { status: 500 });
  }
}
