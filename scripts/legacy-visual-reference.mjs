import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();

const DEFAULT_CURRENT_BASE = "http://localhost:3000";
const DEFAULT_OLD_BASE = "http://localhost:3101";
const DEFAULT_OUTPUT = "docs/frontend-audit-v3/legacy-reference";
const DEFAULT_ROUND_2_OUTPUT = "docs/frontend-audit-v3/legacy-reference/round-2";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];

const THEMES = ["dark", "light"];

const ROUND_1_ROUTES = [
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "report", path: "/report" },
  { name: "status", path: "/status" },
  { name: "faq", path: "/faq" },
  { name: "friends", path: "/friends?visualAuth=1" },
  { name: "tutorial", path: "/tutorial" },
  { name: "history-empty", oldPath: "/history", currentPath: "/history?visualHistory=empty" },
  {
    name: "history-fixture",
    oldPath: "/history",
    currentPath: "/history?visualHistory=fixture",
    note: "Old server must be started with HISTORY_EVIDENCE_FIXTURE=1 for fixture parity.",
  },
  {
    name: "achievements",
    oldPath: "/achievements",
    currentPath: "/achievements?visualAuth=1&visualAchievements=fixture",
    note: "Old server may need a local-only auth bypass in the detached worktree.",
  },
  { name: "werewolf-roles", path: "/werewolf/roles" },
  { name: "mafia-roles", path: "/mafia/roles" },
];

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const round = options.round ?? "1";
const routeSet = round === "2" ? round2Routes() : ROUND_1_ROUTES;
const currentBase = options.currentBase ?? DEFAULT_CURRENT_BASE;
const oldBase = options.oldBase ?? DEFAULT_OLD_BASE;
const outputDir = path.resolve(root, options.output ?? (round === "2" ? DEFAULT_ROUND_2_OUTPUT : DEFAULT_OUTPUT));
const selectedNames = new Set(options.routes ?? routeSet.map((route) => route.name));
const selectedRoutes = routeSet.filter((route) => selectedNames.has(route.name));

if (selectedRoutes.length === 0) {
  throw new Error("No matching routes selected.");
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const route of selectedRoutes) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        await capture({
          browser,
          baseUrl: oldBase,
          side: "old",
          route,
          pathName: route.oldPath ?? route.path,
          viewport,
          theme,
        });
        await capture({
          browser,
          baseUrl: currentBase,
          side: "current",
          route,
          pathName: route.currentPath ?? route.path,
          viewport,
          theme,
        });
      }
    }
  }
} finally {
  await browser.close();
}

console.log(`Legacy visual reference screenshots written to ${outputDir}`);

async function capture({ browser, baseUrl, side, route, pathName, viewport, theme }) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await page.addInitScript((selectedTheme) => {
      window.localStorage.setItem("cookie-consent", "1");
      window.localStorage.setItem("werewolf-theme", selectedTheme);
      window.localStorage.setItem("welcome-modal-shown", "1");
    }, theme);

    const url = new URL(pathName, baseUrl);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(600);

    const screenshotPath = path.join(outputDir, `${route.name}-${side}-${theme}-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`${side.padEnd(7)} ${theme.padEnd(5)} ${viewport.name.padEnd(7)} ${route.name}`);
  } finally {
    await page.close();
  }
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--current-base":
        parsed.currentBase = args[++index];
        break;
      case "--old-base":
        parsed.oldBase = args[++index];
        break;
      case "--output":
        parsed.output = args[++index];
        break;
      case "--routes":
        parsed.routes = args[++index]
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        break;
      case "--round":
        parsed.round = args[++index];
        if (parsed.round !== "1" && parsed.round !== "2") {
          throw new Error("--round must be 1 or 2.");
        }
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/legacy-visual-reference.mjs [options]

Options:
  --old-base <url>      Old pre-primitives app base URL. Default: ${DEFAULT_OLD_BASE}
  --current-base <url>  Current app base URL. Default: ${DEFAULT_CURRENT_BASE}
  --output <dir>        Screenshot output directory. Default: ${DEFAULT_OUTPUT}
  --round <1|2>         Capture Round 1 or Round 2 route set. Default: 1.
  --routes <names>      Comma-separated route names to capture.
  --help                Show this help.

Round 1 route names:
  ${ROUND_1_ROUTES.map((route) => route.name).join(", ")}

Round 2 route names:
  ${round2Routes()
    .map((route) => route.name)
    .join(", ")}

Notes:
  - Start the old worktree separately on :3101.
  - Start the current app separately on :3000.
  - For old /history fixture parity, start old app with HISTORY_EVIDENCE_FIXTURE=1.
  - For old auth-gated pages, use only temporary local old-worktree bypasses; never commit them.
`);
}

function round2Routes() {
  return [
    { name: "sign-in", path: "/sign-in?redirect=%2Flobby%2FABC123" },
    { name: "leaderboard", path: "/leaderboard" },
    {
      name: "account",
      oldPath: "/account",
      currentPath: "/account?visualAuth=1",
      note: "Old server needs a local-only account auth/session fixture for parity.",
    },
    {
      name: "create",
      oldPath: "/create?visualAuth=1",
      currentPath: "/create?visualAuth=1",
      note: "Old server may need a local-only create auth bypass.",
    },
    {
      name: "werewolf-create",
      oldPath: "/werewolf/create?visualAuth=1",
      currentPath: "/werewolf/create?visualAuth=1",
      note: "Old server may need a local-only create auth bypass.",
    },
    {
      name: "mafia-create",
      oldPath: "/mafia/create?visualAuth=1",
      currentPath: "/mafia/create?visualAuth=1",
      note: "Old server may need a local-only create auth bypass.",
    },
    {
      name: "replay-fixture",
      oldPath: "/history/fixture-replay/replay",
      currentPath: "/history/fixture-replay/replay?visualReplay=fixture",
      note: "Old server needs a local-only deterministic replay fixture/bypass.",
    },
    {
      name: "lobby-fixture",
      oldPath: "/lobby/ABC123?mode=werewolves_classic",
      currentPath: "/lobby/ABC123?mode=werewolves_classic&visualAuth=1",
      note: "Old server needs a local-only waiting-room auth fixture/bypass.",
    },
  ];
}
