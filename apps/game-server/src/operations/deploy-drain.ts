export interface DeployDrainDependencies {
  getActiveRooms: () => number;
  stopMatchmaking: () => void;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface DrainWaitOptions {
  timeoutMs: number;
  pollIntervalMs: number;
}

export class DeployDrainController {
  private getActiveRooms: () => number;
  private stopMatchmaking: () => void;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private draining = false;
  private startedAt: number | undefined;

  constructor({
    getActiveRooms,
    stopMatchmaking,
    now = Date.now,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  }: DeployDrainDependencies) {
    this.getActiveRooms = getActiveRooms;
    this.stopMatchmaking = stopMatchmaking;
    this.now = now;
    this.sleep = sleep;
  }

  configure({ getActiveRooms, stopMatchmaking }: Pick<DeployDrainDependencies, "getActiveRooms" | "stopMatchmaking">) {
    this.getActiveRooms = getActiveRooms;
    this.stopMatchmaking = stopMatchmaking;
  }

  begin() {
    if (!this.draining) {
      this.stopMatchmaking();
      this.draining = true;
      this.startedAt = this.now();
    }

    return this.status();
  }

  status() {
    return {
      draining: this.draining,
      activeRooms: this.getActiveRooms(),
      drainStartedAt: this.startedAt === undefined ? null : new Date(this.startedAt).toISOString(),
    };
  }

  isDraining() {
    return this.draining;
  }

  async waitForEmpty({ timeoutMs, pollIntervalMs }: DrainWaitOptions) {
    const startedAt = this.now();
    this.begin();
    let activeRooms = this.getActiveRooms();

    while (activeRooms > 0) {
      const elapsed = this.now() - startedAt;
      const remaining = timeoutMs - elapsed;
      if (remaining <= 0) {
        break;
      }

      await this.sleep(Math.min(pollIntervalMs, remaining));
      activeRooms = this.getActiveRooms();
    }

    const waitedMs = Math.min(this.now() - startedAt, timeoutMs);
    return {
      drained: activeRooms === 0,
      timedOut: activeRooms > 0,
      activeRooms,
      waitedMs,
    };
  }
}

export const deployDrain = new DeployDrainController({
  getActiveRooms: () => 0,
  stopMatchmaking: () => {},
});
