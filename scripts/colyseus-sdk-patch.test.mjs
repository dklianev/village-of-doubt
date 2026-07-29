import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import test from "node:test";

const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const transportEntry = webRequire.resolve("@colyseus/sdk/transport/WebSocketTransport");

test("Colyseus transport preserves custom headers with native Node WebSocket", async () => {
  if (typeof globalThis.WebSocket !== "function") {
    return;
  }

  const received = Promise.withResolvers();
  const server = createServer();
  server.on("upgrade", (request, socket) => {
    received.resolve({
      header: request.headers["x-werewolf-test"],
      protocol: request.headers["sec-websocket-protocol"],
    });
    const accept = createHash("sha1")
      .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n"
      + "Upgrade: websocket\r\n"
      + "Connection: Upgrade\r\n"
      + `Sec-WebSocket-Accept: ${accept}\r\n`
      + "Sec-WebSocket-Protocol: colyseus\r\n\r\n",
    );
    socket.destroy();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  const { WebSocketTransport } = await import(pathToFileURL(transportEntry).href);
  const transport = new WebSocketTransport({});
  transport.protocols = ["colyseus"];

  try {
    transport.connect(`ws://127.0.0.1:${address.port}`, {
      "x-werewolf-test": "preserved",
    });
    const headers = await Promise.race([
      received.promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("WebSocket header probe timed out.")), 3_000)),
    ]);
    assert.equal(headers.header, "preserved");
    assert.equal(headers.protocol, "colyseus");
  } finally {
    transport.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
