import "@/components/system/SystemPages.module.css";

export function RouteLoadingState({ title }: { title: string }) {
  return (
    <main className="shell route-state-shell" aria-busy="true" aria-label="Зареждане">
      <section className="route-loading-card">
        <p className="eyebrow">зареждане</p>
        <h1>{title}</h1>
        <div className="route-loading-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
