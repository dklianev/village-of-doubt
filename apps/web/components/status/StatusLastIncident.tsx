import Link from "next/link";

const INCIDENT: {
  date: string;
  durationMinutes: number;
  summary: string;
  resolutionDetail: string;
} | null = null;

export function StatusLastIncident() {
  return (
    <section className="status-section">
      <header className="status-section-head">
        <p className="status-section-kicker">последен инцидент</p>
        <h2>Какво се е счупвало напоследък.</h2>
      </header>

      {INCIDENT ? (
        <article className="status-incident-card">
          <header className="status-incident-head">
            <time className="status-incident-date" dateTime={INCIDENT.date}>
              {new Intl.DateTimeFormat("bg-BG", { dateStyle: "long", timeStyle: "short" }).format(
                new Date(INCIDENT.date),
              )}
            </time>
            <span className="status-incident-duration">{INCIDENT.durationMinutes} мин. прекъсване</span>
          </header>
          <p className="status-incident-summary">{INCIDENT.summary}</p>
          <p className="status-incident-resolution">{INCIDENT.resolutionDetail}</p>
        </article>
      ) : (
        <p className="status-incident-empty">
          Няма скорошни инциденти, за които да си заслужава да говорим. Ако нещо ти изглежда счупено,{" "}
          <Link href="/report">подай сигнал</Link>.
        </p>
      )}
    </section>
  );
}
