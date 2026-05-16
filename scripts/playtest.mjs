import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";

const suites = [
  "src/game-logic/__tests__/night-resolver.test.ts",
  "src/__tests__/GameRoom.security.test.ts",
  "src/__tests__/GameRoom.regression.test.ts",
];

const args = ["--filter", "@werewolf/game-server", "exec", "vitest", "run", ...suites];
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : pnpm;
const commandArgs = isWindows ? ["/d", "/s", "/c", [pnpm, ...args].join(" ")] : args;

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ALLOW_DEV_AUTH: "true",
    GAME_TOKEN_SECRET: "playtest-secret-that-is-long-enough",
  },
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("Multi-client playtest suite passed.");
  }
  process.exitCode = code ?? 1;
});
