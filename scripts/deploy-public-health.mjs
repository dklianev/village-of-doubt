import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export async function runPublicHealthGate(options) {
  const timeoutMs = requireTimeout(options.timeoutMs ?? 5_000);
  const webHealthUrl = requireUrl(options.webHealthUrl, "web health", options.allowInsecure);
  const gameHealthUrl = requireUrl(options.gameHealthUrl, "game health", options.allowInsecure);
  const webSocketUrl = requireWebSocketUrl(options.webSocketUrl, options.allowInsecure);
  const origin = requireOrigin(options.origin, options.allowInsecure);

  await Promise.all([
    probeJson(webHealthUrl, timeoutMs, "web readiness", "web", (body) => (
      body.ok === true && body.kind === "readiness"
    )),
    probeJson(gameHealthUrl, timeoutMs, "game readiness", "game", (body) => (
      body.ok === true && body.status === "ready" && body.service === "werewolf-game-server"
    )),
    probeWebSocket(webSocketUrl, origin, timeoutMs),
  ]);
}

async function probeJson(url, timeoutMs, label, expectedIngress, validateBody) {
  const response = await request(url, timeoutMs);
  if (response.statusCode !== 200) {
    throw new Error(`${label} returned HTTP ${response.statusCode}; expected 200.`);
  }
  if (response.headers["x-werewolf-ingress"] !== expectedIngress) {
    throw new Error(`${label} did not return the Caddy ingress marker ${expectedIngress}.`);
  }

  let body;
  try {
    body = JSON.parse(response.body);
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
  if (!body || typeof body !== "object" || !validateBody(body)) {
    throw new Error(`${label} did not report the required ok=true semantic readiness payload.`);
  }
}

function request(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const operation = transport.request(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": "werewolf-release-health/1",
      },
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 64 * 1024) {
          operation.destroy(new Error(`${url} returned an oversized health response.`));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    operation.setTimeout(timeoutMs, () => {
      operation.destroy(new Error(`Public HTTPS health probe timed out: ${url}`));
    });
    operation.on("error", reject);
    operation.end();
  });
}

function probeWebSocket(url, origin, timeoutMs) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "wss:" ? https : http;
    const requestUrl = new URL(url);
    requestUrl.protocol = url.protocol === "wss:" ? "https:" : "http:";
    const key = randomBytes(16).toString("base64");
    const expectedAccept = createHash("sha1").update(key + WEBSOCKET_GUID).digest("base64");
    let settled = false;
    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const operation = transport.request(requestUrl, {
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        Origin: origin,
        "Sec-WebSocket-Key": key,
        "Sec-WebSocket-Version": "13",
        "User-Agent": "werewolf-release-health/1",
      },
    });
    operation.once("upgrade", (response, socket) => {
      const statusCode = response.statusCode ?? 0;
      const accept = response.headers["sec-websocket-accept"];
      socket.destroy();
      if (statusCode !== 101) {
        finish(new Error(`Public WSS probe returned HTTP ${statusCode}; expected 101.`));
        return;
      }
      if (accept !== expectedAccept) {
        finish(new Error("Public WSS probe returned an invalid Sec-WebSocket-Accept header."));
        return;
      }
      finish();
    });
    operation.once("response", (response) => {
      response.resume();
      finish(new Error(`Public WSS probe returned HTTP ${response.statusCode ?? 0}; expected 101.`));
    });
    operation.setTimeout(timeoutMs, () => {
      operation.destroy(new Error(`Public WSS probe timed out: ${url}`));
    });
    operation.on("error", finish);
    operation.end();
  });
}

function requireUrl(value, label, allowInsecure = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`The public ${label} URL is invalid.`);
  }
  if (url.protocol !== "https:" && !(allowInsecure && url.protocol === "http:")) {
    throw new Error(`The public ${label} probe must use HTTPS.`);
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`The public ${label} URL must not contain credentials or a fragment.`);
  }
  return url;
}

function requireWebSocketUrl(value, allowInsecure = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The public WebSocket URL is invalid.");
  }
  if (url.protocol !== "wss:" && !(allowInsecure && url.protocol === "ws:")) {
    throw new Error("The public WebSocket probe must use WSS.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("The public WebSocket URL must not contain credentials or a fragment.");
  }
  return url;
}

function requireOrigin(value, allowInsecure = false) {
  const url = requireUrl(value, "WebSocket origin", allowInsecure);
  if (url.pathname !== "/" || url.search) {
    throw new Error("The WebSocket origin must not contain a path or query string.");
  }
  return url.origin;
}

function requireTimeout(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 30_000) {
    throw new Error("PUBLIC_HEALTH_REQUEST_TIMEOUT_MS must be an integer between 100 and 30000.");
  }
  return parsed;
}

function optionsFromEnvironment() {
  const webDomain = process.env.PUBLIC_WEB_DOMAIN;
  const gameDomain = process.env.PUBLIC_WS_DOMAIN;
  if (!webDomain || !gameDomain || !process.env.CORS_ORIGIN) {
    throw new Error("PUBLIC_WEB_DOMAIN, PUBLIC_WS_DOMAIN, and CORS_ORIGIN are required.");
  }
  return {
    webHealthUrl: `https://${webDomain}/api/health/ready`,
    gameHealthUrl: `https://${gameDomain}/health/ready`,
    webSocketUrl: `wss://${gameDomain}/`,
    origin: process.env.CORS_ORIGIN,
    timeoutMs: process.env.PUBLIC_HEALTH_REQUEST_TIMEOUT_MS ?? 5_000,
  };
}

async function runCli() {
  await runPublicHealthGate(optionsFromEnvironment());
  console.log("Public HTTPS and WSS ingress health gate passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`Public ingress health failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
