import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";

const suites = [
  "apps/game-server/src/game-logic/__tests__/night-resolver.test.ts",
  "apps/game-server/src/__tests__/GameRoom.security.test.ts",
  "apps/game-server/src/__tests__/GameRoom.regression.test.ts",
];

const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : pnpm;
const args = isWindows
  ? ["/d", "/s", "/c", [pnpm, "--filter", "@werewolf/game-server", "test", "--", ...suites].join(" ")]
  : ["--filter", "@werewolf/game-server", "test", "--", ...suites];

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ALLOW_DEV_AUTH: "true",
    GAME_TOKEN_SECRET: "playtest-secret-that-is-long-enough",
  },
  stdio: "inherit",
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("Multi-client playtest suite passed.");
  }
  process.exitCode = code ?? 1;
});
