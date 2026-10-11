import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, firefox, webkit } from "playwright";
import { assertInteractiveTouchTargets } from "./frontend-touch-targets.mjs";

let browser;
before(async () => {
  const name = process.env.FRONTEND_E2E_BROWSER ?? "chromium";
  browser = await { chromium, firefox, webkit }[name].launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function fixture(t, html) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(`<!doctype html><style>
    label { display: inline-flex; align-items: center; width: 120px; height: 46px; }
    input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  </style>${html}`);
  return page;
}

test("associated radio labels supply real pointer and keyboard targets", async (t) => {
  const page = await fixture(t, '<label><input type="radio" name="mode" value="player" checked>Player</label><label><input type="radio" name="mode" value="spectator">Spectator</label>');
  await assertInteractiveTouchTargets(page, "join options");
  await page.locator("label").last().click();
  assert.equal(await page.locator('input[value="spectator"]').isChecked(), true);
  await page.locator('input[value="spectator"]').focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator('input[value="player"]').isChecked(), true);
});

test("explicit checkbox labels activate their control", async (t) => {
  const page = await fixture(t, '<input type="checkbox" id="sound"><label for="sound">Sound</label>');
  await assertInteractiveTouchTargets(page, "checkbox label");
  await page.locator("label").click();
  assert.equal(await page.locator("input").isChecked(), true);
});

for (const [name, html] of [
  ["unlabelled radio", '<input type="radio">'],
  ["unassociated label", '<input type="radio"><label>Player</label>'],
  ["small label", '<label style="width:20px;height:20px"><input type="radio">P</label>'],
  ["hidden label", '<input type="radio" id="mode"><label for="mode" style="display:none">Player</label>'],
  ["noninteractive label", '<label style="pointer-events:none"><input type="radio">Player</label>'],
  ["transparent label", '<label style="opacity:0"><input type="radio">Player</label>'],
  ["text field with large label", '<label><input type="text">Name</label>'],
  ["small button", '<button style="width:20px;height:20px;padding:0">Go</button>'],
]) {
  test(`still rejects ${name}`, async (t) => {
    const page = await fixture(t, html);
    await assert.rejects(assertInteractiveTouchTargets(page, name), /cramped interactive targets/);
  });
}
