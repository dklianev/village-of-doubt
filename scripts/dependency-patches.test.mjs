import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const extractZipPatch = readFileSync(new URL("../patches/extract-zip@2.0.1.patch", import.meta.url), "utf8");
const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));

test("extract-zip symlinks cannot escape the extraction root", () => {
  assert.match(workspace, /extract-zip@2\.0\.1: patches\/extract-zip@2\.0\.1\.patch/);
  assert.match(workspace, /auditConfig:\s+[\s\S]*ignoreGhsas:/);
  assert.match(workspace, /GHSA-jmr9-qjv8-65gv/);
  assert.match(extractZipPatch, /path\.isAbsolute\(linkTarget\)/);
  assert.match(extractZipPatch, /path\.isAbsolute\(relativeTarget\)/);
  assert.match(extractZipPatch, /relativeTarget\.startsWith\(`\.\.\$\{path\.sep\}`\)/);
  assert.match(extractZipPatch, /await fs\.symlink\(linkTarget, dest\)/);
});

test("Express query serialization tolerates an untrusted isBuffer property", () => {
  const serverRequire = createRequire(new URL("../apps/game-server/package.json", import.meta.url));
  const qs = createRequire(serverRequire.resolve("express"))("qs");
  for (const options of [{ plainObjects: true }, { allowPrototypes: true }]) {
    const parsed = qs.parse("item[constructor][isBuffer]=unexpected", options);
    assert.doesNotThrow(() => qs.stringify(parsed));
  }
  assert.deepEqual(qs.parse(qs.stringify({ page: "2", tags: ["first", "second"] })), {
    page: "2", tags: ["first", "second"],
  });
});

test("Express proxy trust rejects IPv4 spoofing through IPv6 trust subnets", () => {
  const serverRequire = createRequire(new URL("../apps/game-server/package.json", import.meta.url));
  const proxyaddr = createRequire(serverRequire.resolve("express"))("proxy-addr");
  const request = {
    socket: { remoteAddress: "203.0.113.77" },
    headers: { "x-forwarded-for": "198.51.100.9" },
  };

  for (const subnet of ["::ffff:10.0.0.0/8", "::/1"]) {
    for (const ranges of [[subnet], ["192.0.2.0/24", subnet]]) {
      const trust = proxyaddr.compile(ranges);
      assert.equal(trust(request.socket.remoteAddress, 0), false);
      assert.equal(proxyaddr(request, trust), request.socket.remoteAddress);
    }
  }

  for (const subnet of ["10.0.0.0/8", "::ffff:10.0.0.0/104"]) {
    const trust = proxyaddr.compile([subnet]);
    assert.equal(proxyaddr(request, trust), request.socket.remoteAddress);
    for (const remoteAddress of ["10.1.2.3", "::ffff:10.1.2.3"]) {
      assert.equal(trust(remoteAddress, 0), true);
      assert.equal(
        proxyaddr({ ...request, socket: { remoteAddress } }, trust),
        request.headers["x-forwarded-for"],
      );
    }
  }
});

test("Sentry brace expansion bounds nested and comma-separated input without stack exhaustion", () => {
  const sentryRequire = createRequire(webRequire.resolve("@sentry/nextjs"));
  const pluginRequire = createRequire(sentryRequire.resolve("@sentry/bundler-plugin-core"));
  const globRequire = createRequire(pluginRequire.resolve("glob"));
  const { expand } = createRequire(globRequire.resolve("minimatch"))("brace-expansion");
  for (const pattern of [
    "{" + "{a},".repeat(16000) + "b}",
    "{{x}," + "a,".repeat(125000) + "b}",
    "{a,".repeat(5000) + "z" + "}".repeat(5000),
    "{".repeat(5000) + "a,b" + "}".repeat(5000),
  ]) {
    assert.doesNotThrow(() => expand(pattern, { max: 4, maxLength: 65536 }));
  }
  assert.deepEqual(expand("assets/{day,night}-{1..2}.js"), [
    "assets/day-1.js", "assets/day-2.js", "assets/night-1.js", "assets/night-2.js",
  ]);
});

test("PostCSS source maps reject excessive and invalid indexed offsets", () => {
  const nextRequire = createRequire(webRequire.resolve("next"));
  const { SourceMapConsumer, SourceNode } = createRequire(nextRequire.resolve("postcss"))("source-map-js");
  const mapping = { version: 3, sources: ["input.js"], sourcesContent: ["x"], names: [], mappings: "AAAA" };
  const indexed = (line, column = 0, map = mapping) => ({
    version: 3, sections: [{ offset: { line, column }, map }],
  });
  for (const line of [100000000, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => new SourceMapConsumer(indexed(line)), /Section offset/);
  }
  for (const column of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => new SourceMapConsumer(indexed(0, column)), /Section offset/);
  }
  assert.throws(
    () => new SourceMapConsumer(indexed(6000000, 0, indexed(6000000))),
    /including offsets of nested sections/,
  );
  const consumer = new SourceMapConsumer(indexed(2));
  assert.deepEqual(consumer.sources, ["input.js"]);
  assert.equal(SourceNode.fromStringWithSourceMap("\n\nx", consumer).toString(), "\n\nx");
});

test("sharp tooling and runtime use patched librsvg and preserve SVG decoding", async () => {
  const sharp = createRequire(import.meta.url)("sharp");
  const semver = createRequire(webRequire.resolve("sharp"))("semver");
  const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const webPackage = JSON.parse(readFileSync(new URL("../apps/web/package.json", import.meta.url), "utf8"));
  assert.equal(rootPackage.devDependencies.sharp, webPackage.dependencies.sharp);
  assert.equal(sharp.versions.sharp, rootPackage.devDependencies.sharp);
  assert.equal(webRequire("sharp").versions.sharp, sharp.versions.sharp);
  assert.ok(semver.gte(sharp.versions.sharp, "0.35.5"));
  assert.ok(semver.gte(sharp.versions.rsvg, "2.63.2"));
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#2468ac"/></svg>');
  const { data, info } = await sharp(svg).resize(4, 4).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 4);
  assert.equal(info.height, 4);
  assert.equal(info.channels, 4);
  assert.deepEqual(data, Buffer.from(Array.from({ length: 16 }, () => [36, 104, 172, 255]).flat()));
});
