import { Display, Pill } from "@werewolf/ui";
import styles from "./History.module.css";

export function EvidenceWallEmpty() {
  return (
    <section className={styles.emptyArchive} aria-label="Празен архив">
      <div className={styles.emptyArchiveTable} aria-hidden="true">
        <span className={styles.emptyInkBottle} />
        <span className={styles.emptyFolder} />
        <span className={styles.emptyThread} />
      </div>
      <div className={styles.emptyArchiveCopy}>
        <span className={styles.boardKicker}>Няма заведени дела</span>
        <Display size="h2" as="h2">
          Първото дело още не е заведено.
        </Display>
        <p>Завърши игра и архиварят ще сложи папката на масата.</p>
        <Pill as="a" href="/create" intent="secondary" shimmer>
          Създай първото дело
        </Pill>
      </div>
      <article className={styles.ghostCaseFile} aria-hidden="true">
        <span className={styles.exampleTag}>ПРИМЕР</span>
        <span className={styles.caseFileEyebrow}>ДЕЛО №4821</span>
        <strong>Селото оцеля през три нощи.</strong>
        <p>Гадателката разпозна Върколака преди последното гласуване. Никой не повярва, докато сутринта камбаната не зазвъня.</p>
      </article>
    </section>
  );
}
