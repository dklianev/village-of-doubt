import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const BASELINE_PATH = path.join(root, "scripts/perf-baseline.json");
const BUDGETS = {
  totalJs: { warningKb: 515, hardKb: 525, maxDeltaKb: 5 },
  routes: {
    "/": {
      js: { warningKb: 48, hardKb: 55, maxDeltaKb: 3 },
      css: { warningKb: 56, hardKb: 62, maxDeltaKb: 3 },
    },
    "/create": {
      js: { warningKb: 85, hardKb: 95, maxDeltaKb: 3 },
      css: { warningKb: 58, hardKb: 65, maxDeltaKb: 3 },
    },
    "/play/[code]": {
      js: { warningKb: 135, hardKb: 140, maxDeltaKb: 3 },
      css: { warningKb: 62, hardKb: 70, maxDeltaKb: 3 },
    },
  },
  artCorpus: { warningKb: 50_000, hardKb: 60_000 },
  largestArtAsset: { warningKb: 350, hardKb: 400 },
};

const failures = [];
const warnings = [];
const nextDir = path.join(root, "apps/web/.next");
const baseline = readBaseline();

if (!existsSync(nextDir)) {
  failures.push("Missing apps/web/.next build output. Run `pnpm build` before `pnpm perf:budget`.");
} else {
  reportStaticCorpus();
  reportRouteBudgets();
}

reportArtCorpus();
printResults();

function reportStaticCorpus() {
  const chunksDir = path.join(nextDir, "static/chunks");
  if (!existsSync(chunksDir)) {
    failures.push("Missing apps/web/.next/static/chunks build output.");
    return;
  }

  const chunkFiles = listFilesRecursive(chunksDir);
  const jsFiles = chunkFiles
    .filter((file) => file.endsWith(".js"))
    .map((file) => `static/chunks/${toPosix(file)}`);
  const cssFiles = chunkFiles
    .filter((file) => file.endsWith(".css"))
    .map((file) => `static/chunks/${toPosix(file)}`);

  if (jsFiles.length === 0) {
    failures.push("No JavaScript chunks found in apps/web/.next/static/chunks.");
  } else {
    const jsCorpus = measureAssets(nextDir, jsFiles, "JavaScript corpus");
    console.log(
      `JavaScript corpus gzip: ${roundKb(jsCorpus.gzipBytes)} KB ` +
        `(${formatFileCount(jsCorpus.files.length)}; ${formatThresholds(BUDGETS.totalJs)})`,
    );
    enforceBudget("JavaScript corpus gzip", jsCorpus.gzipBytes, BUDGETS.totalJs, baseline?.totalJsKb);
  }

  if (cssFiles.length === 0) {
    failures.push("No CSS assets found in apps/web/.next/static/chunks.");
  } else {
    const cssCorpus = measureAssets(nextDir, cssFiles, "CSS corpus");
    console.log(`CSS corpus gzip: ${roundKb(cssCorpus.gzipBytes)} KB (${formatFileCount(cssCorpus.files.length)})`);
  }
}

