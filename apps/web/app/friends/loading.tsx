import { FriendsHeader } from "@/components/friends/FriendsHeader";
import styles from "@/components/friends/Friends.module.css";

export default function FriendsLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="Зареждане на гостовата книга">
      <FriendsHeader />
      <div className={styles.workspace}>
        <p className={`${styles.notices} ${styles.small}`} role="status">Зареждаме гостовата книга...</p>
        <div className={styles.invitation} aria-hidden="true">
          <span className={styles.loadingBlock} data-kind="title" />
          <span className={styles.loadingBlock} />
          <span className={styles.loadingBlock} />
          <span className={styles.loadingBlock} />
        </div>
        <div className={`${styles.list} ${styles.loadingList}`} aria-hidden="true">
          <span className={styles.loadingBlock} data-kind="title" />
          <span className={styles.loadingBlock} data-kind="row" />
          <span className={styles.loadingBlock} data-kind="row" />
          <span className={styles.loadingBlock} data-kind="row" />
        </div>
      </div>
    </main>
  );
}
