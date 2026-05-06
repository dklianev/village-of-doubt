import { NextRequest, NextResponse } from "next/server";
import { createDatabase, getAchievementsForUser } from "@werewolf/database";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ achievements: [] });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ achievements: [] });
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const achievements = await getAchievementsForUser(db, userId);
    return NextResponse.json({
      achievements: achievements.map((achievement) => ({
        achievementId: achievement.achievementId,
        gameId: achievement.gameId,
        unlockedAt: achievement.unlockedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[achievements]", error);
    return NextResponse.json({ error: "Постиженията не могат да се заредят в момента." }, { status: 500 });
  }
}
