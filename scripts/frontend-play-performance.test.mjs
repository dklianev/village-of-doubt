import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PLAY_PERFORMANCE_CASES, assertLocalEndpoint, closeProfileRooms, dismissProfileRoleRitual, profileRoomOptions,
  runPlayPerformance, safeProfileFailure, summarizeSamples,
} from "./frontend-play-performance.mjs";

test("profiling accepts only local origins without credentials or query data", () => {
  assert.equal(assertLocalEndpoint("http://127.0.0.1:3401", "http:"), "http://127.0.0.1:3401");
  assert.equal(assertLocalEndpoint("ws://[::1]:3568", "ws:"), "ws://[::1]:3568");
  assert.equal(assertLocalEndpoint("ws://localhost:3568/", "ws:"), "ws://localhost:3568");
  for (const url of ["https://127.0.0.1", "http://example.com", "http://127.0.0.1.example.com",
    "http://10.0.0.1", "http://user:secret@127.0.0.1", "http://127.0.0.1/?token=secret",
    "http://127.0.0.1/#secret", "http://127.0.0.1/play", "not-a-url"]) {
    assert.throws(() => assertLocalEndpoint(url, "http:"));
  }
});

test("crowded room counts and maxPlayers are explicit for all four real-game cases", () => {
  assert.deepEqual(PLAY_PERFORMANCE_CASES, [
    { mode: "werewolves_classic", players: 12 }, { mode: "werewolves_classic", players: 30 },
    { mode: "mafia_free", players: 12 }, { mode: "mafia_free", players: 24 },
  ]);
  for (const { mode, players } of PLAY_PERFORMANCE_CASES) {
    const options = profileRoomOptions(mode, players);
    assert.equal(options.playerCount, players);
    assert.equal(options.maxPlayers, players);
    assert.equal(options.narratorMode, "automatic");
    assert.equal(options.tempoProfile, "manual");
    assert.equal(options.customTimers.autoAdvanceWhenReady, false);
    assert.equal(options.firstNightKill, false);
    assert.equal(options.customTimers.voteSeconds, 240);
  }
  assert.throws(() => profileRoomOptions("mafia_free", 30));
  assert.throws(() => profileRoomOptions("werewolves_classic", 24));
});

test("sample statistics use nearest-rank percentiles without mutating input", () => {
  const samples = [50, 10, 30, 20, 40];
  assert.deepEqual(summarizeSamples(samples), { count: 5, medianMs: 30, p95Ms: 50, maxMs: 50 });
  assert.deepEqual(samples, [50, 10, 30, 20, 40]);
  for (const values of [[], [NaN], [Infinity], [-1]]) assert.throws(() => summarizeSamples(values));
});

test("SDK cleanup attempts every leave and force-closes even a failed transport", async () => {
  const left = [];
  const closed = [];
  const rooms = [0, 1, 2].map((index) => ({
    leave: async (consented) => { assert.equal(consented, true); left.push(index); if (index === 1) throw new Error("synthetic failure"); },
    connection: { close: () => closed.push(index) },
  }));
  assert.equal(await closeProfileRooms(rooms), 1);
  assert.deepEqual(left.sort(), [0, 1, 2]);
  assert.deepEqual(closed.sort(), [0, 1, 2]);
  assert.equal(await closeProfileRooms([]), 0);
});

test("SDK cleanup bounds a stalled graceful leave and still closes its connection", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let closed = false;
  const cleanup = closeProfileRooms([{ leave: () => new Promise(() => {}), connection: { close: () => { closed = true; } } }]);
  t.mock.timers.tick(5001);
  assert.equal(await cleanup, 1);
  assert.equal(closed, true);
});

test("failure diagnostics preserve known checks but suppress tokens, codes and identities", () => {
  const unsafe = new Error("ws://localhost/private?token=secret for frontend-e2e-private@example.test");
  assert.equal(JSON.stringify(safeProfileFailure(unsafe)).includes("secret"), false);
  assert.equal(safeProfileFailure(new Error("Timed out: SDK join.")).reason, "Timed out: SDK join.");
  const timeout = Object.assign(unsafe, { name: "TimeoutError" });
  assert.equal(safeProfileFailure(timeout).kind, "browser-timeout");
  let failure;
  try { assert.ok(false, "Crowded table has horizontal page overflow."); } catch (error) { failure = error; }
  assert.deepEqual(safeProfileFailure(failure), { kind: "assertion", reason: "Crowded table has horizontal page overflow." });
});

test("runner refuses real identities and non-Chromium before opening a context or loading SDK", async () => {
  const options = {
    browser: { browserType: () => ({ name: () => "chromium" }) },
    baseUrl: "http://127.0.0.1:3401", wsUrl: "ws://127.0.0.1:3568", secret: "synthetic-local-test-secret-long-enough",
    artifactDir: "/unused", signInBrowserContext: async () => {},
    identities: Array.from({ length: 30 }, (_, index) => ({ id: `real-user-${index}`, name: "Synthetic", email: "synthetic@example.test" })),
  };
  await assert.rejects(runPlayPerformance(options), /Only seeded frontend E2E/);
  await assert.rejects(runPlayPerformance({ ...options, browser: { browserType: () => ({ name: () => "firefox" }) } }), /Chromium/);
  await assert.rejects(runPlayPerformance({ ...options, label: "../outside" }), /Unsafe artifact label/);
  await assert.rejects(runPlayPerformance({ ...options, baseUrl: "https://production.example" }), /loopback/);
});

test("ritual dismissal survives the accessible dialog name changing after the flip", async () => {
  let dialogName = "Твоята тайна карта";
  let dismissed = false;
  const button = (name, scopedName) => ({ click: async () => {
    if (scopedName) assert.equal(dialogName, scopedName, "The old named dialog no longer matches after flipping.");
    if (name === "Обърни картата") dialogName = "Synthetic role";
    else if (name === "Запомних") dismissed = true;
    else assert.fail("Unexpected ritual button");
  }, waitFor: async ({ state }) => { assert.equal(state, "detached"); assert.equal(dismissed, true); } });
  const page = { getByRole: (role, { name }) => role === "dialog"
    ? { getByRole: (_role, options) => button(options.name, name) }
    : button(name) };
  const result = {};
  await dismissProfileRoleRitual(page, result);
  assert.equal(dismissed, true);
  assert.equal(result.stage, "ritual dismiss");
});
