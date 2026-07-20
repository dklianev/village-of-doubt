import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const webBaseUrl = process.env.WEB_INGRESS_URL ?? "http://127.0.0.1:8080";
const webIngressHost = process.env.WEB_INGRESS_HOST ?? "web.localhost";
const gameBaseUrl = process.env.GAME_INGRESS_URL ?? "http://127.0.0.1:8080";
const gameIngressHost = process.env.GAME_INGRESS_HOST ?? "ws.localhost";
const gameWebSocketUrl = process.env.GAME_WEBSOCKET_URL ?? "ws://127.0.0.1:8080";
const webHealthPath = process.env.WEB_HEALTH_PATH ?? "/api/health";
const webReadinessPath = "/api/health/ready";
const gameHealthPath = process.env.GAME_HEALTH_PATH ?? "/health/ready";
const allowedWebOrigin = process.env.ALLOWED_WEB_ORIGIN ?? "http://web.localhost";
const foreignWebOrigin = process.env.FOREIGN_WEB_ORIGIN ?? "https://attacker.invalid";
const caddyContainerName = process.env.CADDY_CONTAINER_NAME;
const exerciseGameOutage = process.env.TEST_GAME_OUTAGE === "true";
const exerciseDatabaseOutage = process.env.TEST_DATABASE_OUTAGE === "true";

const readiness = await waitForResponse(new URL(webHealthPath, webBaseUrl), "web readiness", webIngressHost);
const readinessBody = JSON.parse(readiness.body);
assert(readinessBody.ok === true, "Web readiness returned ok=false.");
assert(readinessBody.kind === "liveness", "Caddy web upstream health must use shallow liveness.");

const deepReadiness = await waitForResponse(new URL(webReadinessPath, webBaseUrl), "web deploy readiness", webIngressHost);
assert(JSON.parse(deepReadiness.body).kind === "readiness", "Caddy must expose deep readiness for deploy diagnostics.");

const landing = await waitForResponse(new URL("/", webBaseUrl), "web ingress", webIngressHost);
assert(landing.body.includes("Върколак или Мафия"), "Web ingress did not return the landing page.");
assert(landing.headers["x-frame-options"] === "DENY", "Caddy X-Frame-Options header is missing.");
assert(landing.headers["x-content-type-options"] === "nosniff", "Caddy nosniff header is missing.");

const roomPreview = await request(new URL("/api/rooms/ABCDEF/preview", webBaseUrl), webIngressHost);
assert(roomPreview.statusCode === 200, `Room preview returned HTTP ${roomPreview.statusCode}; web-to-game routing is unavailable.`);
assert(JSON.parse(roomPreview.body).status === "missing", "Missing room preview returned an unexpected payload.");

const gameHealth = await waitForResponse(new URL(gameHealthPath, gameBaseUrl), "game readiness", gameIngressHost);
const gameHealthBody = JSON.parse(gameHealth.body);
assert(gameHealthBody.ok === true, "Game ingress readiness returned ok=false.");
assert(gameHealthBody.service === "werewolf-game-server", "Caddy routed the game hostname to the wrong service.");
if (gameHealthPath === "/health/ready") {
  assert(gameHealthBody.status === "ready", "Caddy must route the game readiness endpoint.");
}

await waitForWebSocket(gameWebSocketUrl, gameIngressHost, {
  label: "allowed-origin WebSocket",
  origin: allowedWebOrigin,
  expectedStatusCode: 101,
});
await waitForWebSocket(gameWebSocketUrl, gameIngressHost, {
  label: "foreign-origin WebSocket",
  origin: foreignWebOrigin,
  expectedStatusCode: 403,
});
await waitForWebSocket(gameWebSocketUrl, gameIngressHost, {
  label: "origin-less WebSocket",
  expectedStatusCode: 101,
});

await provePathOnlyAccessLogs();
if (exerciseDatabaseOutage) {
  await proveDatabaseOutageKeepsExistingSocket();
}
if (exerciseGameOutage) {
  await proveGameOutageDoesNotRemoveWeb();
}

async function proveDatabaseOutageKeepsExistingSocket() {
  const socket = await openWebSocket(gameWebSocketUrl, gameIngressHost, {
    label: "held WebSocket during database outage",
    origin: allowedWebOrigin,
    expectedStatusCode: 101,
    keepOpen: true,
  });
  let closed = false;
  socket.once("close", () => {
    closed = true;
  });

  await dockerOutput(["compose", "stop", "postgres"]);
  try {
    await waitForStatus(new URL(gameHealthPath, gameBaseUrl), gameIngressHost, 503, "game deep readiness during database outage");
    const shallow = await waitForResponse(new URL("/health", gameBaseUrl), "game liveness during database outage", gameIngressHost);
    assert(JSON.parse(shallow.body).ok === true, "Game liveness failed during a database outage.");
    await delay(2_000);
    assert(!closed && !socket.destroyed, "An existing WebSocket was closed when only persistence became unavailable.");
  } finally {
    socket.destroy();
    await dockerOutput(["compose", "start", "postgres"]);
    await waitForResponse(new URL(gameHealthPath, gameBaseUrl), "game readiness after database outage", gameIngressHost);
  }
}
console.log("Caddy liveness, path-only logging, dependency isolation, and WebSocket origin policy smoke passed.");

