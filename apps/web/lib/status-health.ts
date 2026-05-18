export type ServiceStatusKind = "ok" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  status: ServiceStatusKind;
  detail?: string;
  icon: "web" | "game" | "database" | "auth" | "email";
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

function gameServerHealthUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (!configuredUrl) {
    return null;
  }

  return configuredUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "") + "/health";
}

export async function loadStatusServices(): Promise<ServiceHealth[]> {
  const services: ServiceHealth[] = [
    {
      id: "web",
      name: "Уеб приложение",
      description: "Този сайт и страниците.",
      status: "ok",
      detail: "Отговаря",
      icon: "web",
    },
  ];

  const healthUrl = gameServerHealthUrl();
  if (healthUrl) {
    const result = await checkService(healthUrl);
    services.push({
      id: "game-server",
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време.",
      status: result.ok ? "ok" : "down",
      detail: result.ok ? `${result.ms} ms` : "Не отговаря",
      icon: "game",
    });
  } else {
    services.push({
      id: "game-server",
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време.",
      status: "unknown",
      detail: "Не е конфигуриран",
      icon: "game",
    });
  }

  services.push({
    id: "database",
    name: "База данни",
    description: "Профили, история, постижения.",
    status: process.env.DATABASE_URL ? "ok" : "unknown",
    detail: process.env.DATABASE_URL ? "Конфигурирана" : "Не е достъпна",
    icon: "database",
  });

  services.push({
    id: "auth-google",
    name: "Вход с Google",
    description: "Външен OAuth провайдър.",
    status: process.env.GOOGLE_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.GOOGLE_CLIENT_ID ? "Активен" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "auth-discord",
    name: "Вход с Discord",
    description: "Външен OAuth провайдър.",
    status: process.env.DISCORD_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.DISCORD_CLIENT_ID ? "Активен" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "email",
    name: "Имейл услуга",
    description: "Потвърждения, нови пароли, сигнали.",
    status: process.env.RESEND_API_KEY ? "ok" : "unknown",
    detail: process.env.RESEND_API_KEY ? "Активна" : "Не е конфигурирана",
    icon: "email",
  });

  return services;
}

export function computeOverallStatus(services: ServiceHealth[]): ServiceStatusKind {
  if (services.some((service) => service.status === "down")) {
    return "down";
  }

  const critical = services.filter(
    (service) => service.id === "web" || service.id === "game-server" || service.id === "database",
  );
  if (critical.length > 0 && critical.every((service) => service.status === "ok")) {
    return "ok";
  }

  return "degraded";
}
