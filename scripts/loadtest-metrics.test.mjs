import test from "node:test";
import assert from "node:assert/strict";
import { assertLoadThresholds, percentile } from "./loadtest-metrics.mjs";

function statsSamplesFromIntervals(utilizations) {
  let eventLoopActiveMs = 0;
  let eventLoopIdleMs = 0;
  const samples = [{ eventLoopUtilization: 0, eventLoopActiveMs, eventLoopIdleMs, rssBytes: 100 }];

  for (const utilization of utilizations) {
    eventLoopActiveMs += utilization * 250;
    eventLoopIdleMs += (1 - utilization) * 250;
    samples.push({
      eventLoopUtilization: utilization,
      eventLoopActiveMs,
      eventLoopIdleMs,
      rssBytes: 100,
    });
  }

  return samples;
}

test("percentile reports the observed upper-bound sample", () => {
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  assert.equal(percentile([40, 10, 30, 20], 0.5), 20);
});

test("load thresholds accept healthy latency and server runtime samples", () => {
  assert.doesNotThrow(() => assertLoadThresholds({
    joinLatenciesMs: [20, 30, 40],
    statsSamples: [
      {
        eventLoopUtilization: 0.83,
        eventLoopActiveMs: 830,
        eventLoopIdleMs: 170,
        rssBytes: 120 * 1024 * 1024,
      },
      {
        eventLoopUtilization: 0.33,
        eventLoopActiveMs: 980,
        eventLoopIdleMs: 2_020,
        rssBytes: 130 * 1024 * 1024,
      },
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
    statsSamples: [
      {
        eventLoopUtilization: 0.5,
        eventLoopActiveMs: 500,
        eventLoopIdleMs: 500,
        rssBytes: 590 * 1024 * 1024,
      },
      {
        eventLoopUtilization: 0.7,
        eventLoopActiveMs: 1_400,
        eventLoopIdleMs: 600,
        rssBytes: 600 * 1024 * 1024,
      },
    ],
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

test("load thresholds retain one isolated event-loop outlier without failing the p99 budget", () => {
  const metrics = assertLoadThresholds({
    joinLatenciesMs: [20],
    statsSamples: statsSamplesFromIntervals([...Array(100).fill(0.1), 1]),
  }, {
    joinP95Ms: 100,
    eventLoopUtilization: 0.8,
    eventLoopP99Utilization: 0.9,
    rssBytes: 1_000,
  });

  assert.ok(Math.abs(metrics.eventLoopP99Utilization - 0.1) < Number.EPSILON);
  assert.equal(metrics.peakEventLoopUtilization, 1);
});

test("load thresholds reject repeated event-loop saturation hidden by the full-window average", () => {
  assert.throws(() => assertLoadThresholds({
    joinLatenciesMs: [20],
    statsSamples: statsSamplesFromIntervals([...Array(99).fill(0.1), 0.95, 0.95]),
  }, {
    joinP95Ms: 100,
    eventLoopUtilization: 0.8,
    eventLoopP99Utilization: 0.9,
    rssBytes: 1_000,
  }), /p99 event loop/i);
});
