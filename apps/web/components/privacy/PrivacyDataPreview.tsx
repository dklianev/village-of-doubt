import Link from "next/link";
import { Display, PaperCard } from "@werewolf/ui/server";
import type { PrivacyUserSnapshot } from "./PrivacyDashboard";
import styles from "./PrivacyDataPreview.module.css";

interface PrivacyDataPreviewProps {
  snapshot: PrivacyUserSnapshot;
}

export function PrivacyDataPreview({ snapshot }: PrivacyDataPreviewProps) {
  const memberSinceLabel = snapshot.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric" }).format(snapshot.memberSince)
    : "—";

  return (
    <section className={`privacy-section ${styles.previewSection}`}>
      <PaperCard eyebrow="ЛИЧЕН ПРЕГЛЕД" density="lg">
        <header className="privacy-section-head">
          <Display as="h2" size="h3">
            Какво виждаме за теб точно сега.
          </Display>
          <p className="privacy-section-lede">
            Това е целият списък с данни, които пазим за твоето досие. Нищо повече, нищо скрито.
          </p>
        </header>

        <dl className={styles.dataList}>
          <div className={styles.dataRow}>
            <dt>
              <span className={styles.dataIcon} aria-hidden>
                @
              </span>
              <span>Имейл адрес</span>
            </dt>
            <dd>
              <code>{snapshot.email}</code>
              {snapshot.emailVerified ? (
                <span className={`${styles.dataBadge} ${styles.dataBadgeOk}`}>потвърден</span>
              ) : (
                <Link href="/verify-email" className={`${styles.dataBadge} ${styles.dataBadgeWarn}`}>
                  непотвърден →
                </Link>
              )}
            </dd>
          </div>

          <div className={styles.dataRow}>
            <dt>
              <span className={styles.dataIcon} aria-hidden>
                И
              </span>
              <span>Име на масата</span>
            </dt>
            <dd>
              <code>{snapshot.name || "—"}</code>
              <Link href="/account" className={styles.dataEdit}>
                Промени →
              </Link>
            </dd>
          </div>

          <div className={styles.dataRow}>
            <dt>
              <span className={styles.dataIcon} aria-hidden>
                #
              </span>
              <span>Игрова история</span>
            </dt>
            <dd>
              <code>
                {snapshot.totalGames === 0
                  ? "още няма"
                  : `${snapshot.totalGames} ${snapshot.totalGames === 1 ? "игра" : "игри"}`}
              </code>
              <Link href="/history" className={styles.dataEdit}>
                Виж архива →
              </Link>
            </dd>
          </div>

          <div className={styles.dataRow}>
            <dt>
              <span className={styles.dataIcon} aria-hidden>
                ★
              </span>
              <span>Легенди</span>
            </dt>
            <dd>
              <code>
                {snapshot.totalAchievements} от {snapshot.achievementTotal} отключени
              </code>
              <Link href="/achievements" className={styles.dataEdit}>
                Виж всички →
              </Link>
            </dd>
          </div>

          <div className={styles.dataRow}>
            <dt>
              <span className={styles.dataIcon} aria-hidden>
                ◷
              </span>
              <span>Регистриран</span>
            </dt>
            <dd>
              <code>{memberSinceLabel}</code>
              <span className={styles.dataBadge}>{snapshot.providersUsed} входа</span>
            </dd>
          </div>
        </dl>

        <div className={styles.dataActions}>
          <a href="/api/account/export" className={`${styles.dataAction} ${styles.dataActionPrimary}`}>
            <span>Изтегли всичките данни</span>
            <span className={styles.dataActionHint}>JSON файл със всичко, което знаем</span>
          </a>
        </div>

        <p className={styles.dataDisclaimer}>
          Не виждаме твоя IP адрес след сесия, не пазим клавишни последователности, не четем чат
          съобщенията извън стаите на играта. Всичко, което показваме тук, можеш да изтеглиш или
          изтриеш по всяко време.
        </p>
      </PaperCard>
    </section>
  );
}
