import { checkGamePersistenceReadiness } from "../persistence/game-persistence.js";

type ReadinessProbe = () => Promise<boolean>;

export class PersistenceReadinessGate {
  private ready: boolean;
  private refreshPromise: Promise<boolean> | undefined;

  constructor(private readonly probe: ReadinessProbe, initialReady: boolean) {
    this.ready = initialReady;
  }

  isReady() {
    return this.ready;
  }

  refresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshPromise = this.runProbe().finally(() => {
      if (this.refreshPromise === refreshPromise) {
        this.refreshPromise = undefined;
      }
    });
    this.refreshPromise = refreshPromise;
    return refreshPromise;
  }

  private async runProbe() {
    try {
      this.ready = await this.probe();
    } catch {
      this.ready = false;
    }
    return this.ready;
  }
}

export const persistenceReadiness = new PersistenceReadinessGate(
  checkGamePersistenceReadiness,
  process.env.NODE_ENV !== "production" || !process.env.DATABASE_URL,
);
