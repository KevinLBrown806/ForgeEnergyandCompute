export interface CacheEntry<T> {
  value: T;
  /** When the entry was written. */
  storedAt: number;
  /** Soft expiry — after this, get() returns undefined but getStale() still works. */
  expiresAt: number;
}

export class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      return undefined;
    }
    return entry.value as T;
  }

  /** Return value even after soft TTL expiry (for partial-outage fallback). */
  getStale<T>(key: string): { value: T; storedAt: number; stale: boolean } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return {
      value: entry.value as T,
      storedAt: entry.storedAt,
      stale: Date.now() > entry.expiresAt,
    };
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      storedAt: now,
      expiresAt: now + ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export const braiinsCache = new TtlCache();
