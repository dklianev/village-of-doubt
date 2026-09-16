import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./frontend-e2e.mjs", import.meta.url), "utf8");

test("production browser runs cover CSS navigation in both themes and viewport sizes", () => {
  assert.match(source, /import \{ assertFrontendCssNavigation \} from "\.\/frontend-css-navigation\.mjs"/);
  assert.match(source, /Object\.entries\(viewports\)[\s\S]*for \(const theme of \["light", "dark"\]\)[\s\S]*testRouteCssNavigation\(viewportName, viewport, theme\)/);
  assert.match(functionSource("testRouteCssNavigation"), /await assertFrontendCssNavigation\(page, baseUrl, theme\)/);
  assert.match(functionSource("testRouteCssNavigation"), /await watcher\.assertClean\(\)/);
});

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

test("anonymous entry checks the current join sign-in copy and preserves the invitation", async () => {
  const events = [];
  const page = { waitForURL: async (url) => events.push(url) };
  await loadFunction("testAnonymousEntry", {
    viewports: { desktop: {} },
    newPage: async () => ({
      page,
      watcher: { assertClean: async () => events.push("clean") },
      close: async () => events.push("closed"),
    }),
    goto: async (_page, path) => events.push(path),
    expectText: async (_page, text) => events.push(text),
    expectNoText: async (_page, text) => events.push(`absent:${text}`),
    assertNoHorizontalOverflow: async () => events.push("layout"),
  })();
  assert.deepEqual(events, [
    "/mafia/join/ABCD12", "**/sign-in?redirect=%2Fmafia%2Fjoin%2FABCD12", "Вход в играта",
    "absent:без регистрация", "layout", "clean", "closed",
  ]);
});

