"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useOfflineRecovery } from "@/components/offline/use-offline-recovery";
import "@/components/offline/Offline.module.css";

const STATUS_COPY = {
  waiting: "Очакваме връзка със сайта.",
  checking: "Проверяваме връзката...",
  offline: "Устройството е без връзка.",
  unavailable: "Сайтът още не е достъпен.",
  exhausted: "Автоматичните проверки приключиха.",
  restoring: "Сайтът отговаря. Отваряме страницата...",
} as const;

export function OfflineClient() {
  const { state, checkConnection } = useOfflineRecovery();

  return (
    <article className="offline-page">
      <header className="offline-hero">
        {/* The optimized original is precached; recovery must not require the image optimizer. */}
        <img
          src="/game-art/system/offline-lantern-v1.webp"
          alt=""
          width={1536}
          height={1024}
          fetchPriority="high"
          decoding="async"
          className="offline-hero-img"
        />
        <div className="offline-hero-scrim" aria-hidden />
        <div className="offline-hero-copy">
          <p className="offline-kicker">
            <WifiOff aria-hidden strokeWidth={2} />
            <span>връзката прекъсна</span>
          </p>
          <h1>Няма връзка</h1>
          <p>
            Страницата не е достъпна в момента. Връзката може да е прекъснала или сайтът да не отговаря.
          </p>

          <div className="offline-status" data-state={state} role="status">
            <span className="offline-status-dot" aria-hidden />
            <span>{STATUS_COPY[state]}</span>
          </div>
        </div>
      </header>

      <section className="offline-actions" aria-label="Възстановяване на връзката">
        <button
          className="btn btn-primary"
          type="button"
          onClick={checkConnection}
          disabled={state === "checking" || state === "restoring"}
          aria-busy={state === "checking"}
        >
          <RefreshCw aria-hidden strokeWidth={2} />
          <span>Провери връзката</span>
        </button>
        <p>Участието ти в текущата игра зависи от това дали тя още продължава.</p>
      </section>
    </article>
  );
}
