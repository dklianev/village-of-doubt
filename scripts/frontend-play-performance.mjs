import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PLAY_PERFORMANCE_CASES = Object.freeze([
  { mode: "werewolves_classic", players: 12 },
  { mode: "werewolves_classic", players: 30 },
  { mode: "mafia_free", players: 12 },
  { mode: "mafia_free", players: 24 },
]);
const VIEWPORT = { width: 390, height: 844 };
const CPU_RATE = 4;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function assertLocalEndpoint(value, protocol) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid local profiling endpoint."); }
  assert.ok(url.protocol === protocol && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)
    && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/",
  "Profiling requires a loopback origin without credentials, query or path.");
  return url.origin;
}

export function summarizeSamples(samples) {
  assert.ok(samples.length > 0 && samples.every((value) => Number.isFinite(value) && value >= 0), "Invalid performance samples.");
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { count: samples.length, medianMs: percentile(0.5), p95Ms: percentile(0.95), maxMs: sorted.at(-1) };
}

export function profileRoomOptions(mode, players) {
  assert.ok(PLAY_PERFORMANCE_CASES.some((entry) => entry.mode === mode && entry.players === players), "Unsupported crowded-table case.");
  return {
    mode, playerCount: players, maxPlayers: players, roomVisibility: "private", narratorMode: "automatic",
    communicationMode: "built_in_chat", tempoProfile: "manual", firstNightKill: false, autoStart: false,
    customTimers: { roleRevealSeconds: 120, personalNightActionSeconds: 300, factionNightActionSeconds: 300,
      dayDiscussionSeconds: 900, playerSpeechSeconds: 240, voteSeconds: 240, resolutionSeconds: 90,
      minimumPhaseSeconds: 3, autoAdvanceWhenReady: false },
  };
}

const SAFE_FAILURE_REASONS = new Set([
  "Synthetic room or page reported an error.", "Browser must have the seeded fixture session.",
  "Production play document did not load.", "Duplicate server players.", "SDK creator must be host.",
  "Expected selectable public voting seats.", "Phase changed during measurements.",
  "Crowded table has horizontal page overflow.", "Crowded table has seats outside the viewport width.",
  "A player disconnected during measurement.", "Local selection unexpectedly submitted a vote or vote state is missing.",
  "Invalid performance samples.", "Profile connection cleanup failed.",
  ...["SDK join", "SDK room leave", "complete roster", "readiness", "role reveal", "authorized phase transition"].map((label) => `Timed out: ${label}.`),
]);

export function safeProfileFailure(error) {
  const firstLine = typeof error?.message === "string" ? error.message.split("\n")[0] : "";
  return {
    kind: error instanceof assert.AssertionError ? "assertion" : error?.name === "TimeoutError" ? "browser-timeout" : "runtime",
    reason: SAFE_FAILURE_REASONS.has(firstLine) ? firstLine : "SDK/browser operation failed; raw details suppressed.",
  };
}

