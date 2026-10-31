import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request } from "node:http";
import { createSecureServer } from "node:http2";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream";
import { pathToFileURL } from "node:url";

const serverPath = resolve("apps/web/.next/standalone/apps/web/server.js");
if (!existsSync(serverPath)) {
  throw new Error(`Missing production web build at ${serverPath}. Run pnpm build first.`);
}

const standaloneAppDir = dirname(serverPath);
cpSync("apps/web/.next/static", resolve(standaloneAppDir, ".next/static"), {
  recursive: true,
  force: true,
});
cpSync("apps/web/public", resolve(standaloneAppDir, "public"), {
  recursive: true,
  force: true,
});

// Production serves the site through Caddy over HTTP/2, and Lighthouse's simulated LCP depends on the
// connection model it observes. The standalone server therefore sits behind a local HTTPS HTTP/2 proxy.
const port = process.env.LHCI_PORT ?? "3410";
const upstreamPort = String(Number(port) + 1000);
const baseUrl = `https://127.0.0.1:${port}`;
await listenHttp2Proxy();

process.env.NODE_ENV = "production";
process.env.PORT = upstreamPort;
process.env.HOSTNAME = "127.0.0.1";
process.env.BETTER_AUTH_URL ??= baseUrl;
process.env.NEXT_PUBLIC_APP_URL ??= baseUrl;
process.env.NEXT_PUBLIC_GAME_SERVER_URL ??= "ws://127.0.0.1:9";
process.env.BETTER_AUTH_SECRET ??= "lighthouse-better-auth-secret-that-is-long-enough";
process.env.GAME_TOKEN_SECRET ??= "lighthouse-game-token-secret-that-is-long-enough";
process.env.ALLOW_DEV_AUTH = "false";

await import(pathToFileURL(serverPath).href);

async function listenHttp2Proxy() {
  // HTTP/1.1 is deliberately not offered, so a client that cannot negotiate HTTP/2 fails instead of measuring HTTP/1.1.
  const proxy = createSecureServer(throwawayCertificate(), (req, res) => {
    const upstream = request({
      host: "127.0.0.1",
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers: {
        ...withoutConnectionHeaders(req.headers),
        host: req.authority,
        "x-forwarded-for": req.socket.remoteAddress,
        "x-forwarded-host": req.authority,
        "x-forwarded-proto": "https",
      },
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, withoutConnectionHeaders(upstreamRes.headers));
      pipeline(upstreamRes, res, () => {});
    });
    upstream.once("error", () => {
      if (res.headersSent || res.stream.destroyed) {
        res.destroy();
      } else {
        res.writeHead(502).end();
      }
    });
    pipeline(req, upstream, () => {});
  });
  await new Promise((resolveListen, rejectListen) => {
    proxy.once("error", rejectListen);
    proxy.listen(Number(port), "127.0.0.1", resolveListen);
  });
  console.log(`Lighthouse HTTP/2 proxy ${baseUrl} -> http://127.0.0.1:${upstreamPort}`);
}

// HTTP/2 rejects connection-specific headers, and pseudo-headers belong to the HTTP/2 hop only.
function withoutConnectionHeaders(headers) {
  const connectionHeaders = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "http2-settings"]);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !name.startsWith(":") && !connectionHeaders.has(name)));
}

// Lighthouse launches Chrome with --ignore-certificate-errors, so a fresh self-signed certificate is enough.
function throwawayCertificate() {
  const dir = mkdtempSync(join(tmpdir(), "lighthouse-tls-"));
  try {
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "1",
      "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
      "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
    ], { stdio: "pipe" });
    return { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) };
  } catch (error) {
    throw new Error(`Lighthouse needs openssl on PATH to create its local TLS certificate: ${error.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
