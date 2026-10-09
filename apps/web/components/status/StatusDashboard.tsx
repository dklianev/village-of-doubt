"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeOverallStatus, parseStatusSnapshot, type ServiceHealth } from "@/lib/status-health-shared";
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

interface StatusRequest {
  controller: AbortController;
  timer?: ReturnType<typeof setTimeout>;
}

export const STATUS_REFRESH_INTERVAL_MS = 30_000;
export const STATUS_REQUEST_TIMEOUT_MS = 8_000;

export function StatusDashboard({
  initialServices,
  initialLastCheckedAt,
  discordUrl,
  telegramUrl,
}: StatusDashboardProps) {
  const [{ snapshot, refreshFailed }, setStatus] = useState({
    snapshot: { services: initialServices, lastCheckedAt: initialLastCheckedAt },
    refreshFailed: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef<StatusRequest | null>(null);

  const cancelRefresh = useCallback(() => {
    const request = requestRef.current;
    requestRef.current = null;
    if (request) {
      clearTimeout(request.timer);
      request.controller.abort();
    }
  }, []);

  const refresh = useCallback(async () => {
    if (requestRef.current) return;

    const request: StatusRequest = { controller: new AbortController() };
    requestRef.current = request;
    setRefreshing(true);
    function finishRequest() {
      if (requestRef.current !== request) return;
      clearTimeout(request.timer);
      requestRef.current = null;
      setRefreshing(false);
    }
    // Release the UI even if an aborted transport or body reader never settles.
    request.timer = setTimeout(() => {
      request.controller.abort();
      setStatus((current) => ({ ...current, refreshFailed: true }));
      finishRequest();
    }, STATUS_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/status", { cache: "no-store", signal: request.controller.signal });
      if (requestRef.current !== request) return;
      if (!response.ok) throw new Error("Status request failed");
      const payload: unknown = await response.json();
      if (requestRef.current !== request) return;
      const next = parseStatusSnapshot(payload);
      if (!next) throw new Error("Invalid status response");
      setStatus((current) => {
        const nextTime = Date.parse(next.lastCheckedAt);
        const currentTime = Date.parse(current.snapshot.lastCheckedAt);
        if (nextTime < currentTime) return { ...current, refreshFailed: true };
        // A cached duplicate is not new evidence of recovery after a failed refresh.
        if (nextTime === currentTime) return current;
        return { snapshot: next, refreshFailed: false };
      });
    } catch {
      if (requestRef.current === request) setStatus((current) => ({ ...current, refreshFailed: true }));
    } finally {
      finishRequest();
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
          void refresh();
        }
      }, STATUS_REFRESH_INTERVAL_MS);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
        cancelRefresh();
        setRefreshing(false);
      } else {
        void refresh();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      cancelRefresh();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh, cancelRefresh]);

  const overall = computeOverallStatus(snapshot.services);

  return (
    <div className="status-page" data-stale={refreshFailed}>
      <StatusHero
        overall={overall}
        lastCheckedAt={snapshot.lastCheckedAt}
        refreshing={refreshing}
        refreshFailed={refreshFailed}
        onRefresh={refresh}
      />

      <div className="status-content">
        <StatusServiceTiles services={snapshot.services} stale={refreshFailed} />
        <StatusLegend />
        <StatusLastIncident />
        <StatusSubscribe discordUrl={discordUrl} telegramUrl={telegramUrl} />
      </div>
    </div>
  );
}
