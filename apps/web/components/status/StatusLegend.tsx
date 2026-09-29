export function StatusLegend() {
  return (
    <section className="status-section status-section-legend">
      <header className="status-section-head">
        <h2>Какво означават състоянията</h2>
      </header>

      <dl className="status-legend-grid">
        <div data-status="ok">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Работи
          </dt>
          <dd>Услугата отговаря на последната автоматична проверка.</dd>
        </div>
        <div data-status="degraded">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Ограничена работа
          </dt>
          <dd>Услугата отговаря, но е забавена или частично налична.</dd>
        </div>
        <div data-status="down">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Прекъсване
          </dt>
          <dd>Последната автоматична проверка е неуспешна.</dd>
        </div>
        <div data-status="unknown">
          <dt>
            <span className="status-legend-dot" aria-hidden />
            Непотвърдено
          </dt>
          <dd>Няма автоматична проверка или достатъчно данни. Конфигурацията не доказва, че услугата работи.</dd>
        </div>
      </dl>
    </section>
  );
}
