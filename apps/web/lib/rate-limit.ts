export type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

export type RateLimitConsumeInput = {
  key: string;
  limit: number;
  windowMs: number;
  now: number;
};

type Bucket = { count: number; resetAt: number };

export class BoundedMemoryRateLimitStore {
  readonly #entries = new Map<string, Bucket>();
  readonly #maxEntries: number;
  #nextCleanupAt = Number.POSITIVE_INFINITY;

  constructor(maxEntries = 10_000) {
    this.#maxEntries = Math.max(1, Math.trunc(maxEntries));
  }

  consume({ key, limit, windowMs, now }: RateLimitConsumeInput): RateLimitResult {
    this.#cleanupExpired(now);
    const current = this.#entries.get(key);
    if (current) {
      if (current.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
        };
      }
      current.count += 1;
      return { allowed: true };
    }

    if (this.#entries.size >= this.#maxEntries) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((this.#nextCleanupAt - now) / 1_000)),
      };
    }

    const resetAt = now + windowMs;
    this.#entries.set(key, { count: 1, resetAt });
    this.#nextCleanupAt = Math.min(this.#nextCleanupAt, resetAt);
    return { allowed: true };
  }

  entryCount(): number {
    return this.#entries.size;
  }

  #cleanupExpired(now: number): void {
    if (now < this.#nextCleanupAt) {
      return;
    }

    let nextCleanupAt = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of this.#entries) {
      if (bucket.resetAt <= now) {
        this.#entries.delete(key);
      } else {
        nextCleanupAt = Math.min(nextCleanupAt, bucket.resetAt);
      }
    }
    this.#nextCleanupAt = nextCleanupAt;
  }
}

export interface SharedRateLimitBackend {
  /**
   * Implementations must atomically increment and expire a key across instances.
   * A Redis or database adapter can be injected here without coupling routes to a vendor SDK.
   */
  consume(input: RateLimitConsumeInput): Promise<RateLimitResult>;
}

export function createSharedRateLimiter(
  options: { limit: number; windowMs: number },
  backend: SharedRateLimitBackend,
) {
  return {
    check(key: string, now = Date.now()) {
      return backend.consume({ key, limit: options.limit, windowMs: options.windowMs, now });
    },
  };
}
