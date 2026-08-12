import { checkDatabaseReadiness, createDatabase } from "@werewolf/database";
import { checkRuntimeRedisReadiness } from "./runtime-rate-limit";
import type { ServiceHealth, ServiceStatusKind } from "./status-health-shared";

export type { ServiceHealth, ServiceStatusKind } from "./status-health-shared";

export interface StatusSnapshot {
  services: ServiceHealth[];
  lastCheckedAt: string;
}

const DEFAULT_STATUS_CACHE_TTL_MS = 20_000;
let cachedSnapshot: { expiresAt: number; value: StatusSnapshot } | null = null;
let inFlightSnapshot: Promise<StatusSnapshot> | null = null;

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

  return configuredUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "") + "/health/ready";
}

async function checkDatabaseService(databaseUrl: string | undefined): Promise<ServiceStatusKind> {
  if (!databaseUrl) {
    return "unknown";
  }

  try {
    return (await checkDatabaseReadiness(createDatabase(databaseUrl))) ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function loadStatusSnapshot(): Promise<StatusSnapshot> {
  const fixture = loadStatusFixture();
  if (fixture) {
    return cloneSnapshot(fixture);
  }

  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return cloneSnapshot(cachedSnapshot.value);
  }
  if (inFlightSnapshot) {
    return cloneSnapshot(await inFlightSnapshot);
  }

  const load = loadUncachedStatusSnapshot();
  inFlightSnapshot = load;
  try {
    const snapshot = await load;
    cachedSnapshot = {
      expiresAt: Date.now() + readPositiveInteger(
        process.env.STATUS_CACHE_TTL_MS,
        DEFAULT_STATUS_CACHE_TTL_MS,
      ),
      value: snapshot,
    };
    return cloneSnapshot(snapshot);
  } finally {
    if (inFlightSnapshot === load) {
      inFlightSnapshot = null;
    }
  }
}

function loadStatusFixture(): StatusSnapshot | null {
  if (process.env.NODE_ENV === "production" || process.env.STATUS_HEALTH_FIXTURE !== "healthy") {
    return null;
  }

  return {
    lastCheckedAt: "2026-01-01T00:00:00.000Z",
    services: [
      {
        id: "web",
        name: "Уеб приложение",
        description: "Този сайт и страниците.",
        status: "ok",
        detail: "Отговаря",
        icon: "web",
      },
      {
        id: "game-server",
        name: "Игрови сървър",
        description: "Стаите и връзките в реално време.",
        status: "ok",
        detail: "42 ms",
        icon: "game",
      },
      {
        id: "database",
        name: "База данни",
        description: "Досиета, история, легенди.",
        status: "ok",
        detail: "Отговаря",
        icon: "database",
      },
      {
        id: "redis",
        name: "Защита на заявките",
        description: "Ограничения и споделено състояние.",
        status: "ok",
        detail: "Отговаря",
        icon: "cache",
      },
      {
        id: "auth-google",
        name: "Вход с Google",
        description: "Външен OAuth провайдър.",
        status: "unknown",
        detail: "Не е конфигуриран",
        icon: "auth",
      },
      {
        id: "auth-discord",
        name: "Вход с Discord",
        description: "Външен OAuth провайдър.",
        status: "unknown",
        detail: "Не е конфигуриран",
        icon: "auth",
      },
      {
        id: "email",
        name: "Имейл услуга",
        description: "Потвърждения, нови пароли, сигнали.",
        status: "unknown",
        detail: "Не е конфигурирана",
        icon: "email",
      },
    ],
  };
}

export async function loadStatusServices(): Promise<ServiceHealth[]> {
  return (await loadStatusSnapshot()).services;
}

export function resetStatusHealthCacheForTests() {
  cachedSnapshot = null;
  inFlightSnapshot = null;
}

async function loadUncachedStatusSnapshot(): Promise<StatusSnapshot> {
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
  const [gameResult, databaseStatus, redisStatus] = await Promise.all([
    healthUrl ? checkService(healthUrl) : null,
    checkDatabaseService(process.env.DATABASE_URL),
    checkRedisService(process.env.REDIS_URL),
  ]);

  if (healthUrl && gameResult) {
    services.push({
      id: "game-server",
      name: "Игрови сървър",
      description: "Стаите и връзките в реално време.",
      status: gameResult.ok ? "ok" : "down",
      detail: gameResult.ok ? `${gameResult.ms} ms` : "Не отговаря",
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
    description: "Досиета, история, легенди.",
    status: databaseStatus,
    detail: databaseStatus === "ok" ? "Отговаря" : databaseStatus === "down" ? "Не отговаря" : "Не е достъпна",
    icon: "database",
  });

  services.push({
    id: "redis",
    name: "Защита на заявките",
    description: "Ограничения и споделено състояние.",
    status: redisStatus,
    detail: redisStatus === "ok" ? "Отговаря" : redisStatus === "down" ? "Не отговаря" : "Не е конфигурирана",
    icon: "cache",
  });

  services.push({
    id: "auth-google",
    name: "Вход с Google",
    description: "Външен OAuth провайдър.",
    status: process.env.GOOGLE_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.GOOGLE_CLIENT_ID ? "Конфигуриран" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "auth-discord",
    name: "Вход с Discord",
    description: "Външен OAuth провайдър.",
    status: process.env.DISCORD_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.DISCORD_CLIENT_ID ? "Конфигуриран" : "Не е конфигуриран",
    icon: "auth",
  });

  services.push({
    id: "email",
    name: "Имейл услуга",
    description: "Потвърждения, нови пароли, сигнали.",
    status: process.env.RESEND_API_KEY ? "ok" : "unknown",
    detail: process.env.RESEND_API_KEY ? "Конфигурирана" : "Не е конфигурирана",
    icon: "email",
  });

  return {
    services,
    lastCheckedAt: new Date().toISOString(),
  };
}

async function checkRedisService(redisUrl: string | undefined): Promise<ServiceStatusKind> {
  if (!redisUrl) {
    return "unknown";
  }
  return (await checkRuntimeRedisReadiness()) ? "ok" : "down";
}

function cloneSnapshot(snapshot: StatusSnapshot): StatusSnapshot {
  return {
    lastCheckedAt: snapshot.lastCheckedAt,
    services: snapshot.services.map((service) => ({ ...service })),
  };
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
