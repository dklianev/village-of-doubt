process.env.LOAD_CLIENTS ??= "500";
process.env.LOAD_HOLD_MS ??= "120000";
process.env.LOAD_JOIN_P95_MS ??= "5000";
process.env.LOAD_MAX_RSS_MB ??= "1024";

await import("./loadtest.mjs");
