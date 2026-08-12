"use client";

import { useState } from "react";
import { Pill } from "@werewolf/ui/server";
import styles from "./Account.module.css";

type ReadableStorage = Pick<Storage, "getItem">;
type AccountExportPage = Record<string, unknown> & {
  games: Array<Record<string, unknown> & { id: string; events?: Array<Record<string, unknown> & { id?: string }> }>;
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    eventPage: number;
    eventPageSize: number;
    eventsHasMore: boolean;
  };
};

const EXPORT_GAME_PAGE_SIZE = 100;
const EXPORT_EVENT_PAGE_SIZE = 1_000;
const MAX_EXPORT_REQUESTS = 2_000;
const MAX_COMPLETE_EXPORT_BYTES = 25 * 1024 * 1024;

export interface AccountExportSettings {
  theme: "dark" | "light" | null;
  soundEnabled: boolean | null;
  cueMode: "silent" | "visual" | "audio_vibration" | null;
  lastGameFamily: "werewolves" | "mafia" | null;
}

export function AccountDataExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    setExporting(true);
    setError("");

    try {
      await downloadCompleteAccountExport();
    } catch {
      setError("Не успяхме да подготвим данните. Опитай отново.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className={`${styles.archivePanel} ${styles.exportSection}`} id="account-data-export">
      <header className={styles.sectionHead}>
        <p className={styles.sectionKicker}>архивно копие</p>
        <h2>Твоите данни</h2>
        <p>Имаш право да изтеглиш всичко, което сме записали за теб.</p>
      </header>

      <Pill
        intent="secondary"
        size="lg"
        shimmer
        className={styles.exportButton}
        onClick={exportData}
        disabled={exporting}
        aria-busy={exporting}
      >
        {exporting ? "Подготвяме данните..." : "Изтегли моите данни (JSON)"}
      </Pill>
      {error ? (
        <p className={`${styles.status} ${styles.statusError}`} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export async function downloadCompleteAccountExport(storage: ReadableStorage | null = getBrowserStorage()) {
  const { data: serverExport, filename } = await fetchCompleteAccountExport(fetch);
  const exportData = buildCompleteAccountExport(serverExport, storage);
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = objectUrl;
  download.download = filename;
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function fetchCompleteAccountExport(
  fetcher: typeof fetch,
): Promise<{ data: Record<string, unknown>; filename: string }> {
  const games = new Map<string, AccountExportPage["games"][number]>();
  let firstPage: AccountExportPage | null = null;
  let filename = `werewolf-mafia-export-${Date.now()}.json`;
  let requestCount = 0;
  let gamePage = 1;
  let hasMoreGames = true;
  let continuation: string | null = null;

  while (hasMoreGames) {
    let eventPage = 1;
    let hasMoreEvents = true;

    while (hasMoreEvents) {
      requestCount += 1;
      if (requestCount > MAX_EXPORT_REQUESTS) {
        throw new Error("export_request_budget_exceeded");
      }

      const params = new URLSearchParams({
        page: String(gamePage),
        pageSize: String(EXPORT_GAME_PAGE_SIZE),
        eventPage: String(eventPage),
        eventPageSize: String(EXPORT_EVENT_PAGE_SIZE),
      });
      const response: Response = await fetcher(`/api/account/export?${params}`, {
        headers: {
          Accept: "application/json",
          ...(continuation ? { "X-Account-Export-Continuation": continuation } : {}),
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("export_failed");
      }

      const page = parseAccountExportPage(await response.json());
      continuation ??= response.headers.get("x-account-export-continuation");
      firstPage ??= page;
      if (requestCount === 1) {
        filename = downloadFilename(response.headers.get("content-disposition"));
      }
      mergeExportGames(games, page.games);
      assertExportSize({ ...firstPage, games: [...games.values()] });

      hasMoreEvents = page.pagination.eventsHasMore;
      eventPage += 1;
      hasMoreGames = page.pagination.hasMore;
      if ((hasMoreEvents || hasMoreGames) && !continuation) {
        throw new Error("missing_export_continuation");
      }
    }

    gamePage += 1;
  }

  if (!firstPage) {
    throw new Error("invalid_account_export");
  }

  return {
    data: {
      ...firstPage,
      games: [...games.values()],
      pagination: {
        complete: true,
        requests: requestCount,
        gamePages: gamePage - 1,
        gamePageSize: EXPORT_GAME_PAGE_SIZE,
        eventPageSize: EXPORT_EVENT_PAGE_SIZE,
      },
    },
    filename,
  };
}

export function buildCompleteAccountExport(serverExport: unknown, storage: ReadableStorage | null) {
  if (!serverExport || typeof serverExport !== "object" || Array.isArray(serverExport)) {
    throw new Error("invalid_account_export");
  }

  return {
    ...(serverExport as Record<string, unknown>),
    settings: readAccountExportSettings(storage),
  };
}

export function readAccountExportSettings(storage: ReadableStorage | null): AccountExportSettings {
  const theme = storage?.getItem("werewolf-theme");
  const sound = storage?.getItem("werewolf-sound");
  const cueMode = storage?.getItem("werewolf-cue-mode");
  const lastGameFamily = storage?.getItem("last-family");

  return {
    theme: theme === "dark" || theme === "light" ? theme : null,
    soundEnabled: sound === "on" ? true : sound === "off" ? false : null,
    cueMode:
      cueMode === "silent" || cueMode === "visual" || cueMode === "audio_vibration" ? cueMode : null,
    lastGameFamily: lastGameFamily === "werewolves" || lastGameFamily === "mafia" ? lastGameFamily : null,
  };
}

function getBrowserStorage(): ReadableStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function downloadFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? `werewolf-mafia-export-${Date.now()}.json`;
}

function parseAccountExportPage(value: unknown): AccountExportPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_account_export");
  }
  const candidate = value as Partial<AccountExportPage>;
  const pagination = candidate.pagination;
  if (
    !Array.isArray(candidate.games) ||
    !pagination ||
    typeof pagination !== "object" ||
    typeof pagination.hasMore !== "boolean" ||
    typeof pagination.eventsHasMore !== "boolean"
  ) {
    throw new Error("invalid_account_export");
  }
  for (const game of candidate.games) {
    if (!game || typeof game !== "object" || typeof game.id !== "string") {
      throw new Error("invalid_account_export");
    }
  }
  return value as AccountExportPage;
}

function mergeExportGames(
  target: Map<string, AccountExportPage["games"][number]>,
  incoming: AccountExportPage["games"],
) {
  for (const game of incoming) {
    const current = target.get(game.id);
    if (!current) {
      target.set(game.id, { ...game, events: [...(game.events ?? [])] });
      continue;
    }

    const events = [...(current.events ?? [])];
    const knownEventIds = new Set(events.map((event) => event.id).filter(Boolean));
    for (const event of game.events ?? []) {
      if (!event.id || !knownEventIds.has(event.id)) {
        events.push(event);
        if (event.id) {
          knownEventIds.add(event.id);
        }
      }
    }
    target.set(game.id, { ...current, ...game, events, eventCount: events.length });
  }
}

function assertExportSize(value: unknown) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_COMPLETE_EXPORT_BYTES) {
    throw new Error("export_size_budget_exceeded");
  }
}