async function provePathOnlyAccessLogs() {
  if (!caddyContainerName) {
    throw new Error("CADDY_CONTAINER_NAME is required to prove access-log redaction at runtime.");
  }

  const secret = `reset-token-${randomBytes(12).toString("hex")}`;
  const sensitivePath = `/api/auth/reset-password?token=${secret}&callbackURL=${encodeURIComponent(`${webBaseUrl}/account`)}`;
  await request(new URL(sensitivePath, webBaseUrl), webIngressHost);
  await delay(250);
  const logs = await dockerOutput(["logs", caddyContainerName]);
  assert(!logs.includes(secret), "Caddy access logs leaked a reset token from the query string.");

  const entries = logs
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return undefined;
      }
    })
    .filter(Boolean);
  assert(
    entries.some((entry) => entry.request?.uri === "/api/auth/reset-password"),
    "Caddy runtime logs did not prove a path-only reset URL.",
  );
}

async function proveGameOutageDoesNotRemoveWeb() {
  await dockerOutput(["compose", "stop", "game"]);
  try {
    await waitForStatus(new URL(webReadinessPath, webBaseUrl), webIngressHost, 503, "deep readiness during game outage");
    await delay(11_000);
    const liveness = await waitForResponse(new URL("/api/health", webBaseUrl), "web liveness during game outage", webIngressHost);
    assert(JSON.parse(liveness.body).kind === "liveness", "Web liveness changed shape during a game outage.");
    const legal = await waitForResponse(new URL("/privacy", webBaseUrl), "public legal route during game outage", webIngressHost);
    assert(legal.body.includes("Поверителност"), "Public legal content disappeared during a game outage.");
  } finally {
    await dockerOutput(["compose", "start", "game"]);
    await waitForResponse(new URL(gameHealthPath, gameBaseUrl), "game readiness after outage smoke", gameIngressHost);
  }
}

async function waitForResponse(url, label, hostHeader) {
  let lastError;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const response = await request(url, hostHeader);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response;
      }
      lastError = new Error(`${label} returned HTTP ${response.statusCode}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw lastError ?? new Error(`${label} did not become ready.`);
}

async function waitForStatus(url, hostHeader, expectedStatusCode, label) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await request(url, hostHeader).catch(() => undefined);
    lastStatus = response?.statusCode ?? 0;
    if (lastStatus === expectedStatusCode) {
      return response;
    }
    await delay(500);
  }
  throw new Error(`${label} returned HTTP ${lastStatus}; expected ${expectedStatusCode}.`);
}

function dockerOutput(args) {
  return new Promise((resolve, reject) => {
    execFile("docker", args, { cwd: process.cwd(), encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`docker ${args.join(" ")} failed: ${stderr || error.message}`));
        return;
      }
      resolve(`${stdout ?? ""}${stderr ?? ""}`);
    });
  });
}

async function waitForWebSocket(url, hostHeader, expectation) {
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await openWebSocket(url, hostHeader, expectation);
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw lastError ?? new Error(`${expectation.label} did not return the expected response.`);
}

function request(url, hostHeader) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "identity",
        Host: hostHeader,
      },
      timeout: 3_000,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    request.on("timeout", () => request.destroy(new Error(`HTTP ingress timed out: ${url}`)));
    request.on("error", reject);
    request.end();
  });
}

function openWebSocket(value, hostHeader, { expectedStatusCode, label, origin, keepOpen = false }) {
  return new Promise((resolve, reject) => {
    const url = new URL(value);
    const secure = url.protocol === "wss:";
    const port = Number(url.port || (secure ? 443 : 80));
    const key = randomBytes(16).toString("base64");
    const expectedAccept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    const connect = secure ? tls.connect : net.connect;
    const socket = connect({
      host: url.hostname,
      port,
      servername: secure ? hostHeader.split(":", 1)[0] : undefined,
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${label} timed out: ${url}`));
    }, 3_000);
    let response = "";

    socket.once(secure ? "secureConnect" : "connect", () => {
      const requestHeaders = [
        `GET ${url.pathname || "/"}${url.search} HTTP/1.1`,
        `Host: ${hostHeader}`,
        "Connection: Upgrade",
        "Upgrade: websocket",
        "Sec-WebSocket-Version: 13",
        `Sec-WebSocket-Key: ${key}`,
      ];
      if (origin) {
        requestHeaders.push(`Origin: ${origin}`);
      }
      requestHeaders.push("", "");
      socket.write(requestHeaders.join("\r\n"));
    });
    const onData = (chunk) => {
      response += chunk.toString("latin1");
      if (!response.includes("\r\n\r\n")) {
        return;
      }
      clearTimeout(timer);
      socket.off("data", onData);
      const [statusLine, ...headerLines] = response.split("\r\n");
      const headers = Object.fromEntries(
        headerLines
          .map((line) => line.split(/:\s*/, 2))
          .filter(([name, value]) => name && value)
          .map(([name, value]) => [name.toLowerCase(), value]),
      );
      const statusCode = Number(/^HTTP\/\d(?:\.\d)?\s+(\d{3})\b/.exec(statusLine)?.[1]);
      if (statusCode !== expectedStatusCode) {
        socket.destroy();
        reject(new Error(`${label} returned ${statusLine}; expected HTTP ${expectedStatusCode}.`));
        return;
      }
      if (expectedStatusCode === 101 && headers["sec-websocket-accept"] !== expectedAccept) {
        socket.destroy();
        reject(new Error("WebSocket ingress returned an invalid Sec-WebSocket-Accept header."));
        return;
      }
      if (!keepOpen) {
        socket.destroy();
      }
      resolve(socket);
    };
    socket.on("data", onData);
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
