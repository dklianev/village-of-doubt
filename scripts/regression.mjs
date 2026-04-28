import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const gameArtDir = path.join(root, "apps/web/public/game-art");

const checks = [
  ["game art WebP pairing", checkGameArtPairing],
  ["CSS image-set delivery", checkCssImageSet],
  ["landing layout contracts", checkLandingLayoutContracts],
  ["roles page art contracts", checkRolesPageContracts],
  ["lobby image scaling contracts", checkLobbyImageContracts],
  ["play UI hardening contracts", checkPlayUiContracts],
  ["production security guards", checkProductionGuardContracts],
  ["production env checker behavior", checkProductionEnvChecker],
  ["smoke/playtest/verify wiring", checkScriptWiring],
];

let failures = 0;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`ok: ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`fail: ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("Regression contract checks passed.");
}

function checkGameArtPairing() {
  const files = listFilesRecursive(gameArtDir);
  const pngs = files.filter((file) => file.endsWith(".png")).sort();
  const webps = new Set(files.filter((file) => file.endsWith(".webp")));
  assert(pngs.length >= 70, `Expected at least 70 PNG game-art files, got ${pngs.length}.`);

  for (const png of pngs) {
    const webp = png.replace(/\.png$/, ".webp");
    assert(webps.has(webp), `Missing optimized WebP for ${png}. Run pnpm optimize:assets.`);
    assert(statSync(path.join(gameArtDir, webp)).size > 10_000, `${webp} looks too small/corrupt.`);
  }

  const totalPngBytes = sumBytes(pngs);
  const totalWebpBytes = sumBytes([...webps]);
  assert(totalWebpBytes < totalPngBytes * 0.35, "Optimized WebP assets are unexpectedly large.");

  for (const critical of [
    "og-preview",
    "transition-night-falls",
    "faction-village",
    "player-avatar-sheet",
    "narrator-kit",
    "empty-history",
    "mafia/bg-landing-hero",
    "mafia/bg-lobby-tavern",
    "mafia/role-mafioso",
    "mafia/role-don",
    "mafia/faction-mafia",
  ]) {
    assert(existsSync(path.join(gameArtDir, `${critical}.png`)), `Missing critical PNG asset ${critical}.png.`);
    assert(existsSync(path.join(gameArtDir, `${critical}.webp`)), `Missing critical WebP asset ${critical}.webp.`);
  }
}

function checkCssImageSet() {
  const css = readText("apps/web/app/globals.css");
  const imageSetCount = count(css, "image-set(url(\"/game-art/");
  const directGameArtVariables = css.match(/--[\w-]+:\s*url\("\/game-art\/[^"]+\.png"\)/g) ?? [];

  assert(imageSetCount >= 80, `Expected many image-set game-art references, got ${imageSetCount}.`);
  assert(directGameArtVariables.length === 0, `Found direct PNG CSS variables: ${directGameArtVariables.join(", ")}`);
  assert(css.includes(".cue-panel"), "Missing live cue panel CSS.");
  assert(css.includes(".narrator-desk"), "Missing narrator desk CSS.");
  assert(css.includes("@keyframes cuePulse"), "Missing cue pulse animation.");
  assert(css.includes('[data-theme="mafia"]'), "Missing Mafia theme selector.");
  assert(css.includes('/game-art/mafia/bg-landing-hero.webp'), "Missing Mafia image-set CSS references.");
}

function checkLandingLayoutContracts() {
  const css = readText("apps/web/app/globals.css");
  const tableauBlock = css.match(/\.landing-tableau\s*\{[^}]+\}/)?.[0] ?? "";

  assert(tableauBlock.includes("position: relative"), "Landing tableau must stay in normal flow below the mode picker.");
  assert(!tableauBlock.includes("position: absolute"), "Landing tableau must not be absolute-positioned over the mode picker.");
  assert(tableauBlock.includes("margin-top:"), "Landing tableau needs explicit spacing from the mode picker.");
  assert(css.includes(".mode-choice-grid {\n  position: relative;\n  z-index: 2;"), "Mode picker must remain above decorative landing layers.");
}