function reportRouteBudgets() {
  for (const [route, routeBudget] of Object.entries(BUDGETS.routes)) {
    let routeAssets;
    try {
      routeAssets = readRouteAssets(nextDir, route);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    reportRouteAsset(route, "JS", routeAssets.js, routeBudget.js, baseline?.routes?.[route]?.jsKb);
    reportRouteAsset(route, "CSS", routeAssets.css, routeBudget.css, baseline?.routes?.[route]?.cssKb);
  }
}

function reportRouteAsset(route, assetType, files, budget, baselineKb) {
  const label = `${route} ${assetType === "JS" ? "JavaScript" : "CSS"}`;
  const measured = measureAssets(nextDir, files, label);
  console.log(
    `Route ${route} ${assetType} gzip: ${roundKb(measured.gzipBytes)} KB ` +
      `(${formatFileCount(measured.files.length)}; ${formatThresholds(budget)})`,
  );
  if (files.length === 0) {
    failures.push(`No ${assetType === "JS" ? "JavaScript" : "CSS"} assets declared for route ${route}.`);
    return;
  }
  if (measured.sourceBytes === 0) {
    failures.push(`Route ${route} ${assetType === "JS" ? "JavaScript" : "CSS"} source bytes are zero.`);
    return;
  }
  enforceBudget(`Route ${route} ${assetType} gzip`, measured.gzipBytes, budget, baselineKb);
}

function reportArtCorpus() {
  const artDir = path.join(root, "apps/web/public/game-art");
  if (!existsSync(artDir)) {
    console.log("Art corpus: 0 files, 0 KB (directory missing)");
    return;
  }

  const imageExtensions = new Set([".avif", ".png", ".webp"]);
  const artFiles = listFilesRecursive(artDir).filter((file) => imageExtensions.has(path.extname(file).toLowerCase()));
  const assets = artFiles.map((file) => ({
    file: toPosix(file),
    extension: path.extname(file).toLowerCase(),
    sizeBytes: statSync(path.join(artDir, file)).size,
  }));
  const totalBytes = assets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  const formatSummary = [...imageExtensions]
    .map((extension) => {
      const matching = assets.filter((asset) => asset.extension === extension);
      const bytes = matching.reduce((sum, asset) => sum + asset.sizeBytes, 0);
      return `${extension.slice(1).toUpperCase()}: ${matching.length} / ${roundKb(bytes)} KB`;
    })
    .join(", ");

  console.log(
    `Art corpus: ${formatFileCount(assets.length)}, ${roundKb(totalBytes)} KB ` +
      `(${formatThresholds(BUDGETS.artCorpus)}; ${formatSummary})`,
  );
  enforceBudget("Art corpus", totalBytes, BUDGETS.artCorpus);

  const largest = assets
    .filter((asset) => asset.extension === ".avif" || asset.extension === ".webp")
    .sort((left, right) => right.sizeBytes - left.sizeBytes)[0];
  const largestBytes = largest?.sizeBytes ?? 0;
  console.log(
    `Largest optimized art: ${largest?.file ?? "none"} (${roundKb(largestBytes)} KB; ` +
      `${formatThresholds(BUDGETS.largestArtAsset)})`,
  );
  if (largest) {
    enforceBudget(`Largest optimized art ${largest.file}`, largestBytes, BUDGETS.largestArtAsset);
  }
}

function enforceBudget(label, bytes, budget, baselineKb) {
  const measuredKb = bytes / 1024;

  if (measuredKb > budget.hardKb) {
    failures.push(`${label} ${roundKb(bytes)} KB > hard budget ${budget.hardKb} KB`);
  } else if (measuredKb > budget.warningKb) {
    warnings.push(`${label} ${roundKb(bytes)} KB > warning ${budget.warningKb} KB`);
  }

  if (
    typeof baselineKb === "number" &&
    typeof budget.maxDeltaKb === "number" &&
    measuredKb > baselineKb + budget.maxDeltaKb
  ) {
    failures.push(
      `${label.replace(/ gzip$/, "")} grew ${roundNumber(measuredKb - baselineKb)} KB above baseline ` +
        `${baselineKb} KB; allowed delta: ${budget.maxDeltaKb} KB`,
    );
  }
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    failures.push("Missing scripts/perf-baseline.json. Regenerate it from a reviewed production build.");
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    if (parsed?.schemaVersion !== 1 || typeof parsed.totalJsKb !== "number" || typeof parsed.routes !== "object") {
      throw new Error("expected schemaVersion 1, totalJsKb, and routes");
    }
    for (const route of Object.keys(BUDGETS.routes)) {
      if (
        typeof parsed.routes?.[route]?.jsKb !== "number" ||
        typeof parsed.routes?.[route]?.cssKb !== "number"
      ) {
        throw new Error(`missing numeric route baseline for ${route}`);
      }
    }
    return parsed;
  } catch (error) {
    failures.push(
      `Invalid scripts/perf-baseline.json: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function printResults() {
  if (warnings.length > 0) {
    console.warn("\nBudget warnings:");
    for (const warning of warnings) {
      console.warn(`  ! ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nBudget violations:");
    for (const failure of failures) {
      console.error(`  x ${failure}`);
    }
    process.exit(1);
  }

  console.log("\nAll budgets within thresholds");
}

function readRouteAssets(buildDir, targetRoute) {
  const routeMapPath = path.join(buildDir, "app-path-routes-manifest.json");
  if (!existsSync(routeMapPath)) {
    throw new Error("Missing Next.js app-path-routes-manifest.json for route budget measurement.");
  }

  const routeMap = JSON.parse(readFileSync(routeMapPath, "utf8"));
  const appPath = Object.entries(routeMap).find(([, route]) => route === targetRoute)?.[0];
  if (!appPath) {
    throw new Error(`Route ${targetRoute} is missing from Next.js app-path-routes-manifest.json.`);
  }

  const appPathSegments = appPath.slice(1).split("/");
  const entryName = appPathSegments.pop();
  const clientManifestPath = path.join(
    buildDir,
    "server/app",
    ...appPathSegments,
    `${entryName}_client-reference-manifest.js`,
  );
  if (!existsSync(clientManifestPath)) {
    throw new Error(
      `Missing client reference manifest for route ${targetRoute}: ` +
        `${toPosix(path.relative(root, clientManifestPath))}`,
    );
  }

  const clientManifest = parseClientReferenceManifest(clientManifestPath, appPath);
  return {
    css: readEntryAssets(clientManifest.entryCSSFiles, appPath, "CSS"),
    js: readEntryAssets(clientManifest.entryJSFiles, appPath, "JavaScript"),
  };
}

function parseClientReferenceManifest(manifestPath, appPath) {
  const source = readFileSync(manifestPath, "utf8");
  const assignment = `globalThis.__RSC_MANIFEST[${JSON.stringify(appPath)}]`;
  const assignmentIndex = source.indexOf(assignment);
  if (assignmentIndex === -1) {
    throw new Error(`Client reference manifest does not contain the ${appPath} entry.`);
  }

  const equalsIndex = source.indexOf("=", assignmentIndex + assignment.length);
  if (equalsIndex === -1) {
    throw new Error(`Client reference manifest has an invalid ${appPath} assignment.`);
  }

  const serialized = source.slice(equalsIndex + 1).trim().replace(/;\s*$/, "");
  try {
    return JSON.parse(serialized);
  } catch (error) {
    throw new Error(
      `Could not parse the ${appPath} client reference manifest: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readEntryAssets(entries, appPath, assetType) {
  if (!entries || typeof entries !== "object") {
    throw new Error(`Client reference manifest has no entry${assetType}Files map.`);
  }

  const entrySuffix = `/app${appPath}`;
  const matchingEntries = Object.entries(entries).filter(([entry]) => toPosix(entry).endsWith(entrySuffix));
  if (matchingEntries.length !== 1) {
    throw new Error(`Expected one ${assetType} entry for ${appPath}, found ${matchingEntries.length}.`);
  }

  const [, values] = matchingEntries[0];
  if (!Array.isArray(values)) {
    throw new Error(`${assetType} entry for ${appPath} is not an array.`);
  }

  return [
    ...new Set(
      values.map((value) => {
        const assetPath = typeof value === "string" ? value : value?.path;
        if (typeof assetPath !== "string") {
          throw new Error(`${assetType} entry for ${appPath} contains an invalid asset.`);
        }
        return normalizeNextAssetPath(assetPath);
      }),
    ),
  ];
}

function normalizeNextAssetPath(assetPath) {
  return toPosix(assetPath)
    .split(/[?#]/, 1)[0]
    .replace(/^\/_next\//, "")
    .replace(/^\//, "");
}

function measureAssets(baseDir, files, label) {
  let sourceBytes = 0;
  let gzipBytes = 0;
  const measuredFiles = [];

  for (const file of files) {
    const absolute = path.resolve(baseDir, ...file.split("/"));
    const relative = path.relative(baseDir, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      failures.push(`${label} asset escapes the Next.js build directory: ${file}`);
      continue;
    }
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      failures.push(`${label} asset is missing from the Next.js build: ${file}`);
      continue;
    }

    const buffer = readFileSync(absolute);
    sourceBytes += buffer.byteLength;
    gzipBytes += gzipSync(buffer).byteLength;
    measuredFiles.push(file);
  }

  return { sourceBytes, gzipBytes, files: measuredFiles };
}

function roundKb(bytes) {
  return roundNumber(bytes / 1024);
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function formatThresholds(budget) {
  return `warning: ${budget.warningKb} KB; hard: ${budget.hardKb} KB`;
}

function formatFileCount(count) {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

function toPosix(value) {
  return value.replaceAll(path.sep, "/").replaceAll("\\", "/");
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
