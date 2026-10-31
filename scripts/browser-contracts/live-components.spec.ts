import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, test } from "playwright/test";

const webRoot = join(process.cwd(), "apps/web");
const webRequire = createRequire(join(webRoot, "package.json"));
const vitest = join(dirname(webRequire.resolve("vitest/package.json")), "vitest.mjs");
const suites = [
  ["PRESENTATION_BASE_URL", "components/games/__tests__/GameCatalog.presentation.test.tsx"],
  ["ROLE_DOSSIER_BASE_URL", "components/games/__tests__/RoleDossier.browser.test.tsx"],
  ["ROLE_DEEP_LINK_BASE_URL", "components/games/__tests__/GameRolesPage.deep-links.browser.test.tsx"],
  ["ACTION_PANEL_BASE_URL", "components/play/__tests__/NightActionPanel.VotingPanel.browser.test.tsx"],
  ["PLAY_LOBBY_BASE_URL", "components/play/__tests__/PlayLobby.browser.test.tsx"],
  ["PLAY_LOBBY_BASE_URL", "components/play/__tests__/PlayLobby.firefox.browser.test.tsx"],
  ["PLAY_COPY_BASE_URL", "lib/play/__tests__/copy.browser.test.ts"],
  ["REPORT_BASE_URL", "components/report/__tests__/ReportWizard.browser.test.tsx"],
];

for (const [variable, file] of suites) {
  test(file, async ({ baseURL }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const child = spawn(process.execPath, [vitest, "run", file!, "--maxWorkers=1"], {
      cwd: webRoot,
      env: {
        ...process.env, [variable!]: baseURL, NO_COLOR: "1",
        ...(variable === "PRESENTATION_BASE_URL" ? { PRESENTATION_ARTIFACT_DIR: testInfo.outputPath("catalog") } : {}),
      },
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let timedOut = false;
    child.stdout.on("data", (data: Buffer) => { stdout = (stdout + data.toString()).slice(-4 * 1024 * 1024); });
    child.stderr.on("data", (data: Buffer) => process.stderr.write(data));
    const stopTree = () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
      } else {
        try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ }
      }
    };
    const timer = setTimeout(() => { timedOut = true; stopTree(); }, 220_000);
    try {
      const status = await new Promise<number | null>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      console.log(stdout);
      expect(timedOut, "Live component suite timed out").toBe(false);
      expect(status, "Vitest component suite failed").toBe(0);
      expect(stdout).not.toMatch(/\d+ skipped/);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null) stopTree();
    }
  });
}