function functionSource(name) {
  const definition = source.match(new RegExp(`(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))?.[0];
  assert.ok(definition, `${name} should be defined`);
  return definition;
}

function loadFunction(name, globals = {}) {
  return runInNewContext(`${functionSource(name)}\n${name}`, { URL, ...globals });
}

function cssAssetFixture({ status = () => 200, body = () => Buffer.from("asset") } = {}) {
  const origin = "http://127.0.0.1:3401";
  const style = (properties) => Object.assign(Object.keys(properties), {
    getPropertyValue: (property) => properties[property],
  });
  const imported = {
    href: `${origin}/styles/imported/theme.css`,
    cssRules: [{ cssRules: [{ style: style({ src: 'url("./font.woff2") format("woff2")' }) }] }],
  };
  const sheet = {
    href: `${origin}/_next/static/chunks/app.css`,
    cssRules: [
      { style: style({ src: 'local("Fixture"), url("../media/font.woff2") format("woff2")' }) },
      { styleSheet: imported },
      { cssRules: [{
        style: style({ "background-image": 'url("../media/scene.webp")' }),
        cssRules: [{ style: style({ "mask-image": "url('../media/mask.svg')" }) }],
      }] },
      { style: style({ "--art": 'url("../media/a b(1).webp")', "background-image": 'url("../media/scene.webp")' }) },
    ],
  };
  const document = {
    baseURI: `${origin}/inline/`,
    styleSheets: [sheet, { href: null, cssRules: [{ style: style({
      "background-image": 'url("./inline.webp")',
      "mask-image": 'url("data:image/svg+xml;base64,PHN2Zz4="), url("#mask")',
    }) }] }],
    querySelectorAll: () => [{}],
  };
  const requested = [];
  const check = loadFunction("assertCssBackgroundImagesLoaded", {
    Buffer,
    document,
    window: {
      location: new URL(`${origin}/mafia/join/ABCD12`),
      getComputedStyle: () => ({
        backgroundImage: `url("${origin}/_next/static/media/scene.webp"), url("http://127.0.0.1:34010/external.webp")`,
        maskImage: "url('./computed-mask.svg')",
        webkitMaskImage: `url("${origin}/inline/computed-mask.svg")`,
      }),
    },
  });
  const page = {
    evaluate: async (callback) => callback(),
    request: { get: async (url) => {
      requested.push(url);
      return { ok: () => status(url) < 400, status: () => status(url), body: async () => body(url) };
    } },
  };
  return { check: () => check(page, "fixture"), requested, document };
}

test("CSS assets use stylesheet/import bases, document base for inline styles and computed image URLs", async () => {
  const fixture = cssAssetFixture();
  await fixture.check();
  assert.deepEqual(fixture.requested.map((url) => new URL(url).pathname), [
    "/_next/static/media/font.woff2", "/styles/imported/font.woff2",
    "/_next/static/media/scene.webp", "/_next/static/media/mask.svg", "/_next/static/media/a%20b(1).webp",
    "/inline/inline.webp", "/inline/computed-mask.svg",
  ]);
});

for (const failure of ["404", "empty", "body-error"]) {
test(`CSS assets still reject genuinely broken image and font responses (${failure})`, async () => {
  const fixture = cssAssetFixture({
    status: () => failure === "404" ? 404 : 200,
    body: () => {
      if (failure === "body-error") throw new Error("body unavailable");
      return failure === "empty" ? Buffer.alloc(0) : Buffer.from("asset");
    },
  });
  await assert.rejects(fixture.check(), (error) => {
    assert.match(error.message, /broken CSS image\/font assets/);
    assert.match(error.message, /\/_next\/static\/media\/font\.woff2/);
    assert.match(error.message, /\/styles\/imported\/font\.woff2/);
    assert.match(error.message, /\/_next\/static\/media\/scene\.webp/);
    return true;
  });
});
}

test("CSSOM skips inaccessible cross-origin sheets but propagates unexpected traversal errors", async () => {
  for (const name of ["SecurityError", "TypeError"]) {
    const fixture = cssAssetFixture();
    fixture.document.styleSheets.unshift({ get cssRules() {
      throw Object.assign(new Error("CSSOM unavailable"), { name });
    } });
    if (name === "SecurityError") {
      await fixture.check();
      assert.ok(fixture.requested.some((url) => url.endsWith("font.woff2")));
    } else {
      await assert.rejects(fixture.check(), /CSSOM unavailable/);
    }
  }
});

test("the Sentry mock handles only the exact configured synthetic envelope transport", async () => {
  const baseUrl = "http://127.0.0.1:3401";
  const routes = [];
  const context = { route: async (matches, handler) => routes.push({ matches, handler }) };
  for (const dsn of [undefined, "", "https://public@sentry.example.test/2", "https://public@example.invalid/1"]) {
    await loadFunction("mockSyntheticSentry", {
      process: { env: { NEXT_PUBLIC_SENTRY_DSN: dsn } }, baseUrl,
    })(context);
  }
  assert.equal(routes.length, 0);
  await loadFunction("mockSyntheticSentry", {
    process: { env: { NEXT_PUBLIC_SENTRY_DSN: "https://public@example.invalid/2" } }, baseUrl,
  })(context);
  assert.equal(routes.length, 1);
  const { matches, handler } = routes[0];
  const envelope = "https://example.invalid/api/2/envelope/?sentry_version=7&sentry_key=public&sentry_client=fixture";
  assert.equal(matches(new URL(envelope)), true);
  for (const url of [
    envelope.replace("https:", "http:"), envelope.replace("example.invalid", "example.invalid.other.test"),
    envelope.replace("/2/", "/1/"), envelope.replace("/envelope/", "/other/"),
    envelope.replace("key=public", "key=other"), envelope.replace("version=7", "version=8"),
    "https://example.invalid/api/2/envelope/", `${baseUrl}/api/game-token`,
    `${baseUrl}/api/auth/sign-in/email`, `${baseUrl}/api/auth/get-session`,
    `${baseUrl}/api/2/envelope/?sentry_version=7&sentry_key=public`,
    "https://example.invalid/api/auth/sign-in/email?sentry_version=7&sentry_key=public",
  ]) assert.equal(matches(new URL(url)), false, url);

  for (const method of ["POST", "OPTIONS", "GET", "DELETE"]) {
    let fulfilled = false;
    let continued = false;
    await handler({
      request: () => ({ method: () => method }),
      fallback: async () => { continued = true; },
      fulfill: async (response) => {
        fulfilled = true;
        assert.equal(response.status, 200);
        assert.deepEqual(Object.keys(response.json), []);
        assert.equal(response.headers["access-control-allow-origin"], baseUrl);
      },
    });
    assert.equal(fulfilled, method === "POST" || method === "OPTIONS");
    assert.equal(continued, !fulfilled);
  }
});

test("all single, retry and six-player contexts install the synthetic transport before opening a page", async () => {
  for (const scenario of ["newPage", "testCreateTokenRetry", "testSixClientGameStart"]) {
    const contexts = [];
    const stop = new Error("fixture setup complete");
    const run = loadFunction(scenario, {
      activeBrowser: { newContext: async () => {
        const context = {
          mocked: false, closed: false,
          addInitScript: async () => {},
          newPage: async () => {
            assert.equal(context.mocked, true);
            if (scenario !== "testSixClientGameStart") throw stop;
            return {
              getByLabel: () => ({ waitFor: async () => {} }),
              getByRole: () => ({ click: async () => {} }),
              getByTestId: () => ({}), waitForURL: async () => {}, waitForFunction: async () => {},
            };
          },
          pages: () => [],
          close: async () => { context.closed = true; },
        };
        contexts.push(context);
        return context;
      } },
      mockSyntheticSentry: async (context) => { context.mocked = true; },
      baseUrl: "http://127.0.0.1:3401", wsUrl: "ws://127.0.0.1:3568",
      viewports: { desktop: {}, mobile: {} },
      authFixture: { users: Array.from({ length: 6 }, (_, id) => ({ id })) },
      signInBrowserContext: async (context) => assert.equal(context.mocked, true),
      installGameSocketProbe: () => {},
      watchPage: () => ({}),
      createSixPlayerRoom: async () => new URL("http://127.0.0.1:3401/play/FIXTUR?players=6"),
      goto: async () => {}, expectText: async () => {}, waitForVisibleText: async () => {},
      assertNoHorizontalOverflow: async () => {},
      assertSixPlayerRoster: async () => { throw stop; },
    });
    await assert.rejects(run("werewolves"), (error) => error === stop);
    assert.equal(contexts.length, scenario === "testSixClientGameStart" ? 6 : 1);
    assert.ok(contexts.every((context) => context.mocked));
    if (scenario !== "newPage") assert.ok(contexts.every((context) => context.closed));
  }
});

for (const family of ["werewolves", "mafia"]) {
test(`the host selects six players and submits the real ${family} create UI`, async () => {
  const events = [];
  const mafia = family === "mafia";
  const generatedUrl = `http://127.0.0.1:3401/play/ABCDEF?mode=${mafia ? "mafia_free" : "werewolves_classic"}&players=6`;
  const slider = {
    click: async () => events.push("slider click"),
    press: async (key) => events.push(key),
  };
  const page = {
    getByRole(role, { name }) {
      events.push(`${role}:${name}`);
      if (role === "slider") return slider;
      return { click: async () => events.push("submit") };
    },
    waitForURL: async () => events.push("navigation"),
    url: () => generatedUrl,
  };
  const createRoom = loadFunction("createSixPlayerRoom", {
    goto: async (_page, path) => events.push(path),
    expectText: async (_page, text) => events.push(text),
    expectInputValue: async (input, value) => {
      assert.equal(input, slider);
      assert.equal(value, "6");
    },
  });

  const roomUrl = await createRoom(page, "fixture", family);
  assert.equal(roomUrl.href, generatedUrl);
  assert.deepEqual(events, [
    mafia ? "/mafia/create" : "/werewolf/create", mafia ? "Стая за Мафия" : "Стая за Върколак", "slider:Брой играчи",
    "slider click", "Home", ...(mafia ? ["ArrowRight", "ArrowRight"] : []),
    mafia ? "button:Отвори масата" : "button:Създай селото", "submit", "navigation",
  ]);
});
}

