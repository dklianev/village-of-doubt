import { spawn } from "node:child_process";

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

const children = [
  startProcess("game-server", ["--filter", "@werewolf/game-server", "dev"]),
  startProcess("web", ["--filter", "@werewolf/web", "dev"]),
];

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
