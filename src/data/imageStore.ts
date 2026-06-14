// Offline, on-device store for the real-world photo attached to each target.
// Photos can be large, so they live in IndexedDB (not localStorage) keyed by
// the lowercased target word. Every method degrades gracefully: if IndexedDB
// is unavailable or a read fails, the app simply falls back to the emoji.

const DB_NAME = 'alexspeak'
const DB_VERSION = 1
const STORE = 'targetImages'

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

const key = (word: string) => word.trim().toLowerCase()

/**
 * Save a photo for a target. Rejects on failure (e.g. storage quota) so the
 * Settings UI can tell the caregiver — unlike reads, a failed write matters.
 */
export async function putTargetImage(word: string, dataUrl: string): Promise<void> {
  const db = await openDb()
  if (!db) throw new Error('Photo storage is unavailable on this device')
  await new Promise<void>((resolve, reject) => {
    let request: IDBRequest
    try {
      request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(dataUrl, key(word))
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Could not save the photo'))
      return
    }
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error ?? new Error('Could not save the photo (storage may be full)'))
  })
}

export async function getTargetImage(word: string): Promise<string | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    let request: IDBRequest
    try {
      request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key(word))
    } catch {
      resolve(null)
      return
    }
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null)
    request.onerror = () => resolve(null)
  })
}

export async function deleteTargetImage(word: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    let request: IDBRequest
    try {
      request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key(word))
    } catch {
      resolve()
      return
    }
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
}

/** All stored photos as a `{ word: dataUrl }` map; `{}` on any failure. */
export async function getAllTargetImages(): Promise<Record<string, string>> {
  const db = await openDb()
  if (!db) return {}
  return new Promise((resolve) => {
    const images: Record<string, string> = {}
    let request: IDBRequest<IDBCursorWithValue | null>
    try {
      request = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
    } catch {
      resolve(images)
      return
    }
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        if (typeof cursor.value === 'string') images[String(cursor.key)] = cursor.value
        cursor.continue()
      } else {
        resolve(images)
      }
    }
    request.onerror = () => resolve(images)
  })
}