function checkRolesPageContracts() {
  const rolesPage = readText("apps/web/app/roles/page.tsx");
  const css = readText("apps/web/app/globals.css");

  assert(rolesPage.includes("ROLE_ART_SLUGS"), "Roles page must use explicit role art slugs.");
  assert(rolesPage.includes("RoleFamilySection"), "Roles page must split roles by game family.");
  assert(rolesPage.includes("getRolesForFamily"), "Roles page must filter roles by family.");
  assert(rolesPage.includes("<picture className=\"role-codex-art\""), "Roles page must render role art as real picture elements.");
  assert(rolesPage.includes("role-mayor mayor-codex-card"), "Mayor public title must render with role-mayor art.");
  assert(rolesPage.includes("PUBLIC_TITLES.mayor"), "Mayor copy should come from shared Bulgarian public title definitions.");
  assert(css.includes(".role-mayor"), "Missing mayor role-art CSS class.");
  assert(css.includes("/game-art/role-mayor.webp"), "Missing optimized mayor role art CSS reference.");
  assert(css.includes("/game-art/mafia/role-mafioso.webp"), "Missing Mafia role-art CSS reference.");
  assert(css.includes(".role-codex-art img"), "Role codex cards must style real image elements.");
  assert(css.includes("object-fit: contain"), "Role codex images must preserve full generated art instead of aggressive cropping.");
}

function checkLobbyImageContracts() {
  const css = readText("apps/web/app/globals.css");
  const lobbyInvitePage = readText("apps/web/app/lobby/[code]/page.tsx");

  assert(css.includes("--mode-preview-position"), "Lobby mode preview should use explicit sprite focal positions.");
  assert(css.includes("/ 200% auto no-repeat"), "Lobby mode preview sprite must preserve source aspect ratio.");
  assert(css.includes(".role-count-art"), "Lobby preset role chips must keep role artwork thumbnails.");
  assert(css.includes("var(--role-art) center / contain no-repeat"), "Lobby role thumbnails must not aggressively crop role art.");
  assert(css.includes(".achievement-preview-strip span"), "Lobby achievement preview strip is missing.");
  assert(css.includes("aspect-ratio: 1"), "Lobby badge tiles must stay square to avoid sprite distortion.");
  assert(css.includes("var(--empty-lobby) center / contain no-repeat"), "Lobby decorative empty-room art must preserve its full composition.");
  assert(css.includes("--invite-art: var(--art-lobby)"), "Mafia invite card should swap away from the village map asset.");
  assert(css.includes(".invite-scene-card"), "Invite card should use a mode-neutral class name.");
  assert(css.includes("var(--invite-art) center / cover no-repeat"), "Invite card must use theme-aware invite art.");
  assert(lobbyInvitePage.includes("досие към задната стая"), "Mafia invite page should use Mafia-specific scene copy.");
}

function checkPlayUiContracts() {
  const playClient = readText("apps/web/components/play-room-client.tsx");

  for (const contract of [
    "CUE_MODE_STORAGE_KEY",
    "LiveCuePanel",
    "NarratorDesk",
    "triggerDeviceCue",
    "createOptions?.tempoProfile === \"live\"",
    "Игра на живо: звукът и вибрацията са изключени по подразбиране",
    "панел на Разказвача",
    "Водиш играта",
    "Контрол на водещия",
    "narratorExtendTimer",
    "getGameFamily(mode)",
    "phaseLabelBg(phase, familyOrMode)",
    "phaseGuideBg(phase, mode)",
    "MAFIA_PHASE_GUIDE_BG",
    "Мафията, Донът и Комисарят.",
  ]) {
    assert(playClient.includes(contract), `Missing play UI contract: ${contract}`);
  }

  const liveDefaultIndex = playClient.indexOf("createOptions?.tempoProfile === \"live\"");
  const cuePreferenceReadIndex = playClient.indexOf("const saved = window.localStorage.getItem(CUE_MODE_STORAGE_KEY)");
  assert(
    liveDefaultIndex >= 0 && cuePreferenceReadIndex >= 0 && liveDefaultIndex < cuePreferenceReadIndex,
    "Live rooms must force silent cues before reading saved cue preferences.",
  );
}

