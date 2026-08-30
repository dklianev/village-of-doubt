import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  formatLighthouseSummary,
  lighthouseTailFailures,
  summarizeLighthouseProfile,
} from "./lighthouse-summary.mjs";

const profiles = [
  { preset: "desktop", port: "3410" },
  { preset: "mobile", port: "3411" },
];
const chromePath = process.env.CHROME_PATH ?? findPlaywrightHeadlessShell();

for (const profile of profiles) {
  await runLighthouse(profile);
}

const tailFailures = [];
for (const { preset } of profiles) {
  const outputDir = join(process.cwd(), "output", "lighthouse", preset);
  const summaries = summarizeLighthouseProfile(outputDir, preset);
  for (const summary of summaries) {
    console.log(formatLighthouseSummary(summary));
  }
  tailFailures.push(...lighthouseTailFailures(summaries));
}

if (tailFailures.length > 0) {
  throw new Error(`Lighthouse run-tail guard failed:\n${tailFailures.map((failure) => `- ${failure}`).join("\n")}`);
}

console.log("Lighthouse CI passed for desktop and mobile profiles.");

function runLighthouse({ preset, port }) {
  const invocation = packageManagerInvocation();

  return new Promise((resolve, reject) => {
    const child = spawn(
      invocation.command,
      [...invocation.args, "exec", "lhci", "autorun", "--config=lighthouserc.cjs"],
      {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(chromePath ? { CHROME_PATH: chromePath } : {}),
        LIGHTHOUSE_PROFILE: preset,
        LHCI_PORT: port,
        LHCI_OUTPUT_DIR: `output/lighthouse/${preset}`,
      },
      stdio: "inherit",
      shell: false,
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(
        `Lighthouse ${preset} profile failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`,
      ));
    });
  });
}

function packageManagerInvocation() {
  const cli = process.env.npm_execpath;
  return cli
    ? { command: process.execPath, args: [cli] }
    : { command: "pnpm", args: [] };
}

function findPlaywrightHeadlessShell() {
  if (process.platform !== "win32") {
    return undefined;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return undefined;
  }

  const playwrightRoot = join(localAppData, "ms-playwright");
  if (!existsSync(playwrightRoot)) {
    return undefined;
  }

  const installations = readdirSync(playwrightRoot)
    .filter((entry) => entry.startsWith("chromium_headless_shell-"))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  for (const installation of installations) {
    const executable = join(playwrightRoot, installation, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
    if (existsSync(executable)) {
      return executable;
    }
  }

  return undefined;
}
