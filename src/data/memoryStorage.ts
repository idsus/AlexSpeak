// Minimal Storage-compatible in-memory store, used by unit tests (which run
// in node, where localStorage does not exist).
export class MemoryStorage {
  private map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const fallback = new MemoryStorage()

/** localStorage when the browser allows it; otherwise one shared in-memory store (blocked or missing storage). */
export function safeStorage(): StorageLike {
  try {
    const s = globalThis.localStorage
    if (s) return s
  } catch {
    // the getter throws when site data is blocked
  }
  return fallback
}
