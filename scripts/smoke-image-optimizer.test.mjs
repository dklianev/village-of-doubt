import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import sharp from "sharp";
import { assertOptimizedImage } from "./smoke-image-optimizer.mjs";

const { transformSync } = createRequire(import.meta.resolve("tsx"))("esbuild");
const webRoot = fileURLToPath(new URL("../apps/web/", import.meta.url));
const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const sourceUrl = "http://127.0.0.1:3300/game-art/fixture.webp";
const original = await fixtureImage(1448, 816);
const resized = await sharp(original).resize(256).webp().toBuffer();

test("image smoke requests and decodes a resized Next.js image", async () => {
  const calls = [];
  await assertOptimizedImage(sourceUrl, 256, "fixture", async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.accept, "image/webp");
    return imageResponse(url === sourceUrl ? original : resized);
  });
  assert.deepEqual(calls, [sourceUrl, "http://127.0.0.1:3300/_next/image?url=%2Fgame-art%2Ffixture.webp&w=256&q=75"]);
});

test("image smoke rejects Next's HTTP-200 original-image fallback", async () => {
  await assert.rejects(
    assertOptimizedImage(sourceUrl, 256, "fixture", async () => imageResponse(original)),
    /expected 256x144, received 1448x816; image optimization may have fallen back/,
  );
});

test("image smoke rejects a resized image with the wrong aspect ratio", async () => {
  const distorted = await fixtureImage(256, 256);
  await assert.rejects(
    assertOptimizedImage(sourceUrl, 256, "fixture", async (url) => imageResponse(url === sourceUrl ? original : distorted)),
    /expected 256x144, received 256x256/,
  );
});

for (const [name, response, message] of [
  ["HTTP error", () => new Response("missing", { status: 404 }), /HTTP 404/],
  ["HTML fallback", () => new Response("<html></html>", { headers: { "content-type": "text/html" } }), /valid image content type/],
  ["invalid image", () => imageResponse(Buffer.from("not an image")), /decodable image/],
]) {
  test(`image smoke rejects an optimizer ${name}`, async () => {
    await assert.rejects(
      assertOptimizedImage(sourceUrl, 256, "fixture", async (url) => url === sourceUrl ? imageResponse(original) : response()),
      message,
    );
  });
}

test("image smoke rejects a source that cannot demonstrate downscaling", async () => {
  await assert.rejects(
    assertOptimizedImage(sourceUrl, 256, "fixture", async () => imageResponse(resized)),
    /source must be wider than 256px/,
  );
});

test("runtime smoke exercises the tested optimized-image probe", () => {
  const smoke = readFileSync(new URL("./smoke.mjs", import.meta.url), "utf8");
  assert.match(smoke, /await assertOptimizedImage\("http:\/\/127\.0\.0\.1:3300\/game-art\/og-preview\.webp", 256,/);
  const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(rootPackage.scripts["operations:test"].includes("scripts/smoke-image-optimizer.test.mjs"));
});

test("standalone includes only installed Sharp Windows DLLs, not whole packages or stale versions", () => {
  const includes = configuredIncludes();
  const picomatch = webRequire("next/dist/compiled/picomatch");
  const sharpPackage = JSON.parse(readFileSync(path.join(webRoot, "node_modules/sharp/package.json"), "utf8"));
  const matches = (file) => includes.some((pattern) => picomatch(pattern)(file));
  for (const arch of ["x64", "arm64", "ia32"]) {
    const binding = `@img/sharp-win32-${arch}`;
    const version = sharpPackage.optionalDependencies[binding];
    const prefix = `../../node_modules/.pnpm/@img+sharp-win32-${arch}@${version}/node_modules/${binding}`;
    assert.ok(matches(`${prefix}/lib/libvips-42.dll`));
    assert.ok(matches(`${prefix}/lib/libvips-cpp-8.18.7.dll`));
    assert.equal(matches(`${prefix}/lib/sharp.node`), false);
    assert.equal(matches(`${prefix}/package.json`), false);
    assert.equal(matches(`${prefix}/unrelated.dll`), false);
    assert.equal(matches(`${prefix.replace(`@${version}/`, "@0.0.0/")}/lib/libvips-42.dll`), false);
  }
});

test("traced Windows DLLs are sufficient for the isolated Sharp binding", { skip: process.platform !== "win32" }, async (t) => {
  const sharpRequire = createRequire(webRequire.resolve("sharp"));
  const nativeRoot = path.dirname(sharpRequire.resolve(`@img/sharp-win32-${process.arch}/sharp.node`));
  const lib = path.join(nativeRoot, "lib");
  const files = readdirSync(lib);
  const dlls = files.filter((file) => file.endsWith(".dll"));
  const binding = files.find((file) => file.endsWith(".node"));
  assert.ok(binding);
  assert.equal(dlls.length, 2);

  const glob = webRequire("next/dist/compiled/glob");
  const traced = new Set();
  for (const pattern of configuredIncludes().filter((pattern) => pattern.endsWith("/*.dll"))) {
    const matches = await new Promise((resolve, reject) => {
      glob(pattern, { cwd: webRoot, nodir: true, dot: true }, (error, files) => error ? reject(error) : resolve(files));
    });
    for (const file of matches) traced.add(path.resolve(webRoot, file));
  }
  assert.deepEqual([...traced].sort(), dlls.map((file) => path.join(lib, file)).sort());

  const root = mkdtempSync(path.join(tmpdir(), "sharp-trace-"));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("sharp-trace-"));
    rmSync(root, { recursive: true, force: true });
  });
  const isolatedBinding = path.join(root, binding);
  copyFileSync(path.join(lib, binding), isolatedBinding);
  const load = () => {
    const result = spawnSync(process.execPath, ["-e", "require(process.argv[1]);", isolatedBinding], {
      cwd: root, encoding: "utf8", windowsHide: true, timeout: 10_000,
    });
    assert.ifError(result.error);
    return result;
  };
  assert.notEqual(load().status, 0, "the binding alone must reproduce the missing-DLL failure");
  for (const dll of dlls) copyFileSync(path.join(lib, dll), path.join(root, dll));
  const result = load();
  assert.equal(result.status, 0, result.stderr);
  for (const dll of dlls) {
    rmSync(path.join(root, dll));
    assert.notEqual(load().status, 0, `${dll} is required`);
    copyFileSync(path.join(lib, dll), path.join(root, dll));
  }
});

function configuredIncludes() {
  const source = readFileSync(path.join(webRoot, "next.config.ts"), "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "cjs" });
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    process: { env: {} },
    require: (name) => name === "@sentry/nextjs" ? { withSentryConfig: (config) => config } : webRequire(name),
  });
  return Array.from(module.exports.default.outputFileTracingIncludes["/*"]);
}

function fixtureImage(width, height) {
  return sharp({ create: { width, height, channels: 3, background: "#2468ac" } }).webp().toBuffer();
}

function imageResponse(bytes) {
  return new Response(bytes, { headers: { "content-type": "image/webp" } });
}
