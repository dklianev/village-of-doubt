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
  ["rules playbook contracts", checkRulesPlaybookContracts],
  ["Bulgarian copy contracts", checkBulgarianCopyContracts],
  ["lobby image scaling contracts", checkLobbyImageContracts],
  ["lobby wizard contracts", checkLobbyWizardContracts],
  ["play UI hardening contracts", checkPlayUiContracts],
  ["frontend hygiene contracts", checkFrontendHygieneContracts],
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
  const roleThumbs = files.filter((file) => /^thumbs[\\/](mafia[\\/])?role-[^\\/]+\.webp$/.test(file));
  const mobileAssets = files.filter((file) => /^mobile[\\/].+\.webp$/.test(file));
  assert(pngs.length >= 70, `Expected at least 70 PNG game-art files, got ${pngs.length}.`);
  assert(roleThumbs.length >= 38, `Expected at least 38 role thumbnail WebPs, got ${roleThumbs.length}.`);
  assert(mobileAssets.length >= 40, `Expected at least 40 mobile WebP assets, got ${mobileAssets.length}.`);

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

  for (const critical of [
    "thumbs/role-healer.webp",
    "thumbs/role-seer.webp",
    "thumbs/mafia/role-mafioso.webp",
    "thumbs/mafia/role-don.webp",
    "mobile/bg-landing-hero.webp",
    "mobile/texture-parchment.webp",
    "mobile/mafia/bg-landing-hero.webp",
  ]) {
    assert(existsSync(path.join(gameArtDir, critical)), `Missing critical lightweight asset ${critical}.`);
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
  assert(css.includes(".toast-host"), "Missing toast host CSS.");
  assert(css.includes(".skeleton"), "Missing loading skeleton CSS.");
  assert(css.includes("@keyframes cuePulse"), "Missing cue pulse animation.");
  assert(css.includes("@keyframes skeletonShimmer"), "Missing skeleton shimmer animation.");
  assertThemeVariableBlock(css, '[data-theme="dark"]');
  assertThemeVariableBlock(css, '[data-theme="light"]');
  assert(css.includes('[data-theme="mafia"]'), "Missing Mafia theme selector.");
  assert(css.includes('/game-art/mafia/bg-landing-hero.webp'), "Missing Mafia image-set CSS references.");
  assert(css.includes('/game-art/mobile/bg-landing-hero.webp'), "Missing mobile image-set CSS references.");
}

function assertThemeVariableBlock(css, selector) {
  const start = css.indexOf(selector);
  assert(start >= 0, `Missing ${selector} theme selector.`);
  const block = css.slice(start, css.indexOf("}", start));
  for (const variable of ["--paper", "--ink", "--blood"]) {
    assert(block.includes(variable), `${selector} must declare ${variable}.`);
  }
}

function checkLandingLayoutContracts() {
  const css = readText("apps/web/app/globals.css");
  const landingPage = readText("apps/web/components/landing-experience.tsx");
  const siteChrome = readText("apps/web/components/site-chrome.tsx");

  assert(landingPage.includes("game-choice-grid"), "Landing page must render the separated game picker.");
  assert(landingPage.includes("href={`${game.href}/create`}"), "Landing page must link directly to each game's create flow.");
  assert(landingPage.includes("href: \"/werewolf\""), "Landing page must define a Werewolf game entry.");
  assert(landingPage.includes("href: \"/mafia\""), "Landing page must define a Mafia game entry.");
  assert(!landingPage.includes("Село под съмнение"), "Landing page must not use the old Werewolf branding.");
  assert(!landingPage.includes("Българска Мафия"), "Landing page must not use the old Mafia branding.");
  assert(css.includes(".game-choice-grid"), "Game picker grid needs dedicated styling.");
  assert(css.includes(".game-choice-card"), "Game picker cards need dedicated styling.");
  assert(siteChrome.includes("prefetch={false}"), "Site chrome navigation should not prefetch every secondary route on first load.");
}

