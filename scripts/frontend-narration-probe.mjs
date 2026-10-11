import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Browser-only observer: native decoding/playback are preserved, not mocked.
export function installNarrationProbe() {
  if (typeof BaseAudioContext === "undefined" || typeof AudioBufferSourceNode === "undefined") {
    window.__frontendNarration = { read: () => ({ unavailable: "Web Audio API unavailable", events: [], active: 0, peak: 0 }) };
    return;
  }
  const buffers = new WeakMap();
  const sources = new WeakMap();
  const active = new Set();
  const events = [];
  let peak = 0;
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (bytes, ...args) {
    const digest = crypto.subtle.digest("SHA-256", bytes.slice(0));
    return Promise.all([decode.call(this, bytes, ...args), digest]).then(([buffer, hash]) => {
      buffers.set(buffer, Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join(""));
      return buffer;
    });
  };
  const start = AudioBufferSourceNode.prototype.start;
  const stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const result = start.apply(this, args);
    const hash = buffers.get(this.buffer);
    if (hash) {
      const entry = { hash, phase: document.querySelector("main[data-phase]")?.dataset.phase, ended: false };
      sources.set(this, entry);
      active.add(this);
      peak = Math.max(peak, active.size);
      events.push(entry);
      if (events.length > 128) events.shift();
      this.addEventListener("ended", () => { active.delete(this); entry.ended = true; }, { once: true });
    }
    return result;
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    const result = stop.apply(this, args);
    active.delete(this);
    const entry = sources.get(this);
    if (entry) entry.ended = true;
    return result;
  };
  window.__frontendNarration = { read: () => ({ events: events.map(entry => ({ ...entry })), active: active.size, peak }) };
}

const seen = new WeakMap();
const unavailable = new WeakSet();
const manifest = JSON.parse(readFileSync(new URL("../apps/web/public/audio/narration/manifest.v1.json", import.meta.url), "utf8"));

export async function enableNarrationProbe(page, family) {
  // Callers await the connected room UI. Background requests must not gate the
  // init-script observer; the ordinary Ready click supplies the audio gesture.
  await page.waitForFunction(() => typeof window.__frontendNarration?.read === "function");
  const support = await page.evaluate(() => window.__frontendNarration.read());
  if (support.unavailable) {
    assert.ok(process.platform === "win32" && page.context().browser().browserType().name() === "webkit",
      `Native narration cannot be verified: ${support.unavailable}`);
    console.log("UNVERIFIED: native narration (Windows WebKit has no Web Audio API); game flow remains required.");
    unavailable.add(page);
    seen.delete(page);
    return;
  }
  unavailable.delete(page);
  seen.set(page, { family, next: 0 });
}

export async function assertNarratedPhase(pages, phase) {
  const cue = phase === "game_over" ? "finale.village" : `phase.${phase.replaceAll("_", ".")}`;
  for (const page of pages) {
    const cursor = seen.get(page);
    if (!cursor) continue;
    const hash = manifest.voices.classic[`${cursor.family}.${cue}`]?.sha256;
    assert.ok(hash, `Missing public narration fixture cue: ${cue}`);
    await page.waitForFunction(({ hash, next }) => window.__frontendNarration.read().events.slice(next).some(event => event.hash === hash), { hash, next: cursor.next }, { timeout: 10_000 });
    const current = await page.evaluate(() => window.__frontendNarration.read());
    assert.deepEqual(current.events.slice(cursor.next).map(event => event.hash), [hash], `Unexpected or repeated narration in ${phase}`);
    assert.ok(current.peak <= 1, "Recorded narration overlaps");
    cursor.next = current.events.length;
  }
}

export async function assertNarrationSilent(page, expectedStarts) {
  if (unavailable.has(page)) return;
  const current = await page.evaluate(() => window.__frontendNarration.read());
  assert.equal(current.events.length, expectedStarts, "Old narration replayed after reconnect/navigation");
  assert.equal(current.active, 0, "Narration kept playing after the room disconnected");
}
