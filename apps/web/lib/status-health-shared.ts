export type ServiceStatusKind = "ok" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  status: ServiceStatusKind;
  detail?: string;
  icon: "web" | "game" | "database" | "cache" | "auth" | "email";
}

export function computeOverallStatus(services: ServiceHealth[]): ServiceStatusKind {
  if (services.some((service) => service.status === "down")) {
    return "down";
  }

  const critical = services.filter(
    (service) =>
      service.id === "web" ||
      service.id === "game-server" ||
      service.id === "database" ||
      service.id === "redis",
  );
  if (critical.length > 0 && critical.every((service) => service.status === "ok")) {
    return "ok";
  }

  return "degraded";
}