async function deadline(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}.`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

export async function closeProfileRooms(rooms) {
  // Leave is authoritative; force-close a failed/hung transport so teardown never retains bots.
  const results = await Promise.allSettled(rooms.map(async (room) => {
    try { await deadline(room.leave(true), 5000, "SDK room leave"); }
    finally { room.connection?.close(); }
  }));
  return results.filter((result) => result.status === "rejected").length;
}

export async function dismissProfileRoleRitual(page, result) {
  result.stage = "ritual flip";
  const ritual = page.getByRole("dialog", { name: "Твоята тайна карта", exact: true });
  await ritual.getByRole("button", { name: "Обърни картата", exact: true }).click();
  result.stage = "ritual dismiss";
  const done = page.getByRole("button", { name: "Запомних", exact: true });
  await done.click();
  await done.waitFor({ state: "detached", timeout: 15000 });
}

/** Caller owns production services, seeded identities and DB cleanup. This never builds or starts services. */
export async function runPlayPerformance({
  browser, baseUrl, wsUrl, identities, signInBrowserContext, secret, artifactDir,
  label = "baseline", samples = 20, warmupIterations = 5, warmupMs = 2500,
}) {
  const appOrigin = assertLocalEndpoint(baseUrl, "http:");
  const socketOrigin = assertLocalEndpoint(wsUrl, "ws:");
  const gameOrigin = socketOrigin.replace(/^ws:/, "http:");
  assert.equal(browser.browserType().name(), "chromium", "4x CPU profiling requires Chromium/CDP.");
  assert.ok(/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(label), "Unsafe artifact label.");
  assert.ok(typeof artifactDir === "string" && artifactDir.length > 0, "Artifact directory is required.");
  assert.ok(typeof secret === "string" && secret.length >= 32, "A local test signing secret is required.");
  assert.ok(typeof signInBrowserContext === "function", "Authenticated fixture sign-in is required.");
  assert.ok(Array.isArray(identities) && identities.length >= 30, "Thirty seeded synthetic identities are required.");
  const fixture = identities.slice(0, 30);
  assert.ok(fixture.every((user) => /^frontend-e2e-[a-zA-Z0-9_-]+$/.test(user.id)
    && typeof user.name === "string" && user.name.length > 0 && user.email?.endsWith("@example.test")),
  "Only seeded frontend E2E identities may be profiled.");
  assert.equal(new Set(fixture.map((user) => user.id)).size, fixture.length, "Fixture identities must be unique.");
  assert.ok(Number.isInteger(samples) && samples >= 5 && samples <= 60, "Use 5-60 samples.");
  assert.ok(Number.isInteger(warmupIterations) && warmupIterations >= 1 && warmupIterations <= 20, "Use 1-20 warmup selections.");
  assert.ok(Number.isFinite(warmupMs) && warmupMs >= 500 && warmupMs <= 10000, "Use a bounded warmup.");

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const webRequire = createRequire(join(root, "apps/web/package.json"));
  const serverRequire = createRequire(join(root, "apps/game-server/package.json"));
  const { Client } = webRequire("@colyseus/sdk");
  const { createGameToken } = await import(pathToFileURL(serverRequire.resolve("@werewolf/shared/server")).href);
  const { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } = await import(pathToFileURL(serverRequire.resolve("@werewolf/shared")).href);
  await mkdir(artifactDir, { recursive: true });
  const report = { version: 1, label, browser: browser.version(), viewport: VIEWPORT, cpuRate: CPU_RATE,
    samples, warmupIterations, warmupMs, phase: "voting", theme: "light", httpCache: "disabled-by-local-network-guard",
    latencyMetric: "trusted click capture to selected DOM plus two animation frames; paint estimate, not INP",
    cases: [] };
  const jsonPath = join(artifactDir, `play-performance-${label}.json`);

  for (const scenario of PLAY_PERFORMANCE_CASES) {
    const caseName = `${scenario.mode}-${scenario.players}`;
    const result = { ...scenario, status: "running", stage: "setup" };
    report.cases.push(result);
    const code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join("");
    const users = fixture.slice(0, scenario.players);
    const rooms = [];
    let context;
    let page;
    let closing = false;
    let runtimeError = false;
    let blockedExternalRequests = 0;
    // Track the real SDK room before its handshake, including failed or timed-out joins.
    class ProfileClient extends Client {
      createRoom(...args) {
        assert.equal(closing, false, "Profile already closed.");
        const room = super.createRoom(...args);
        rooms.push(room);
        return room;
      }
    }
    const checkRuntime = () => assert.equal(runtimeError, false, "Synthetic room or page reported an error.");
    const waitFor = async (predicate, description) => {
      const end = Date.now() + 30000;
      while (Date.now() < end) {
        checkRuntime();
        if (await predicate()) return;
        await sleep(100);
      }
      throw new Error(`Timed out: ${description}.`);
    };
    try {
      context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true,
        deviceScaleFactor: 1, colorScheme: "light", serviceWorkers: "block" });
      // No responses or socket messages are fabricated. External destinations are denied.
      await context.route("**/*", (route) => {
        const origin = new URL(route.request().url()).origin;
        if (origin === appOrigin || origin === gameOrigin) return route.continue();
        blockedExternalRequests += 1;
        return route.abort("blockedbyclient");
      });
      await context.routeWebSocket("**/*", (socket) => {
        if (new URL(socket.url()).origin === socketOrigin) socket.connectToServer();
        else { blockedExternalRequests += 1; void socket.close(); }
      });
      await context.addInitScript(() => {
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
        localStorage.setItem("werewolf-theme", "light");
        localStorage.setItem("werewolf-sound", "off");
      });
      await signInBrowserContext(context, users[0]);
      const sessionResponse = await context.request.get(`${appOrigin}/api/auth/get-session`, { maxRedirects: 0 });
      const session = await sessionResponse.json();
      assert.ok(sessionResponse.ok() && session?.user?.id === users[0].id, "Browser must have the seeded fixture session.");
      page = await context.newPage();
      page.on("pageerror", () => { runtimeError = true; });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });

      result.stage = "SDK roster";
      for (const user of users.slice(1)) {
        const client = new ProfileClient(socketOrigin, {
          urlBuilder: (url) => {
            assert.ok([gameOrigin, socketOrigin].includes(url.origin), "SDK endpoint escaped local origins.");
            return url.href;
          },
          fetchFn: (url, init) => {
            assert.equal(new URL(url).origin, gameOrigin, "SDK HTTP escaped local origin.");
            return fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(30000) });
          },
        });
        const token = createGameToken({ userId: user.id, displayName: user.name, roomCode: code, secret });
        const options = { ...profileRoomOptions(scenario.mode, scenario.players), code, token };
        const joining = (rooms.length ? client.joinById(rooms[0].roomId, options) : client.create("game", options))
          .then(async (room) => {
            if (closing) { await closeProfileRooms([room]); throw new Error("Profile already closed."); }
            room.onMessage("*", (type) => { if (type === "error" || type === "safe_error") runtimeError = true; });
            room.onError(() => { if (!closing) runtimeError = true; });
            room.onLeave(() => { if (!closing) runtimeError = true; });
            return room;
          });
        await deadline(joining, 30000, "SDK join");
      }
      const host = rooms[0];
      const players = () => Array.from(host.state?.players?.values?.() ?? []);
      result.stage = "browser navigate";
      const roomUrl = new URL(`/play/${code}`, appOrigin);
      roomUrl.search = new URLSearchParams({ mode: scenario.mode, players: String(scenario.players) }).toString();
      const response = await page.goto(roomUrl.href, { waitUntil: "domcontentloaded", timeout: 30000 });
      assert.ok(response?.ok(), "Production play document did not load.");
      result.stage = "server roster";
      await waitFor(() => players().length === scenario.players && players().every((player) => player.connected), "complete roster");
      assert.equal(new Set(players().map((player) => player.userId)).size, scenario.players, "Duplicate server players.");
      assert.ok(players().some((player) => player.userId === users[1].id && player.host), "SDK creator must be host.");
      result.stage = "SDK readiness";
      for (const room of rooms) room.send("ready", { ready: true });
      result.stage = "browser ready click";
      await page.getByTestId("ready-toggle").click();
      result.stage = "server readiness";
      await waitFor(() => players().every((player) => player.ready), "readiness");
      result.stage = "host start";
      host.send("startGame");
      result.stage = "server role reveal";
      await waitFor(() => host.state.phase === "role_reveal", "role reveal");
      await dismissProfileRoleRitual(page, result);
      result.stage = "public voting";
      for (const next of ["first_night", "day_announcement", "day_discussion", "voting"]) {
        result.stage = `advance ${next}`;
        host.send("narratorAdvance");
        await waitFor(() => host.state.phase === next, "authorized phase transition");
      }
      result.stage = "render voting";
      await page.locator('main.play-shell[data-phase="voting"]').waitFor({ state: "visible" });
      result.stage = "render roster";
      await page.waitForFunction((ids) => {
        const seats = [...document.querySelectorAll("main [data-seat-user-id]")];
        return seats.length === ids.length && ids.every((id) => seats.filter((seat) => seat.dataset.seatUserId === id).length === 1);
      }, users.map((user) => user.id), { timeout: 30000 });
      result.stage = "fonts and settling";
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(warmupMs);
      const targets = await page.locator('main button[data-seat-user-id][data-alive="true"]').evaluateAll((seats) => seats.map((seat) => seat.dataset.seatUserId));
      assert.ok(targets.length >= 2, "Expected selectable public voting seats.");
      const select = async (index, measured) => {
        const id = targets[index % targets.length];
        const seat = page.locator(`main button[data-seat-user-id="${id}"]`);
        await seat.scrollIntoViewIfNeeded();
        if (measured) await armSelectionMeasurement(page, id);
        await seat.click();
        await page.waitForFunction((target) => document.querySelector(`[data-seat-user-id="${target}"]`)?.dataset.selected === "true", id);
        if (measured) return page.evaluate(() => window.__playPerformanceSelection);
      };
      result.stage = "warmup";
      for (let index = 0; index < warmupIterations; index++) await select(index, false);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      await page.evaluate(installLongTaskObserver);
      result.before = await collectCounters(page, cdp);
      result.stage = "measurement";
      const latencies = [];
      for (let index = 0; index < samples; index++) {
        checkRuntime();
        assert.equal(host.state.phase, "voting", "Phase changed during measurements.");
        latencies.push(await select(warmupIterations + index, true));
      }
      result.after = await collectCounters(page, cdp);
      result.longTasks = await page.evaluate(() => {
        const probe = window.__playPerformanceLongTasks;
        probe.entries.push(...probe.observer.takeRecords().map((entry) => ({ startTime: entry.startTime, duration: entry.duration })));
        probe.observer.disconnect();
        return probe.entries;
      });
      result.clickToNextPaintEstimateMs = latencies;
      result.summary = summarizeSamples(latencies);
      result.uniquePlayers = scenario.players;
      assert.ok(result.after.horizontalOverflowPx <= 1, "Crowded table has horizontal page overflow.");
      assert.ok(result.after.visibleSeatOverflowPx <= 1, "Crowded table has seats outside the viewport width.");
      assert.equal(players().filter((player) => player.connected).length, scenario.players, "A player disconnected during measurement.");
      assert.ok(players().every((player) => player.hasVoted === false), "Local selection unexpectedly submitted a vote or vote state is missing.");
      await page.locator("main").scrollIntoViewIfNeeded();
      result.screenshot = `play-performance-${label}-${caseName}.png`;
      await page.screenshot({ path: join(artifactDir, result.screenshot), fullPage: false });
      checkRuntime();
      result.status = "passed";
      result.stage = "complete";
    } catch (error) {
      result.status = "failed";
      result.failure = safeProfileFailure(error);
      if (page && !page.isClosed()) {
        try { result.dom = await deadline(page.evaluate(readProfileFailureDom), 3000, "failure DOM"); }
        catch { result.domUnavailable = true; }
        const failureScreenshot = `play-performance-${label}-${caseName}-failure.png`;
        try {
          await page.screenshot({ path: join(artifactDir, failureScreenshot), fullPage: false, timeout: 5000,
            mask: [page.locator('[data-private-dossier], [role="dialog"][data-flipped="true"]')] });
          result.failureScreenshot = failureScreenshot;
        } catch { result.failureScreenshotUnavailable = true; }
      }
      // Do not serialize raw SDK/browser errors: they may contain signed URLs or session data.
      throw new Error(`Play performance ${caseName} failed during ${result.stage}; see sanitized JSON artifact.`);
    } finally {
      closing = true;
      // Client-side navigation runs the actual room effect cleanup and consented leave.
      // Closing a tab directly would instead reserve the browser seat for reconnect.
      if (page && new URL(page.url()).pathname.startsWith("/play/")) {
        try {
          await page.locator('a.site-brand[href="/"]').click({ timeout: 5000 });
          await page.waitForURL((url) => url.pathname === "/", { timeout: 10000 });
        } catch { result.browserNavigationFailed = true; }
      }
      await context?.close().catch(() => { result.browserCleanupFailed = true; });
      result.sdkCleanupFailures = await closeProfileRooms(rooms);
      result.blockedExternalRequests = blockedExternalRequests;
      if (result.browserCleanupFailed || result.sdkCleanupFailures) result.status = "failed";
      await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
      if (!result.failure) assert.ok(!result.browserCleanupFailed && result.sdkCleanupFailures === 0, "Profile connection cleanup failed.");
    }
  }
  return report;
}

function readProfileFailureDom() {
  const visible = (element) => Boolean(element && element.getClientRects().length
    && getComputedStyle(element).visibility !== "hidden");
  const phases = ["lobby", "role_reveal", "first_night", "night", "day_announcement", "day_discussion", "voting",
    "resolution", "nomination", "defense", "hunter_revenge", "mayor_successor", "paused", "game_over"];
  const phase = document.querySelector("main[data-phase]")?.getAttribute("data-phase");
  const ready = document.querySelector('[data-testid="ready-toggle"]');
  return {
    phase: phases.includes(phase) ? phase : null,
    seatCount: document.querySelectorAll("main [data-seat-user-id]").length,
    ready: { present: Boolean(ready), visible: visible(ready), disabled: ready ? ready.disabled : null,
      pressed: ready?.getAttribute("aria-pressed") === "true" },
    dialogNames: [...document.querySelectorAll('[role="dialog"], dialog')].filter(visible).slice(0, 8).map((dialog) => {
      if (dialog.getAttribute("data-flipped") === "true") return "[revealed role dialog]";
      const label = dialog.getAttribute("aria-label") || (dialog.getAttribute("aria-labelledby") ?? "").split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
      return label.trim().replace(/(?:https?|wss?):\/\/\S+|\S+@\S+/g, "[redacted]").slice(0, 120);
    }),
  };
}

async function armSelectionMeasurement(page, id) {
  await page.evaluate((target) => {
    window.__playPerformanceSelection = new Promise((resolve, reject) => {
      const seat = document.querySelector(`[data-seat-user-id="${target}"]`);
      const click = (event) => {
        if (!event.isTrusted) return;
        const start = performance.now();
        let frame;
        const timeout = setTimeout(() => { cancelAnimationFrame(frame); reject(new Error("Selection did not paint")); }, 5000);
        const selected = () => {
          if (seat.dataset.selected !== "true") { frame = requestAnimationFrame(selected); return; }
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => { clearTimeout(timeout); resolve(performance.now() - start); });
          });
        };
        frame = requestAnimationFrame(selected);
      };
      seat.addEventListener("click", click, { capture: true, once: true });
    });
    void window.__playPerformanceSelection.catch(() => {});
  }, id);
}

function installLongTaskObserver() {
  if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) throw new Error("Long Tasks API unavailable");
  const entries = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (entries.length < 1000) entries.push({ startTime: entry.startTime, duration: entry.duration });
  });
  observer.observe({ type: "longtask" });
  window.__playPerformanceLongTasks = { observer, entries };
}

async function collectCounters(page, cdp) {
  const layout = await page.evaluate(() => ({
    elements: document.querySelectorAll("*").length,
    horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    visibleSeatOverflowPx: Math.max(0, ...[...document.querySelectorAll("main [data-seat-user-id]")].map((seat) => {
      const rect = seat.getBoundingClientRect();
      return Math.max(-rect.left, rect.right - innerWidth);
    })),
  }));
  const dom = await cdp.send("Memory.getDOMCounters");
  const heap = await cdp.send("Runtime.getHeapUsage");
  return { ...layout, documents: dom.documents, nodes: dom.nodes, jsEventListeners: dom.jsEventListeners,
    heapUsedBytes: heap.usedSize, heapTotalBytes: heap.totalSize };
}
