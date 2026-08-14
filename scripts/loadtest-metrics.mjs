export function percentile(values, quantile) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

export function assertLoadThresholds(measurements, thresholds) {
  const joinP95Ms = percentile(measurements.joinLatenciesMs, 0.95);
  const sustainedEventLoopUtilization = eventLoopUtilizationBetween(
    measurements.statsSamples[0],
    measurements.statsSamples.at(-1),
  );
  const maxRssBytes = Math.max(0, ...measurements.statsSamples.map((sample) => sample.rssBytes));
  const failures = [];

  if (joinP95Ms > thresholds.joinP95Ms) {
    failures.push(`join p95 ${joinP95Ms.toFixed(1)}ms exceeds ${thresholds.joinP95Ms}ms`);
  }
  if (sustainedEventLoopUtilization > thresholds.eventLoopUtilization) {
    failures.push(`sustained event loop utilization ${(sustainedEventLoopUtilization * 100).toFixed(1)}% exceeds ${(thresholds.eventLoopUtilization * 100).toFixed(1)}%`);
  }
  if (maxRssBytes > thresholds.rssBytes) {
    failures.push(`RSS ${(maxRssBytes / 1024 / 1024).toFixed(1)}MiB exceeds ${(thresholds.rssBytes / 1024 / 1024).toFixed(1)}MiB`);
  }

  if (failures.length > 0) {
    throw new Error(`Load thresholds failed:\n${failures.join("\n")}`);
  }

  return { joinP95Ms, sustainedEventLoopUtilization, maxRssBytes };
}

export function eventLoopUtilizationBetween(first, last) {
  if (!first || !last || first === last) {
    throw new Error("Load stats sampling requires at least two event-loop measurements.");
  }
  const activeMs = last.eventLoopActiveMs - first.eventLoopActiveMs;
  const idleMs = last.eventLoopIdleMs - first.eventLoopIdleMs;
  const totalMs = activeMs + idleMs;
  if (activeMs < 0 || idleMs < 0 || totalMs <= 0) {
    throw new Error("Load stats event-loop counters must increase across the measurement window.");
  }
  return activeMs / totalMs;
}