function checkRolesPageContracts() {
  const rolesPage = readText("apps/web/components/games/game-roles-page.tsx");
  const legacyRolesRoute = readText("apps/web/app/roles/page.tsx");
  const css = readText("apps/web/app/globals.css");

  assert(rolesPage.includes("getRolesForFamily"), "Roles page must filter roles by family.");
  assert(rolesPage.includes("KNOWN_WEREWOLF_ROLE_ASSETS"), "Roles page must keep an explicit Werewolf asset allow-list.");
  assert(rolesPage.includes("KNOWN_MAFIA_ROLE_ASSETS"), "Roles page must keep an explicit Mafia asset allow-list.");
  assert(rolesPage.includes("<picture className=\"role-codex-art role-codex-frame\""), "Roles page must render role art as framed picture elements.");
  assert(rolesPage.includes("role-codex-card-compact"), "Roles page must use compact codex cards instead of full-text rows.");
  assert(rolesPage.includes("RoleCodexDetail"), "Roles page must keep full role copy in a cinematic detail sheet.");
  assert(rolesPage.includes("roleThumbPath"), "Roles page must use lightweight role thumbnails for codex cards.");
  assert(legacyRolesRoute.includes("redirect(\"/werewolf/roles\")"), "Legacy /roles route must not render mixed role data.");
  assert(css.includes(".role-mayor"), "Missing mayor role-art CSS class.");
  assert(css.includes("/game-art/role-mayor.webp"), "Missing optimized mayor role art CSS reference.");
  assert(css.includes("/game-art/mafia/role-mafioso.webp"), "Missing Mafia role-art CSS reference.");
  assert(css.includes(".role-codex-frame"), "Role codex images need a stable art frame.");
  assert(css.includes("aspect-ratio: 5 / 7"), "Role codex art frames must preserve a portrait card ratio.");
  assert(css.includes(".role-codex-detail"), "Role codex detail sheet needs dedicated styling.");
  assert(css.includes(".role-codex-frame img"), "Role codex cards must style real image elements.");
  assert(css.includes("object-fit: cover"), "Role codex images must fill the card frame without stretching.");
  assert(!/\.role-codex-card\s*{[^}]*content-visibility/s.test(css), "Role codex cards must render full content during visual audits.");
}

function checkRulesPlaybookContracts() {
  const rulesPage = readText("apps/web/components/games/game-rules-page.tsx");
  const werewolfRulesRoute = readText("apps/web/app/werewolf/rules/page.tsx");
  const mafiaRulesRoute = readText("apps/web/app/mafia/rules/page.tsx");
  const css = readText("apps/web/app/globals.css");

  assert(rulesPage.includes("getRulesForFamily"), "Rules page must keep shared rules data as its source.");
  assert(rulesPage.includes("rules-playbook-hero"), "Rules page must render the premium playbook hero.");
  assert(rulesPage.includes("rules-phase-timeline"), "Rules page must render the interactive phase timeline.");
  assert(rulesPage.includes("rules-scenario-grid"), "Rules page must render family scenario cards.");
  assert(rulesPage.includes("rules-chapter-grid"), "Rules sections must render as compact chapter cards.");
  assert(rulesPage.includes("rules-table-protocol"), "Rules page must render the table protocol block.");
  assert(rulesPage.includes("WEREWOLF_SCENARIOS"), "Werewolf rules must define family-specific scenarios.");
  assert(rulesPage.includes("MAFIA_SCENARIOS"), "Mafia rules must define family-specific scenarios.");
  assert(
    werewolfRulesRoute.includes('<GameRulesPage family="werewolves" />'),
    "/werewolf/rules must continue to render through GameRulesPage.",
  );
  assert(mafiaRulesRoute.includes('<GameRulesPage family="mafia" />'), "/mafia/rules must continue to render through GameRulesPage.");

  for (const selector of [
    ".rules-playbook-hero",
    ".rules-phase-timeline",
    ".rules-phase-detail",
    ".rules-chapter-grid",
    ".rules-chapter-card",
    ".rules-scenario-grid",
    ".rules-table-protocol",
  ]) {
    assert(css.includes(selector), `Missing rules playbook CSS selector ${selector}.`);
  }
}

function checkBulgarianCopyContracts() {
  const uiFiles = [
    ...listFilesRecursive(path.join(root, "apps/web/app")).filter((file) => /\.(tsx|ts)$/.test(file)).map((file) => `apps/web/app/${file}`),
    ...listFilesRecursive(path.join(root, "apps/web/components")).filter((file) => /\.(tsx|ts)$/.test(file)).map((file) => `apps/web/components/${file}`),
    "packages/shared/src/games/werewolf/roles.ts",
    "packages/shared/src/games/werewolf/rules.ts",
    "packages/shared/src/games/mafia/roles.ts",
    "packages/shared/src/games/mafia/rules.ts",
    "packages/shared/src/game-config.ts",
  ];

  for (const file of uiFiles) {
    const text = readText(file);
    for (const forbidden of [
      "Село под съмнение",
      "Българска Мафия",
      "Werewolf & Mafia",
      "Вот",
      "PDF",
      "pdf",
      "голямата кутия",
      "Голяма кутия",
      "канонич",
      "правилник",
      "правилниц",
    ]) {
      assert(!text.includes(forbidden), `${file} contains forbidden user-facing copy: ${forbidden}`);
    }
  }

  assert(
    existsSync(path.join(root, "docs/werewolf-rules-implementation-status.md")),
    "Werewolf rules implementation status doc should use source-neutral naming.",
  );
  assert(
    !existsSync(path.join(root, "docs/werewolf-pdf-implementation-status.md")),
    "Old PDF-named Werewolf implementation doc should not remain.",
  );
}

