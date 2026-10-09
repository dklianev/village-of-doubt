import Link from "next/link";

export function StatusLastIncident() {
  return (
    <section className="status-section">
      <header className="status-section-head">
        <h2>История на инцидентите</h2>
      </header>

      <p className="status-incident-empty">
        Няма свързан източник за историята на инцидентите. Това не означава, че не е имало прекъсвания.{" "}
        <Link href="/report">Подай сигнал за проблем</Link>.
      </p>
    </section>
  );
}
