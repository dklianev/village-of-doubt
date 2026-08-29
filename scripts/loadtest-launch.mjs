process.env.LOAD_CLIENTS ??= "200";
process.env.LOAD_HOLD_MS ??= "30000";
process.env.LOAD_JOIN_P95_MS ??= "3000";
process.env.LOAD_MAX_EVENT_LOOP_UTILIZATION ??= "0.8";
process.env.LOAD_MAX_RSS_MB ??= "768";
process.env.LOAD_MIN_PHASES ??= "2";

await import("./loadtest.mjs");
