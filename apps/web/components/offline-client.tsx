"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import "@/components/offline/Offline.module.css";

const RETRY_DELAYS_MS = [5_000, 5_000, 10_000, 10_000, 15_000, 20_000, 30_000, 30_000] as const;

export function OfflineClient() {
  const [retryCount, setRetryCount] = useState(0);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);

    async function checkConnection() {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (!isOnline || document.hidden) {
        return;
      }

      try {
        await fetch("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(2000),
        });
        window.location.reload();
      } catch {
        setOnline(false);
      }
    }

    let retryIndex = 0;
    let timeoutId: number | undefined;

    function scheduleRetry() {
      if (document.hidden || timeoutId !== undefined || retryIndex >= RETRY_DELAYS_MS.length) {
        return;
      }
      timeoutId = window.setTimeout(retry, RETRY_DELAYS_MS[retryIndex]);
    }

    function retry() {
      timeoutId = undefined;
      if (document.hidden) {
        return;
      }
      retryIndex += 1;
      setRetryCount((count) => count + 1);
      void checkConnection().finally(scheduleRetry);
    }

    const handleOnline = () => void checkConnection();
    const handleOffline = () => void checkConnection();
    const handleVisibilityChange = () => scheduleRetry();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleRetry();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <article className="offline-page">
      <header className="offline-hero">
        <Image
          src="/game-art/legal/offline-banner.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 1180px) 100vw, 1180px"
          className="offline-hero-img"
        />
        <div className="offline-hero-scrim" aria-hidden />
        <div className="offline-hero-copy">
          <p className="offline-kicker">
            <WifiOff aria-hidden strokeWidth={2} />
            <span>връзката прекъсна</span>
          </p>
          <h1>Лампата свети, чакаме теб.</h1>
          <p>
            Ако си бил в активна стая, не затваряй страницата. Когато връзката се върне, ще те
            върнем към същото място.
          </p>

          <div className="offline-status" data-state={online ? "online" : "offline"} role="status">
            <span className="offline-status-dot" aria-hidden />
            <span>{online ? "Възстановяваме връзката..." : `Очакваме връзка... (опит ${retryCount + 1})`}</span>
            <button
              type="button"
              className="offline-status-retry"
              onClick={() => window.location.reload()}
              aria-label="Опитай отново сега"
            >
              <RefreshCw aria-hidden strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <section className="offline-actions" aria-label="Бързи връзки">
        <Link className="btn btn-primary" href="/">
          Към началото
        </Link>
        <Link className="btn btn-secondary" href="/werewolf/rules">
          Прочети правилата
        </Link>
        <Link className="btn btn-secondary" href="/faq">
          Седни до огъня
        </Link>
      </section>
    </article>
  );
}