function checkLobbyImageContracts() {
  const css = readText("apps/web/app/globals.css");
  const lobbyInvitePage = readText("apps/web/app/lobby/[code]/page.tsx");
  const lobbyCreateClient = readText("apps/web/components/lobby-create-client.tsx");

  assert(css.includes("--mode-preview-position"), "Lobby mode preview should use explicit sprite focal positions.");
  assert(css.includes("/ 200% auto no-repeat"), "Lobby mode preview sprite must preserve source aspect ratio.");
  assert(css.includes(".role-count-art"), "Lobby preset role chips must keep role artwork thumbnails.");
  assert(css.includes("var(--role-art) center / contain no-repeat"), "Lobby role thumbnails must not aggressively crop role art.");
  assert(lobbyCreateClient.includes("roleThumbStyle"), "Lobby role chips must override role art with lightweight thumbnails.");
  assert(css.includes(".achievement-preview-strip span"), "Lobby achievement preview strip is missing.");
  assert(css.includes("aspect-ratio: 1"), "Lobby badge tiles must stay square to avoid sprite distortion.");
  assert(css.includes("var(--empty-lobby) center / contain no-repeat"), "Lobby decorative empty-room art must preserve its full composition.");
  assert(css.includes("--invite-art: var(--art-lobby)"), "Mafia invite card should swap away from the village map asset.");
  assert(css.includes(".invite-scene-card"), "Invite card should use a mode-neutral class name.");
  assert(css.includes("var(--invite-art) center / cover no-repeat"), "Invite card must use theme-aware invite art.");
  assert(lobbyInvitePage.includes("досие към задната стая"), "Mafia invite page should use Mafia-specific scene copy.");
}

function checkLobbyWizardContracts() {
  const css = readText("apps/web/app/globals.css");
  const wizard = readText("apps/web/components/lobby/LobbyWizard.tsx");
  const stepRoles = readText("apps/web/components/lobby/StepRoles.tsx");
  const reducer = readText("apps/web/lib/lobby-form.ts");
  const roomNames = readText("apps/web/lib/roomname-generator.ts");

  for (const selector of [
    ".lobby-wizard",
    ".mode-tile-card",
    ".tempo-tile",
    ".sticky-preview",
    ".mobile-summary-chip",
    ".role-tile-large",
    ".role-carousel",
    ".preset-chips",
    ".lobby-confetti",
  ]) {
    assert(css.includes(selector), `Missing lobby wizard CSS selector ${selector}.`);
  }

  assert(wizard.includes("useReducer(lobbyFormReducer"), "LobbyWizard must use the lobby form reducer.");
  assert(wizard.includes("startViewTransition"), "LobbyWizard must use view transitions for step changes.");
  assert(stepRoles.includes("playCue"), "StepRoles must trigger role-selection sound cues.");
  assert(reducer.includes("export function lobbyFormReducer"), "lobby-form.ts must export lobbyFormReducer.");
  assert(reducer.includes("export function estimatedDurationSeconds"), "lobby-form.ts must export estimatedDurationSeconds.");
  assert(roomNames.includes("export function randomRoomName"), "roomname-generator.ts must export randomRoomName.");
}

