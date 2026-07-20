import test from "node:test";
import assert from "node:assert/strict";
import { assertLoadThresholds, percentile } from "./loadtest-metrics.mjs";

test("percentile reports the observed upper-bound sample", () => {
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  assert.equal(percentile([40, 10, 30, 20], 0.5), 20);
});

test("load thresholds accept healthy latency and server runtime samples", () => {
  assert.doesNotThrow(() => assertLoadThresholds({
    joinLatenciesMs: [20, 30, 40],
    statsSamples: [
      { eventLoopUtilization: 0.2, rssBytes: 120 * 1024 * 1024 },
      { eventLoopUtilization: 0.3, rssBytes: 130 * 1024 * 1024 },
    ],
  }, {
    joinP95Ms: 100,
    eventLoopUtilization: 0.8,
    rssBytes: 256 * 1024 * 1024,
  }));
});

test("load thresholds report every exceeded budget", () => {
  assert.throws(() => assertLoadThresholds({
    joinLatenciesMs: [300, 500],
    statsSamples: [{ eventLoopUtilization: 0.95, rssBytes: 600 * 1024 * 1024 }],
  }, {
    joinP95Ms: 200,
    eventLoopUtilization: 0.8,
    rssBytes: 512 * 1024 * 1024,
  }), (error) => {
    assert.match(error.message, /join p95/i);
    assert.match(error.message, /event loop/i);
    assert.match(error.message, /RSS/i);
    return true;
  });
});
