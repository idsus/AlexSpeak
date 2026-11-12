// Opt-in, on-device store of short WAV clips of what the mic heard (keepClips setting).
// Same shape as imageStore: IndexedDB, reads degrade to empty, writes reject. Never uploaded.

const DB_NAME = 'alexspeak-clips'
const DB_VERSION = 1
const STORE = 'clips'
export const MAX_CLIPS = 200

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>, fallback: T): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve) => {
        if (!db) return resolve(fallback)
        try {
          const request = op(db.transaction(STORE, mode).objectStore(STORE))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(fallback)
        } catch {
          resolve(fallback)
        }
      }),
  )
}

/** Save a clip, then drop the oldest beyond MAX_CLIPS. Keys are Date.now(), so they sort by age. */
export async function putClip(id: number, wav: Uint8Array): Promise<void> {
  const db = await openDb()
  if (!db) throw new Error('Recording storage is unavailable on this device')
  await new Promise<void>((resolve, reject) => {
    try {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(wav.slice().buffer, id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Could not save the recording (storage may be full)'))
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Could not save the recording'))
    }
  })
  const keys = await run('readonly', (s) => s.getAllKeys(), [] as IDBValidKey[])
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_CLIPS))) await run('readwrite', (s) => s.delete(old), undefined)
}

export async function getClip(id: number): Promise<ArrayBuffer | null> {
  const v = await run<unknown>('readonly', (s) => s.get(id), null)
  return v instanceof ArrayBuffer ? v : null
}

export async function clipStats(): Promise<{ count: number; bytes: number }> {
  const all = await run<unknown[]>('readonly', (s) => s.getAll(), [])
  return { count: all.length, bytes: all.reduce<number>((n, v) => n + (v instanceof ArrayBuffer ? v.byteLength : 0), 0) }
}

export async function deleteAllClips(): Promise<void> {
  await run('readwrite', (s) => s.clear(), undefined)
}
