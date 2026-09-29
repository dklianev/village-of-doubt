import Link from "next/link";
import { getImageProps } from "next/image";
import { ArrowUpRight, Check, LockKeyhole } from "lucide-react";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { achievementPresentation } from "@/components/achievements/achievement-presentation";
import styles from "./Account.module.css";

interface Props {
  unlockedIds: string[];
  total: number;
}

export function AccountAchievements({ unlockedIds, total }: Props) {
  const unlockedSet = new Set(unlockedIds);
  const owned = ACHIEVEMENTS.filter((definition) => unlockedSet.has(definition.id));
  const visibleAchievements = owned.slice(0, 3);
  const lockedCount = Math.max(0, total - owned.length);
  const lockedImage = visibleAchievements.length === 0 ? getImageProps({
    src: "/game-art/achievements/relics/guardian_save.webp", alt: "", width: 960, height: 640,
    sizes: "(max-width: 600px) 120px, 220px",
  }).props : null;

  return (
    <section
      className={`${styles.section} ${styles.achievementsSection}`}
      data-empty={visibleAchievements.length === 0 ? "true" : undefined}
      data-account-empty-legends={visibleAchievements.length === 0 ? "true" : undefined}
    >
      <header className={`${styles.sectionHead} ${styles.collectionHead}`}>
        <div>
          <h2>Легенди</h2>
          <p>{owned.length} от {total} легенди отключени.</p>
        </div>
        {owned.length > 0 ? (
          <Link href="/achievements" className={styles.sectionLink}>
            Виж всички легенди <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {visibleAchievements.length > 0 ? <ul className={styles.achievementRow} aria-label="Спечелени легенди">
        {visibleAchievements.map((definition) => {
          const { artSrc, tierLabel } = achievementPresentation(definition, null, null, false);
          const { props: image } = getImageProps({
            src: artSrc, alt: "", width: 960, height: 640,
            sizes: "(max-width: 600px) 130px, (max-width: 900px) 28vw, 360px",
          });
          return (
            <li key={definition.id}>
              <article
                className={styles.achievementSeal}
                data-achievement-id={definition.id}
                data-tier={definition.tier ?? "bronze"}
                data-family={definition.family ?? "universal"}
              >
                <div className={styles.relicArt}>
                  <img {...image} />
                </div>
                <div className={styles.relicCaption}>
                  <p className={styles.relicTier}><Check size={13} aria-hidden="true" />{tierLabel}</p>
                  <h3 className={styles.achievementTitle}>{definition.titleBg}</h3>
                  <p className={styles.relicDescription}>{definition.descriptionBg}</p>
                </div>
              </article>
            </li>
          );
        })}
      </ul> : null}

      {visibleAchievements.length === 0 ? (
        <div className={styles.achievementEmpty}>
          <div className={styles.lockedPreview} data-account-locked-legend role="img" aria-label="Заключена легенда: Спасител">
            {lockedImage ? <img {...lockedImage} /> : null}
            <span><LockKeyhole size={14} aria-hidden="true" />Заключена</span>
          </div>
          <div className={styles.achievementEmptyCopy}>
            <h3>Легендите още не са започнали.</h3>
            <p>Всяка легенда има свое условие. Виж какво можеш да отключиш в следващата игра.</p>
            <Link href="/achievements" className={styles.sectionLink}>
              Разгледай легендите <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}

      {visibleAchievements.length > 0 && lockedCount > 0 ? (
        <p className={styles.collectionRemainder}>
          <LockKeyhole size={14} aria-hidden="true" />
          {lockedCount === 1 ? "Още една легенда чака своята вечер." : `Още ${lockedCount} легенди чакат своята вечер.`}
        </p>
      ) : null}
    </section>
  );
}
