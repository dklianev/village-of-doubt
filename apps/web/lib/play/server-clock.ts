// Phase deadlines are game-server timestamps; device clocks can be minutes off.
let serverOffsetMs = 0;

/** Estimates server time minus device time from one request round trip (NTP-style midpoint). */
export function recordServerClock(serverNow: unknown, sentAt: number, receivedAt: number) {
  if (typeof serverNow !== "number" || !Number.isFinite(serverNow)) return;
  serverOffsetMs = serverNow - (sentAt + receivedAt) / 2;
}

export function serverClockNow() {
  return Date.now() + serverOffsetMs;
}
