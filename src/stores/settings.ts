import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Business, Settings } from '@/types'
import { DEFAULT_BUSINESS, DEFAULT_SETTINGS, seedDemoData } from '@/db/seed'
import { getKV, restoreBackup, setKV, wipeDatabase, type BackupFile } from '@/db/db'
import { db } from '@/db/db'
import { useDataStore } from './data'

export const useSettingsStore = defineStore('settings', () => {
  const business = ref<Business>({ ...DEFAULT_BUSINESS })
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  /** Reactive proxies can't be structured-cloned into IndexedDB. */
  function plain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  const currency = computed(() => settings.value.currency)
  const locale = computed(() => settings.value.locale)
  const dateFormat = computed(() => settings.value.dateFormat)

  async function load() {
    const [b, s] = await Promise.all([getKV<Business>('business'), getKV<Settings>('settings')])
    if (b) business.value = { ...DEFAULT_BUSINESS, ...b }
    if (s) settings.value = { ...DEFAULT_SETTINGS, ...s }
    loaded.value = true
  }

  async function saveBusiness(patch: Partial<Business>) {
    business.value = { ...business.value, ...patch }
    await setKV('business', plain(business.value))
  }

  async function saveSettings(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch }
    await setKV('settings', plain(settings.value))
  }

  /** Reserve the next invoice number and persist the counter. */
  async function consumeNumber(): Promise<number> {
    const n = settings.value.nextNumber
    await saveSettings({ nextNumber: n + 1 })
    return n
  }

  async function loadDemo() {
    await seedDemoData()
    await load()
    await useDataStore().load()
  }

  async function eraseAll() {
    await wipeDatabase()
    business.value = { ...DEFAULT_BUSINESS }
    settings.value = { ...DEFAULT_SETTINGS }
    await setKV('business', plain(business.value))
    await setKV('settings', plain(settings.value))
    await useDataStore().load()
  }

  function snapshot(): Omit<BackupFile, 'app' | 'version' | 'exportedAt'> {
    const data = useDataStore()
    return {
      business: business.value,
      settings: settings.value,
      clients: data.clients,
      items: data.items,
      invoices: data.invoices,
    }
  }

  return {
    business,
    settings,
    loaded,
    currency,
    locale,
    dateFormat,
    load,
    saveBusiness,
    saveSettings,
    consumeNumber,
    loadDemo,
    eraseAll,
    snapshot,
  }
})
