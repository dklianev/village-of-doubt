import Image from "next/image";
import { Display, SceneCard } from "@werewolf/ui/server";
import styles from "./AccountHero.module.css";

interface AccountHeroProps {
  name: string;
  image: string | null;
  memberSince: Date | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
}

export function AccountHero(props: AccountHeroProps) {
  const initial = (props.name[0] ?? "?").toUpperCase();
  const memberSinceLabel = props.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { year: "numeric", month: "long" }).format(props.memberSince)
    : null;

  return (
    <header aria-label="Досие" className={styles.heroFrame}>
      <SceneCard
        eyebrow="ДОСИЕ"
        density="lg"
        background={{
          image: "var(--art-account)",
          overlay: "scrim",
          focalY: 35,
        }}
      >
        <div className={styles.heroProfile}>
          <div className={styles.heroAvatar}>
            {props.image ? (
              <Image src={props.image} alt="" width={96} height={96} sizes="96px" unoptimized />
            ) : (
              <span className={styles.heroInitial}>{initial}</span>
            )}
          </div>

          <div className={styles.heroName}>
            <Display size="h1">{props.name || "Без име"}</Display>
            {memberSinceLabel ? (
              <p className={styles.heroMember}>Член от {memberSinceLabel}</p>
            ) : null}
          </div>
        </div>

        {props.totalGames > 0 ? (
          <dl className={styles.heroStats}>
            <div>
              <dt className={styles.statLabel}>Игри</dt>
              <dd className={styles.statValue}>{props.totalGames}</dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Победи</dt>
              <dd className={styles.statValue}>{props.totalWins}</dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Процент</dt>
              <dd className={styles.statValue}>{props.winRate}%</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.heroEmpty}>Първото дело още чака име.</p>
        )}
      </SceneCard>
    </header>
  );
}
