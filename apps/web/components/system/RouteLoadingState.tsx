import "@/components/system/SystemPages.module.css";

export function RouteLoadingState({ title, variant = "account" }: { title: string; variant?: "account" | "achievements" | "play" }) {
  return (
    <main className={`shell route-loading-shell route-loading-${variant}`} aria-label={title}>
      <header className="route-loading-heading">
        {variant === "account" ? <span className="route-loading-portrait route-placeholder" aria-hidden="true" /> : null}
        <div>
          <p className="route-loading-status" role="status">Зареждаме...</p>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="route-loading-structure" aria-label={title} aria-busy="true">
        {variant === "account" ? <div className="route-loading-tabs" aria-hidden="true">{[0, 1, 2].map(i => <span className="route-placeholder" key={i} />)}</div> : null}
        {variant === "play" ? <div className="route-loading-table" aria-hidden="true"><span className="route-loading-table-inset" /></div> : null}
        <div className="route-loading-items" aria-hidden="true">
          {Array.from({ length: variant === "achievements" ? 6 : 3 }, (_, i) => (
            <div className="route-loading-item" key={i}>
              {variant === "achievements" ? <span className="route-placeholder route-loading-seal" /> : null}
              <span className="route-placeholder" /><span className="route-placeholder" /><span className="route-placeholder" />
            </div>
          ))}
        </div>
      </section>
      <nav className="route-loading-exits" aria-label="Други страници">
        <a href="/">Към началото</a><a href="/faq">Помощ</a>
      </nav>
    </main>
  );
}
