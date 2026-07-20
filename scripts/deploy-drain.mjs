import { spawn } from "node:child_process";

const statsUrl = process.env.DEPLOY_STATS_URL ?? buildDefaultStatsUrl();
const timeoutMs = readPositiveInteger("DEPLOY_DRAIN_TIMEOUT_MS", 20 * 60_000);
const pollIntervalMs = readPositiveInteger("DEPLOY_DRAIN_POLL_INTERVAL_MS", 5_000);

await run("docker", [
  "compose",
  "exec",
  "--no-TTY",
  "game",
  "node",
  "--input-type=module",
  "--eval",
  "const response = await fetch('http://127.0.0.1:2567/operations/drain', { method: 'POST' }); if (!response.ok) { throw new Error(`drain returned HTTP ${response.status}`); } console.log(await response.text());",
]);

const startedAt = Date.now();
let lastStatus;
while (Date.now() - startedAt < timeoutMs) {
  try {
    lastStatus = await readStats();
    if (lastStatus.draining !== true) {
      throw new Error("game server has not acknowledged drain mode");
    }
    console.log(`Deploy drain: ${lastStatus.activeRooms} active room(s), ${lastStatus.connectedPlayers} connected player(s).`);
    if (lastStatus.activeRooms === 0) {
      console.log("Deploy drain complete. It is safe to run docker compose up -d --build.");
      process.exit(0);
    }
  } catch (error) {
    console.warn(`Deploy drain status unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  await delay(pollIntervalMs);
}

throw new Error(
  `Deploy drain timed out after ${timeoutMs}ms with ${lastStatus?.activeRooms ?? "unknown"} active room(s). ` +
  "The existing game container is still running; deployment was not started.",
);

function buildDefaultStatsUrl() {
  const domain = process.env.PUBLIC_WS_DOMAIN;
  if (!domain) {
    throw new Error("DEPLOY_STATS_URL or PUBLIC_WS_DOMAIN is required.");
  }
  return `https://${domain}/stats`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
      }
    });
  });
}

async function readStats() {
  if (statsUrl === "internal") {
    const output = await runCapture("docker", [
      "compose",
      "exec",
      "--no-TTY",
      "game",
      "node",
      "--input-type=module",
      "--eval",
      "const response = await fetch('http://127.0.0.1:2567/stats'); if (!response.ok) { throw new Error(`stats returned HTTP ${response.status}`); } console.log(await response.text());",
    ]);
    return JSON.parse(output.trim().split(/\r?\n/).at(-1));
  }

  const response = await fetch(statsUrl, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} ${args.slice(0, 4).join(" ")} failed: ${stderr || `exit ${code}`}`));
      }
    });
  });
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
