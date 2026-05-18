import type { ServiceHealth, ServiceStatusKind } from "@/lib/status-health";

const STATUS_LABEL: Record<ServiceStatusKind, string> = {
  ok: "Работи",
  degraded: "Забавено",
  down: "Прекъсване",
  unknown: "Не се проверява",
};

export function StatusServiceTiles({ services }: { services: ServiceHealth[] }) {
  return (
    <section className="status-section">
      <header className="status-section-head">
        <p className="status-section-kicker">услуги</p>
        <h2>Какво проверяваме точно сега.</h2>
      </header>

      <ul className="status-tile-grid">
        {services.map((service) => (
          <li key={service.id}>
            <article className="status-tile" data-status={service.status}>
              <div className="status-tile-head">
                <ServiceIcon name={service.icon} />
                <h3>{service.name}</h3>
                <span className="status-tile-badge">{STATUS_LABEL[service.status]}</span>
              </div>
              <p className="status-tile-description">{service.description}</p>
              {service.detail ? <p className="status-tile-detail">{service.detail}</p> : null}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ServiceIcon({ name }: { name: ServiceHealth["icon"] }) {
  const common = {
    className: "status-tile-icon",
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "web":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M5 16h22M16 5c4 5.5 4 16.5 0 22M16 5c-4 5.5-4 16.5 0 22" />
        </svg>
      );
    case "game":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="24" height="14" rx="3" />
          <path d="M9 17h4M11 15v4" />
          <circle cx="20" cy="15" r="1.5" fill="currentColor" />
          <circle cx="23" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="16" cy="8" rx="10" ry="3" />
          <path d="M6 8v16c0 2 3.5 3 10 3s10-1 10-3V8" />
          <path d="M6 16c2.5 2 17.5 2 20 0" />
        </svg>
      );
    case "auth":
      return (
        <svg {...common}>
          <rect x="7" y="14" width="18" height="14" rx="2" />
          <path d="M11 14v-4c0-3.5 2-5 5-5s5 1.5 5 5v4" />
          <circle cx="16" cy="21" r="1.5" fill="currentColor" />
        </svg>
      );
    case "email":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="24" height="16" rx="2" />
          <path d="m4 11 12 8 12-8" />
        </svg>
      );
  }
}
