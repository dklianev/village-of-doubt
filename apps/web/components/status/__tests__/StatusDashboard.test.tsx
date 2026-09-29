import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusDashboard, STATUS_REFRESH_INTERVAL_MS, STATUS_REQUEST_TIMEOUT_MS } from "../StatusDashboard";
import { deferred, statusSnapshot } from "./status-fixtures";

const fetchMock = vi.fn<typeof fetch>();

function dashboard(snapshot = statusSnapshot()) {
  return render(<StrictMode><StatusDashboard
    initialServices={snapshot.services}
    initialLastCheckedAt={snapshot.lastCheckedAt}
    discordUrl={null}
    telegramUrl={null}
  /></StrictMode>);
}

async function clickRefresh() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Опресни състоянието сега|Опитай отново/ }));
  });
}

describe("StatusDashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["network", "http", "json", "payload"])("marks the retained snapshot stale after a %s failure", async (kind) => {
    if (kind === "network") fetchMock.mockRejectedValueOnce(new Error("https://private-probe.test secret"));
    if (kind === "http") fetchMock.mockResolvedValueOnce(new Response("private-probe.test", { status: 503 }));
    if (kind === "json") fetchMock.mockResolvedValueOnce(new Response("not json"));
    if (kind === "payload") fetchMock.mockResolvedValueOnce(Response.json({ services: [], lastCheckedAt: "invalid" }));
    const { container } = dashboard();

    await clickRefresh();

    expect(screen.getByRole("alert")).toHaveTextContent("Обновяването не успя");
    expect(screen.getByRole("alert")).toHaveTextContent("може вече да не са актуални");
    expect(screen.getByRole("status")).toHaveAttribute("data-overall", "unknown");
    expect(container.querySelector(".status-page")).toHaveAttribute("data-stale", "true");
    expect(container.querySelector("time")).toHaveAttribute("datetime", statusSnapshot().lastCheckedAt);
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getByRole("heading", { name: "Последни получени данни" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeEnabled();
    expect(container).not.toHaveTextContent(/private-probe|secret|not json/);
  });

  it("keeps the failure visible while retrying and replaces the snapshot only after success", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    const { container } = dashboard();
    await clickRefresh();
    const retry = deferred<Response>();
    fetchMock.mockReturnValueOnce(retry.promise);
    await clickRefresh();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeDisabled();
    const next = statusSnapshot("2026-09-20T10:01:00.000Z");
    next.services[1]!.status = "down";
    await act(async () => retry.resolve(Response.json(next)));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("datetime", next.lastCheckedAt);
    expect(screen.getByRole("status")).toHaveAttribute("data-overall", "down");
    expect(screen.getByRole("button", { name: "Опресни състоянието сега" })).toBeEnabled();
    expect(container.querySelector(".status-page")).toHaveAttribute("data-stale", "false");
    expect(fetchMock).toHaveBeenCalledWith("/api/status", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
  });

  it.each([
    { age: "older", lastCheckedAt: "2026-09-20T09:59:00.000Z", failed: false },
    { age: "equal", lastCheckedAt: "2026-09-20T10:00:00.000Z", failed: false },
    { age: "newer", lastCheckedAt: "2026-09-20T10:01:00.000Z", failed: false },
    { age: "older", lastCheckedAt: "2026-09-20T09:59:00.000Z", failed: true },
    { age: "equal", lastCheckedAt: "2026-09-20T10:00:00.000Z", failed: true },
    { age: "newer", lastCheckedAt: "2026-09-20T10:01:00.000Z", failed: true },
  ])("handles an $age healthy snapshot with prior refresh failure=$failed", async ({ age, lastCheckedAt, failed }) => {
    const initial = statusSnapshot();
    initial.services[1]!.status = "down";
    const { container } = dashboard(initial);
    if (failed) {
      fetchMock.mockRejectedValueOnce(new Error("network"));
      await clickRefresh();
    }
    fetchMock.mockResolvedValueOnce(Response.json(statusSnapshot(lastCheckedAt)));

    await clickRefresh();

    const newer = age === "newer";
    const stale = age === "older" || (age === "equal" && failed);
    expect(container.querySelector("time")).toHaveAttribute("datetime", newer ? lastCheckedAt : initial.lastCheckedAt);
    expect(container.querySelector(".status-page")).toHaveAttribute("data-stale", String(stale));
    expect(screen.getByRole("status")).toHaveAttribute("data-overall", stale ? "unknown" : newer ? "ok" : "down");
    expect(screen.getByRole("heading", { name: "Игрови сървър" }).closest("article"))
      .toHaveAttribute("data-status", newer ? "ok" : "down");
    expect(screen.queryByRole("alert") !== null).toBe(stale);
    expect(screen.getByRole("button", { name: stale ? "Опитай отново" : "Опресни състоянието сега" })).toBeEnabled();
  });

  it("compares later refreshes against the newest accepted snapshot, not the initial props", async () => {
    const { container } = dashboard();
    const newest = statusSnapshot("2026-09-20T10:02:00.000Z");
    newest.services[1]!.status = "down";
    fetchMock.mockResolvedValueOnce(Response.json(newest));
    await clickRefresh();
    fetchMock.mockResolvedValueOnce(Response.json(statusSnapshot("2026-09-20T10:01:00.000Z")));

    await clickRefresh();

    expect(container.querySelector("time")).toHaveAttribute("datetime", newest.lastCheckedAt);
    expect(screen.getByRole("heading", { name: "Игрови сървър" }).closest("article")).toHaveAttribute("data-status", "down");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it.each(["headers", "body"])("bounds a hung %s read and ignores its late response during a retry", async (stage) => {
    const oldResponse = deferred<Response>();
    const oldBody = deferred<unknown>();
    fetchMock.mockReturnValueOnce(stage === "headers" ? oldResponse.promise : Promise.resolve({ ok: true, json: () => oldBody.promise } as Response));
    const { container } = dashboard();
    await clickRefresh();
    const signal = fetchMock.mock.calls[0]![1]!.signal!;
    await act(async () => vi.advanceTimersByTimeAsync(STATUS_REQUEST_TIMEOUT_MS));

    expect(signal.aborted).toBe(true);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeEnabled();
    const retry = deferred<Response>();
    fetchMock.mockReturnValueOnce(retry.promise);
    await clickRefresh();
    await act(async () => {
      oldResponse.resolve(Response.json(statusSnapshot("2026-09-20T10:00:30.000Z")));
      oldBody.resolve(statusSnapshot("2026-09-20T10:00:30.000Z"));
    });
    expect(container.querySelector("time")).toHaveAttribute("datetime", statusSnapshot().lastCheckedAt);
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    const next = statusSnapshot("2026-09-20T10:01:00.000Z");
    await act(async () => retry.resolve(Response.json(next)));
    expect(container.querySelector("time")).toHaveAttribute("datetime", next.lastCheckedAt);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("polls once in StrictMode, deduplicates refreshes, and recovers automatically", async () => {
    const request = deferred<Response>();
    fetchMock.mockReturnValueOnce(request.promise);
    dashboard();
    await act(async () => vi.advanceTimersByTimeAsync(STATUS_REFRESH_INTERVAL_MS));
    fireEvent(document, new Event("visibilitychange"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => request.reject(new Error("network")));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(Response.json(statusSnapshot()));
    await act(async () => vi.advanceTimersByTimeAsync(STATUS_REFRESH_INTERVAL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(Response.json(statusSnapshot("2026-09-20T10:01:00.000Z")));
    await act(async () => vi.advanceTimersByTimeAsync(STATUS_REFRESH_INTERVAL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pauses polling while hidden and aborts pending work before a visible refresh", async () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const request = deferred<Response>();
    fetchMock.mockReturnValueOnce(request.promise);
    dashboard();
    await act(async () => vi.advanceTimersByTimeAsync(STATUS_REFRESH_INTERVAL_MS * 2));
    expect(fetchMock).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    const signal = fetchMock.mock.calls[0]![1]!.signal!;
    hidden.mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    fetchMock.mockResolvedValueOnce(Response.json(statusSnapshot()));
    hidden.mockReturnValue(false);
    await act(async () => fireEvent(document, new Event("visibilitychange")));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Опресни състоянието сега" })).toBeEnabled();
    await act(async () => request.reject(new Error("old abort")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("aborts and clears all timers and listeners on unmount", async () => {
    const request = deferred<Response>();
    fetchMock.mockReturnValueOnce(request.promise);
    const { unmount } = dashboard();
    await clickRefresh();
    const signal = fetchMock.mock.calls[0]![1]!.signal!;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => request.resolve(Response.json(statusSnapshot())));
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => vi.advanceTimersByTimeAsync(STATUS_REFRESH_INTERVAL_MS * 2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("separates operational probes from configured but unverified providers", () => {
    dashboard();
    expect(screen.getByRole("status")).toHaveTextContent("Основните услуги отговарят на проверките.");
    const google = screen.getByRole("heading", { name: "Вход с Google" }).closest("article");
    expect(google).toHaveAttribute("data-status", "unknown");
    expect(google).toHaveTextContent("Непотвърдено");
    expect(google).toHaveTextContent("входът не се проверява автоматично");
    expect(google).not.toHaveTextContent("Работи");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Състояние на услугите");
  });
});
