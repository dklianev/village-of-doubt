process.env.LOAD_CLIENTS ??= "300";
process.env.LOAD_ROOM_SIZE ??= "30";
process.env.LOAD_HOLD_MS ??= "60000";
process.env.LOAD_MIN_PHASES ??= "2";
process.env.LOAD_JOIN_P95_MS ??= "5000";
process.env.LOAD_MAX_EVENT_LOOP_UTILIZATION ??= "0.85";
process.env.LOAD_MAX_RSS_MB ??= "1024";

await import("./loadtest.mjs");
