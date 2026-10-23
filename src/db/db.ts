import Dexie, { type Table } from 'dexie'
import type { CatalogItem, Client, Invoice } from '@/types'

export interface KVRow {
  key: string
  value: unknown
}

class BillfoldDB extends Dexie {
  clients!: Table<Client, string>
  items!: Table<CatalogItem, string>
  invoices!: Table<Invoice, string>
  kv!: Table<KVRow, string>

  constructor() {
    super('billfold')
    this.version(1).stores({
      clients: 'id, name, updatedAt, createdAt',
      items: 'id, name, updatedAt, sku',
      invoices: 'id, number, status, clientId, issueDate, dueDate, updatedAt, total',
      kv: 'key',
    })
  }
}

export const db = new BillfoldDB()

/** Ask the OS to keep our IndexedDB around (WebView / browser). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* not supported */
  }
  return false
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key)
  return row?.value as T | undefined
}

export async function setKV(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value })
}

export async function wipeDatabase(): Promise<void> {
  await db.transaction('rw', db.clients, db.items, db.invoices, db.kv, async () => {
    await Promise.all([db.clients.clear(), db.items.clear(), db.invoices.clear(), db.kv.clear()])
  })
}

export interface BackupFile {
  app: 'billfold'
  version: 1
  exportedAt: string
  business: unknown
  settings: unknown
  clients: Client[]
  items: CatalogItem[]
  invoices: Invoice[]
}

export async function buildBackup(payload: Omit<BackupFile, 'app' | 'version' | 'exportedAt'>): Promise<BackupFile> {
  return {
    app: 'billfold',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...payload,
  }
}

export async function restoreBackup(file: BackupFile): Promise<void> {
  if (file.app !== 'billfold') throw new Error('Not a Billfold backup file')
  await db.transaction('rw', db.clients, db.items, db.invoices, db.kv, async () => {
    await Promise.all([db.clients.clear(), db.items.clear(), db.invoices.clear()])
    if (file.clients?.length) await db.clients.bulkPut(file.clients)
    if (file.items?.length) await db.items.bulkPut(file.items)
    if (file.invoices?.length) await db.invoices.bulkPut(file.invoices)
    if (file.business) await db.kv.put({ key: 'business', value: file.business })
    if (file.settings) await db.kv.put({ key: 'settings', value: file.settings })
  })
}
