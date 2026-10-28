import path from "node:path";
import { fileURLToPath } from "node:url";
import { drainRequest, readPositiveInteger } from "./deploy-drain-lib.mjs";

export async function runDrain({
  timeoutMs = readPositiveInteger("DEPLOY_DRAIN_TIMEOUT_MS", 20 * 60_000),
  pollIntervalMs = readPositiveInteger("DEPLOY_DRAIN_POLL_INTERVAL_MS", 5_000),
  operationTimeoutMs = readPositiveInteger("DEPLOY_DRAIN_OPERATION_TIMEOUT_MS", 10_000),
  cancelTimeoutMs = readPositiveInteger("DEPLOY_DRAIN_CANCEL_TIMEOUT_MS", 10_000),
  request = drainRequest,
  now = Date.now,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const deadline = now() + timeoutMs;
  const remaining = () => {
    const ms = Math.min(operationTimeoutMs, deadline - now());
    if (ms <= 0) throw new Error(`Deploy drain timed out after ${timeoutMs}ms.`);
    return ms;
  };
  let completed = false;
  try {
    // An unacknowledged POST may still have enabled drain mode.
    try {
      await request("POST", remaining());
    } catch (error) {
      error.recoveryRequired = true;
      throw error;
    }
    while (now() < deadline) {
      try {
        const status = await request("GET", remaining());
        if (status.draining !== true || !Number.isSafeInteger(status.activeRooms) || status.activeRooms < 0) {
          throw new Error("game server has not acknowledged a valid drain status");
        }
        console.log(`Deploy drain: ${status.activeRooms} active room(s).`);
        if (status.activeRooms === 0 && now() < deadline) {
          completed = true;
          console.log("Deploy drain complete. It is safe to replace the game container.");
          return;
        }
      } catch {
        console.warn("Deploy drain status unavailable.");
      }
      await delay(Math.max(0, Math.min(pollIntervalMs, deadline - now())));
    }
    throw new Error(`Deploy drain timed out after ${timeoutMs}ms; deployment was not started.`);
  } finally {
    if (!completed) {
      // Cleanup has a fresh budget, independent of the expired operation deadline.
      try {
        await request("DELETE", cancelTimeoutMs);
      } catch (error) {
        error.recoveryRequired = true;
        throw error;
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDrain().catch((error) => {
    console.error(error.message);
    process.exitCode = error.recoveryRequired ? 74 : 75;
  });
}
