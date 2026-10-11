import styles from "./Friends.module.css";

export function FriendsHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <p className={styles.kicker}>Гостовата книга</p>
        <h1>Познати на масата</h1>
        <p className={styles.subtitle}>Компанията прави вечерта.</p>
      </div>
    </header>
  );
}
