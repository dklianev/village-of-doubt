import { Database, Gamepad2, Globe, KeyRound, Layers, Mail } from "lucide-react";
import type { ServiceHealth, ServiceStatusKind } from "@/lib/status-health-shared";

const STATUS_LABEL: Record<ServiceStatusKind, string> = {
  ok: "Работи",
  degraded: "Ограничена работа",
  down: "Прекъсване",
  unknown: "Непотвърдено",
};

const SERVICE_ICONS = { web: Globe, game: Gamepad2, database: Database, cache: Layers, auth: KeyRound, email: Mail };

export function StatusServiceTiles({ services, stale = false }: { services: ServiceHealth[]; stale?: boolean }) {
  return (
    <section className="status-section">
      <header className="status-section-head">
        <h2>{stale ? "Последни получени данни" : "Проверки на услугите"}</h2>
        <p className="status-section-lede">Входът и доставката на имейли не се проверяват автоматично.</p>
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
  const Icon = SERVICE_ICONS[name];
  return <Icon className="status-tile-icon" size={28} strokeWidth={1.6} aria-hidden="true" />;
}
