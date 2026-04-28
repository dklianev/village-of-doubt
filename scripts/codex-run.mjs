import { spawn } from "node:child_process";
import { createConnection } from "node:net";

const isWindows = process.platform === "win32";
const env = { ...process.env };
const webPort = env.PORT ?? "3000";
const gamePort = env.GAME_SERVER_PORT ?? "2567";
const packageManager = packageManagerInvocation();

setDefault("GAME_SERVER_PORT", gamePort);
setDefault("ALLOW_DEV_AUTH", "true");
setDefault("BETTER_AUTH_URL", `http://localhost:${webPort}`);
setDefault("NEXT_PUBLIC_APP_URL", `http://localhost:${webPort}`);
setDefault("NEXT_PUBLIC_GAME_SERVER_URL", `ws://localhost:${gamePort}`);
setDefault("CORS_ORIGIN", `http://localhost:${webPort}`);
setDefault("BETTER_AUTH_SECRET", "codex-local-better-auth-secret-00000000");
setDefault("GAME_TOKEN_SECRET", "codex-local-game-token-secret-000000000");

console.log("Codex run action: starting web + game-server with local defaults.");
console.log(`Web:  http://localhost:${webPort}`);
console.log(`Game: ws://localhost:${gamePort}`);
console.log("Stop: Ctrl+C");

const existing = await detectExistingServices();
if (existing.web && existing.game) {
  console.log("Codex run action: web and game-server are already running.");
  process.exit(0);
}

await assertPortAvailableOrHealthy("web", webPort, existing.web);
await assertPortAvailableOrHealthy("game-server", gamePort, existing.game);

const children = [];
if (!existing.game) {
  children.push(startProcess("game-server", ["--filter", "@werewolf/game-server", "dev"]));
} else {
  console.log(`Codex run action: reusing existing game-server on port ${gamePort}.`);
}
if (!existing.web) {
  children.push(startProcess("web", ["--filter", "@werewolf/web", "dev"]));
} else {
  console.log(`Codex run action: reusing existing web server on port ${webPort}.`);
}

if (children.length === 0) {
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await shutdown(0);
  });
}

let shuttingDown = false;

function startProcess(label, args) {
  const child = spawn(packageManager.command, [...packageManager.args, ...args], {
    cwd: process.cwd(),
    env,
    shell: packageManager.shell,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("error", async (error) => {
    console.error(`[${label}] ${error.message}`);
    await shutdown(1);
  });
  child.on("exit", async (code, signal) => {
    if (shuttingDown) {
      return;
    }
    console.error(`[${label}] exited with ${signal ? `signal ${signal}` : `code ${code}`}`);
    await shutdown(code ?? 1);
  });

  return child;
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await Promise.all(children.map(stopChild));
  process.exit(exitCode);
}

function stopChild(child) {
  if (!child.pid || child.killed) {
    return Promise.resolve();
  }

  if (isWindows) {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
  }

  child.kill("SIGTERM");
  return Promise.resolve();
}

function setDefault(key, value) {
  if (!env[key]) {
    env[key] = value;
  }
}

function packageManagerInvocation() {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath], shell: false };
  }
  return { command: isWindows ? "pnpm.cmd" : "pnpm", args: [], shell: isWindows };
}

async function detectExistingServices() {
  const [web, game] = await Promise.all([
    isHealthy(`http://127.0.0.1:${webPort}/api/health`),
    isHealthy(`http://127.0.0.1:${gamePort}/health`),
  ]);
  return { web, game };
}

async function assertPortAvailableOrHealthy(label, port, healthy) {
  if (healthy) {
    return;
  }

  if (await isPortOpen(port)) {
    console.error(
      `Codex run action: ${label} port ${port} is already in use, but its health endpoint did not respond.`,
    );
    console.error("Stop the process using that port, or set PORT / GAME_SERVER_PORT to free ports and try again.");
    process.exit(1);
  }
}

async function isHealthy(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return false;
    }
    const body = await response.json().catch(() => ({}));
    return body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: Number(port), timeout: 800 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}
