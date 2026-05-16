import type { Metadata } from "next";
import { ResourceHints } from "@/components/resource-hints";

export const metadata: Metadata = {
  title: "Състояние | Върколак и Мафия",
  description: "Здраве на сървърите и услугите.",
};

export const dynamic = "force-dynamic";

interface ServiceStatus {
  name: string;
  description: string;
  status: "ok" | "degraded" | "down" | "unknown";
  detail?: string;
}

async function checkService(url: string, timeoutMs = 3000): Promise<{ ok: boolean; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return { ok: response.ok, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, ms: Date.now() - start };
  }
}

function gameServerHealthUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (!configuredUrl) {
    return null;
  }

  return configuredUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "") + "/health";
}

async function loadStatuses(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [
    {
      name: "Уеб приложение",
      description: "Този сайт",
      status: "ok",
      detail: "Отговаря",
    },
  ];

  const healthUrl = gameServerHealthUrl();
  if (healthUrl) {
    const result = await checkService(healthUrl);
    services.push({
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време",
      status: result.ok ? "ok" : "down",
      detail: result.ok ? `${result.ms} ms` : "Не отговаря",
    });
  } else {
    services.push({
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време",
      status: "unknown",
      detail: "Не е конфигуриран",
    });
  }

  services.push({
    name: "База данни",
    description: "Профили, история и постижения",
    status: process.env.DATABASE_URL ? "ok" : "unknown",
    detail: process.env.DATABASE_URL ? "Конфигурирана" : "Не е достъпна",
  });

  services.push({
    name: "Вход с Google",
    description: "Външен вход за профили",
    status: process.env.GOOGLE_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.GOOGLE_CLIENT_ID ? "Активен" : "Не е конфигуриран",
  });

  services.push({
    name: "Вход с Discord",
    description: "Външен вход за профили",
    status: process.env.DISCORD_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.DISCORD_CLIENT_ID ? "Активен" : "Не е конфигуриран",
  });

  services.push({
    name: "Имейл услуга",
    description: "Потвърждения, нови пароли и сигнали",
    status: process.env.RESEND_API_KEY ? "ok" : "unknown",
    detail: process.env.RESEND_API_KEY ? "Активна" : "Не е конфигурирана",
  });

  return services;
}

const STATUS_LABEL_BG: Record<ServiceStatus["status"], string> = {
  ok: "Стабилно",
  degraded: "Бавно",
  down: "Прекъсване",
  unknown: "Неизвестно",
};

function getOverallStatus(services: ServiceStatus[]): ServiceStatus["status"] {
  if (services.some((service) => service.status === "down")) {
    return "down";
  }
  if (services.every((service) => service.status === "ok")) {
    return "ok";
  }
  return "degraded";
}

function overallLabel(status: ServiceStatus["status"]) {
  if (status === "ok") {
    return "Всички системи работят.";
  }
  if (status === "down") {
    return "Засечена е авария.";
  }
  return "Една или повече услуги са в неизвестно състояние.";
}

export default async function StatusPage() {
  const services = await loadStatuses();
  const overall = getOverallStatus(services);

  return (
    <main className="shell harbor-shell">
      <ResourceHints images={["/game-art/auth/status-harbor.webp"]} />
      <section className="harbor-stage">
        <div className="harbor-art" aria-hidden />

        <article className="harbor-card">
          <header>
            <p className="harbor-kicker">състояние</p>
            <h1>Бдим над масата.</h1>
            <p className="harbor-subtitle">
              Преглед на здравето на услугите ни. Опреснява се при всяко зареждане.
            </p>
            <p className={`harbor-overall harbor-overall-${overall}`}>
              <span className="harbor-dot" aria-hidden />
              {overallLabel(overall)}
            </p>
          </header>

          <ul className="harbor-list">
            {services.map((service) => (
              <li key={service.name} className={`harbor-item harbor-item-${service.status}`}>
                <span className="harbor-item-dot" aria-hidden />
                <div className="harbor-item-body">
                  <h2>{service.name}</h2>
                  <p className="harbor-item-desc">{service.description}</p>
                  <p className="harbor-item-status">
                    <strong>{STATUS_LABEL_BG[service.status]}</strong>
                    {service.detail ? ` · ${service.detail}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <footer className="harbor-foot">
            <p>
              Видял си нещо счупено? <a href="/report">Подай сигнал</a>.
            </p>
            <p className="harbor-foot-time">Проверено в {new Date().toLocaleString("bg-BG")}</p>
          </footer>
        </article>
      </section>
    </main>
  );
}
