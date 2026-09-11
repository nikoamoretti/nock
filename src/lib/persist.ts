import type { Snapshot } from './types'

export interface Persistence {
  load(): Promise<Snapshot | null>
  save(snapshot: Snapshot): Promise<void>
}

export class MemoryPersistence implements Persistence {
  snapshot: Snapshot | null

  constructor(snapshot: Snapshot | null = null) {
    this.snapshot = snapshot
  }

  async load(): Promise<Snapshot | null> {
    return this.snapshot ? structuredClone(this.snapshot) : null
  }

  async save(snapshot: Snapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot)
  }
}

const DB_NAME = 'nock'
const DB_VERSION = 3
const STORE = 'kv'
const KEY = 'snapshot'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
      if (event.oldVersion < 3) {
        request.transaction?.objectStore(STORE).delete(KEY)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export class IdbPersistence implements Persistence {
  async load(): Promise<Snapshot | null> {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE, 'readonly')
      const value = await idbRequest<Snapshot | undefined>(
        tx.objectStore(STORE).get(KEY),
      )
      return value ? structuredClone(value) : null
    } finally {
      db.close()
    }
  }

  async save(snapshot: Snapshot): Promise<void> {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(structuredClone(snapshot), KEY)
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }
}
