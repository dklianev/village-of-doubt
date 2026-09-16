import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertStaticCss } from "./smoke-static-css.mjs";

const baseUrl = "http://127.0.0.1:3300/";
const font = "@font-face{font-family:fixture;src:url(/font.woff2)}";
const art = '.hero{background-image:image-set(url("/game-art/fixture.avif") type("image/avif"),url("/game-art/fixture.webp") type("image/webp"))}';
const page = '<link href="/_next/static/font.css" rel="stylesheet"><link rel="stylesheet" href="/_next/static/art.css">';

test("smoke checks optimized art across every CSS chunk, not only the first", async () => {
  const calls = [];
  await assertStaticCss(page, baseUrl, "fixture", async (url) => {
    calls.push(url);
    return cssResponse(url.endsWith("font.css") ? font : art);
  });
  assert.deepEqual(calls, [`${baseUrl}_next/static/font.css`, `${baseUrl}_next/static/art.css`]);
});

test("smoke handles single chunks, duplicate links, and encoded query strings", async () => {
  const link = "<link rel='stylesheet' href='/_next/static/app.css?v=1&amp;build=2'>";
  const calls = [];
  await assertStaticCss(`${link}${link}`, baseUrl, "fixture", async (url) => {
    calls.push(url);
    return cssResponse(art);
  });
  assert.deepEqual(calls, [`${baseUrl}_next/static/app.css?v=1&build=2`]);
});

for (const [name, response] of [
  ["missing", () => new Response("not found", { status: 404 })],
  ["HTML fallback", () => new Response(art, { headers: { "content-type": "text/html" } })],
  ["empty", () => cssResponse(" ")],
]) {
  test(`smoke rejects a ${name} later chunk even when the first contains art`, async () => {
    await assert.rejects(
      assertStaticCss(page, baseUrl, "fixture", async (url) => url.endsWith("font.css") ? cssResponse(art) : response()),
      /without valid CSS/,
    );
  });
}

test("smoke still rejects styles without optimized art", async () => {
  await assert.rejects(assertStaticCss(page, baseUrl, "fixture", async () => cssResponse(font)), /optimized image-set WebP/);
});

test("smoke does not mistake preloads or script text for applied stylesheets", async () => {
  const body = '<link rel="preload" as="style" href="/_next/static/art.css"><script>const href="/_next/static/app.css"</script>';
  await assert.rejects(assertStaticCss(body, baseUrl, "fixture", async () => { throw new Error("unexpected fetch"); }), /did not include a Next.js CSS asset/);
});

test("runtime smoke uses the tested stylesheet validation", () => {
  const source = readFileSync(new URL("./smoke.mjs", import.meta.url), "utf8");
  assert.match(source, /await assertStaticCss\(body, pageUrl, label\)/);
});

function cssResponse(body) {
  return new Response(body, { headers: { "content-type": "text/css; charset=utf-8" } });
}
