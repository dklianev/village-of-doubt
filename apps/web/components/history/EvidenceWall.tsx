import Form from "next/form";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ListFilter, RotateCcw } from "lucide-react";
import { CaseFileCard } from "./CaseFileCard";
import { EvidenceWallEmpty } from "./EvidenceWallEmpty";
import { ARCHIVE_FAMILIES, ARCHIVE_OUTCOMES, archiveHref, type ArchiveSelection } from "@/lib/history-archive";
import type { HistoryGameView } from "@/lib/history-highlights";
import styles from "./Archive.module.css";

export function ArchiveHeader() {
  return (
    <header className={styles.header}>
      <p className={styles.kicker}>След последния глас</p>
      <h1>Архив на масата</h1>
      <p>Всяка вечер оставя следа.</p>
    </header>
  );
}

export function EvidenceWall({ games, status = "ready", selection = { family: "all", outcome: "all" },
  hasOlder = false, hasNewer = false, visualHistory,
}: {
  games: HistoryGameView[];
  status?: "ready" | "unavailable";
  selection?: ArchiveSelection;
  hasOlder?: boolean;
  hasNewer?: boolean;
  visualHistory?: string | undefined;
}) {
  const filtered = selection.family !== "all" || selection.outcome !== "all";
  const paged = Boolean(selection.before || selection.after);
  const firstPage = { family: selection.family, outcome: selection.outcome };
  const resetHref = archiveHref({ family: "all", outcome: "all" }, visualHistory);
  return (
    <>
      <Form action="/history" key={`${selection.family}:${selection.outcome}`} className={styles.filters} aria-label="Филтри на архива">
        {visualHistory ? <input type="hidden" name="visualHistory" value={visualHistory} /> : null}
        <div className={styles.filterField}>
          <label htmlFor="archive-family">Игра</label>
          <select id="archive-family" name="family" defaultValue={selection.family}>
            {ARCHIVE_FAMILIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="archive-outcome">Победител</label>
          <select id="archive-outcome" name="outcome" defaultValue={selection.outcome}>
            {ARCHIVE_OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <button type="submit" className={styles.filterSubmit}><ListFilter size={17} aria-hidden="true" />Покажи</button>
        {filtered || paged ? <Link className={styles.reset} href={resetHref}><RotateCcw size={15} aria-hidden="true" />Изчисти</Link> : null}
        <p className={styles.archiveScope}>Публични игри · най-новите първо</p>
      </Form>

      {status === "unavailable" ? (
        <section className={styles.notice} data-state="unavailable" role="alert">
          <h2>Архивът не отговори</h2>
          <p>Не успяхме да заредим делата. Опитай отново след малко.</p>
          <a className={styles.textLink} href={archiveHref(selection, visualHistory)}><RotateCcw size={17} aria-hidden="true" />Опитай отново</a>
        </section>
      ) : games.length === 0 ? (
        filtered || paged ? <section className={styles.notice} data-state="filtered-empty">
          <h2>{paged ? "Тук няма повече дела" : "Няма дела с тази развръзка"}</h2>
          <p>{paged ? "Записите в архива може да са се променили. Върни се към най-новите." : "Няма завършени публични игри за избраната комбинация."}</p>
          <Link className={styles.textLink} href={paged ? archiveHref(firstPage, visualHistory) : resetHref}>
            <ArrowLeft size={17} aria-hidden="true" />{paged ? "Към най-новите дела" : "Покажи всички дела"}
          </Link>
        </section> : <EvidenceWallEmpty />
      ) : (
        <>
          <div className={styles.indexLine}>
            <h2>{paged ? "Още от архива" : filtered ? "Избрани вечери" : "Последните вечери"}</h2>
            <p>{games.length} {games.length === 1 ? "дело" : "дела"} на тази страница</p>
          </div>
          <section className={styles.wall} aria-label="Списък с дела">
            {games.map((game) => <CaseFileCard key={game.id} game={game} visualHistory={visualHistory} />)}
          </section>
          {hasNewer || hasOlder ? <nav className={styles.pagination} aria-label="Страници на архива">
            {hasNewer ? <Link href={archiveHref({ ...firstPage, after: games[0]!.id }, visualHistory)} className={styles.textLink}>
              <ArrowLeft size={18} aria-hidden="true" />По-нови дела
            </Link> : <span />}
            {hasOlder ? <Link href={archiveHref({ ...firstPage, before: games.at(-1)!.id }, visualHistory)} className={styles.textLink}>
              По-стари дела<ArrowRight size={18} aria-hidden="true" />
            </Link> : null}
          </nav> : null}
        </>
      )}
    </>
  );
}

export function ArchiveLoading() {
  return <p className={styles.loading} role="status">Зареждаме делата...</p>;
}
