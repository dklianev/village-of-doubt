import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const TARGET_ROUTE = "/play/[code]";
const BUDGETS = {
  totalJsKb: 550,
  routeJsKb: 140,
  routeCssKb: 70,
  totalArtCorpusKb: 120_000,
  largestArtAssetKb: 800,
};

const failures = [];
const nextDir = path.join(root, "apps/web/.next");

if (!existsSync(nextDir)) {
  failures.push("Missing apps/web/.next build output. Run `pnpm build` before `pnpm perf:budget`.");
} else {
  reportStaticCorpus();
  reportRouteBudget();
}

reportArtCorpus();

if (failures.length > 0) {
  console.error("\nBudget violations:");
  for (const failure of failures) {
    console.error(`  x ${failure}`);
  }
  process.exit(1);
}

console.log("\nAll budgets within thresholds");

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
      `JavaScript corpus gzip: ${roundKb(jsCorpus.gzipBytes)} KB (${formatFileCount(jsCorpus.files.length)}; budget: ${BUDGETS.totalJsKb} KB)`,
    );
    if (jsCorpus.gzipBytes > kbToBytes(BUDGETS.totalJsKb)) {
      failures.push(
        `JavaScript corpus gzip ${roundKb(jsCorpus.gzipBytes)} KB > budget ${BUDGETS.totalJsKb} KB`,
      );
    }
  }

  if (cssFiles.length === 0) {
    failures.push("No CSS assets found in apps/web/.next/static/chunks.");
  } else {
    const cssCorpus = measureAssets(nextDir, cssFiles, "CSS corpus");
    console.log(`CSS corpus gzip: ${roundKb(cssCorpus.gzipBytes)} KB (${formatFileCount(cssCorpus.files.length)})`);
  }
}

function reportRouteBudget() {
  let routeAssets;
  try {
    routeAssets = readRouteAssets(nextDir, TARGET_ROUTE);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    return;
  }

  const routeJs = measureAssets(nextDir, routeAssets.js, `${TARGET_ROUTE} JavaScript`);
  console.log(
    `Route ${TARGET_ROUTE} JS gzip: ${roundKb(routeJs.gzipBytes)} KB (${formatFileCount(routeJs.files.length)}; budget: ${BUDGETS.routeJsKb} KB)`,
  );
  if (routeAssets.js.length === 0) {
    failures.push(`No JavaScript assets declared for route ${TARGET_ROUTE}.`);
  } else if (routeJs.sourceBytes === 0) {
    failures.push(`Route ${TARGET_ROUTE} JavaScript source bytes are zero.`);
  }
  if (routeJs.gzipBytes > kbToBytes(BUDGETS.routeJsKb)) {
    failures.push(
      `Route ${TARGET_ROUTE} JS gzip ${roundKb(routeJs.gzipBytes)} KB > budget ${BUDGETS.routeJsKb} KB`,
    );
  }

  const routeCss = measureAssets(nextDir, routeAssets.css, `${TARGET_ROUTE} CSS`);
  console.log(
    `Route ${TARGET_ROUTE} CSS gzip: ${roundKb(routeCss.gzipBytes)} KB (${formatFileCount(routeCss.files.length)}; budget: ${BUDGETS.routeCssKb} KB)`,
  );
  if (routeAssets.css.length === 0) {
    failures.push(`No CSS assets declared for route ${TARGET_ROUTE}.`);
  } else if (routeCss.sourceBytes === 0) {
    failures.push(`Route ${TARGET_ROUTE} CSS source bytes are zero.`);
  }
  if (routeCss.gzipBytes > kbToBytes(BUDGETS.routeCssKb)) {
    failures.push(
      `Route ${TARGET_ROUTE} CSS gzip ${roundKb(routeCss.gzipBytes)} KB > budget ${BUDGETS.routeCssKb} KB`,
    );
  }
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
      `(budget: ${BUDGETS.totalArtCorpusKb} KB; ${formatSummary})`,
  );
  if (totalBytes > kbToBytes(BUDGETS.totalArtCorpusKb)) {
    failures.push(
      `Art corpus ${roundKb(totalBytes)} KB > budget ${BUDGETS.totalArtCorpusKb} KB`,
    );
  }

  const largest = assets
    .filter((asset) => asset.extension === ".avif" || asset.extension === ".webp")
    .sort((left, right) => right.sizeBytes - left.sizeBytes)[0];
  console.log(`Largest optimized art: ${largest?.file ?? "none"} (${roundKb(largest?.sizeBytes ?? 0)} KB)`);
  if (largest && largest.sizeBytes > kbToBytes(BUDGETS.largestArtAssetKb)) {
    failures.push(
      `Largest optimized art ${largest.file} ${roundKb(largest.sizeBytes)} KB > budget ${BUDGETS.largestArtAssetKb} KB`,
    );
  }
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
    throw new Error(`Missing client reference manifest for route ${targetRoute}: ${toPosix(path.relative(root, clientManifestPath))}`);
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
      `Could not parse the ${appPath} client reference manifest: ${error instanceof Error ? error.message : String(error)}`,
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
    throw new Error(
      `Expected one ${assetType} entry for ${appPath}, found ${matchingEntries.length}.`,
    );
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

function kbToBytes(kb) {
  return kb * 1024;
}

function roundKb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
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
