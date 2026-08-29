import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import test from "node:test";
import { once } from "node:events";

import { runPublicHealthGate } from "./deploy-public-health.mjs";

async function withIngress(handler, run) {
  const server = http.createServer(handler);
  server.on("upgrade", (request, socket) => {
    if (request.url !== "/" || request.headers.origin !== "http://web.example.test") {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }

    const accept = createHash("sha1")
      .update(String(request.headers["sec-websocket-key"]) + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    socket.end([
      "HTTP/1.1 101 Switching Protocols",
      "Connection: Upgrade",
      "Upgrade: websocket",
      "Sec-WebSocket-Accept: " + accept,
      "",
      "",
    ].join("\r\n"));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run(address.port);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function readinessHandler(request, response) {
  response.setHeader("content-type", "application/json");
  if (request.url === "/api/health/ready") {
    response.setHeader("x-werewolf-ingress", "web");
    response.end(JSON.stringify({ ok: true, kind: "readiness" }));
    return;
  }
  if (request.url === "/health/ready") {
    response.setHeader("x-werewolf-ingress", "game");
    response.end(JSON.stringify({ ok: true, status: "ready", service: "werewolf-game-server" }));
    return;
  }
  response.writeHead(404).end();
}

function gateOptions(port) {
  return {
    webHealthUrl: "http://127.0.0.1:" + port + "/api/health/ready",
    gameHealthUrl: "http://127.0.0.1:" + port + "/health/ready",
    webSocketUrl: "ws://127.0.0.1:" + port + "/",
    origin: "http://web.example.test",
    timeoutMs: 1_000,
    allowInsecure: true,
  };
}

test("accepts only deep web/game readiness plus an allowed-origin WebSocket upgrade", async () => {
  await withIngress(readinessHandler, async (port) => {
    await assert.doesNotReject(runPublicHealthGate(gateOptions(port)));
  });
});

test("rejects a false-green web payload even when HTTP and WebSocket transport succeed", async () => {
  await withIngress((request, response) => {
    if (request.url === "/api/health/ready") {
      response.setHeader("content-type", "application/json");
      response.setHeader("x-werewolf-ingress", "web");
      response.end(JSON.stringify({ ok: false, kind: "readiness" }));
      return;
    }
    readinessHandler(request, response);
  }, async (port) => {
    await assert.rejects(runPublicHealthGate(gateOptions(port)), /web readiness.*ok=true/i);
  });
});

test("rejects health responses that did not traverse the expected Caddy virtual host", async () => {
  await withIngress((request, response) => {
    if (request.url === "/health/ready") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true, status: "ready", service: "werewolf-game-server" }));
      return;
    }
    readinessHandler(request, response);
  }, async (port) => {
    await assert.rejects(runPublicHealthGate(gateOptions(port)), /Caddy ingress marker.*game/i);
  });
});

test("requires HTTPS and WSS unless an explicit local-test override is supplied", async () => {
  await assert.rejects(runPublicHealthGate({
    webHealthUrl: "http://web.example.test/api/health/ready",
    gameHealthUrl: "https://ws.example.test/health/ready",
    webSocketUrl: "wss://ws.example.test/",
    origin: "https://web.example.test",
    timeoutMs: 100,
  }), /HTTPS/);
});
