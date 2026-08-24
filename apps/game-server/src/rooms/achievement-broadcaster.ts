import {
  ACHIEVEMENTS,
  evaluateAchievementUnlocks,
  type AchievementEventLike,
  type AchievementPlayerLike,
} from "@werewolf/shared";

const MAX_ACHIEVEMENT_EVENTS = 500;
const KNOWN_ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));

export interface AchievementUnlock {
  userId: string;
  achievementId: string;
}

export interface AchievementEvaluationContext {
  winnerTeam?: string | null;
  players: AchievementPlayerLike[];
}

export class AchievementBroadcaster {
  private readonly events: AchievementEventLike[] = [];
  private readonly announcedUnlocks = new Set<string>();

  recordEvent(event: AchievementEventLike) {
    if (event.type === "chat") {
      return;
    }
    this.events.push(event);
    if (this.events.length > MAX_ACHIEVEMENT_EVENTS) {
      this.events.shift();
    }
  }

  evaluateUnlocks(context: AchievementEvaluationContext) {
    const rawUnlocks = evaluateAchievementUnlocks({
      events: this.events,
      players: context.players,
      ...(context.winnerTeam === undefined ? {} : { winnerTeam: context.winnerTeam }),
    });

    const seen = new Set<string>();
    return rawUnlocks.filter((unlock) => {
      const key = this.unlockKey(unlock);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  announce(unlocks: AchievementUnlock[], sendToUser: (userId: string, achievementIds: string[]) => void) {
    if (unlocks.length === 0) {
      return;
    }

    const byUserId = new Map<string, string[]>();
    for (const unlock of unlocks) {
      if (!KNOWN_ACHIEVEMENT_IDS.has(unlock.achievementId)) {
        continue;
      }
      const key = this.unlockKey(unlock);
      if (this.announcedUnlocks.has(key)) {
        continue;
      }
      this.announcedUnlocks.add(key);
      byUserId.set(unlock.userId, [...(byUserId.get(unlock.userId) ?? []), unlock.achievementId]);
    }

    for (const [userId, achievementIds] of byUserId) {
      sendToUser(userId, achievementIds);
    }
  }

  reset() {
    this.events.length = 0;
    this.announcedUnlocks.clear();
  }

  private unlockKey(unlock: AchievementUnlock) {
    return `${unlock.userId}:${unlock.achievementId}`;
  }
}
