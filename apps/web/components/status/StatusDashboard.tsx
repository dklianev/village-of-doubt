"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeOverallStatus, type ServiceHealth } from "@/lib/status-health";
import { StatusHero } from "./StatusHero";
import { StatusLastIncident } from "./StatusLastIncident";
import { StatusLegend } from "./StatusLegend";
import { StatusServiceTiles } from "./StatusServiceTiles";
import { StatusSubscribe } from "./StatusSubscribe";

interface StatusDashboardProps {
  initialServices: ServiceHealth[];
  initialLastCheckedAt: string;
  discordUrl: string | null;
  telegramUrl: string | null;
}

const REFRESH_INTERVAL_MS = 30_000;

export function StatusDashboard({
  initialServices,
  initialLastCheckedAt,
  discordUrl,
  telegramUrl,
}: StatusDashboardProps) {
  const [services, setServices] = useState(initialServices);
  const [lastCheckedAt, setLastCheckedAt] = useState(initialLastCheckedAt);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { services: ServiceHealth[]; lastCheckedAt: string };
        setServices(data.services);
        setLastCheckedAt(data.lastCheckedAt);
      }
    } catch {
      // Last known state is more useful than a transient polling error.
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;

    function stop() {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    }

    function start() {
      stop();
      timer = window.setInterval(() => {
        if (!document.hidden) {
          refresh();
        }
      }, REFRESH_INTERVAL_MS);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        refresh();
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const overall = computeOverallStatus(services);

  return (
    <div className="status-page">
      <StatusHero
        overall={overall}
        lastCheckedAt={lastCheckedAt}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <div className="status-content">
        <StatusServiceTiles services={services} />
        <StatusLegend />
        <StatusLastIncident />
        <StatusSubscribe discordUrl={discordUrl} telegramUrl={telegramUrl} />
      </div>
    </div>
  );
}