test("the six-client fixture uses the generated invitation and verifies every seeded player before starting", () => {
  const scenario = functionSource("testSixClientGameStart");
  assert.doesNotMatch(scenario, /createRoomCode|visualAuth|dev-user-id|mode=werewolves_classic/);
  assert.match(scenario, /signInBrowserContext\(context, identity\)/);
  assert.match(scenario, /createSixPlayerRoom\(page, "six-client host create", family\)/);
  assert.match(functionSource("main"), /for \(const family of \["werewolves", "mafia"\]\)[\s\S]*testSixClientGameStart\(family\)/);
  assert.match(scenario, /viewport: index === 5 \? viewports\.mobile : viewports\.desktop/);
  assert.match(scenario, /if \(index === 5\) await context\.addInitScript\(installGameSocketProbe, wsUrl\)/);
  assert.match(scenario, /\/lobby\/\$\{code\}\$\{roomUrl\.search\}/);
  assert.match(scenario, /Покана за масата\./);
  assert.match(scenario, /Код на стаята \$\{code\}/);
  assert.match(scenario, /getByRole\("link", \{ name: "Към играта", exact: true \}\)\.click\(\)/);
  assert.match(scenario, /data-seat-user-id/);
  assert.ok(scenario.indexOf("assertSixPlayerRoster(pages, expectedUserIds)") < scenario.indexOf('getByTestId("ready-toggle").click()'));
  assert.match(scenario, /startReadyGame\(pages\[0\]\)/);
  assert.match(scenario, /role_reveal[\s\S]*first_night/);
  assert.match(scenario, /readPrivateRole\(page, family\)/);
  assert.match(scenario, /"first_night", "day_announcement"/);
  assert.match(scenario, /"day_announcement", "day_discussion"/);
  assert.match(scenario, /"day_discussion", "voting"/);
  assert.match(scenario, /Потвърди гласа за/);
  assert.match(scenario, /expectTextIn\(mobilePage\.locator\("\.play-action-receipt"\), `Приет глас:/);
  assert.match(scenario, /data-voted="true"/);
  assert.match(scenario, /nextTarget\.id[\s\S]*data-selected="true"[\s\S]*Приет глас: \$\{target\.name\}/);
  assert.match(scenario, /reconnectFirstGameGuest\(pages, expectedUserIds, privateRoles\[5\], family, `Приет глас: \$\{target\.name\}`\)/);
  assert.match(scenario, /finally \{\s*await Promise\.allSettled\(contexts\.map\(\(context\) => context\.close\(\)\)\)/);
});

test("roster validation rejects missing, duplicate and substituted seats", async () => {
  const ids = Array.from({ length: 6 }, (_, index) => `fixture-${index}`);
  for (const actual of [ids, ids.slice(0, 5), [...ids, ids[0]], [...ids.slice(0, 5), ids[0]], [...ids.slice(0, 5), "outsider"]]) {
    const validate = loadFunction("assertSixPlayerRoster", {
      document: { querySelectorAll: () => actual.map((id) => ({ dataset: { seatUserId: id } })) },
    });
    const page = { waitForFunction: async (predicate, expected) => assert.equal(predicate(expected), true, "roster mismatch") };
    if (actual === ids) await validate([page], ids);
    else await assert.rejects(validate([page], ids), /roster mismatch/);
  }
});

for (const mode of ["manual", "automatic", "autostart-race", "failed-click", "not-ready"]) {
test(`start handling preserves ${mode} behavior`, async () => {
  let phase = mode === "automatic" ? "role_reveal" : "lobby";
  let clicks = 0;
  const start = loadFunction("startReadyGame", {
    document: {
      querySelector: () => ({ getAttribute: () => phase }),
      querySelectorAll: () => Array.from({ length: 6 }, () => ({ dataset: { ready: mode === "not-ready" ? "false" : "true" } })),
    },
  });
  const host = {
    waitForFunction: async (predicate) => assert.equal(predicate(), true, "not ready"),
    locator: () => ({
      getAttribute: async () => phase,
      waitFor: async () => assert.equal(phase, "role_reveal"),
    }),
    getByRole: (_role, { name }) => ({ click: async () => {
      assert.equal(name, "Започни игра");
      clicks += 1;
      if (mode === "failed-click") throw new Error("click failed");
      phase = "role_reveal";
      if (mode === "autostart-race") throw new Error("button detached");
    } }),
  };
  if (mode === "failed-click" || mode === "not-ready") {
    await assert.rejects(start(host), /click failed|not ready/);
  } else {
    await start(host);
  }
  assert.equal(clicks, mode === "automatic" || mode === "not-ready" ? 0 : 1);
});
}

test("bounded phase advancement uses the host control and rejects unrelated phases", async () => {
  for (const current of ["first_night", "day_announcement", "game_over"]) {
    const events = [];
    const advance = loadFunction("advanceFirstGamePhase", {
      holdFirstGamePhase: async (_pages, phase) => events.push(phase),
    });
    const host = {
      locator: () => ({ getAttribute: async () => current }),
      getByRole: (_role, { name }) => ({ click: async () => events.push(name) }),
    };
    if (current === "game_over") {
      await assert.rejects(advance([host], "first_night", "day_announcement"), /Expected first-round phase/);
      assert.deepEqual(events, []);
    } else {
      await advance([host], "first_night", "day_announcement");
      assert.deepEqual(events, current === "first_night" ? ["Следваща фаза", "day_announcement"] : ["day_announcement"]);
    }
  }
});

test("phase assertions extend the real host timer before waiting for every client", async () => {
  const events = [];
  const pages = Array.from({ length: 6 }, (_, index) => ({
    locator: (selector) => ({ waitFor: async () => {
      assert.equal(selector, 'main.play-shell[data-phase="role_reveal"]');
      events.push(index);
    } }),
    getByRole: (_role, { name }) => ({ click: async () => {
      assert.equal(index, 0);
      events.push(name);
    } }),
  }));
  await loadFunction("holdFirstGamePhase")(pages, "role_reveal");
  assert.deepEqual(events, [0, "+180 сек.", 0, 1, 2, 3, 4, 5]);
});

test("private-role assertions require one viewer card from the selected family", async () => {
  const label = "Тайна роля: Ясновидка";
  for (const [count, family, text] of [[1, "werewolves", label], [2, "werewolves", label], [1, "mafia", label], [1, "werewolves", null], [1, "werewolves", "Тайна роля: "]]) {
    let opened = false;
    const card = {
      waitFor: async () => assert.equal(opened, true),
      getAttribute: async (attribute) => attribute === "aria-label" ? text : family,
    };
    const personal = {
      waitFor: async () => {},
      getByRole: (role, options) => {
        assert.equal(role, "button");
        assert.equal(options.name, "Виж ролята си");
        assert.equal(options.exact, true);
        return { isVisible: async () => true, click: async () => { opened = true; } };
      },
      locator: () => card,
    };
    const page = { getByRole: () => personal, locator: () => ({ count: async () => count }) };
    const readRole = loadFunction("readPrivateRole");
    if (count === 1 && family === "werewolves" && text === label) {
      assert.equal(await readRole(page, "werewolves"), label);
    } else {
      await assert.rejects(readRole(page, "werewolves"), /exactly one viewer-private role card/);
    }
  }
});

test("the socket probe closes only the native game transport with a reconnectable code", () => {
  const closed = [];
  class NativeWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = NativeWebSocket.OPEN;
      this.listeners = [];
    }
    addEventListener(event, callback) {
      assert.equal(event, "close");
      this.listeners.push(callback);
    }
    close(code) {
      closed.push(code);
      this.readyState = 3;
      this.listeners.forEach((callback) => callback());
    }
  }
  const window = { WebSocket: NativeWebSocket };
  loadFunction("installGameSocketProbe", { window })("ws://127.0.0.1:3568");
  const probe = window.__frontendE2eGameSockets;
  const other = new window.WebSocket("ws://127.0.0.1:3000/hmr");
  assert.throws(() => probe.closeOpen(), /one open fixture game WebSocket/);
  const game = new window.WebSocket("ws://127.0.0.1:3568/fixture/seat");
  assert.ok(game instanceof NativeWebSocket);
  assert.equal(window.WebSocket.OPEN, NativeWebSocket.OPEN);
  assert.deepEqual(Array.from(probe.openIds()), [1]);
  assert.equal(probe.closeOpen(), 1);
  assert.deepEqual(closed, [3001]);
  assert.equal(other.readyState, NativeWebSocket.OPEN);
  assert.deepEqual(Array.from(probe.openIds()), []);
  const replacement = new window.WebSocket("ws://127.0.0.1:3568/fixture/seat");
  replacement.readyState = 0;
  assert.deepEqual(Array.from(probe.openIds()), []);
  replacement.readyState = NativeWebSocket.OPEN;
  assert.deepEqual(Array.from(probe.openIds()), [2]);
  new window.WebSocket("ws://127.0.0.1:3568/fixture/duplicate");
  assert.throws(() => probe.closeOpen(), /one open fixture game WebSocket/);
});

test("reconnect requires a replacement socket, server presence and the preserved role, ballot and ACK receipt", async () => {
  for (const mode of ["success", "missing-drop", "unchanged-socket", "changed-role", "cleared-receipt"]) {
    const events = [];
    let receiptChecks = 0;
    const pages = Array.from({ length: 6 }, () => ({ locator: (selector) => ({ waitFor: async () => {
      events.push(selector);
      if (mode === "missing-drop" && selector.includes('data-connected="false"')) throw new Error("drop not observed");
    } }) }));
    const reconnect = loadFunction("reconnectFirstGameGuest", {
      assertSixPlayerRoster: async () => events.push("roster"),
      readPrivateRole: async () => mode === "changed-role" ? "changed" : "same",
      expectTextIn: async (_locator, text) => {
        assert.equal(text, "Приет глас: Играч 1");
        receiptChecks += 1;
        if (mode === "cleared-receipt" && receiptChecks === 2) throw new Error("ACK receipt lost");
      },
      window: { __frontendE2eGameSockets: {
        closeOpen: () => { events.push("close"); return 1; },
        openIds: () => mode === "unchanged-socket" ? [1] : [2],
      } },
    });
    pages[5].evaluate = async (callback) => callback();
    pages[5].waitForFunction = async (predicate, previousId) => {
      assert.equal(predicate(previousId), true, "replacement socket not observed");
      events.push("replacement");
    };
    const run = reconnect(pages, ["one", "two", "three", "four", "five", "guest"], "same", "werewolves", "Приет глас: Играч 1");
    if (mode === "success") {
      await run;
      assert.ok(events.includes("roster"));
      assert.equal(receiptChecks, 2);
      assert.equal(events.filter((event) => typeof event === "string" && event.includes('data-voted="true"')).length, 6);
    } else {
      await assert.rejects(run, /drop not observed|replacement socket not observed|private assignment changed|ACK receipt lost/);
    }
    assert.equal(events[0], "close");
    assert.match(events[1], /data-connected="false"/);
    if (mode === "success" || mode === "changed-role") {
      assert.equal(events[2], "replacement");
      assert.match(events[3], /data-connected="true"/);
    }
  }
});

test("the separate retry fixture fails only the first token request then reconnects through real auth", () => {
  assert.match(source, /runCheck\("create token failure can be retried", testCreateTokenRetry\)/);
  const scenario = functionSource("testCreateTokenRetry");
  assert.match(scenario, /signInBrowserContext\(context, authFixture\.users\[0\]\)/);
  assert.match(scenario, /createWerewolfRoom\(page,/);
  assert.match(scenario, /\/api\/game-token/);
  assert.match(scenario, /route\.fulfill\(\{ status: 503, json: \{ error: failureMessage \} \}\)/);
  assert.match(scenario, /page\.route\(tokenUrl, failToken, \{ times: 1 \}\)/);
  assert.match(scenario, /Връзката със стаята прекъсна/);
  assert.match(scenario, /expectTextIn\(dialog, failureMessage\)/);
  assert.match(scenario, /response\.ok\(\)/);
  assert.match(scenario, /Свържи отново/);
  assert.ok(scenario.indexOf("page.unroute(tokenUrl, failToken)") < scenario.indexOf('name: "Свържи отново"'));
  assert.match(scenario, /page\.url\(\) !== roomUrl\.href/);
  assert.match(scenario, /finally \{[\s\S]*page\.unroute\(tokenUrl, failToken\)[\s\S]*context\.close\(\)/);
  assert.doesNotMatch(scenario, /visualAuth|dev-user-id|ALLOW_DEV_AUTH|status: 200|accessToken:/);
});

test("expected mocked HTTP errors do not silence unrelated or repeated console errors", async () => {
  const url = "http://127.0.0.1:3401/api/game-token";
  function makeWatcher(expectedHttpError) {
    const handlers = {};
    const watcher = loadFunction("watchPage", {
      baseUrl: "http://127.0.0.1:3401",
      describeConsoleArgument: async () => "",
    })(
      { on: (event, handler) => { handlers[event] = handler; } },
      "fixture",
      { expectedHttpError },
    );
    return {
      watcher,
      emit(errorUrl = url, text = "Failed to load resource: the server responded with a status of 503 (Service Unavailable)") {
        handlers.console({ type: () => "error", text: () => text, location: () => ({ url: errorUrl }), args: () => [] });
      },
    };
  }

  const expected = makeWatcher({ url, status: 503 });
  expected.emit();
  await expected.watcher.assertClean();
  expected.emit();
  await assert.rejects(expected.watcher.assertClean(), /console error/);

  for (const [errorUrl, message] of [[`${url}/other`, undefined], [url, "Application error 503"]]) {
    const unexpected = makeWatcher({ url, status: 503 });
    unexpected.emit(errorUrl, message);
    await assert.rejects(unexpected.watcher.assertClean(), /console error/);
  }
  const normal = makeWatcher();
  normal.emit();
  await assert.rejects(normal.watcher.assertClean(), /console error/);
});

test("browser watchers retain real image/font failures and application errors, including Sentry errors", async () => {
  const baseUrl = "http://127.0.0.1:3401";
  const cases = [
    ...["image", "font"].flatMap((type) => [
      ["requestfailed", {
        url: () => `${baseUrl}/_next/static/media/fixture.${type === "font" ? "woff2" : "webp"}`,
        resourceType: () => type, failure: () => ({ errorText: "net::ERR_CONNECTION_RESET" }),
      }, new RegExp(`${type} request failed`)],
      ["response", {
        url: () => `${baseUrl}/_next/static/media/fixture.${type === "font" ? "woff2" : "webp"}`,
        request: () => ({ resourceType: () => type }), status: () => 404,
      }, new RegExp(`${type} 404`)],
    ]),
    ["pageerror", new Error("Application exception"), /page error: Application exception/],
    ["console", {
      type: () => "error", text: () => "Sentry transport error: application failure", args: () => [],
      location: () => ({ url: "https://example.invalid/api/2/envelope/?sentry_key=public&sentry_version=7" }),
    }, /console error: Sentry transport error/],
  ];
  for (const [event, payload, expected] of cases) {
    const handlers = {};
    const watcher = loadFunction("watchPage", { baseUrl, describeConsoleArgument: async () => "" })(
      { on: (name, handler) => { handlers[name] = handler; } }, "fixture",
    );
    handlers[event](payload);
    assert.equal(watcher.failed, true);
    await assert.rejects(watcher.assertClean(), expected);
  }
});