function checkProductionGuardContracts() {
  const gameConfig = readText("apps/game-server/src/app.config.ts");
  const gameRoom = readText("apps/game-server/src/rooms/GameRoom.ts");
  const gameTokenRoute = readText("apps/web/app/api/game-token/route.ts");

  assert(gameConfig.includes("cors({ credentials: true, origin: getCorsOrigin() })"), "Game server CORS must be origin-restricted.");
  assert(gameConfig.includes("throw new Error(\"CORS_ORIGIN"), "Production CORS misconfiguration must fail fast.");
  assert(gameRoom.includes("process.env.NODE_ENV === \"production\""), "GameRoom must enforce production token secrets.");
  assert(gameRoom.includes("isProductionSecret"), "GameRoom missing production secret validation helper.");
  assert(gameTokenRoute.includes("process.env.NODE_ENV === \"production\""), "Web game-token route must enforce production token secrets.");
  assert(gameTokenRoute.includes("isProductionSecret"), "Web game-token route missing production secret validation helper.");
}

function checkProductionEnvChecker() {
  const valid = runEnvChecker(validProductionEnv());
  assert(valid.status === 0, `Valid production env failed:\n${valid.stderr}\n${valid.stdout}`);

  const wildcardCors = runEnvChecker({ ...validProductionEnv(), CORS_ORIGIN: "*" });
  assert(wildcardCors.status !== 0, "Wildcard CORS origin should fail production env check.");
  assert(wildcardCors.stderr.includes("CORS_ORIGIN"), "Wildcard CORS failure should mention CORS_ORIGIN.");

  const devAuth = runEnvChecker({ ...validProductionEnv(), ALLOW_DEV_AUTH: "true" });
  assert(devAuth.status !== 0, "ALLOW_DEV_AUTH=true should fail production env check.");
  assert(devAuth.stderr.includes("ALLOW_DEV_AUTH"), "Dev auth failure should mention ALLOW_DEV_AUTH.");

  const missingAppUrl = validProductionEnv();
  delete missingAppUrl.NEXT_PUBLIC_APP_URL;
  const missing = runEnvChecker(missingAppUrl);
  assert(missing.status !== 0, "Missing NEXT_PUBLIC_APP_URL should fail production env check.");
  assert(missing.stderr.includes("NEXT_PUBLIC_APP_URL"), "Missing app URL failure should mention NEXT_PUBLIC_APP_URL.");
}

function checkScriptWiring() {
  const packageJson = JSON.parse(readText("package.json"));
  const smoke = readText("scripts/smoke.mjs");
  const playtest = readText("scripts/playtest.mjs");

  assert(packageJson.scripts.regression === "node scripts/regression.mjs", "package.json must expose pnpm regression.");
  assert(packageJson.scripts.verify.includes("pnpm regression"), "pnpm verify must run regression checks.");
  assert(smoke.includes("optimized phase transition game art"), "Smoke must check optimized game-art delivery.");
  assert(smoke.includes("play page"), "Smoke must check the play page route.");
  assert(smoke.includes("live-safe play page"), "Smoke must check live-safe play page copy.");
  assert(smoke.includes("image-set"), "Smoke must check optimized CSS image-set references.");
  assert(playtest.includes("night-resolver.test.ts"), "Playtest must include night resolver regression tests.");
}

function validProductionEnv() {
  return {
    DATABASE_URL: "postgres://werewolf:prod-password@postgres:5432/werewolf",
    BETTER_AUTH_SECRET: "prod-better-auth-secret-000000000000000000",
    GAME_TOKEN_SECRET: "prod-game-token-secret-0000000000000000000",
    BETTER_AUTH_URL: "https://werewolf.example.com",
    NEXT_PUBLIC_APP_URL: "https://werewolf.example.com",
    NEXT_PUBLIC_GAME_SERVER_URL: "wss://ws.werewolf.example.com",
    PUBLIC_WEB_DOMAIN: "werewolf.example.com",
    PUBLIC_WS_DOMAIN: "ws.werewolf.example.com",
    CORS_ORIGIN: "https://werewolf.example.com",
    ALLOW_DEV_AUTH: "false",
  };
}

function runEnvChecker(env) {
  return spawnSync(process.execPath, ["scripts/check-production-env.mjs"], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ComSpec: process.env.ComSpec,
      ...env,
    },
    encoding: "utf8",
  });
}

function sumBytes(files) {
  return files.reduce((total, file) => total + statSync(path.join(gameArtDir, file)).size, 0);
}

function listFilesRecursive(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return listFilesRecursive(absolute, relative);
    }

    return entry.isFile() ? [relative] : [];
  });
}

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
