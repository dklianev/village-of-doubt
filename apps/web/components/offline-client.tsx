"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

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

    function retry() {
      if (document.hidden) {
        return;
      }
      setRetryCount((count) => count + 1);
      void checkConnection();
    }

    const handleOnline = () => void checkConnection();
    const handleOffline = () => void checkConnection();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = window.setInterval(retry, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
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
          Често задавани въпроси
        </Link>
      </section>
    </article>
  );
}