function checkPlayUiContracts() {
  const playClient = readText("apps/web/components/play-room-client.tsx");
  const css = readText("apps/web/app/globals.css");

  for (const contract of [
    "ANONYMOUS_DISPLAY_NAME_KEY",
    "anonymousDisplayName",
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
  assert(css.includes("bottom: max(12px, env(safe-area-inset-bottom))"), "Mobile night action sheet must respect safe-area.");
  assert(css.includes("max-height: calc(100dvh - 96px)"), "Mobile night action sheet must be height-constrained.");
  assert(css.includes("overscroll-behavior: contain"), "Mobile night action sheet must contain scroll bounce.");
}

function checkFrontendHygieneContracts() {
  const css = readText("apps/web/app/globals.css");
  const siteChrome = readText("apps/web/components/site-chrome.tsx");
  const stepRoom = readText("apps/web/components/lobby/StepRoom.tsx");

  assert(!/calc\(100%\s*-\s*\d+px\)/.test(css), "globals.css must not contain calc(100% - Npx) width patterns.");
  assert(css.includes("@media (max-width: 480px)"), "globals.css must include explicit max-width 480px mobile rules.");
  assert(existsSync(path.join(root, "docs/frontend-audit/REPORT.md")), "Frontend visual audit report must exist.");
  assert(css.includes("--chrome-bg"), "Navbar redesign must keep the --chrome-bg token.");
  assert(siteChrome.includes("export default function SiteChrome"), "site-chrome.tsx must export one default component named SiteChrome.");
  assert(!siteChrome.includes("ЗВУК: ВКЛ"), "Navbar sound control must be icon-only.");
  assert(!siteChrome.includes("ТЕМА: СИСТЕМНА"), "Navbar theme control must be icon-only.");
  assert(css.includes(".field-input-wrap"), "Step 1 form must keep the in-input action wrapper.");
  assert(css.includes(".field-action"), "Step 1 form must keep icon action button styles.");
  assert(stepRoom.includes("export function Field"), "StepRoom must use the uniform Field subcomponent.");
}

function checkProductionGuardContracts() {
  const gameConfig = readText("apps/game-server/src/app.config.ts");
  const gameRoom = readText("apps/game-server/src/rooms/GameRoom.ts");
  const gameTokenRoute = readText("apps/web/app/api/game-token/route.ts");
  const proxy = readText("apps/web/proxy.ts");
  const caddyfile = readText("Caddyfile");

  assert(gameConfig.includes("cors({ credentials: true, origin: getCorsOrigin() })"), "Game server CORS must be origin-restricted.");
  assert(gameConfig.includes("throw new Error(\"CORS_ORIGIN"), "Production CORS misconfiguration must fail fast.");
  assert(gameRoom.includes("process.env.NODE_ENV === \"production\""), "GameRoom must enforce production token secrets.");
  assert(gameRoom.includes("isProductionSecret"), "GameRoom missing production secret validation helper.");
  assert(gameTokenRoute.includes("process.env.NODE_ENV === \"production\""), "Web game-token route must enforce production token secrets.");
  assert(gameTokenRoute.includes("isProductionSecret"), "Web game-token route missing production secret validation helper.");
  assert(proxy.includes("export function proxy"), "Next 16 rate limiter must use proxy.ts with export function proxy.");
  assert(proxy.includes("matcher: \"/api/game-token\""), "Game-token proxy must only match the token endpoint.");
  assert(proxy.includes("process.env.NODE_ENV !== \"production\""), "Game-token proxy must stay production-only.");
  assert(proxy.includes("Retry-After"), "Game-token rate limit must return Retry-After.");
  assert(proxy.includes("Твърде много заявки"), "Game-token rate limit error must be Bulgarian.");
  assert(caddyfile.includes("Strict-Transport-Security"), "Caddyfile must enable HSTS.");
  assert(caddyfile.includes("X-Frame-Options \"DENY\""), "Caddyfile must block framing.");
  assert(caddyfile.includes("Content-Security-Policy"), "Caddyfile must include a baseline CSP.");
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
  const codexEnvironment = readText(".codex/environments/environment.toml");
  const ciWorkflow = readText(".github/workflows/ci.yml");

  assert(packageJson.scripts.regression === "node scripts/regression.mjs", "package.json must expose pnpm regression.");
  assert(packageJson.scripts["codex:run"] === "node scripts/codex-run.mjs", "package.json must expose pnpm codex:run.");
  assert(existsSync(path.join(root, "scripts/codex-run.mjs")), "Codex run action script must exist.");
  assert(codexEnvironment.includes('command = "pnpm codex:run"'), "Codex Run action must point at pnpm codex:run.");
  assert(packageJson.scripts["frontend:e2e"] === "node scripts/frontend-e2e.mjs", "package.json must expose pnpm frontend:e2e.");
  assert(packageJson.scripts.verify.includes("pnpm regression"), "pnpm verify must run regression checks.");
  assert(packageJson.scripts.verify.includes("pnpm frontend:e2e"), "pnpm verify must run frontend Playwright QA.");
  assert(smoke.includes("optimized phase transition game art"), "Smoke must check optimized game-art delivery.");
  assert(smoke.includes("play page"), "Smoke must check the play page route.");
  assert(smoke.includes("live-safe play page"), "Smoke must check live-safe play page copy.");
  assert(smoke.includes("image-set"), "Smoke must check optimized CSS image-set references.");
  assert(playtest.includes("night-resolver.test.ts"), "Playtest must include night resolver regression tests.");
  assert(ciWorkflow.includes("actions/checkout@v6"), "CI checkout action must use a Node 24-runtime release.");
  assert(ciWorkflow.includes("pnpm/action-setup@v6"), "CI pnpm action must use a Node 24-runtime release.");
  assert(ciWorkflow.includes("actions/setup-node@v6"), "CI setup-node action must use a Node 24-runtime release.");
  assert(ciWorkflow.includes("node-version: 24"), "CI must verify against Node 24.");
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
