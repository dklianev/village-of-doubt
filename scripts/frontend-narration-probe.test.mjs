import assert from "node:assert/strict";
import { webcrypto, createHash } from "node:crypto";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { installNarrationProbe, enableNarrationProbe, assertNarrationSilent } from "./frontend-narration-probe.mjs";

test("the probe preserves native decoding and playback and ignores generated ambience", async () => {
  class Context {
    async decodeAudioData(bytes) { this.decoded = bytes; return { duration: 2 }; }
  }
  class Source {
    start(...args) { this.startArgs = args; return 'started'; }
    stop(...args) { this.stopArgs = args; return 'stopped'; }
    addEventListener(event, callback) { this[event] = callback; }
  }
  const window = {};
  runInNewContext(`(${installNarrationProbe.toString()})()`, {
    BaseAudioContext: Context, AudioBufferSourceNode: Source, crypto: webcrypto, window,
    document: { querySelector: () => ({ dataset: { phase: 'voting' } }) },
  });
  const context = new Context();
  const bytes = Uint8Array.from([1, 2, 3]).buffer;
  const buffer = await context.decodeAudioData(bytes);
  assert.equal(context.decoded, bytes);
  assert.equal(buffer.duration, 2);
  const ambience = new Source();
  ambience.start();
  assert.equal(window.__frontendNarration.read().events.length, 0);
  const source = new Source();
  source.buffer = buffer;
  assert.equal(source.start(0), 'started');
  assert.deepEqual(source.startArgs, [0]);
  const observed = window.__frontendNarration.read();
  assert.equal(observed.active, 1);
  assert.equal(observed.peak, 1);
  assert.equal(observed.events[0].hash, createHash('sha256').update(new Uint8Array(bytes)).digest('hex'));
  assert.equal(observed.events[0].phase, 'voting');
  source.stop();
  assert.equal(window.__frontendNarration.read().active, 0);
  assert.equal(window.__frontendNarration.read().events[0].ended, true);
  source.ended();
  assert.equal(window.__frontendNarration.read().active, 0);
});

test("silence assertion rejects duplicate starts and continued playback", async () => {
  await assertNarrationSilent({ evaluate: async () => ({ events: [{}], active: 0 }) }, 1);
  await assert.rejects(assertNarrationSilent({ evaluate: async () => ({ events: [{}, {}], active: 0 }) }, 1), /replayed/);
  await assert.rejects(assertNarrationSilent({ evaluate: async () => ({ events: [{}], active: 1 }) }, 1), /kept playing/);
});

test("missing Web Audio is explicit and fails outside the Windows WebKit limitation", async () => {
  const window = {};
  runInNewContext(`(${installNarrationProbe.toString()})()`, { window });
  assert.equal(window.__frontendNarration.read().unavailable, "Web Audio API unavailable");
  const page = {
    waitForLoadState: async () => {},
    evaluate: async () => window.__frontendNarration.read(),
    context: () => ({ browser: () => ({ browserType: () => ({ name: () => "chromium" }) }) }),
  };
  await assert.rejects(enableNarrationProbe(page, "mafia"), /Native narration cannot be verified/);
  page.context = () => ({ browser: () => ({ browserType: () => ({ name: () => "webkit" }) }) });
  if (process.platform === "win32") {
    await enableNarrationProbe(page, "mafia");
    await assertNarrationSilent(page, 0);
  } else {
    await assert.rejects(enableNarrationProbe(page, "mafia"), /Native narration cannot be verified/);
  }
});
