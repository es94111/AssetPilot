// lib/ttlCooldown.ts — bounded process-local cooldown for opportunistic maintenance.
// Correctness must come from persistent DB idempotency; this cache is only a query optimization.

export interface BoundedCooldownCache {
  /** Returns true when the key is outside its cooldown and records the new timestamp. */
  tryAcquire(key: string, now: number): boolean;
  /** Remove expired entries and return the current bounded size. */
  size(now: number): number;
  clear(): void;
}

export function createBoundedCooldownCache(
  ttlMs: number,
  maxEntries: number,
): BoundedCooldownCache {
  const ttl = Math.max(1, Math.floor(ttlMs));
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = new Map<string, number>();

  function prune(now: number): void {
    for (const [key, lastAt] of entries) {
      if (now - lastAt >= ttl) entries.delete(key);
    }
  }

  return {
    tryAcquire(key: string, now: number): boolean {
      prune(now);
      const lastAt = entries.get(key);
      if (lastAt != null && now - lastAt < ttl) return false;

      if (!entries.has(key) && entries.size >= limit) {
        let oldestKey: string | null = null;
        let oldestAt = Number.POSITIVE_INFINITY;
        for (const [candidate, timestamp] of entries) {
          if (timestamp < oldestAt) {
            oldestKey = candidate;
            oldestAt = timestamp;
          }
        }
        if (oldestKey != null) entries.delete(oldestKey);
      }

      entries.set(key, now);
      return true;
    },
    size(now: number): number {
      prune(now);
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
  };
}
