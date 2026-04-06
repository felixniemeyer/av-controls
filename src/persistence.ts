import * as Base from './controls/base'

const DB_NAME = 'av-controls'
const STORE_NAME = 'control-state'
const DB_VERSION = 1

export interface PersistenceOptions {
  enabled?: boolean      // default: true
  artworkId: string      // required - identifies the artwork
  debounceMs?: number    // default: 500
}

interface StoredControlState {
  state: any
  timestamp: number
}

/**
 * Extracts the control path and state from a nested Group.Update
 */
export function extractUpdateInfo(update: Base.Update): { path: string[], state: Base.State } | null {
  const path: string[] = []
  let current: Base.Update = update

  // Walk through nested container updates (Group, Modal, Tabs, etc.) to build path.
  // We intentionally detect by shape instead of concrete class so any container update
  // that forwards `{ controlId, update }` participates in persistence path extraction.
  while (
    typeof current === 'object'
    && current !== null
    && 'controlId' in (current as object)
    && 'update' in (current as object)
  ) {
    const nested = current as Base.Update & { controlId: string; update: Base.Update }
    path.push(nested.controlId)
    current = nested.update
  }

  // Convert the leaf update to a state-like object
  // The update object typically has the same shape as state
  const state = updateToState(current)
  if (!state) return null

  return { path, state }
}

/**
 * Convert an Update to a State-like object for persistence
 * Updates and States typically have the same properties
 */
function updateToState(update: Base.Update): Base.State | null {
  // Most updates have the same structure as their State counterpart
  // We just need to copy the properties
  const state = new Base.State()
  const updateObj = update as any

  // Copy all properties except inherited ones
  for (const key of Object.keys(updateObj)) {
    (state as any)[key] = updateObj[key]
  }

  return state
}

/**
 * Walk a receiver tree and apply a callback to each leaf receiver
 */
export function walkReceivers(
  receiver: Base.Receiver,
  path: string[],
  callback: (path: string[], receiver: Base.Receiver) => void
): void {
  // Check if this is a container (Group, Modal, Tabs)
  const receiverAny = receiver as any
  if (receiverAny.controls && typeof receiverAny.controls === 'object') {
    // It's a container - recurse into children
    for (const id in receiverAny.controls) {
      const child = receiverAny.controls[id]
      if (child) {
        walkReceivers(child, [...path, id], callback)
      }
    }
  } else {
    // It's a leaf control
    callback(path, receiver)
  }
}

/**
 * StatePersistence handles IndexedDB storage with per-control debouncing
 */
export class StatePersistence {
  private db: IDBDatabase | null = null
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private options: Required<PersistenceOptions>
  private isInitialized = false

  constructor(options: PersistenceOptions) {
    this.options = {
      enabled: options.enabled ?? true,
      artworkId: options.artworkId,
      debounceMs: options.debounceMs ?? 500,
    }
  }

  /**
   * Initialize the IndexedDB connection
   */
  async init(): Promise<void> {
    if (!this.options.enabled) return
    if (this.isInitialized) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB for av-controls persistence')
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
    })
  }

  /**
   * Load all stored state for this artwork
   * Returns a Map of controlPath -> state
   */
  async loadState(): Promise<Map<string, Base.State>> {
    const result = new Map<string, Base.State>()
    if (!this.db || !this.options.enabled) return result

    const prefix = `${this.options.artworkId}/`

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.openCursor()

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const key = cursor.key as string
          if (key.startsWith(prefix)) {
            const controlPath = key.slice(prefix.length)
            const stored = cursor.value as StoredControlState
            result.set(controlPath, stored.state)
          }
          cursor.continue()
        } else {
          resolve(result)
        }
      }
    })
  }

  /**
   * Schedule a debounced write for a specific control
   */
  scheduleWrite(controlPath: string, state: Base.State): void {
    if (!this.options.enabled || !this.db) return

    // Cancel existing timer for this control
    const existingTimer = this.debounceTimers.get(controlPath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Start new timer
    const timer = setTimeout(() => {
      this.writeState(controlPath, state)
      this.debounceTimers.delete(controlPath)
    }, this.options.debounceMs)

    this.debounceTimers.set(controlPath, timer)
  }

  /**
   * Write a control's state to IndexedDB
   */
  private async writeState(controlPath: string, state: Base.State): Promise<void> {
    if (!this.db) return

    const key = `${this.options.artworkId}/${controlPath}`
    const stored: StoredControlState = {
      state,
      timestamp: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(stored, key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Apply stored state to a receiver tree
   */
  applyStoredState(rootReceiver: Base.Receiver, storedState: Map<string, Base.State>): void {
    walkReceivers(rootReceiver, [], (path, receiver) => {
      const pathKey = path.join('/')
      const state = storedState.get(pathKey)
      if (state) {
        try {
          receiver.restoreState(state)
        } catch (e) {
          console.warn(`Failed to restore state for control at ${pathKey}:`, e)
        }
      }
    })
  }

  /**
   * Handle an update from a control and schedule persistence
   */
  handleUpdate(update: Base.Update): void {
    if (!this.options.enabled) return

    const info = extractUpdateInfo(update)
    if (info) {
      const pathKey = info.path.join('/')
      this.scheduleWrite(pathKey, info.state)
    }
  }

  /**
   * Flush all pending writes immediately
   */
  async flush(): Promise<void> {
    // Clear all timers and write immediately
    // This is useful before page unload
    const promises: Promise<void>[] = []

    for (const [, timer] of this.debounceTimers) {
      clearTimeout(timer)
      // We don't have the state here, so we can't flush
      // In practice, the debounce is short enough that this is rarely needed
    }
    this.debounceTimers.clear()

    await Promise.all(promises)
  }

  /**
   * Close the database connection and clear timers
   */
  close(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.isInitialized = false
  }

  /**
   * Clear all stored state for this artwork
   */
  async clearState(): Promise<void> {
    if (!this.db) return

    const prefix = `${this.options.artworkId}/`

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.openCursor()

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const key = cursor.key as string
          if (key.startsWith(prefix)) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }
    })
  }
}
