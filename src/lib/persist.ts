import type { Issue, QueuedCommand, Snapshot } from './types'

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
const DB_VERSION = 4
const STORE = 'kv'
export const IDB_SNAPSHOT_KEY = 'snapshot'
export const IDB_ENTITIES_KEY = 'entities'
export const IDB_COMMANDS_KEY = 'commands'

type EntityCache = { issues: Issue[] }
type CommandCache = { pending: QueuedCommand[]; seen: string[] }

function openDb(dbName = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
      if (event.oldVersion < 3) {
        request.transaction?.objectStore(STORE).delete(IDB_SNAPSHOT_KEY)
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

function completeTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export function mergePersistedSnapshot(
  snapshot: Snapshot | undefined,
  entities?: EntityCache,
  commands?: CommandCache,
): Snapshot | null {
  if (!snapshot) return null
  const issues = entities?.issues ?? snapshot.issues ?? []
  return {
    ...snapshot,
    issues,
    comments: snapshot.comments ?? [],
    activities: snapshot.activities ?? [],
    attachments: snapshot.attachments ?? [],
    savedViews: snapshot.savedViews ?? [],
    initiatives: snapshot.initiatives ?? [],
    documents: snapshot.documents ?? [],
    notifications: snapshot.notifications ?? [],
    triageRules: snapshot.triageRules ?? [],
    customerRequests: snapshot.customerRequests ?? [],
    snoozes: snapshot.snoozes ?? {},
    inboxDelivery: snapshot.inboxDelivery,
    installations: snapshot.installations ?? [],
    externalLinks: snapshot.externalLinks ?? [],
    externalIdentities: snapshot.externalIdentities ?? [],
    pendingCommands: commands?.pending ?? snapshot.pendingCommands ?? [],
    seenMutationIds: commands?.seen ?? snapshot.seenMutationIds ?? [],
  }
}

export class IdbPersistence implements Persistence {
  dbName: string

  constructor(dbName = DB_NAME) {
    this.dbName = dbName
  }

  async load(): Promise<Snapshot | null> {
    const db = await openDb(this.dbName)
    try {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const snapshot = await idbRequest<Snapshot | undefined>(
        store.get(IDB_SNAPSHOT_KEY),
      )
      const entities = await idbRequest<EntityCache | undefined>(
        store.get(IDB_ENTITIES_KEY),
      )
      const commands = await idbRequest<CommandCache | undefined>(
        store.get(IDB_COMMANDS_KEY),
      )
      const merged = mergePersistedSnapshot(snapshot, entities, commands)
      return merged ? structuredClone(merged) : null
    } finally {
      db.close()
    }
  }

  async save(snapshot: Snapshot): Promise<void> {
    const db = await openDb(this.dbName)
    try {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const cloned = structuredClone(snapshot)
      const meta: Snapshot = {
        ...cloned,
        issues: [],
        pendingCommands: [],
        seenMutationIds: [],
      }
      store.put(meta, IDB_SNAPSHOT_KEY)
      store.put({ issues: cloned.issues }, IDB_ENTITIES_KEY)
      store.put(
        {
          pending: cloned.pendingCommands ?? [],
          seen: cloned.seenMutationIds ?? [],
        },
        IDB_COMMANDS_KEY,
      )
      await completeTx(tx)
    } finally {
      db.close()
    }
  }
}
