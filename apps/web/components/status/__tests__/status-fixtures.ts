import type { StatusSnapshot } from "@/lib/status-health-shared";

export function statusSnapshot(lastCheckedAt = "2026-09-20T10:00:00.000Z"): StatusSnapshot {
  return {
    lastCheckedAt,
    services: [
      { id: "web", name: "Уеб приложение", description: "Страници", status: "ok", icon: "web" },
      { id: "game-server", name: "Игрови сървър", description: "Стаи", status: "ok", icon: "game" },
      { id: "database", name: "База данни", description: "История", status: "ok", icon: "database" },
      { id: "redis", name: "Защита на заявките", description: "Ограничения", status: "ok", icon: "cache" },
      { id: "auth-google", name: "Вход с Google", description: "Външен вход", status: "unknown", icon: "auth", detail: "Конфигуриран; входът не се проверява автоматично." },
      { id: "auth-discord", name: "Вход с Discord", description: "Външен вход", status: "unknown", icon: "auth" },
      { id: "email", name: "Имейл услуга", description: "Имейли", status: "unknown", icon: "email" },
    ],
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
