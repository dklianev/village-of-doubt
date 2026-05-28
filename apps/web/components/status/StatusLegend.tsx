export function StatusLegend() {
  return (
    <section className="status-section status-section-legend">
      <header className="status-section-head">
        <p className="status-section-kicker">какво означават статусите</p>
        <h2>Речник на светлините.</h2>
      </header>

      <dl className="status-legend-grid">
        <div data-status="ok">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Работи
          </dt>
          <dd>Услугата отговаря нормално.</dd>
        </div>
        <div data-status="degraded">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Забавено
          </dt>
          <dd>Услугата отговаря, но е забавена или частично налична.</dd>
        </div>
        <div data-status="down">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Прекъсване
          </dt>
          <dd>Услугата не отговаря. Работим по възстановяване.</dd>
        </div>
        <div data-status="unknown">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Не се проверява
          </dt>
          <dd>Няма автоматична проверка; състоянието е условно.</dd>
        </div>
      </dl>
    </section>
  );
}
