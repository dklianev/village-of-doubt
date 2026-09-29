export type ServiceStatusKind = "ok" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  status: ServiceStatusKind;
  detail?: string;
  icon: "web" | "game" | "database" | "cache" | "auth" | "email";
}

export interface StatusSnapshot {
  services: ServiceHealth[];
  lastCheckedAt: string;
}

const SERVICE_ICONS: Record<string, ServiceHealth["icon"]> = {
  web: "web",
  "game-server": "game",
  database: "database",
  redis: "cache",
  "auth-google": "auth",
  "auth-discord": "auth",
  email: "email",
};
const CRITICAL_SERVICE_IDS = ["web", "game-server", "database", "redis"];

export function parseStatusSnapshot(value: unknown): StatusSnapshot | null {
  if (!value || typeof value !== "object" || !("services" in value) || !("lastCheckedAt" in value)) {
    return null;
  }
  const { services, lastCheckedAt } = value;
  if (typeof lastCheckedAt !== "string" || !Number.isFinite(Date.parse(lastCheckedAt)) ||
      new Date(lastCheckedAt).toISOString() !== lastCheckedAt ||
      !Array.isArray(services) || services.length !== Object.keys(SERVICE_ICONS).length) {
    return null;
  }

  const parsed: ServiceHealth[] = [];
  const seen = new Set<string>();
  for (const service of services) {
    if (!service || typeof service !== "object") return null;
    const { id, name, description, status, detail, icon } = service;
    if (typeof id !== "string" || !Object.hasOwn(SERVICE_ICONS, id) || seen.has(id) ||
        icon !== SERVICE_ICONS[id] ||
        !isStatusText(name, 120) || !isStatusText(description, 500) ||
        (detail !== undefined && !isStatusText(detail, 500)) ||
        (status !== "ok" && status !== "degraded" && status !== "down" && status !== "unknown")) {
      return null;
    }
    seen.add(id);
    // Keep only public display fields, never arbitrary fields from a response.
    parsed.push({ id, name, description, status, icon, ...(detail === undefined ? {} : { detail }) });
  }
  return { services: parsed, lastCheckedAt };
}

function isStatusText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function computeOverallStatus(services: ServiceHealth[]): ServiceStatusKind {
  if (services.some((service) => service.status === "down")) {
    return "down";
  }

  if (services.some((service) => service.status === "degraded")) {
    return "degraded";
  }

  return CRITICAL_SERVICE_IDS.every((id) => services.some((service) => service.id === id && service.status === "ok"))
    ? "ok"
    : "unknown";
}
