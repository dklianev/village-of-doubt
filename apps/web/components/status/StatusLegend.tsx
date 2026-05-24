import styles from "./Status.module.css";

export function StatusLegend() {
  return (
    <section className={`${styles.section} ${styles.legend}`}>
      <header className={styles.sectionHead}>
        <p className={styles.sectionKicker}>какво означават статусите</p>
        <h2>Речник на светлините.</h2>
      </header>

      <dl className={styles.legendGrid}>
        <div data-status="ok">
          <dt>
            <span className={styles.legendDot} aria-hidden />
            Работи
          </dt>
          <dd>Услугата отговаря нормално.</dd>
        </div>
        <div data-status="degraded">
          <dt>
            <span className={styles.legendDot} aria-hidden />
            Забавено
          </dt>
          <dd>Услугата отговаря, но е забавена или частично налична.</dd>
        </div>
        <div data-status="down">
          <dt>
            <span className={styles.legendDot} aria-hidden />
            Прекъсване
          </dt>
          <dd>Услугата не отговаря. Работим по възстановяване.</dd>
        </div>
        <div data-status="unknown">
          <dt>
            <span className={styles.legendDot} aria-hidden />
            Не се проверява
          </dt>
          <dd>Няма автоматична проверка; състоянието е условно.</dd>
        </div>
      </dl>
    </section>
  );
}
