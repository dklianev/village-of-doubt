import { drainRequest, readPositiveInteger } from "./deploy-drain-lib.mjs";

await drainRequest("DELETE", readPositiveInteger("DEPLOY_DRAIN_CANCEL_TIMEOUT_MS", 10_000));
