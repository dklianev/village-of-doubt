import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const gameArtDir = path.join(root, "apps/web/public/game-art");
const sourceArtDir = path.join(root, "assets/game-art-source");

const checks = [
  ["game art WebP pairing", checkGameArtPairing],
  ["CSS image-set delivery", checkCssImageSet],
  ["landing layout contracts", checkLandingLayoutContracts],
  ["family quickstart contracts", checkFamilyQuickStartContracts],
  ["roles page art contracts", checkRolesPageContracts],
  ["rules playbook contracts", checkRulesPlaybookContracts],
  ["Bulgarian copy contracts", checkBulgarianCopyContracts],
  ["lobby image scaling contracts", checkLobbyImageContracts],
  ["lobby wizard contracts", checkLobbyWizardContracts],
  ["play UI hardening contracts", checkPlayUiContracts],
  ["frontend hygiene contracts", checkFrontendHygieneContracts],
  ["metadata title contracts", checkMetadataTitleContracts],
  ["private route metadata contracts", checkPrivateRouteMetadataContracts],
  ["primitive override anti-pattern", checkPrimitiveOverrideAntiPattern],
  ["faction theme attribute contracts", checkFactionThemeAttributeContracts],
  ["play room lifecycle contracts", checkPlayRoomLifecycleContracts],
  ["globals.css size budget", checkGlobalsCssBudget],
  ["production security guards", checkProductionGuardContracts],
  ["launch testing contracts", checkLaunchTestingContracts],
  ["production env checker behavior", checkProductionEnvChecker],
  ["smoke/playtest/verify wiring", checkScriptWiring],
  ["production operations contracts", checkProductionOperationsContracts],
  ["database migration workflow", checkDatabaseMigrationWorkflow],
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
  const sourcePngs = listFilesRecursive(sourceArtDir).filter((file) => file.endsWith(".png")).sort();
  const publicPngs = files.filter((file) => file.endsWith(".png")).sort();
  const webps = new Set(files.filter((file) => file.endsWith(".webp")));
  const openGraphPngs = publicPngs.filter((file) => /^og[\\/]/.test(file));
  const openGraphDerivatives = files.filter(
    (file) => /^og[\\/].+\.(?:avif|webp)$/.test(file),
  );
  const roleThumbs = files.filter((file) => /^thumbs[\\/](mafia[\\/])?role-[^\\/]+\.webp$/.test(file));
  const mobileAssets = files.filter((file) => /^mobile[\\/].+\.webp$/.test(file));
  const expectedPublicPngs = new Set([
    "legal/faq-hearth-banner.png",
    "legal/privacy-banner.png",
    "legal/report-banner.png",
    "legal/status-banner.png",
    "legal/terms-banner.png",
    "og/og-achievements.png",
    "og/og-faq.png",
    "og/og-history.png",
    "og/og-home.png",
    "og/og-leaderboard.png",
    "og/og-mafia.png",
    "og/og-sign-in.png",
    "og/og-tutorial.png",
    "og/og-werewolf.png",
  ]);

  assert(sourcePngs.length >= 70, `Expected at least 70 source PNG game-art files, got ${sourcePngs.length}.`);
  assert(openGraphPngs.length >= 9, `Expected Open Graph PNG sources, got ${openGraphPngs.length}.`);
  assert(
    publicPngs.length === expectedPublicPngs.size &&
      publicPngs.every((file) => expectedPublicPngs.has(file.replaceAll("\\", "/"))),
    `Runtime public PNG whitelist drifted: ${publicPngs.join(", ")}`,
  );
  assert(
    openGraphDerivatives.length === 0,
    `Open Graph metadata should not retain unused AVIF/WebP derivatives: ${openGraphDerivatives.join(", ")}`,
  );
  assert(roleThumbs.length >= 38, `Expected at least 38 role thumbnail WebPs, got ${roleThumbs.length}.`);
  assert(mobileAssets.length >= 40, `Expected at least 40 mobile WebP assets, got ${mobileAssets.length}.`);

  for (const png of sourcePngs.filter((file) => !/^og[\\/]/.test(file))) {
    const webp = png.replace(/\.png$/, ".webp");
    assert(webps.has(webp), `Missing optimized WebP for ${png}. Run pnpm optimize:assets.`);
    assert(statSync(path.join(gameArtDir, webp)).size > 10_000, `${webp} looks too small/corrupt.`);
    assert(
      statSync(path.join(gameArtDir, webp)).size < statSync(path.join(sourceArtDir, png)).size,
      `${webp} should remain smaller than its source PNG master.`,
    );
  }

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
    assert(existsSync(path.join(sourceArtDir, `${critical}.png`)), `Missing source PNG master ${critical}.png.`);
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
  const css = readAppStyles();
  const imageSetCount = count(css, "image-set(url(\"/game-art/");
  const directGameArtVariables = css.match(/--[\w-]+:\s*url\("\/game-art\/[^"]+\.png"\)/g) ?? [];
  const pngImageSetCandidates = css.match(/type\(["']image\/png["']\)/g) ?? [];

  assert(imageSetCount >= 80, `Expected many image-set game-art references, got ${imageSetCount}.`);
  assert(directGameArtVariables.length === 0, `Found direct PNG CSS variables: ${directGameArtVariables.join(", ")}`);
  assert(pngImageSetCandidates.length === 0, "Runtime CSS must not expose source PNG image-set candidates.");
  assert(css.includes(".cue-panel"), "Missing live cue panel CSS.");
  assert(css.includes(".narrator-desk"), "Missing narrator desk CSS.");
  assert(css.includes(".toast-host"), "Missing toast host CSS.");
  assert(css.includes(".skeleton"), "Missing loading skeleton CSS.");
  assert(css.includes("@keyframes cuePulse"), "Missing cue pulse animation.");
  assert(css.includes("@keyframes skeletonShimmer"), "Missing skeleton shimmer animation.");
  assertThemeVariableBlock(css, '[data-theme="dark"]');
  assertThemeVariableBlock(css, '[data-theme="light"]');
  assert(css.includes('[data-theme="mafia"]'), "Missing Mafia theme selector.");
  assert(css.includes('[data-family="mafia"]') && css.includes('[data-faction="mafia"]'), "Faction selectors must support data-family/data-faction for Mafia.");
  assert(css.includes('/game-art/mafia/bg-landing-hero.webp'), "Missing Mafia image-set CSS references.");
  assert(css.includes('/game-art/mobile/bg-landing-hero.webp'), "Missing mobile image-set CSS references.");
}

function checkMetadataTitleContracts() {
  const appDir = path.join(root, "apps/web/app");
  const files = listFilesRecursive(appDir).filter((file) => file.endsWith(".tsx"));
  const duplicateBrandSuffix = [];

  for (const file of files) {
    const absolute = path.join(appDir, file);
    const source = readFileSync(absolute, "utf8");
    const titleSuffixMatches = source.matchAll(/title:\s*(?:`[^`]*|\{[^}]*|["'][^"']*)\|\s*Върколак и Мафия/g);
    for (const match of titleSuffixMatches) {
      duplicateBrandSuffix.push(`${path.join("apps/web/app", file)}:${lineForIndex(source, match.index ?? 0)}`);
    }
  }

  assert(
    duplicateBrandSuffix.length === 0,
    `Per-route metadata titles must not include the site suffix manually; layout.tsx applies it. Found:\n${duplicateBrandSuffix.join("\n")}`,
  );
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
  const css = readLandingStyles();
  const landingPage = readText("apps/web/components/landing-experience.tsx");
  const modeChoiceCards = readText("apps/web/components/landing/ModeChoiceCards.tsx");
  const universalHowToPlay = readText("apps/web/components/landing/UniversalHowToPlay.tsx");
  const liveTickerCard = readText("apps/web/components/landing/LiveTickerCard.tsx");
  const recentEndingsCard = readText("apps/web/components/landing/RecentEndingsCard.tsx");
  const quickStartIcons = readText("apps/web/components/landing/quickstart-icons.tsx");
  const siteChrome = readText("apps/web/components/site-chrome.tsx");
  const siteChromeCss = readText("apps/web/components/site-chrome/SiteChrome.module.css");
  const tutorialCss = readText("apps/web/components/tutorial/Tutorial.module.css");
  const chromeCss = `${css}\n${siteChromeCss}`;
  const publicShellCss = `${css}\n${tutorialCss}`;
  const chromeIconHoverStart = chromeCss.indexOf(".site-icon-button:hover");
  const chromeIconHoverBlock =
    chromeIconHoverStart >= 0 ? chromeCss.slice(chromeIconHoverStart, chromeCss.indexOf("}", chromeIconHoverStart)) : "";
  const heroKickerPattern = /(^|\n)(?::global\()?\.landing-hero-card > \.section-kicker\)?\s*{/;
  const theatreBackdropStart = css.indexOf("body:has(.landing-shell)::before");
  const theatreBackdropBlock =
    theatreBackdropStart >= 0 ? css.slice(theatreBackdropStart, css.indexOf("}", theatreBackdropStart)) : "";
  const theatreBodyStart = css.indexOf('html[data-theme="dark"] body:has(.landing-shell)');
  const theatreBodyBlock =
    theatreBodyStart >= 0 ? css.slice(theatreBodyStart, css.indexOf("}", theatreBodyStart)) : "";
  const lightBackdropStart = css.indexOf('html[data-theme="light"] .landing-shell::before');
  const lightBackdropBlock =
    lightBackdropStart >= 0 ? css.slice(lightBackdropStart, css.indexOf("}", lightBackdropStart)) : "";
  const tutorialLightBackdropStart = tutorialCss.indexOf('html[data-theme="light"] .tutorial-shell::before');
  const tutorialLightBackdropBlock =
    tutorialLightBackdropStart >= 0 ? tutorialCss.slice(tutorialLightBackdropStart, tutorialCss.indexOf("}", tutorialLightBackdropStart)) : "";
  const lightTheatreBackdropStart = css.indexOf('html[data-theme="light"] body:has(.landing-shell)::before');
  const lightTheatreBackdropBlock =
    lightTheatreBackdropStart >= 0 ? css.slice(lightTheatreBackdropStart, css.indexOf("}", lightTheatreBackdropStart)) : "";
  const publicShellStackPattern =
    /\.landing-shell,\s*\.game-home-shell,\s*\.lobby-shell,\s*\.history-shell,\s*\.roles-shell,\s*\.rules-shell,\s*\.sign-in-shell,\s*\.utility-shell\s*{[\s\S]*?z-index:\s*0;[\s\S]*?isolation:\s*isolate;/;

  assert(landingPage.includes("<ModeChoiceCards"), "Landing page must render the separated game picker component.");
  assert(modeChoiceCards.includes("game-choice-grid"), "Landing mode choice component needs the game picker grid.");
  assert(modeChoiceCards.includes("useAuthSession(initialSession)"), "Landing page CTA must share the lightweight auth session hook.");
  assert(!modeChoiceCards.includes('@/lib/auth-client'), "Landing cards must not pull Better Auth into the critical route bundle.");
  assert(modeChoiceCards.includes("prefetch={false}"), "Landing game links must not prefetch multiple route trees before LCP.");
  assert(modeChoiceCards.includes("Влез и играй"), "Signed-out landing CTA must point users to sign-in.");
  assert(modeChoiceCards.includes("Избери игра"), "Signed-in landing CTA must send users to game selection.");
  assert(landingPage.includes("href: \"/werewolf\""), "Landing page must define a Werewolf game entry.");
  assert(landingPage.includes("href: \"/mafia\""), "Landing page must define a Mafia game entry.");
  assert(landingPage.includes("/game-art/bg-landing-hero-composited.avif"), "Landing page should preload the desktop AVIF composited hero background selected by CSS.");
  assert(landingPage.includes("/game-art/mobile/bg-landing-hero-composited.avif"), "Landing page should preload the mobile AVIF composited hero background selected by the picture source.");
  assert(landingPage.includes("/game-art/mobile/bg-landing-hero-composited.webp"), "Landing hero picture should keep a mobile WebP fallback.");
  assert(!landingPage.includes("href: \"/game-art/bg-landing-ambient-composited.webp\""), "Landing should not preload ambient art ahead of its LCP hero.");
  assert(!landingPage.includes("href: \"/game-art/mobile/bg-landing-ambient-composited.webp\""), "Landing should not preload mobile ambient art ahead of its LCP hero.");
  assert(!landingPage.includes("href: \"/game-art/bg-lobby-tavern.webp\""), "Landing should not preload below-fold game-card art.");
  assert(!landingPage.includes("href: \"/game-art/mobile/bg-lobby-tavern.webp\""), "Landing should not preload below-fold mobile game-card art.");
  assert(css.includes("/game-art/mobile/mafia/bg-lobby-tavern.webp"), "Landing cards must use the optimized Mafia backdrop on mobile.");
  assert(!landingPage.includes("Село под съмнение"), "Landing page must not use the old Werewolf branding.");
  assert(!landingPage.includes("Българска Мафия"), "Landing page must not use the old Mafia branding.");
  assert(css.includes(".game-choice-grid"), "Game picker grid needs dedicated styling.");
  assert(css.includes(".game-choice-card"), "Game picker cards need dedicated styling.");
  assert(css.includes(".game-choice-actions"), "Landing game choice actions must have a dedicated alignment hook.");
  assert(heroKickerPattern.test(css), "Landing hero kicker chip must be a base dark-and-light style, not light-only.");
  assert(css.includes(".quickstart-surface"), "Landing quickstart needs the parchment surface selector.");
  assert(css.includes(".quickstart-medallion"), "Landing quickstart needs medallion styling.");
  assert(css.includes(".quickstart-connector"), "Landing quickstart needs connector styling.");
  assert(css.includes("top: 46px;"), "Landing quickstart connector should align through medallion centers on desktop.");
  assert(css.includes(".mode-choice-continue-pill"), "Landing mode cards need the continue pill styling.");
  assert(existsSync(path.join(root, "apps/web/components/landing/UniversalHowToPlay.tsx")), "Missing landing UniversalHowToPlay component.");
  assert(existsSync(path.join(root, "apps/web/components/landing/LiveTickerCard.tsx")), "Missing landing LiveTickerCard component.");
  assert(existsSync(path.join(root, "apps/web/components/landing/RecentEndingsCard.tsx")), "Missing landing RecentEndingsCard component.");
  assert(existsSync(path.join(root, "apps/web/components/landing/quickstart-icons.tsx")), "Missing landing quickstart inline SVG icon set.");
  assert(landingPage.includes("UniversalHowToPlay"), "Landing page must import and render UniversalHowToPlay.");
  assert(landingPage.includes("LiveTickerCard") && landingPage.includes("RecentEndingsCard"), "Landing page must render shared stats cards.");
  assert(!landingPage.includes("QuickStartSection"), "Landing page must not render deprecated QuickStartSection.");
  assert(!universalHowToPlay.includes("IntersectionObserver"), "Landing how-to-play should not ship IntersectionObserver for below-fold connector reveal.");
  assert(css.includes("content-visibility: visible;"), "Landing quickstart must render hover shadows outside its bounds.");
  assert(css.includes("contain-intrinsic-size: none;"), "Landing quickstart must not use paint containment that clips CTA hover shadows.");
  assert(liveTickerCard.includes("Бъди първият на масата"), "Landing live empty state must invite the first room.");
  assert(recentEndingsCard.includes("Първите герои ще се появят тук."), "Landing winner empty state must use designed Bulgarian copy.");
  for (const exportName of ["PersonIcon", "HouseIcon", "MaskIcon", "MoonIcon", "BallotIcon", "LastWinnerEmptyGlyph"]) {
    assert(quickStartIcons.includes(`export function ${exportName}`), `landing quickstart-icons.tsx must export ${exportName}.`);
  }
  assert(css.includes("--art-landing-dual"), "Landing page must expose the dual-world background art variable.");
  assert(css.includes("--art-landing-ambient"), "Landing page must expose the ambient outer background art variable.");
  assert(theatreBodyBlock.includes("rgba(8, 9, 9, 0.95)"), "Dark theatre pages should use a solid body color behind the fixed backdrop.");
  assert(publicShellStackPattern.test(css), "Public page shells must isolate their fixed backdrop layer above the body background.");
  assert(publicShellCss.includes(".tutorial-shell") && publicShellCss.includes("isolation: isolate;"), "Tutorial shell must keep its isolated fixed backdrop layer.");
  assert(theatreBackdropBlock.includes("--art-landing-ambient-composited"), "Landing theatre backdrop must use the composited ambient homepage background.");
  assert(theatreBackdropBlock.includes("animation: ambient-drift 48s"), "Landing theatre backdrop must drift subtly in dark theme.");
  assert(
    css.includes(".landing-shell::before") && css.includes(".game-home-shell::before"),
    "Landing and family shells should disable their old absolute pseudo backdrop.",
  );
  assert(css.includes('html[data-theme="dark"] .lobby-shell::before'), "Lobby dark backdrop should keep the original absolute pseudo system.");
  assert(!css.includes('html[data-theme="dark"] .landing-shell::before'), "Landing dark theme must not use the old zoom-prone shell pseudo.");
  assert(!css.includes('html[data-theme="dark"] .game-home-shell::before'), "Family home dark theme must not use the old zoom-prone shell pseudo.");
  for (const shellSelector of [
    ".landing-shell::before",
    ".game-home-shell::before",
    ".lobby-shell::before",
    ".history-shell::before",
    ".roles-shell::before",
    ".rules-shell::before",
    ".tutorial-shell::before",
    ".utility-shell::before",
  ]) {
    const backdropBlock = shellSelector === ".tutorial-shell::before" ? tutorialLightBackdropBlock : lightBackdropBlock;
    assert(backdropBlock.includes(shellSelector), `Light theme must disable page-art backdrop for ${shellSelector}.`);
  }
  assert(lightBackdropBlock.includes(".lobby-shell::before"), "Legacy create light theme should match the old shared parchment backdrop.");
  assert(lightBackdropBlock.includes("display: none;"), "Light theme should use the shared homepage body background instead of page-art backdrops.");
  assert(
    lightTheatreBackdropBlock.includes("#f7ead0") &&
      lightTheatreBackdropBlock.includes("animation: ambient-drift-light 72s") &&
      lightTheatreBackdropBlock.includes("transform: translate3d(-0.6%, 0, 0) scale(1.02)"),
    "Light theatre backdrop should use the cream gradient with subtle ambient drift.",
  );
  assert(css.includes("/game-art/bg-landing-ambient-composited.webp"), "Landing page must reference the optimized composited ambient outer background.");
  assert(existsSync(path.join(sourceArtDir, "bg-landing-ambient-composited.png")), "Missing composited ambient landing source PNG.");
  assert(existsSync(path.join(gameArtDir, "bg-landing-ambient-composited.webp")), "Missing optimized composited ambient landing background WebP.");
  assert(existsSync(path.join(gameArtDir, "mobile/bg-landing-ambient-composited.webp")), "Missing mobile composited ambient landing background WebP.");
  assert(existsSync(path.join(sourceArtDir, "bg-landing-ambient.png")), "Missing ambient landing source PNG.");
  assert(existsSync(path.join(gameArtDir, "bg-landing-ambient.webp")), "Missing optimized ambient landing background WebP.");
  assert(existsSync(path.join(gameArtDir, "mobile/bg-landing-ambient.webp")), "Missing mobile ambient landing background WebP.");
  assert(css.includes("/game-art/bg-landing-hero-composited.webp"), "Landing page must reference the optimized composited hero background.");
  assert(existsSync(path.join(sourceArtDir, "bg-landing-hero-composited.png")), "Missing composited hero landing source PNG.");
  assert(existsSync(path.join(gameArtDir, "bg-landing-hero-composited.webp")), "Missing optimized composited hero landing background WebP.");
  assert(existsSync(path.join(gameArtDir, "mobile/bg-landing-hero-composited.webp")), "Missing mobile composited hero landing background WebP.");
  assert(css.includes("/game-art/bg-landing-dual-world-v2.webp"), "Landing page must keep the optimized current dual-world background variable for other routes.");
  assert(existsSync(path.join(sourceArtDir, "bg-landing-dual-world-v2.png")), "Missing current dual-world landing source PNG.");
  assert(existsSync(path.join(gameArtDir, "bg-landing-dual-world-v2.webp")), "Missing optimized current dual-world landing background WebP.");
  assert(existsSync(path.join(gameArtDir, "mobile/bg-landing-dual-world-v2.webp")), "Missing mobile current dual-world landing background WebP.");
  assert(siteChrome.includes("prefetch={false}"), "Site chrome navigation should not prefetch every secondary route on first load.");
  assert(chromeCss.includes("/game-art/logo-chrome-mark.webp"), "Navbar brand should use the chrome-optimized micro-sigil WebP.");
  assert(existsSync(path.join(sourceArtDir, "logo-chrome-mark.png")), "Missing chrome micro-sigil source PNG.");
  assert(existsSync(path.join(gameArtDir, "logo-chrome-mark.webp")), "Missing optimized chrome micro-sigil WebP asset.");
  assert(siteChrome.includes("site-brand-dot"), "Navbar wordmark should keep the premium separator accent.");
  assert(siteChrome.includes("Социална игра на сенки"), "Navbar subtitle should use the updated Bulgarian tagline.");
  assert(!siteChrome.includes("ВЪРКОЛАК · МАФИЯ"), "Navbar must not use the old uppercase subtitle.");
  assert(!siteChrome.includes("Системна тема"), "Navbar theme toggle should only expose light and dark modes.");
  assert(!siteChrome.includes("\"system\""), "Navbar theme cycle should not include the old system preference.");
  assert(!chromeIconHoverBlock.includes("transform:"), "Navbar icon hover must not use transform lift.");
}

function checkFamilyQuickStartContracts() {
  const css = readGameHomeStyles();
  const gameHomePage = readText("apps/web/components/games/game-home-page.tsx");
  const liveTickerCard = readText("apps/web/components/landing/LiveTickerCard.tsx");
  const recentEndingsCard = readText("apps/web/components/landing/RecentEndingsCard.tsx");
  const werewolfTimeline = readText("apps/web/components/games/WerewolfNightTimeline.tsx");
  const mafiaTimeline = readText("apps/web/components/games/MafiaNightTimeline.tsx");
  const roleSpotlight = readText("apps/web/components/games/RoleSpotlight.tsx");
  const variantsChips = readText("apps/web/components/games/VariantsChips.tsx");
  const mafiaMechanics = readText("apps/web/components/games/MafiaMechanicsCallouts.tsx");
  const sportMafia = readText("apps/web/components/games/SportMafiaCallout.tsx");
  const gameRoom = readText("apps/game-server/src/rooms/GameRoom.ts");
  const icons = readText("apps/web/components/games/quickstart-icons.tsx");
  const werewolfTheatreStart = css.indexOf('body:has(.game-home-shell[data-family="werewolves"])::before');
  const werewolfTheatreBlock =
    werewolfTheatreStart >= 0 ? css.slice(werewolfTheatreStart, css.indexOf("}", werewolfTheatreStart)) : "";
  const mafiaTheatreStart = css.indexOf('body:has(.game-home-shell[data-family="mafia"])::before');
  const mafiaTheatreBlock =
    mafiaTheatreStart >= 0 ? css.slice(mafiaTheatreStart, css.indexOf("}", mafiaTheatreStart)) : "";

  assert(existsSync(path.join(root, "apps/web/components/games/WerewolfNightTimeline.tsx")), "Missing WerewolfNightTimeline component.");
  assert(existsSync(path.join(root, "apps/web/components/games/MafiaNightTimeline.tsx")), "Missing MafiaNightTimeline component.");
  assert(existsSync(path.join(root, "apps/web/components/games/RoleSpotlight.tsx")), "Missing RoleSpotlight component.");
  assert(existsSync(path.join(root, "apps/web/components/games/VariantsChips.tsx")), "Missing VariantsChips component.");
  assert(existsSync(path.join(root, "apps/web/components/games/quickstart-icons.tsx")), "Missing quickstart inline SVG icon set.");
  assert(!existsSync(path.join(root, "apps/web/components/games/QuickStartSection.tsx")), "Family home QuickStartSection should be deprecated after identity split.");
  assert(gameHomePage.includes("<WerewolfNightTimeline") && gameHomePage.includes("<MafiaNightTimeline"), "GameHomePage must render family-specific timelines.");
  assert(gameHomePage.includes("<RoleSpotlight"), "GameHomePage must render family role spotlight.");
  assert(gameHomePage.includes("<LiveTickerCard") && gameHomePage.includes("<RecentEndingsCard"), "GameHomePage must render shared stats cards.");
  assert(gameHomePage.includes("function GameHero"), "GameHomePage must extract the cinematic hero into a GameHero subcomponent.");
  for (const selector of [".game-home-hero__art", ".game-home-hero__scrim", ".game-home-hero__content", ".game-home-hero__fog", ".game-home-hero__rain"]) {
    assert(css.includes(selector), `Missing cinematic game hero selector ${selector}.`);
  }
  assert(css.includes('[data-family="werewolves"]') && css.includes('[data-faction="werewolves"]') && css.includes("--family-hero"), "Werewolf faction selectors must expose --family-hero.");
  assert(css.includes('[data-family="mafia"]') && css.includes('[data-faction="mafia"]') && css.includes("--family-hero"), "Mafia faction selectors must expose --family-hero.");
  assert(css.includes("@keyframes fog-drift"), "Werewolf hero needs fog-drift keyframes.");
  assert(css.includes("@keyframes rain-veil"), "Mafia hero needs rain-veil keyframes.");
  for (const asset of [
    "werewolf/bg-hero-v2.png",
    "werewolf/bg-hero-v2.webp",
    "werewolf/bg-hero-light-v1.png",
    "werewolf/bg-hero-light-v1.webp",
    "mafia/bg-hero-v2.png",
    "mafia/bg-hero-v2.webp",
    "mafia/bg-hero-light-v1.png",
    "mafia/bg-hero-light-v1.webp",
    "mobile/werewolf/bg-hero-v2.webp",
    "mobile/werewolf/bg-hero-light-v1.webp",
    "mobile/mafia/bg-hero-v2.webp",
    "mobile/mafia/bg-hero-light-v1.webp",
  ]) {
    const assetRoot = asset.endsWith(".png") ? sourceArtDir : gameArtDir;
    assert(existsSync(path.join(assetRoot, asset)), `Missing cinematic hero asset ${asset}.`);
  }
  assert(
    werewolfTheatreBlock.includes("var(--art-werewolf)") &&
      css.includes("/game-art/werewolf/bg-hero-v2.webp") &&
      css.includes("/game-art/werewolf/bg-hero-light-v1.webp"),
    "Werewolf home theatre backdrop should use theme-aware --art-werewolf hero art.",
  );
  assert(
    mafiaTheatreBlock.includes("var(--art-mafia)") &&
      css.includes("/game-art/mafia/bg-hero-v2.webp") &&
      css.includes("/game-art/mafia/bg-hero-light-v1.webp"),
    "Mafia home theatre backdrop should use theme-aware --art-mafia hero art.",
  );
  assert(!gameHomePage.includes("QuickStartSection"), "GameHomePage must not render deprecated QuickStartSection.");
  assert(!werewolfTimeline.includes("IntersectionObserver") && !mafiaTimeline.includes("IntersectionObserver"), "Family timelines should not ship IntersectionObserver for reveal.");
  assert(css.includes("content-visibility: visible"), "Family quickstart should avoid paint containment that clips CTA hover shadows.");
  assert(liveTickerCard.includes("Бъди първият на масата") && liveTickerCard.includes("Запали първия огън"), "Live ticker empty states must be family-aware.");
  assert(recentEndingsCard.includes("Първите легенди ще се появят тук.") && recentEndingsCard.includes("Първите досиета ще се появят тук."), "Recent endings empty states must be family-aware.");
  assert(recentEndingsCard.includes("LastWinnerEmptyGlyph"), "Family winner empty state must use the shared designed glyph.");
  assert(roleSpotlight.includes("ordinary_villager") && roleSpotlight.includes("commissioner"), "RoleSpotlight must use real family role identifiers.");
  assert(variantsChips.includes("С Маниак") && variantsChips.includes("Комисар и Доктор"), "Variant chips must use project role terminology.");
  assert(mafiaMechanics.includes("Дневникът на Комисаря"), "Mafia mechanics must use current role terminology.");
  assert(sportMafia.includes("Създай маса"), "Sport Mafia CTA must use idiomatic Bulgarian copy.");
  assert(gameRoom.includes("recentEndings") && gameRoom.includes("byFamily"), "Game server stats must expose family counts and recent endings.");
  for (const selector of [".quickstart-surface", ".quickstart-medallion", ".quickstart-connector", ".quickstart-row", ".night-timeline", ".role-spotlight", ".variants-chips"]) {
    assert(css.includes(selector), `Missing quickstart CSS selector ${selector}.`);
  }
  for (const asset of [
    "werewolf/night-1-fog.png",
    "werewolf/night-1-fog.webp",
    "werewolf/night-2-seer.webp",
    "werewolf/night-3-wolves.webp",
    "werewolf/night-4-healer.webp",
    "werewolf/night-5-dawn.webp",
    "mafia/night-1-rain.png",
    "mafia/night-1-rain.webp",
    "mafia/night-2-don.webp",
    "mafia/night-3-sheriff.webp",
    "mafia/night-4-doctor.webp",
    "mafia/night-5-morning.webp",
  ]) {
    const assetRoot = asset.endsWith(".png") ? sourceArtDir : gameArtDir;
    assert(existsSync(path.join(assetRoot, asset)), `Missing night timeline art asset ${asset}.`);
  }
  for (const exportName of ["PersonIcon", "KeyIcon", "DoorIcon", "MaskIcon", "MoonIcon", "BallotIcon", "LastWinnerEmptyGlyph"]) {
    assert(icons.includes(`export function ${exportName}`), `quickstart-icons.tsx must export ${exportName}.`);
  }
}

function checkRolesPageContracts() {
  const rolesPage = readText("apps/web/components/games/game-roles-page.tsx");
  const legacyRolesRoute = readText("apps/web/app/roles/page.tsx");
  const css = readRolesStyles();

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
  const rulesPhaseTimeline = readText("apps/web/components/games/GameRulesPhaseTimeline.tsx");
  const werewolfRulesRoute = readText("apps/web/app/werewolf/rules/page.tsx");
  const mafiaRulesRoute = readText("apps/web/app/mafia/rules/page.tsx");
  const css = readRulesStyles();

  assert(rulesPage.includes("getRulesForFamily"), "Rules page must keep shared rules data as its source.");
  assert(rulesPage.includes("rules-playbook-hero"), "Rules page must render the premium playbook hero.");
  assert(
    rulesPage.includes("<GameRulesPhaseTimeline"),
    "Rules page must render the interactive phase timeline client island.",
  );
  assert(
    rulesPhaseTimeline.includes("rules-phase-timeline"),
    "Rules phase timeline must keep its page-local contract class.",
  );
  assert(
    rulesPhaseTimeline.includes("function PhaseDetailPanel"),
    "Rules phase timeline must render phase details through PhaseDetailPanel.",
  );
  assert(
    rulesPhaseTimeline.includes("phaseLabelBg"),
    "Rules phase timeline must use family-aware phase labels.",
  );
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
    ".phase-timeline",
    ".phase-node",
    ".phase-detail-panel",
    ".phase-info-chip",
    ".phase-loop-arrow",
    ".phase-timeline__line.is-loop",
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
  const css = readLobbyStyles();
  const lobbyInvitePage = readText("apps/web/app/lobby/[code]/page.tsx");
  const lobbyCreateClient = readText("apps/web/components/lobby-create-client.tsx");

  assert(css.includes("--mode-preview-position"), "Lobby mode preview should use explicit sprite focal positions.");
  assert(css.includes("/ 200% auto no-repeat"), "Lobby mode preview sprite must preserve source aspect ratio.");
  assert(css.includes(".role-count-art"), "Lobby preset role chips must keep role artwork thumbnails.");
  assert(css.includes("var(--role-art) center / contain no-repeat"), "Lobby role thumbnails must not aggressively crop role art.");
  assert(lobbyCreateClient.includes("roleThumbStyle"), "Lobby role chips must override role art with lightweight thumbnails.");
  assert(css.includes(".achievement-preview-strip span"), "Lobby achievement preview strip is missing.");
  assert(css.includes("aspect-ratio: 1"), "Lobby badge tiles must stay square to avoid sprite distortion.");
  assert(css.includes(".lobby-invite-hero-img"), "Lobby invite hero image must keep explicit image styling.");
  assert(css.includes("object-position: center 44%"), "Lobby invite hero image must keep its tuned focal point.");
  assert(css.includes("--invite-art: var(--art-lobby)"), "Mafia invite card should swap away from the village map asset.");
  assert(css.includes(".lobby-invite-v2"), "Invite page should use the current cinematic invite shell.");
  assert(lobbyInvitePage.includes("LobbyInviteClient"), "Lobby invite page must render the invite client.");
  assert(lobbyInvitePage.includes("досие към задната стая"), "Mafia invite page should use Mafia-specific scene copy.");
}

function checkLobbyWizardContracts() {
  const css = readLobbyStyles();
  const wizard = readText("apps/web/components/lobby/LobbyWizard.tsx");
  const stepRoles = readText("apps/web/components/lobby/StepRoles.tsx");
  const reducer = readText("apps/web/lib/lobby-form/reducer.ts");
  const selectors = readText("apps/web/lib/lobby-form/selectors.ts");
  const index = readText("apps/web/lib/lobby-form/index.ts");
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
  assert(reducer.includes("export function lobbyFormReducer"), "lobby-form reducer module must export lobbyFormReducer.");
  assert(selectors.includes("export function estimatedDurationSeconds"), "lobby-form selectors module must export estimatedDurationSeconds.");
  assert(index.includes("export { lobbyFormReducer }"), "lobby-form index must re-export lobbyFormReducer.");
  assert(roomNames.includes("export function randomRoomName"), "roomname-generator.ts must export randomRoomName.");
}

function checkPlayUiContracts() {
  const playModuleText = [
    "apps/web/components/play-room-client.tsx",
    ...listFilesRecursive(path.join(root, "apps/web/components/play"))
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => path.join("apps/web/components/play", file)),
    ...listFilesRecursive(path.join(root, "apps/web/lib/play"))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => path.join("apps/web/lib/play", file)),
    ...listFilesRecursive(path.join(root, "apps/web/hooks/play"))
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => path.join("apps/web/hooks/play", file)),
  ]
    .map((file) => readText(file))
    .join("\n");
  const css = readPlayStyles();

  for (const contract of [
    "authClient.useSession",
    "/api/game-token",
    "CUE_MODE_STORAGE_KEY",
    "LiveCuePanel",
    "NarratorDesk",
    "triggerDeviceCue",
    "tempoProfile === \"live\"",
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
    assert(playModuleText.includes(contract), `Missing play UI contract: ${contract}`);
  }

  const liveDefaultIndex = playModuleText.indexOf("tempoProfile === \"live\"");
  const cuePreferenceReadIndex = playModuleText.indexOf("const saved = safeLocalStorage.getItem(CUE_MODE_STORAGE_KEY)");
  assert(
    liveDefaultIndex >= 0 && cuePreferenceReadIndex >= 0 && liveDefaultIndex < cuePreferenceReadIndex,
    "Live rooms must force silent cues before reading saved cue preferences.",
  );
  assert(css.includes("bottom: max(12px, env(safe-area-inset-bottom))"), "Mobile night action sheet must respect safe-area.");
  assert(css.includes("max-height: calc(100dvh - 96px)"), "Mobile night action sheet must be height-constrained.");
  assert(css.includes("overscroll-behavior: contain"), "Mobile night action sheet must contain scroll bounce.");
}

function checkFrontendHygieneContracts() {
  const css = readAppStyles();
  const lobbyStyles = readLobbyStyles();
  const siteChrome = readText("apps/web/components/site-chrome.tsx");
  const serviceWorker = readText("apps/web/public/sw.js");
  const uiTokens = readText("packages/ui/src/tokens.css");
  const uiPackage = JSON.parse(readText("packages/ui/package.json"));
  const sharedPackage = JSON.parse(readText("packages/shared/package.json"));
  const stepRoom = readText("apps/web/components/lobby/StepRoom.tsx");
  const fieldComponent = readText("apps/web/components/lobby/Field.tsx");
  const clientComponentFiles = listFilesRecursive(path.join(root, "apps/web/components"))
    .filter((file) => /\.(tsx|ts)$/.test(file))
    .filter((file) => readText(`apps/web/components/${file}`).startsWith('"use client"'));
  const serverDefaultComponents = [
    "apps/web/components/SiteFooter.tsx",
    "apps/web/components/JsonLd.tsx",
    "apps/web/components/resource-hints.tsx",
    "apps/web/components/skeleton.tsx",
    "apps/web/components/manual-role-builder.tsx",
  ];

  assert(!/calc\(100%\s*-\s*\d+px\)/.test(css), "App styles must not contain calc(100% - Npx) width patterns.");
  assert(css.includes("@media (max-width: 480px)"), "App styles must include explicit max-width 480px mobile rules.");
  assert(existsSync(path.join(root, "docs/frontend-audit/REPORT.md")), "Frontend visual audit report must exist.");
  assert(css.includes("--chrome-bg"), "Navbar redesign must keep the --chrome-bg token.");
  assert(siteChrome.includes("export default function SiteChrome"), "site-chrome.tsx must export one default component named SiteChrome.");
  assert(!siteChrome.includes("ЗВУК: ВКЛ"), "Navbar sound control must be icon-only.");
  assert(!siteChrome.includes("ТЕМА: СИСТЕМНА"), "Navbar theme control must be icon-only.");
  assert(
    /useEffect\(\(\) => \{\s*onPathnameChange\(pathname\);/.test(siteChrome) && !siteChrome.includes("useLayoutEffect"),
    "Navbar pathname state must synchronize after mount so instant hydration cannot update an unmounted parent.",
  );
  assert(
    serviceWorker.includes('const SHELL_URLS = ["/offline"]'),
    "The service worker shell cache must contain only the navigation fallback that its fetch handler reads.",
  );
  assert(
    uiPackage.scripts["build:js"].includes("preserve-client-boundary.mjs"),
    "The UI build must preserve the client directive that tsup strips while bundling.",
  );
  for (const primitive of ["Dialog", "Sheet", "Toast"]) {
    assert(
      readText(`packages/ui/src/primitives/${primitive}.tsx`).startsWith('"use client"'),
      `${primitive} must declare its Radix/React client boundary.`,
    );
  }
  assert(uiTokens.includes("--ds-border-subtle:"), "UI tokens must define --ds-border-subtle for primitive borders.");
  assert(!existsSync(path.join(root, "packages/ui/src/styles/sheet.css")), "The obsolete duplicate Sheet stylesheet must stay removed.");
  assert(sharedPackage.sideEffects === false, "@werewolf/shared must remain side-effect free for client tree-shaking.");
  assert(lobbyStyles.includes(".field-input-wrap"), "Step 1 form must keep the in-input action wrapper.");
  assert(lobbyStyles.includes(".field-action"), "Step 1 form must keep icon action button styles.");
  assert(
    stepRoom.includes('from "@/components/lobby/Field"') && fieldComponent.includes("export function Field"),
    "StepRoom must use the uniform Field subcomponent.",
  );
  assert(clientComponentFiles.length <= 50, `Too many apps/web client components: ${clientComponentFiles.length} > 50.`);
  for (const file of serverDefaultComponents) {
    assert(!readText(file).startsWith('"use client"'), `${file} should stay server-default.`);
  }
  assert(
    readText("apps/web/components/manual-role-builder.tsx").includes("ManualRoleBuilderClient"),
    "ManualRoleBuilder shell must delegate interactive form state to ManualRoleBuilderClient.",
  );
  assert(
    readText("apps/web/components/manual-role-builder-client.tsx").startsWith('"use client"'),
    "ManualRoleBuilderClient must remain the explicit client island.",
  );
}

function checkPrimitiveOverrideAntiPattern() {
  const primitiveClassNames = [
    "paper-card",
    "scene-card",
    "ds-pill",
    "pill",
    "medallion",
    "surface",
    "eyebrow",
    "display",
    "toast",
    "dialog",
    "sheet",
    "empty-state",
  ];
  const primitiveDataNames = [
    "paper-card",
    "scene-card",
    "pill",
    "medallion",
    "surface",
    "eyebrow",
    "display",
    "toast",
    "dialog",
    "sheet",
    "empty-state",
  ];
  const files = listFilesRecursive(path.join(root, "apps/web"))
    .filter((file) => file.endsWith(".module.css"))
    .map((file) => path.join("apps/web", file));
  const violations = [];
  const classPattern = new RegExp(`:global\\([^)]*\\.(${primitiveClassNames.join("|")})\\b`, "g");
  const dataPattern = new RegExp(`:global\\([^)]*\\[data-ds-(${primitiveDataNames.join("|")})\\b`, "g");

  for (const file of files) {
    const src = readText(file);
    for (const pattern of [classPattern, dataPattern]) {
      for (const match of src.matchAll(pattern)) {
        violations.push({
          file,
          line: src.slice(0, match.index).split("\n").length,
          match: match[0].replace(/\s+/g, " "),
        });
      }
    }
  }

  if (violations.length === 0) {
    return;
  }

  const detail = violations.map((violation) => `  ${violation.file}:${violation.line}  ${violation.match}`).join("\n");
  const message =
    `Primitive identity override detected in ${violations.length} location(s):\n${detail}\n\n` +
    "Use a primitive extension or a page-local wrapper selector instead of :global() primitive overrides.";

  throw new Error(message);
}

function checkFactionThemeAttributeContracts() {
  const roots = [path.join(root, "apps/web/app"), path.join(root, "apps/web/components")];
  const files = roots
    .flatMap((dir) => listFilesRecursive(dir).map((file) => path.join(path.relative(root, dir), file)))
    .filter((file) => /\.(tsx|ts)$/.test(file));
  const violations = [];
  const factionThemePattern = /data-theme\s*=\s*(?:"(?:mafia|werewolves)"|{["'](?:mafia|werewolves)["']}|{[^}]*\bfamily\b[^}]*})/g;

  for (const file of files) {
    const source = readText(file);
    for (const match of source.matchAll(factionThemePattern)) {
      violations.push(`${file}:${lineForIndex(source, match.index ?? 0)}`);
    }
  }

  assert(
    violations.length === 0,
    `Faction context must use data-faction/data-family, not data-theme. Found:\n${violations.join("\n")}`,
  );
}

function checkPrivateRouteMetadataContracts() {
  const rootLayout = readText("apps/web/app/layout.tsx");
  const sitemap = readText("apps/web/app/sitemap.ts");
  const robots = readText("apps/web/app/robots.ts");
  const playPage = readText("apps/web/app/play/[code]/page.tsx");
  const lobbyPage = readText("apps/web/app/lobby/[code]/page.tsx");
  const replayPage = readText("apps/web/app/history/[gameId]/replay/page.tsx");
  const friendsPage = readText("apps/web/app/friends/page.tsx");
  const offlinePage = readText("apps/web/app/offline/page.tsx");

  assert(!rootLayout.includes("alternates: { canonical: SITE_URL }"), "Root metadata must not force the home canonical onto every route.");
  for (const privatePath of ["/roles", "/history", "/achievements"]) {
    assert(!sitemap.includes(`absoluteUrl("${privatePath}")`), `${privatePath} must not be listed in the public sitemap.`);
  }
  for (const privatePath of ["/friends", "/history", "/achievements", "/create"]) {
    assert(robots.includes(`"${privatePath}"`), `${privatePath} must be excluded from crawler access.`);
  }
  for (const source of [playPage, lobbyPage, friendsPage, offlinePage]) {
    assert(source.includes("index: false"), "Private and utility routes must emit explicit noindex metadata.");
  }
  assert(playPage.includes("normalizeRoomCode"), "Play metadata must normalize untrusted room codes.");
  assert(lobbyPage.includes("normalizeRoomCode"), "Lobby metadata must normalize untrusted room codes.");
  assert(replayPage.includes("isUuid(gameId)"), "Replay routes must reject malformed database identifiers before querying Postgres.");
}

function checkPlayRoomLifecycleContracts() {
  const playPage = readText("apps/web/app/play/[code]/page.tsx");
  const roomHook = readText("apps/web/hooks/play/use-game-room.ts");
  assert(
    /<PlayRoomClient\s+[\s\S]*?key=\{code}/.test(playPage),
    "The /play room client must be keyed by room code so route changes cannot retain public or private room state.",
  );
  assert(
    !roomHook.includes("visual-game-fixture"),
    "The production useGameRoom hook must not statically import the dev-only visual fixture.",
  );
  assert(
    playPage.includes('await import("@/hooks/play/visual-game-fixture")'),
    "The dev visual client must be loaded behind the server-side non-production gate.",
  );
}

function checkGlobalsCssBudget() {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "node scripts/audit-globals-css.mjs --budget"], {
          cwd: root,
          encoding: "utf8",
        })
      : spawnSync(process.execPath, ["scripts/audit-globals-css.mjs", "--budget"], {
          cwd: root,
          encoding: "utf8",
        });

  assert(
    result.status === 0,
    `globals.css budget failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`,
  );
}

function checkProductionGuardContracts() {
  const gameConfig = readText("apps/game-server/src/app.config.ts");
  const gameRoom = readText("apps/game-server/src/rooms/GameRoom.ts");
  const gameTokenRoute = readText("apps/web/app/api/game-token/route.ts");
  const proxy = readText("apps/web/proxy.ts");
  const caddyfile = readText("Caddyfile");

  assert(
    gameConfig.includes("cors({ credentials: true, origin: resolveGameServerCorsOrigin(process.env) })"),
    "Game server CORS must be origin-restricted.",
  );
  assert(gameConfig.includes("throw new Error(\"CORS_ORIGIN"), "Production CORS misconfiguration must fail fast.");
  assert(gameRoom.includes("process.env.NODE_ENV === \"production\""), "GameRoom must enforce production token secrets.");
  assert(gameRoom.includes("isProductionSecret"), "GameRoom missing production secret validation helper.");
  assert(gameTokenRoute.includes("process.env.NODE_ENV === \"production\""), "Web game-token route must enforce production token secrets.");
  assert(gameTokenRoute.includes("isProductionSecret"), "Web game-token route missing production secret validation helper.");
  assert(
    proxy.includes("export function proxy") || proxy.includes("export async function proxy"),
    "Next 16 rate limiter must use proxy.ts with an exported proxy function.",
  );
  assert(proxy.includes("matcher: \"/api/game-token\""), "Game-token proxy must only match the token endpoint.");
  assert(proxy.includes("process.env.NODE_ENV !== \"production\""), "Game-token proxy must stay production-only.");
  assert(proxy.includes("Retry-After"), "Game-token rate limit must return Retry-After.");
  assert(proxy.includes("Твърде много заявки"), "Game-token rate limit error must be Bulgarian.");
  assert(caddyfile.includes("Strict-Transport-Security"), "Caddyfile must enable HSTS.");
  assert(caddyfile.includes("X-Frame-Options \"DENY\""), "Caddyfile must block framing.");
  assert(caddyfile.includes("Content-Security-Policy"), "Caddyfile must include a baseline CSP.");
  assert(
    caddyfile.includes("@private_room_preview path_regexp private_room_preview (?i)^/rooms/[^/]+/preview(?:/.*)?$") &&
      caddyfile.includes("respond @private_room_preview 404"),
    "Public game ingress must not expose room preview enumeration.",
  );
  assert(
    caddyfile.includes("header_up -X-Werewolf-Room-Preview"),
    "Public game ingress must strip internal room preview credentials.",
  );
  assert(caddyfile.includes("health_uri /api/health\n"), "Caddy web upstream health must use shallow liveness.");
  assert(!caddyfile.includes("health_uri /api/health/ready"), "Caddy must not remove web ingress for deep dependency failures.");
  assert(caddyfile.includes("health_uri /health\n"), "Caddy game transport health must use shallow liveness.");
  assert(!caddyfile.includes("health_uri /health/ready"), "Caddy must not sever live game sockets for persistence-only failures.");
  assert((caddyfile.match(/request>uri regexp/g) ?? []).length >= 3, "Caddy access and runtime error logs must strip query strings from request URIs.");
}

function checkLaunchTestingContracts() {
  const packageJson = JSON.parse(readText("package.json"));
  const authRoute = readText("apps/web/app/api/auth/[...all]/route.ts");
  const authConfig = readText("apps/web/lib/auth.ts");
  const bannedCopyPattern = /без акаунт|без регистрация|временна идентичност|играй без|влизаш без|без профил|anonymous/i;
  const uiFiles = [
    ...listFilesRecursive(path.join(root, "apps/web/app"))
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .map((file) => `apps/web/app/${file}`),
    ...listFilesRecursive(path.join(root, "apps/web/components"))
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .map((file) => `apps/web/components/${file}`),
  ];
  const visualBaselineDir = path.join(root, "apps/web/__visual__/__baseline__");
  const baselinePngs = existsSync(visualBaselineDir)
    ? listFilesRecursive(visualBaselineDir).filter((file) => file.endsWith(".png"))
    : [];

  assert(
    packageJson.scripts["perf:budget"] === "node --test scripts/bundle-budget.test.mjs && node scripts/bundle-budget.mjs",
    "package.json must expose pnpm perf:budget with parser tests.",
  );
  assert(packageJson.scripts.visual?.includes("playwright.config.ts"), "package.json must expose pnpm visual with the Playwright config.");
  assert(packageJson.scripts["e2e:auth"] === "node scripts/e2e-auth.mjs", "package.json must expose pnpm e2e:auth.");
  assert(packageJson.scripts.verify.includes("pnpm visual"), "pnpm verify must run visual regression.");
  assert(packageJson.scripts.verify.includes("pnpm perf:budget"), "pnpm verify must run bundle budgets.");
  assert(packageJson.scripts.verify.includes("pnpm e2e:auth"), "pnpm verify must run auth E2E checks.");
  assert(packageJson.scripts["verify:heavy"]?.includes("pnpm test:migrations"), "pnpm verify:heavy must include migration tests.");
  assert(packageJson.scripts["verify:heavy"]?.includes("pnpm loadtest"), "pnpm verify:heavy must include load tests.");
  assert(!authRoute.includes("OAUTH_MOCK") && !authConfig.includes("OAUTH_MOCK"), "OAuth mock code must not ship in auth production routes.");
  const frontendE2e = readText("scripts/frontend-e2e.mjs");
  assert(!frontendE2e.includes("context.route("), "Frontend multiplayer E2E must not mock Better Auth or game-token routes.");
  assert(frontendE2e.includes("ROOM_CODE_ALPHABET"), "Frontend multiplayer E2E must use the shared room-code alphabet.");
  assert(frontendE2e.includes("ALLOW_DEV_AUTH: \"false\""), "Frontend multiplayer E2E must run production services without dev auth.");
  assert(frontendE2e.includes("sign-in/email"), "Frontend multiplayer E2E must obtain real Better Auth session cookies.");
  assert(baselinePngs.length >= 30, `Expected at least 30 visual baseline PNGs, got ${baselinePngs.length}. Run pnpm visual:update.`);

  for (const file of uiFiles) {
    const text = readText(file);
    assert(!bannedCopyPattern.test(text), `${file} still contains removed anonymous/auth-bypass wording.`);
  }
}

function checkProductionEnvChecker() {
  const valid = runEnvChecker(validProductionEnv());
  assert(valid.status === 0, `Valid production env failed:\n${valid.stderr}\n${valid.stdout}`);

  const validRotatingSecrets = runEnvChecker({
    ...validProductionEnv(),
    BETTER_AUTH_SECRETS:
      "2:prod-current-auth-secret-000000000000000000,1:prod-previous-auth-secret-0000000000000000",
  });
  assert(validRotatingSecrets.status === 0, "A newest-first Better Auth rotation key ring should be accepted.");

  const staleCurrentSecret = runEnvChecker({
    ...validProductionEnv(),
    BETTER_AUTH_SECRETS:
      "1:prod-previous-auth-secret-0000000000000000,2:prod-current-auth-secret-000000000000000000",
  });
  assert(staleCurrentSecret.status !== 0, "Better Auth rotation must not encrypt with an older key version.");
  assert(
    staleCurrentSecret.stderr.includes("BETTER_AUTH_SECRETS"),
    "Invalid Better Auth rotation should name BETTER_AUTH_SECRETS.",
  );

  const retiredLegacySecret = validProductionEnv();
  delete retiredLegacySecret.BETTER_AUTH_SECRET;
  retiredLegacySecret.BETTER_AUTH_LEGACY_TOKENS_RETIRED = "true";
  const withoutLegacySecret = runEnvChecker(retiredLegacySecret);
  assert(
    withoutLegacySecret.status === 0,
    `A fully migrated Better Auth key ring should allow legacy key retirement:\n${withoutLegacySecret.stderr}`,
  );

  const unconfirmedLegacyRetirement = validProductionEnv();
  delete unconfirmedLegacyRetirement.BETTER_AUTH_SECRET;
  const withoutRetirementSignOff = runEnvChecker(unconfirmedLegacyRetirement);
  assert(
    withoutRetirementSignOff.status !== 0,
    "Removing BETTER_AUTH_SECRET without an explicit migration sign-off must fail.",
  );
  assert(
    withoutRetirementSignOff.stderr.includes("BETTER_AUTH_LEGACY_TOKENS_RETIRED"),
    "Unsafe Better Auth key retirement should name the required sign-off.",
  );

  const sharedRuntimeRole = runEnvChecker({
    ...validProductionEnv(),
    GAME_DATABASE_URL: validProductionEnv().WEB_DATABASE_URL,
  });
  assert(sharedRuntimeRole.status !== 0, "Web and game must not share a production database identity.");
  assert(
    sharedRuntimeRole.stderr.includes("GAME_DATABASE_URL"),
    "Shared runtime database identity failure should mention GAME_DATABASE_URL.",
  );

  const missingDatabaseIdentity = validProductionEnv();
  delete missingDatabaseIdentity.MIGRATION_DATABASE_URL;
  const withoutMigrationIdentity = runEnvChecker(missingDatabaseIdentity);
  assert(withoutMigrationIdentity.status !== 0, "Missing migration database identity should fail production env check.");
  assert(
    withoutMigrationIdentity.stderr.includes("MIGRATION_DATABASE_URL"),
    "Missing migration identity failure should mention MIGRATION_DATABASE_URL.",
  );

  const unlabeledRuntime = runEnvChecker({
    ...validProductionEnv(),
    WEB_DATABASE_URL: "postgres://werewolf_web:prod-web-password-000000000000000000@postgres:5432/werewolf",
  });
  assert(unlabeledRuntime.status !== 0, "Production database clients must set application_name.");
  assert(
    unlabeledRuntime.stderr.includes("application_name"),
    "Unlabeled database client failure should mention application_name.",
  );

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

  const missingRedisUrl = validProductionEnv();
  delete missingRedisUrl.WEB_REDIS_URL;
  const withoutRedis = runEnvChecker(missingRedisUrl);
  assert(withoutRedis.status !== 0, "Missing WEB_REDIS_URL should fail production env check.");
  assert(withoutRedis.stderr.includes("WEB_REDIS_URL"), "Missing Redis URL failure should name the service URL.");

  const unauthenticatedRedis = validProductionEnv();
  delete unauthenticatedRedis.WEB_REDIS_PASSWORD;
  const withoutRedisAuth = runEnvChecker(unauthenticatedRedis);
  assert(withoutRedisAuth.status !== 0, "Unauthenticated production Redis should fail production env check.");
  assert(withoutRedisAuth.stderr.includes("WEB_REDIS_PASSWORD"), "Redis auth failure should name the service secret.");

  const serverOnlySentry = validProductionEnv();
  delete serverOnlySentry.NEXT_PUBLIC_SENTRY_DSN;
  const withoutClientSentry = runEnvChecker(serverOnlySentry);
  assert(withoutClientSentry.status !== 0, "Production must require browser Sentry.");
  assert(withoutClientSentry.stderr.includes("NEXT_PUBLIC_SENTRY_DSN"), "Missing browser Sentry failure should name the variable.");

  const missingRelease = validProductionEnv();
  delete missingRelease.RELEASE_VERSION;
  const noRelease = runEnvChecker(missingRelease);
  assert(noRelease.status !== 0, "Missing RELEASE_VERSION should fail production env check.");
  assert(noRelease.stderr.includes("RELEASE_VERSION"), "Missing release failure should mention RELEASE_VERSION.");

  const placeholderRelease = runEnvChecker({ ...validProductionEnv(), RELEASE_VERSION: "unknown" });
  assert(placeholderRelease.status !== 0, "Placeholder RELEASE_VERSION should fail production env check.");
}

function checkScriptWiring() {
  const packageJson = JSON.parse(readText("package.json"));
  const turboConfig = JSON.parse(readText("turbo.json"));
  const smoke = readText("scripts/smoke.mjs");
  const playtest = readText("scripts/playtest.mjs");
  const codexEnvironment = readText(".codex/environments/environment.toml");
  const ciWorkflow = readText(".github/workflows/ci.yml");
  const webDockerfile = readText("apps/web/Dockerfile");
  const clientInstrumentation = readText("apps/web/instrumentation-client.ts");
  const browserSentryBridge = readText("apps/web/lib/sentry-client.ts");
  const browserSentryRuntime = readText("apps/web/lib/sentry-client-runtime.ts");
  const gameDockerfile = readText("apps/game-server/Dockerfile");
  const gameConfig = readText("apps/game-server/src/app.config.ts");
  const playerPresenceManager = readText("apps/game-server/src/rooms/player-presence-manager.ts");
  const compose = readText("docker-compose.yml");

  assert(packageJson.scripts.regression === "node scripts/regression.mjs", "package.json must expose pnpm regression.");
  assert(packageJson.scripts["codex:run"] === "node scripts/codex-run.mjs", "package.json must expose pnpm codex:run.");
  assert(existsSync(path.join(root, "scripts/codex-run.mjs")), "Codex run action script must exist.");
  assert(codexEnvironment.includes('command = "pnpm codex:run"'), "Codex Run action must point at pnpm codex:run.");
  assert(packageJson.scripts["frontend:e2e"] === "node scripts/frontend-e2e.mjs", "package.json must expose pnpm frontend:e2e.");
  assert(
    packageJson.scripts["frontend:e2e:cross-browser"] === "node scripts/frontend-e2e-matrix.mjs",
    "package.json must expose cross-browser frontend QA.",
  );
  assert(packageJson.scripts.lighthouse === "node scripts/lighthouse.mjs", "package.json must expose Lighthouse QA.");
  assert(smoke.includes("COLYSEUS_REDIS_URL"), "Smoke tests must supply the production Colyseus Redis dependency.");
  assert(
    readText("scripts/frontend-e2e.mjs").includes("authenticated local Redis"),
    "Frontend E2E must exercise the production authenticated Redis boundary.",
  );
  assert(packageJson.scripts["loadtest:launch"] === "node scripts/loadtest-launch.mjs", "package.json must expose the launch load profile.");
  assert(packageJson.scripts["loadtest:heavy"] === "node scripts/loadtest-heavy.mjs", "package.json must expose the stress load profile.");
  assert(packageJson.scripts["verify:assets"].includes("node scripts/verify-optimized-assets.mjs"), "package.json must expose the optimized asset drift guard.");
  assert(packageJson.scripts.verify.startsWith("pnpm verify:assets"), "pnpm verify must fail early on generated asset drift.");
  assert(packageJson.devDependencies?.sharp, "The root asset pipeline must declare sharp directly.");
  const buildPassThroughEnv = new Set(turboConfig.tasks?.build?.passThroughEnv ?? []);
  for (const variable of [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_SECRETS",
    "BETTER_AUTH_LEGACY_TOKENS_RETIRED",
    "GAME_TOKEN_SECRET",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
  ]) {
    assert(
      buildPassThroughEnv.has(variable),
      `Turbo build tasks must receive ${variable} in strict environment mode.`,
    );
  }
  assert(
    turboConfig.tasks.build.outputs.includes("!.next/cache/**")
      && turboConfig.tasks.build.outputs.includes("!.next/dev/**"),
    "Turbo must not archive transient Next.js cache or dev output as production build artifacts.",
  );
  assert(
    turboConfig.tasks.build.env?.includes("RELEASE_VERSION"),
    "Turbo build cache keys must include the Sentry release version.",
  );
  assert(packageJson.scripts.verify.includes("pnpm regression"), "pnpm verify must run regression checks.");
  assert(packageJson.scripts.verify.includes("pnpm frontend:e2e"), "pnpm verify must run frontend Playwright QA.");
  assert(packageJson.scripts.verify.includes("pnpm operations:test"), "pnpm verify must validate production operations wiring.");
  assert(
    packageJson.scripts["verify:heavy"].includes("pnpm frontend:e2e:cross-browser")
      && packageJson.scripts["verify:heavy"].includes("pnpm lighthouse")
      && packageJson.scripts["verify:heavy"].includes("pnpm loadtest:heavy"),
    "pnpm verify:heavy must run cross-browser, Lighthouse, and stress-load gates.",
  );
  assert(smoke.includes("optimized phase transition game art"), "Smoke must check optimized game-art delivery.");
  assert(smoke.includes("play page"), "Smoke must check the play page route.");
  assert(smoke.includes("live-safe play page"), "Smoke must check live-safe play page copy.");
  assert(smoke.includes("image-set"), "Smoke must check optimized CSS image-set references.");
  assert(playtest.includes("night-resolver.test.ts"), "Playtest must include night resolver regression tests.");
  assert(
    ciWorkflow.includes("actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803"),
    "CI checkout action must be pinned by commit.",
  );
  assert(
    ciWorkflow.includes("pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271"),
    "CI pnpm action must be pinned by commit.",
  );
  assert(
    ciWorkflow.includes("actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38"),
    "CI Node action must be pinned by commit.",
  );
  assert(
    ciWorkflow.includes("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"),
    "CI artifact action must be pinned by commit.",
  );
  assert(
    clientInstrumentation.includes("startClientMonitoring()")
      && browserSentryBridge.includes('import("./sentry-client-runtime")')
      && browserSentryBridge.includes("requestIdleCallback")
      && browserSentryRuntime.includes("new BrowserClient({")
      && browserSentryRuntime.includes("globalHandlersIntegration()"),
    "Next client instrumentation must defer a minimal browser Sentry client.",
  );
  assert(
    webDockerfile.includes("NEXT_PUBLIC_SENTRY_DSN")
      && webDockerfile.includes("sentry_auth_token"),
    "Web release builds must receive the public DSN and an ephemeral source-map token.",
  );
  assert(
    webDockerfile.includes("id=better_auth_secrets")
      && webDockerfile.includes('BETTER_AUTH_SECRETS="$(cat /run/secrets/better_auth_secrets)"')
      && compose.includes("BETTER_AUTH_SECRETS: ${BETTER_AUTH_SECRETS:?"),
    "Web release builds and runtime must receive the versioned Better Auth key ring as a secret.",
  );
  assert(
    (webDockerfile.match(/^COPY patches patches$/gm) ?? []).length === 2
      && gameDockerfile.includes("COPY patches patches"),
    "Every Docker dependency stage must copy pnpm patchedDependencies before frozen install.",
  );

  const ciNodeMajor = ciWorkflow.match(/node-version:\s*["']?(\d+)/)?.[1];
  const webNodeMajor = webDockerfile.match(/^FROM node:(\d+)/m)?.[1];
  const gameNodeMajor = gameDockerfile.match(/^FROM node:(\d+)/m)?.[1];
  assert(Boolean(ciNodeMajor && webNodeMajor && gameNodeMajor), "CI and Dockerfiles must declare explicit Node major versions.");
  assert(webNodeMajor === gameNodeMajor, "Web and game production images must use the same Node major.");
  assert(ciNodeMajor === webNodeMajor, `CI Node ${ciNodeMajor} must match production Node ${webNodeMajor}.`);
  assert(ciWorkflow.includes("scripts/container-ingress-smoke.mjs"), "CI must verify Caddy HTTP and WebSocket ingress.");
  assert(
    ciWorkflow.includes("redis:8.2-alpine@sha256:a7859ed111db3c1f5404a973a4747505d559fb5ca32d37e447afc0ef845a2103"),
    "CI production smoke must pin Redis by digest.",
  );
  assert(
    ciWorkflow.includes("REDIS_URL: redis://default:ci-redis-password-that-is-long-enough@localhost:6379"),
    "CI verify must connect smoke tests to authenticated Redis.",
  );
  assert(
    count(
      ciWorkflow,
      "COLYSEUS_REDIS_URL: redis://default:ci-redis-password-that-is-long-enough@localhost:6379",
    ) >= 2,
    "CI verify build and runtime gates must connect to authenticated Colyseus Redis.",
  );
  assert(ciWorkflow.includes("WEB_REDIS_PASSWORD:"), "CI container verification must provide the web Redis secret.");
  assert(ciWorkflow.includes("GAME_REDIS_PASSWORD:"), "CI container verification must provide the game Redis secret.");
  assert(ciWorkflow.includes("COLYSEUS_REDIS_PASSWORD:"), "CI container verification must provide the Colyseus Redis secret.");
  assert(gameConfig.includes("RedisPresence"), "Production game-server scaling must configure RedisPresence.");
  assert(gameConfig.includes("RedisDriver"), "Production game-server scaling must configure RedisDriver.");
  assert(
    gameConfig.includes("resolveGameServerRedisUrl(process.env)")
      && gameConfig.includes("environment.REDIS_URL"),
    "Game-server Redis scaling must be driven by the validated REDIS_URL environment.",
  );
  assert(gameConfig.includes("createRedisPlayerSecurityStore"), "Game-server nonce and join guards must use the shared Redis store.");
  assert(!playerPresenceManager.includes("usedNonces = new Map"), "Game-server nonce replay state must not be process-local.");
  assert(!playerPresenceManager.includes("joinAttempts = new Map"), "Game-server join throttling must not be process-local.");
  assert(
    gameConfig.includes("options:") && gameConfig.includes("publicAddress"),
    "Colyseus scaling primitives and per-replica public addressing must use server options.",
  );
  assert(compose.includes("redis:"), "Production compose must define Redis.");
  assert(compose.includes("REDIS_URL"), "Production compose must wire REDIS_URL to scalable services.");
  assert(
    compose.includes("COLYSEUS_PUBLIC_ADDRESS"),
    "Production compose must expose the optional per-replica Colyseus public address.",
  );
  assert(compose.includes("redis_data:/data"), "Production Redis must persist its append-only log.");
  assert(compose.includes("--appendonly"), "Production Redis must enable AOF persistence.");
  assert(/^\s+- --maxmemory\s*$/m.test(compose), "Production Redis must enforce an application memory ceiling.");
  assert(compose.includes("mem_limit:"), "Production Redis must have a container memory ceiling above maxmemory.");
  assert(compose.includes("web_redis_password"), "Production Redis credentials must use separate Docker secrets.");
  assert(compose.includes("REDIS_PASSWORD_FILE"), "Redis clients must receive the credential through a secret file.");
  assert(!/redis:[\s\S]*?ports:/m.test(compose), "Production Redis must not publish a host port.");
  assert(readText("apps/game-server/Dockerfile.dockerignore").split(/\r?\n/).includes("apps/web"), "Game image context must exclude the web app and its large art assets.");
}

function checkProductionOperationsContracts() {
  const service = readText("ops/systemd/werewolf-backup.service");
  const timer = readText("ops/systemd/werewolf-backup.timer");
  const backup = readText("scripts/backup-postgres.sh");
  const backupManifest = readText("scripts/backup-manifest.mjs");
  const freshness = readText("scripts/check-backup-freshness.sh");
  const deploy = readText("scripts/deploy-release.sh");
  const rollback = readText("scripts/rollback-release.sh");
  const runbook = readText("docs/operations/production-runbook.md");
  const browserMatrix = readText("scripts/frontend-e2e-matrix.mjs");
  const lighthouse = readText("lighthouserc.cjs");
  const launchLoad = readText("scripts/loadtest-launch.mjs");
  const heavyLoad = readText("scripts/loadtest-heavy.mjs");
  const compose = readText("docker-compose.yml");
  const envExample = readText(".env.example");
  const roleReconciler = readText("scripts/postgres-init/apply-roles.sh");
  const restore = readText("scripts/restore-postgres.sh");
  const instrumentation = readText("apps/web/instrumentation.ts");

  assert((timer.match(/^OnCalendar=/gm) ?? []).length === 4, "PostgreSQL backups must run every six hours.");
  assert(timer.includes("Persistent=true"), "Missed backups must run after the host returns.");
  assert(!service.includes("User=werewolf"), "The application account must not execute Docker-backed backups.");
  assert(!service.includes("SupplementaryGroups=docker"), "The application account must not inherit Docker daemon authority.");
  assert(service.includes("User=root") && service.includes("Group=root"), "Docker-backed backups must use an explicit root service identity.");
  assert(service.includes("EnvironmentFile=/etc/werewolf/backup.env"), "Scheduled backups must use a dedicated root-only environment.");
  assert(service.includes("Environment=BACKUP_REQUIRE_FIXED_CONTAINER=1"), "Scheduled backups must reject mutable Compose fallback.");
  assert(service.includes("Environment=BACKUP_REQUIRE_ENCRYPTION=1"), "Scheduled backups must require encrypted artifacts.");
  assert(service.includes("Environment=BACKUP_REQUIRE_SIGNATURE=1"), "Scheduled backups must require signed manifests.");
  assert(
    service.includes("ExecStart=/usr/local/libexec/werewolf/backup-postgres.sh"),
    "Scheduled backups must execute a root-owned installed helper.",
  );
  assert(
    service.includes("ExecStartPost=/usr/local/libexec/werewolf/check-backup-freshness.sh"),
    "Scheduled backups must verify freshness with a root-owned installed helper.",
  );
  assert(
    backup.includes("BACKUP_COMPOSE_PROJECT")
      && backup.includes('"$docker_command" ps')
      && backup.includes('"$docker_command" exec'),
    "Scheduled backups must resolve PostgreSQL without reading mutable Compose files.",
  );
  assert(backup.includes("RCLONE_REMOTE"), "Backups must support an off-site copy.");
  assert(backup.includes("BACKUP_AGE_RECIPIENT") && backup.includes(".sql.gz.age"), "Scheduled backups must be encrypted with age.");
  assert(
    backup.includes("BACKUP_SIGNING_PRIVATE_KEY_FILE")
      && backup.includes(".manifest.json")
      && backupManifest.includes("ed25519"),
    "Scheduled backups must produce Ed25519-signed manifests.",
  );
  assert(
    freshness.includes("BACKUP_SIGNING_PUBLIC_KEY_FILE")
      && restore.includes("BACKUP_SIGNING_PUBLIC_KEY_FILE"),
    "Freshness checks and restores must verify backup producer signatures.",
  );
  assert(
    freshness.includes("sha256sum -c")
      && freshness.includes("gzip -t")
      && freshness.includes("BACKUP_CLOCK_SKEW_SECONDS"),
    "Backup freshness must verify checksum, compression, and future timestamps.",
  );
  assert(!deploy.includes("\n  scripts/backup-postgres.sh\n"), "Deploys must not execute a mutable backup helper directly.");
  assert(deploy.includes('systemctl start "$backup_service"'), "Deploys must wait for the hardened backup service.");
  assert(
    deploy.includes("RELEASE_STATE_DIR:-/var/lib/werewolf/release-state"),
    "Production release state must live outside the immutable checkout.",
  );
  assert(
    rollback.includes("RELEASE_STATE_DIR:-/var/lib/werewolf/release-state"),
    "Production rollback state must live outside the immutable checkout.",
  );
  assert(/must not belong to the\s+Docker group/i.test(runbook), "The runbook must deny Docker group access to the app account.");
  assert(runbook.includes("root:root and mode `0600`"), "The runbook must protect backup credentials.");
  assert(
    runbook.includes("loginctl terminate-user werewolf") && runbook.includes("sudo reboot"),
    "The runbook must invalidate stale Docker supplementary groups.",
  );
  assert(
    runbook.includes("/srv/werewolf-releases/$expected_source")
      && runbook.includes("GIT_CONFIG_NOSYSTEM=1")
      && runbook.includes("GIT_CONFIG_GLOBAL=/dev/null")
      && runbook.includes('if sudo test -e "$release_source"; then')
      && runbook.includes('if [ "$actual_source" != "$expected_source" ]; then'),
    "Root helper installation must use a fresh root-created release checkout.",
  );
  assert(
    runbook.includes("if ! sudo test -e /etc/werewolf/backup.env"),
    "Helper upgrades must preserve the live off-site backup configuration.",
  );
  assert(runbook.includes("RPO 6 hours and RTO 60 minutes"), "The runbook must document recovery objectives.");
  assert(runbook.includes("expand/contract"), "The runbook must document rollback-safe migrations.");
  for (const browser of ["chromium", "firefox", "webkit"]) {
    assert(browserMatrix.includes(`"${browser}"`), `Cross-browser QA must include ${browser}.`);
  }
  assert(
    browserMatrix.includes("Cross-browser E2E refuses non-local Redis instances.")
      && browserMatrix.includes("await client.flushDb()"),
    "Cross-browser QA must isolate local Redis rate-limit state without touching remote instances.",
  );
  assert(lighthouse.includes("categories:accessibility"), "Lighthouse must enforce accessibility.");
  assert(lighthouse.includes("cumulative-layout-shift"), "Lighthouse must enforce layout stability.");
  assert(launchLoad.includes('"200"'), "The launch load profile must exercise 200 clients.");
  assert(launchLoad.includes('"0.8"'), "The launch load profile must enforce the 80% event-loop trigger.");
  assert(heavyLoad.includes('"500"'), "The stress load profile must exercise 500 clients.");
  assert(
    compose.includes("MIGRATION_DATABASE_URL")
      && compose.includes("WEB_DATABASE_URL")
      && compose.includes("GAME_DATABASE_URL"),
    "Production services must use separate migration, web, and game database URLs.",
  );
  assert(
    compose.includes("postgres-roles:")
      && compose.includes("postgres-grants:")
      && compose.includes("condition: service_completed_successfully"),
    "Production startup must reconcile database roles before and after migrations.",
  );
  assert(
    roleReconciler.includes("FROM pg_roles")
      && roleReconciler.includes("ALTER DEFAULT PRIVILEGES FOR ROLE werewolf_migrator")
      && roleReconciler.includes("TO werewolf_web")
      && roleReconciler.includes("TO werewolf_game"),
    "Database role reconciliation must be idempotent and apply explicit runtime grants.",
  );
  assert(
    !/GRANT ALL[^;]*TO werewolf_(?:web|game)/.test(roleReconciler),
    "Runtime database roles must never receive blanket privileges.",
  );
  assert(
    roleReconciler.includes("SET log_min_duration_statement = -1")
      && roleReconciler.includes("SET log_min_error_statement = PANIC")
      && roleReconciler.includes("\\getenv migrator_password MIGRATOR_DB_PASSWORD")
      && !/-v (?:migrator|web|game)_password=/.test(roleReconciler),
    "Database credential statements must stay out of query logs and process arguments.",
  );
  assert(
    roleReconciler.includes("\nBEGIN;\n") && roleReconciler.includes("\nCOMMIT;\n"),
    "Database role reconciliation must apply atomically.",
  );
  assert(
    compose.includes("shared_preload_libraries=pg_stat_statements")
      && compose.includes("log_min_duration_statement=${POSTGRES_SLOW_QUERY_MS:-500}")
      && compose.includes("log_parameter_max_length=0")
      && compose.includes("log_parameter_max_length_on_error=0")
      && compose.includes("log_line_prefix="),
    "PostgreSQL must expose statement statistics without logging bind parameters.",
  );
  assert(
    roleReconciler.includes(
      "CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA werewolf_observability",
    )
      && roleReconciler.includes(
        "REVOKE ALL PRIVILEGES ON SCHEMA werewolf_observability FROM PUBLIC, werewolf_web, werewolf_game",
      )
      && envExample.includes("application_name=werewolf-migrator")
      && envExample.includes("application_name=werewolf-web")
      && envExample.includes("application_name=werewolf-game"),
    "PostgreSQL observability must install pg_stat_statements and label every production client.",
  );
  assert(
    restore.includes("MIGRATION_DATABASE_URL")
      && restore.includes("compose run --rm --no-deps -T postgres-roles"),
    "Restore drills must reconcile staging ownership before running migrations.",
  );
  assert(
    !/^import\s+.*database-maintenance/m.test(instrumentation)
      && instrumentation.includes('await import("@/lib/database-maintenance")'),
    "Database maintenance must stay behind the Node-only instrumentation boundary.",
  );
}

function checkDatabaseMigrationWorkflow() {
  const databaseReadme = readText("packages/database/README.md");
  const packageJson = JSON.parse(readText("package.json"));
  assert(databaseReadme.includes("db:generate"), "Database README must document migration generation.");
  assert(databaseReadme.includes("db:migrate"), "Database README must document migration application.");
  assert(databaseReadme.includes("drizzle-kit check"), "Database README must document the migration drift guard.");
  assert(
    packageJson.scripts["check:migrations"]?.includes("check-migration-safety"),
    "package.json must expose the migration safety policy guard.",
  );

  const safetyResult = spawnSync(process.execPath, ["scripts/check-migration-safety.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert(
    safetyResult.status === 0,
    `Migration safety policy failed:\n${safetyResult.stdout ?? ""}\n${safetyResult.stderr ?? ""}`,
  );

  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "pnpm --filter @werewolf/database exec drizzle-kit check --config drizzle.config.ts"], {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
          },
        })
      : spawnSync("pnpm", ["--filter", "@werewolf/database", "exec", "drizzle-kit", "check", "--config", "drizzle.config.ts"], {
          cwd: root,
          encoding: "utf8",
        });

  assert(
    result.status === 0,
    `Drizzle migration metadata check failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`,
  );
}

function validProductionEnv() {
  return {
    MIGRATION_DATABASE_URL:
      "postgres://werewolf_migrator:prod-migrator-password-000000000000000@postgres:5432/werewolf?application_name=werewolf-migrator",
    WEB_DATABASE_URL:
      "postgres://werewolf_web:prod-web-password-000000000000000000@postgres:5432/werewolf?application_name=werewolf-web",
    GAME_DATABASE_URL:
      "postgres://werewolf_game:prod-game-password-00000000000000000@postgres:5432/werewolf?application_name=werewolf-game",
    WEB_REDIS_URL: "redis://werewolf_web@redis:6379",
    GAME_REDIS_URL: "redis://werewolf_security@redis:6379",
    COLYSEUS_REDIS_URL: "redis://werewolf_colyseus@redis:6379",
    WEB_REDIS_PASSWORD: "prod-web-redis-password-0000000000000000",
    GAME_REDIS_PASSWORD: "prod-game-redis-password-000000000000000",
    COLYSEUS_REDIS_PASSWORD: "prod-colyseus-redis-password-0000000000",
    BETTER_AUTH_SECRET: "prod-better-auth-secret-000000000000000000",
    BETTER_AUTH_SECRETS:
      "2:prod-current-auth-secret-000000000000000000,1:prod-previous-auth-secret-0000000000000000",
    GAME_TOKEN_SECRET: "prod-game-token-secret-0000000000000000000",
    BETTER_AUTH_URL: "https://werewolf.example.com",
    NEXT_PUBLIC_APP_URL: "https://werewolf.example.com",
    NEXT_PUBLIC_GAME_SERVER_URL: "wss://ws.werewolf.example.com",
    PUBLIC_WEB_DOMAIN: "werewolf.example.com",
    PUBLIC_WS_DOMAIN: "ws.werewolf.example.com",
    CORS_ORIGIN: "https://werewolf.example.com",
    DB_PASSWORD: "prod-admin-password-000000000000000000",
    MIGRATOR_DB_PASSWORD: "prod-migrator-password-000000000000000",
    WEB_DB_PASSWORD: "prod-web-password-000000000000000000",
    GAME_DB_PASSWORD: "prod-game-password-00000000000000000",
    ALLOW_DEV_AUTH: "false",
    GOOGLE_CLIENT_ID: "prod-google-client-id",
    GOOGLE_CLIENT_SECRET: "prod-google-client-secret",
    DISCORD_CLIENT_ID: "prod-discord-client-id",
    DISCORD_CLIENT_SECRET: "prod-discord-client-secret",
    RESEND_API_KEY: "re_prod_example_key",
    RESEND_FROM: "Върколак и Мафия <noreply@werewolf.example.com>",
    REPORTS_NOTIFY_EMAIL: "reports@werewolf.example.com",
    SENTRY_DSN: "https://public@sentry.example.com/1",
    NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.example.com/2",
    RELEASE_VERSION: "release-2026-07-20.1",
    RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
    RELEASE_MANIFEST_PUBLIC_KEY: process.execPath,
    BACKUP_AGE_RECIPIENT: "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
    RCLONE_REMOTE: "encrypted-remote:werewolf/backups",
    DATABASE_STALE_ACTIVE_HOURS: "24",
    DATABASE_EVENT_RETENTION_DAYS: "365",
    MIGRATION_LOCK_TIMEOUT_MS: "5000",
    MIGRATION_STATEMENT_TIMEOUT_MS: "300000",
    MIGRATION_IDLE_TRANSACTION_TIMEOUT_MS: "300000",
    MIGRATION_PROCESS_TIMEOUT_SECONDS: "600",
    COMPOSE_WAIT_TIMEOUT_SECONDS: "120",
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

function readCssSurface(...relativePaths) {
  return relativePaths.map((relativePath) => readText(relativePath)).join("\n");
}

function readLobbyStyles() {
  return readCssSurface(
    "apps/web/app/globals.css",
    "apps/web/components/lobby/LegacyCreate.module.css",
    "apps/web/components/LegacyLobby.module.css",
    "apps/web/components/games/JoinEntry.module.css",
  );
}

function readAppStyles() {
  return readCssSurface(
    "apps/web/app/globals.css",
    "apps/web/components/account/Account.module.css",
    "apps/web/components/leaderboard/Leaderboard.module.css",
    "apps/web/components/legal/LegalShell.module.css",
    "apps/web/components/landing/LandingSurface.module.css",
    "apps/web/components/offline/Offline.module.css",
    "apps/web/components/system/SystemPages.module.css",
    "apps/web/components/games/GameHomePage.module.css",
    "apps/web/components/history/History.module.css",
    "apps/web/components/achievements/Achievements.module.css",
    "apps/web/components/friends/LegacyFriends.module.css",
    "apps/web/components/auth/AuthRecovery.module.css",
    "apps/web/components/site-chrome/SiteChrome.module.css",
    "apps/web/components/play/PlayRoom.module.css",
    "apps/web/components/play/PhaseRail.module.css",
    "apps/web/components/play/ReconnectModal.module.css",
    "apps/web/components/play/VoteTallyBar.module.css",
  );
}

function readLandingStyles() {
  return readCssSurface(
    "apps/web/app/globals.css",
    "apps/web/components/landing/LandingSurface.module.css",
  );
}

function readGameHomeStyles() {
  return readCssSurface(
    "apps/web/app/globals.css",
    "apps/web/components/landing/LandingSurface.module.css",
    "apps/web/components/games/GameHomePage.module.css",
  );
}

function readPlayStyles() {
  return readCssSurface(
    "apps/web/app/globals.css",
    "apps/web/components/play/PlayRoom.module.css",
    "apps/web/components/play/PhaseRail.module.css",
    "apps/web/components/play/ReconnectModal.module.css",
    "apps/web/components/play/VoteTallyBar.module.css",
  );
}

function readRolesStyles() {
  return readCssSurface(
    "apps/web/app/globals.css",
    "apps/web/components/games/GameRolesPage.module.css",
  );
}

function readRulesStyles() {
  return readCssSurface(
    "apps/web/app/globals.css",
    "apps/web/components/games/GameRulesPage.module.css",
  );
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function lineForIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
