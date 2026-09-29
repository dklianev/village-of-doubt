import { ACHIEVEMENTS } from "@werewolf/shared";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, RotateCw } from "lucide-react";
import { AchievementCollection } from "@/components/achievements/AchievementCollection";
import { AchievementPlaque } from "@/components/achievements/AchievementPlaque";
import { AchievementProgressWreath } from "@/components/achievements/AchievementProgressWreath";
import { achievementPresentation, getAchievementCollection, type OwnedAchievement } from "@/components/achievements/achievement-presentation";
import { formatBulgarianDateTime } from "@/lib/date-time";

export type { OwnedAchievement } from "@/components/achievements/achievement-presentation";

interface AchievementsClientProps {
  owned: OwnedAchievement[];
  status: "ready" | "unavailable";
  visualReplay?: boolean;
}

export function AchievementsClient({ owned, status, visualReplay = false }: AchievementsClientProps) {
  const { featured, remaining, unlockedCount } = getAchievementCollection(ACHIEVEMENTS, owned);
  const feature = featured?.owned
    ? achievementPresentation(featured.achievement, featured.owned.unlockedAt, featured.owned.gameId, visualReplay)
    : null;

  return (
    <>
      <header className="achievement-hero-frame">
        <h1>Легенди от масата</h1>
        {status === "ready" ? <AchievementProgressWreath unlocked={unlockedCount} total={ACHIEVEMENTS.length} /> : null}
      </header>

      {status === "unavailable" ? (
        <section className="achievement-load-state" role="alert">
          <h2>Не успяхме да заредим легендите</h2>
          <p>Колекцията временно не е достъпна. Опитай отново след малко.</p>
          <a className="btn btn-secondary achievement-retry" href="/achievements">
            <RotateCw size={18} aria-hidden="true" /> Опитай отново
          </a>
        </section>
      ) : (
        <>
          {featured && feature ? (
            <article className="achievement-feature" data-achievement-id={featured.achievement.id} data-tier={feature.tier} data-family={feature.family} data-locked="false" aria-labelledby={`achievement-${featured.achievement.id}`}>
              <div className="achievement-feature-copy">
                <p className="achievement-feature-kicker">Последно отключено</p>
                <h2 className="achievement-feature-title" id={`achievement-${featured.achievement.id}`}>{featured.achievement.titleBg}</h2>
                <p className="achievement-feature-desc">{featured.achievement.descriptionBg}</p>
                <p className="achievement-feature-meta">
                  <span className="achievement-feature-status"><Check size={16} aria-hidden="true" /> Отключено</span>
                  <span>{feature.familyLabel}</span>
                  <span>{feature.tierLabel}</span>
                  {feature.unlockedDate ? <time dateTime={feature.unlockedDate.toISOString()}>{formatBulgarianDateTime(feature.unlockedDate, { dateStyle: "medium" })}</time> : null}
                </p>
                <div className="achievement-feature-action">
                  {feature.replayHref ? (
                    <Link className="btn btn-primary achievement-replay-link" href={feature.replayHref} prefetch={false} aria-label={`Виж играта: ${featured.achievement.titleBg}`}>
                      Виж играта <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  ) : <p className="achievement-replay-unavailable">Записът не е достъпен</p>}
                </div>
              </div>
              <div className="achievement-feature-art" aria-hidden="true">
                <Image className="achievement-feature-object" src={feature.artSrc} alt="" width={960} height={640} sizes="(max-width: 639px) 90vw, (max-width: 1023px) 55vw, 720px" loading="eager" fetchPriority="high" />
                <Image className="achievement-feature-companion" src={`/game-art/achievements/relics/${featured.achievement.id === "jester_win" ? "hunter_revenge" : "jester_win"}.webp`} alt="" width={960} height={640} sizes="(max-width: 639px) 90px, 260px" loading="eager" />
              </div>
            </article>
          ) : null}
          {unlockedCount === 0 ? (
            <div className="achievement-empty-note">
              <p>Още нямаш отключена легенда. Всяко отличие носи своя история.</p>
              <Link className="btn btn-primary" href="/" prefetch={false}>
                Избери игра <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : null}
          <AchievementCollection
            hasFeatured={featured !== null}
            items={remaining.map(({ achievement, owned: unlocked }, index) => ({
              id: achievement.id,
              isUnlocked: unlocked !== null,
              content: <AchievementPlaque achievement={achievement} unlockedAt={unlocked?.unlockedAt ?? null} gameId={unlocked?.gameId ?? null} visualReplay={visualReplay} headingLevel={3} eager={index === 0} />,
            }))}
          />
        </>
      )}
      <Link className="achievement-return" href="/history">
        Виж записаните игри <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </>
  );
}
