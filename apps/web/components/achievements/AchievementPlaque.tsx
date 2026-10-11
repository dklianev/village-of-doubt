import type { AchievementDefinition } from "@werewolf/shared";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, LockKeyhole } from "lucide-react";
import { formatBulgarianDateTime } from "@/lib/date-time";
import { achievementPresentation } from "./achievement-presentation";

interface PlaqueProps {
  achievement: AchievementDefinition;
  unlockedAt: string | null;
  gameId?: string | null;
  visualReplay?: boolean;
  headingLevel?: 2 | 3;
  eager?: boolean;
}

export function AchievementPlaque({ achievement, unlockedAt, gameId = null, visualReplay = false, headingLevel = 2, eager = false }: PlaqueProps) {
  const { tier, family, isUnlocked, replayHref, unlockedDate, familyLabel, tierLabel, artSrc } =
    achievementPresentation(achievement, unlockedAt, gameId, visualReplay);
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const titleId = `achievement-${achievement.id}`;

  return (
    <article className="achievement-plaque" data-achievement-id={achievement.id} data-tier={tier} data-family={family} data-locked={!isUnlocked} aria-labelledby={titleId}>
      <div className="achievement-plaque-art">
        <Image src={artSrc} alt="" width={960} height={640} sizes="(max-width: 639px) 34vw, (max-width: 1023px) 44vw, (max-width: 1599px) 28vw, 560px" loading={eager ? "eager" : "lazy"} />
      </div>
      <div className="achievement-plaque-inner">
        <Heading className="achievement-plaque-title" id={titleId}>{achievement.titleBg}</Heading>
        <p className="achievement-plaque-family"><span>{familyLabel}</span>{" · "}<span className="achievement-plaque-tier">{tierLabel}</span></p>
        <p className="achievement-plaque-desc">{achievement.descriptionBg}</p>
        <p className="achievement-plaque-meta">
          {isUnlocked ? <Check size={16} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}
          {isUnlocked ? "Отключено" : "Заключено"}
          {unlockedDate ? <time dateTime={unlockedDate.toISOString()}>{formatBulgarianDateTime(unlockedDate, { dateStyle: "medium" })}</time> : null}
        </p>
        {replayHref ? (
          <Link className="achievement-replay-link" href={replayHref} prefetch={false} aria-label={`Виж играта: ${achievement.titleBg}`}>
            Виж играта <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        ) : isUnlocked ? <p className="achievement-replay-unavailable">Записът не е достъпен</p> : null}
      </div>
    </article>
  );
}
