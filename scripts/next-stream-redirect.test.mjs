import assert from "node:assert/strict";
import test from "node:test";
import { extractNextStreamRedirect } from "./next-stream-redirect.mjs";

test("extracts a Next.js streamed redirect without losing query parameters", () => {
  const body = String.raw`b:E{"digest":"NEXT_REDIRECT;replace;/sign-in?redirect=%2Fplay%2FROOM\u0026from=nav;307;"}`;

  assert.equal(
    extractNextStreamRedirect(body),
    "/sign-in?redirect=%2Fplay%2FROOM&from=nav",
  );
});

test("ignores ordinary HTML without a streamed redirect", () => {
  assert.equal(extractNextStreamRedirect("<main>Готово</main>"), null);
});
