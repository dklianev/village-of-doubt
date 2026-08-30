import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./frontend-e2e.mjs", import.meta.url), "utf8");

test("the authenticated join fixture uses a seeded Better Auth session and stays on join", () => {
  assert.match(source, /runCheck\("authenticated join keeps the room invitation", testAuthenticatedEntry\)/);

  const authenticatedEntry = source.match(
    /async function testAuthenticatedEntry\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(authenticatedEntry, "testAuthenticatedEntry should be defined");
  assert.match(authenticatedEntry, /newPage\("authenticated-entry", viewports\.desktop\)/);
  assert.match(authenticatedEntry, /signInBrowserContext\(entry\.context, authFixture\.users\[0\]\)/);
  assert.match(authenticatedEntry, /waitForURL\("\*\*\/mafia\/join\/ABCD12"\)/);
  assert.match(authenticatedEntry, /Добре дошъл в бара/);
});

test("the anonymous join check is labelled as an auth-gate redirect", () => {
  assert.match(source, /goto\(page, "\/mafia\/join\/ABCD12", "anonymous join"\)/);
  assert.match(source, /assertNoHorizontalOverflow\(page, "anonymous join"\)/);
});
