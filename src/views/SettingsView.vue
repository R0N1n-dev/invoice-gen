<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  BadgeCheck,
  Check,
  Building2,
  Database,
  FileDown,
  FileText,
  Image as ImageIcon,
  Palette,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from '@lucide/vue'
import AppSheet from '@/components/AppSheet.vue'
import AppSelect from '@/components/AppSelect.vue'
import { useSettingsStore } from '@/stores/settings'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { CURRENCIES, LOCALES } from '@/lib/money'
import { isNative, saveTextFile } from '@/lib/native'
import { FONTS, THEMES, fontById, themeById, themeSwatches } from '@/lib/themes'
import { restoreBackup, type BackupFile } from '@/db/db'
import type { Business, Settings } from '@/types'

const settings = useSettingsStore()
const data = useDataStore()
const ui = useUiStore()

const biz = reactive<Business>(JSON.parse(JSON.stringify(settings.business)))
const prefs = reactive<Settings>(JSON.parse(JSON.stringify(settings.settings)))
const dirty = ref(false)
const showAbout = ref(false)
const importRef = ref<HTMLInputElement | null>(null)

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }))
const localeOptions = LOCALES.map((l) => ({ value: l, label: l }))
const dateFormatOptions = [
  { value: 'medium', label: '24 Mar 2026', hint: 'Day, short month, year' },
  { value: 'short', label: '24/03/2026', hint: 'Day, month, year' },
  { value: 'iso', label: '2026-03-24', hint: 'ISO 8601' },
]
const templateOptions = [
  { value: 'modern', label: 'Modern', hint: 'Accent band, big total' },
  { value: 'classic', label: 'Classic', hint: 'Letterhead, ruled table' },
  { value: 'minimal', label: 'Minimal', hint: 'Document, black total bar' },
]
const termsOptions = [
  { value: 0, label: 'On receipt' },
  { value: 7, label: 'Net 7' },
  { value: 14, label: 'Net 14' },
  { value: 30, label: 'Net 30' },
  { value: 45, label: 'Net 45' },
  { value: 60, label: 'Net 60' },
]

const modes = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

const currentTheme = computed(() => themeById(settings.settings.themeId))
const currentFont = computed(() => fontById(settings.settings.fontId))

function setMode(mode: 'light' | 'dark' | 'system') {
  prefs.colorMode = mode
  void settings.saveSettings({ colorMode: mode })
}
function setTheme(id: string) {
  prefs.themeId = id
  void settings.saveSettings({ themeId: id })
}
function setFont(id: string) {
  prefs.fontId = id
  void settings.saveSettings({ fontId: id })
}

const accentPresets = ['#7C93FF', '#3FDD9B', '#FFB86B', '#FF6B81', '#B78CFF', '#0EA5E9', '#0A0A0A']

const storageLabel = computed(() => (isNative ? 'On-device database + Documents backup' : 'Browser IndexedDB (this device)'))
const counts = computed(() => ({
  invoices: data.invoices.length,
  clients: data.clients.length,
  items: data.items.length,
}))

function markDirty() {
  dirty.value = true
}


function revert() {
  Object.assign(biz, JSON.parse(JSON.stringify(settings.business)))
  Object.assign(prefs, JSON.parse(JSON.stringify(settings.settings)))
  dirty.value = false
}

async function save() {
  await settings.saveBusiness({ ...biz })
  await settings.saveSettings({ ...prefs })
  dirty.value = false
  ui.toast('Settings saved')
}

function pickLogo() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 4_000_000) {
      ui.toast('Logo must be under 4 MB', 'err')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    biz.logo = await downscale(dataUrl, 420)
    markDirty()
  }
  input.click()
}

function downscale(dataUrl: string, max: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, max / Math.max(img.width, img.height))
      if (ratio === 1) return resolve(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

async function exportBackup() {
  const payload = {
    app: 'billfold' as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    ...settings.snapshot(),
  }
  const json = JSON.stringify(payload, null, 2)
  const stamp = new Date().toISOString().slice(0, 10)
  const result = await saveTextFile(`billfold-backup-${stamp}.json`, json)
  ui.toast(
    result.ok ? `Backup saved to ${result.location ?? 'your device'}` : result.error ?? 'Export failed',
    result.ok ? 'ok' : 'err',
  )
}

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as BackupFile
    if (parsed.app !== 'billfold') throw new Error('Not a Billfold backup')
    const ok = await ui.confirm({
      title: 'Restore this backup?',
      message: `${parsed.invoices?.length ?? 0} invoices, ${parsed.clients?.length ?? 0} clients. This replaces everything currently on this device.`,
      confirmLabel: 'Restore',
      danger: true,
    })
    if (!ok) return
    await restoreBackup(parsed)
    await settings.load()
    await data.load()
    Object.assign(biz, JSON.parse(JSON.stringify(settings.business)))
    Object.assign(prefs, JSON.parse(JSON.stringify(settings.settings)))
    dirty.value = false
    ui.toast('Backup restored')
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'Could not read that file', 'err')
  }
}

async function loadDemo() {
  const ok = await ui.confirm({
    title: 'Load demo data?',
    message: 'This replaces your current clients and invoices with a sample studio dataset.',
    confirmLabel: 'Load demo',
    danger: true,
  })
  if (!ok) return
  await settings.loadDemo()
  Object.assign(biz, JSON.parse(JSON.stringify(settings.business)))
  Object.assign(prefs, JSON.parse(JSON.stringify(settings.settings)))
  dirty.value = false
  ui.toast('Demo data loaded')
}

async function eraseAll() {
  const ok = await ui.confirm({
    title: 'Erase all data?',
    message: 'Every invoice, client, catalog item and setting on this device will be deleted. Export a backup first if you need one.',
    confirmLabel: 'Erase everything',
    danger: true,
  })
  if (!ok) return
  await settings.eraseAll()
  Object.assign(biz, JSON.parse(JSON.stringify(settings.business)))
  Object.assign(prefs, JSON.parse(JSON.stringify(settings.settings)))
  dirty.value = false
  ui.toast('All data erased')
}
</script>


<template>
  <div class="content flush" style="padding-bottom: 150px">
    <div class="page-head">
      <div>
        <h1 class="page-title">Settings</h1>
        <div class="page-sub">Business identity, invoice defaults and local backups</div>
      </div>
      <button class="btn sm" :class="dirty ? 'primary' : 'ghost'" type="button" :disabled="!dirty" @click="save">
        {{ dirty ? 'Save' : 'Saved' }}
      </button>
    </div>

    <div class="settings-title">Appearance</div>
    <div class="settings-card" style="padding: 14px">
      <div class="between" style="align-items: flex-start">
        <div>
          <div style="font-size: 12.5px; font-weight: 600">Colour mode</div>
          <div class="tiny dim" style="margin-top: 2px">Light, dark, or follow the system.</div>
        </div>
      </div>
      <div class="segmented" style="margin-top: 10px">
        <button
          v-for="m in modes"
          :key="m.value"
          type="button"
          :class="{ on: prefs.colorMode === m.value }"
          @click="setMode(m.value)"
        >
          {{ m.label }}
        </button>
      </div>

      <div class="between" style="margin: 16px 0 8px; align-items: baseline">
        <div style="font-size: 12.5px; font-weight: 600">Theme</div>
        <span class="tiny dim">{{ currentTheme.useCase }}</span>
      </div>
      <div class="theme-grid">
        <button
          v-for="t in THEMES"
          :key="t.id"
          type="button"
          class="theme-card"
          :class="{ on: prefs.themeId === t.id }"
          @click="setTheme(t.id)"
        >
          <span class="theme-swatches">
            <i v-for="(c, i) in themeSwatches(t)" :key="i" :style="{ background: c }"></i>
          </span>
          <span class="theme-name">{{ t.name }}</span>
          <span class="theme-kind">{{ t.kind === 'dual' ? 'Dual tone' : 'Triple tone' }}</span>
          <Check v-if="prefs.themeId === t.id" :size="14" class="theme-tick" />
        </button>
      </div>

      <div class="between" style="margin: 16px 0 8px; align-items: baseline">
        <div style="font-size: 12.5px; font-weight: 600">Typeface</div>
        <span class="tiny dim">{{ currentFont.vibe }}</span>
      </div>
      <div class="scrim-list">
        <button
          v-for="f in FONTS"
          :key="f.id"
          type="button"
          class="quick font-row"
          :class="{ chosen: prefs.fontId === f.id }"
          @click="setFont(f.id)"
        >
          <span class="grow" style="text-align: left">
            <span class="font-sample" :style="{ fontFamily: f.stack }">{{ f.name }}</span>
            <span class="row-sub">{{ f.vibe }}</span>
          </span>
          <Check v-if="prefs.fontId === f.id" :size="16" class="font-tick" />
        </button>
      </div>
    </div>

    <div class="settings-title">Business profile</div>
    <div class="settings-card" style="padding: 14px">
      <div class="logo-picker" style="padding-top: 0">
        <div class="logo-preview">
          <img v-if="biz.logo" :src="biz.logo" alt="Business logo" />
          <ImageIcon v-else :size="20" class="dim" />
        </div>
        <div class="grow">
          <div style="font-size: 12.5px; font-weight: 600">Logo</div>
          <div class="tiny dim" style="margin-top: 2px">PNG or JPG. Appears on every PDF invoice.</div>
          <div class="row" style="margin-top: 8px; gap: 6px">
            <button class="btn sm ghost" type="button" @click="pickLogo">Upload</button>
            <button v-if="biz.logo" class="btn sm ghost" type="button" @click="biz.logo = ''; markDirty()">
              Remove
            </button>
          </div>
        </div>
      </div>
      <label class="field">
        <span class="label">Business name *</span>
        <input v-model="biz.name" type="text" @input="markDirty" />
      </label>
      <div class="grid-2">
        <label class="field">
          <span class="label">Legal name</span>
          <input v-model="biz.legalName" type="text" placeholder="Optional" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Tax / VAT ID</span>
          <input v-model="biz.taxId" type="text" @input="markDirty" />
        </label>
      </div>
      <div class="grid-2">
        <label class="field">
          <span class="label">Email</span>
          <input v-model="biz.email" type="email" inputmode="email" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Phone</span>
          <input v-model="biz.phone" type="tel" @input="markDirty" />
        </label>
      </div>
      <div class="grid-2">
        <label class="field">
          <span class="label">Website</span>
          <input v-model="biz.website" type="text" placeholder="studio.com" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Address</span>
          <input v-model="biz.address1" type="text" @input="markDirty" />
        </label>
      </div>
      <div class="grid-3">
        <label class="field">
          <span class="label">City</span>
          <input v-model="biz.city" type="text" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Postal code</span>
          <input v-model="biz.postal" type="text" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Country</span>
          <input v-model="biz.country" type="text" @input="markDirty" />
        </label>
      </div>
      <label class="field" style="margin-bottom: 0">
        <span class="label">Footer note on PDFs</span>
        <input v-model="biz.footerNote" type="text" placeholder="Thank you for your business." @input="markDirty" />
      </label>
    </div>

    <div class="settings-title">Payment details</div>
    <div class="settings-card" style="padding: 14px">
      <div class="grid-2">
        <label class="field">
          <span class="label">Bank name</span>
          <input v-model="biz.bankName" type="text" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Account holder</span>
          <input v-model="biz.accountName" type="text" @input="markDirty" />
        </label>
      </div>
      <div class="grid-2">
        <label class="field" style="margin-bottom: 0">
          <span class="label">IBAN</span>
          <input v-model="biz.iban" type="text" placeholder="PT50 …" @input="markDirty" />
        </label>
        <label class="field" style="margin-bottom: 0">
          <span class="label">BIC / SWIFT</span>
          <input v-model="biz.bic" type="text" @input="markDirty" />
        </label>
      </div>
    </div>

    <div class="settings-title">Brand colour</div>
    <div class="settings-card" style="padding: 14px">
      <div class="between" style="align-items: flex-start">
        <div>
          <div style="font-size: 12.5px; font-weight: 600">Accent used on PDFs</div>
          <div class="tiny dim" style="margin-top: 2px">Header band, totals box and links.</div>
        </div>
        <input v-model="biz.accent" type="color" class="color-input" aria-label="Accent colour" @input="markDirty" />
      </div>
      <div class="row wrap" style="gap: 8px; margin-top: 12px">
        <button
          v-for="c in accentPresets"
          :key="c"
          class="swatch"
          :class="{ on: biz.accent.toLowerCase() === c.toLowerCase() }"
          :style="{ background: c }"
          type="button"
          :aria-label="`Use ${c}`"
          @click="biz.accent = c; markDirty()"
        ></button>
      </div>
    </div>

    <div class="settings-title">Invoice defaults</div>
    <div class="settings-card" style="padding: 14px">
      <div class="grid-2">
        <label class="field">
          <span class="label">Currency</span>
          <AppSelect v-model="prefs.currency" label="Currency" :options="currencyOptions" @update:model-value="markDirty" />
        </label>
        <label class="field">
          <span class="label">Locale</span>
          <AppSelect v-model="prefs.locale" label="Locale" :options="localeOptions" @update:model-value="markDirty" />
        </label>
      </div>
      <div class="grid-2">
        <label class="field">
          <span class="label">Date format</span>
          <AppSelect v-model="prefs.dateFormat" label="Date format" :options="dateFormatOptions" @update:model-value="markDirty" />
        </label>
        <label class="field">
          <span class="label">Default PDF template</span>
          <AppSelect v-model="prefs.defaultTemplate" label="PDF template" :options="templateOptions" @update:model-value="markDirty" />
        </label>
      </div>
      <div class="grid-3">
        <label class="field">
          <span class="label">Number prefix</span>
          <input v-model="prefs.invoicePrefix" type="text" maxlength="8" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Next number</span>
          <input v-model.number="prefs.nextNumber" type="number" min="1" step="1" @input="markDirty" />
        </label>
        <label class="field">
          <span class="label">Payment terms</span>
          <AppSelect v-model="prefs.paymentTermsDays" label="Payment terms" :options="termsOptions" @update:model-value="markDirty" />
        </label>
      </div>
      <label class="toggle-row">
        <span>
          <span style="font-size: 12.5px; font-weight: 550; display: block">Year in invoice numbers</span>
          <span class="tiny dim">e.g. INV-{{ new Date().getFullYear() }}-0042</span>
        </span>
        <button
          class="toggle"
          :class="{ on: prefs.numberWithYear }"
          type="button"
          role="switch"
          :aria-checked="prefs.numberWithYear"
          @click="prefs.numberWithYear = !prefs.numberWithYear; markDirty()"
        ></button>
      </label>
      <label class="field" style="margin-top: 10px">
        <span class="label">Default tax rate %</span>
        <input v-model.number="prefs.defaultTaxRate" type="number" min="0" step="0.1" @input="markDirty" />
      </label>
      <label class="field">
        <span class="label">Default notes</span>
        <textarea v-model="prefs.defaultNotes" rows="2" @input="markDirty"></textarea>
      </label>
      <label class="field" style="margin-bottom: 0">
        <span class="label">Default terms</span>
        <textarea v-model="prefs.defaultTerms" rows="2" @input="markDirty"></textarea>
      </label>
    </div>

    <div class="settings-title">Your data</div>
    <div class="settings-card" style="padding: 6px 14px">
      <div class="settings-row">
        <span class="si"><Database :size="15" /></span>
        <span class="grow">
          <span class="st">Local storage</span>
          <span class="ss">{{ storageLabel }} · {{ counts.invoices }} invoices · {{ counts.clients }} clients · {{ counts.items }} items</span>
        </span>
        <BadgeCheck :size="16" style="color: var(--ok)" />
      </div>
      <label class="settings-row" style="cursor: pointer">
        <span class="si"><ShieldCheck :size="15" /></span>
        <span class="grow">
          <span class="st">Auto-backup on this device</span>
          <span class="ss">Writes a JSON snapshot after changes{{ isNative ? '' : ' (native builds only)' }}</span>
        </span>
        <button
          class="toggle"
          :class="{ on: prefs.autoBackup }"
          type="button"
          role="switch"
          :aria-checked="prefs.autoBackup"
          @click="prefs.autoBackup = !prefs.autoBackup; markDirty()"
        ></button>
      </label>
      <button class="settings-row" type="button" @click="exportBackup">
        <span class="si"><FileDown :size="15" /></span>
        <span class="grow">
          <span class="st">Export backup</span>
          <span class="ss">One JSON file with everything on this device</span>
        </span>
      </button>
      <button class="settings-row" type="button" @click="importRef?.click()">
        <span class="si"><Upload :size="15" /></span>
        <span class="grow">
          <span class="st">Restore from backup</span>
          <span class="ss">Replaces current data — used when moving phones</span>
        </span>
      </button>
      <input ref="importRef" type="file" accept="application/json,.json" class="sr-only" @change="onImport" />
      <button class="settings-row" type="button" @click="loadDemo">
        <span class="si"><RotateCcw :size="15" /></span>
        <span class="grow">
          <span class="st">Load demo data</span>
          <span class="ss">Sample studio invoices to explore the app</span>
        </span>
      </button>
      <button class="settings-row" type="button" @click="eraseAll">
        <span class="si" style="color: var(--danger)"><Trash2 :size="15" /></span>
        <span class="grow">
          <span class="st" style="color: var(--danger)">Erase all data</span>
          <span class="ss">Deletes invoices, clients, catalog and settings</span>
        </span>
      </button>
    </div>

    <div class="settings-title">About</div>
    <div class="settings-card" style="padding: 6px 14px">
      <button class="settings-row" type="button" @click="showAbout = true">
        <span class="si"><FileText :size="15" /></span>
        <span class="grow">
          <span class="st">Billfold 1.0.0</span>
          <span class="ss">Vue 3 · Vite 8 · Capacitor 8 · pdf-lib</span>
        </span>
      </button>
      <div class="settings-row" style="cursor: default">
        <span class="si"><Building2 :size="15" /></span>
        <span class="grow">
          <span class="st">Works fully offline</span>
          <span class="ss">No account, no server, no network permission needed</span>
        </span>
      </div>
      <div class="settings-row" style="cursor: default">
        <span class="si"><Palette :size="15" /></span>
        <span class="grow">
          <span class="st">No haptics</span>
          <span class="ss">The app never triggers vibration on any device</span>
        </span>
      </div>
    </div>

    <div v-if="dirty" class="dock">
      <button class="btn ghost" type="button" @click="revert">Revert</button>
      <button class="btn primary grow" type="button" @click="save">Save settings</button>
    </div>

    <AppSheet :open="showAbout" title="About Billfold" @close="showAbout = false">
      <p class="muted" style="font-size: 12.5px; line-height: 1.7">
        Billfold is an offline-first invoice generator. Everything you enter is stored locally in IndexedDB on this
        device and never uploaded. PDFs are rendered on-device with pdf-lib — no server round trip.
      </p>
      <div class="mt-14">
        <div class="kv"><span class="k">Storage</span><span class="v">IndexedDB (Dexie) + Filesystem backups</span></div>
        <div class="kv"><span class="k">PDF engine</span><span class="v">pdf-lib + embedded Inter</span></div>
        <div class="kv"><span class="k">Runtime</span><span class="v">Vue 3.5 · Vite 8 · Capacitor 8</span></div>
        <div class="kv"><span class="k">Platforms</span><span class="v">Android 7+ · modern browsers</span></div>
      </div>
    </AppSheet>
  </div>
</template>

<style scoped>
.theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px;
  border-radius: 13px;
  border: 1px solid var(--line);
  background: var(--surface);
  text-align: left;
}
.theme-card.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.theme-swatches {
  display: flex;
  gap: 3px;
  height: 18px;
}
.theme-swatches i {
  flex: 1;
  border-radius: 4px;
  border: 1px solid var(--line);
}
.theme-name {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.theme-kind {
  font-size: 9px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.theme-tick {
  position: absolute;
  right: 8px;
  bottom: 8px;
  color: var(--link);
}
.font-row {
  padding: 10px 12px;
}
.font-row.chosen {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
.font-sample {
  display: block;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.font-tick {
  flex: none;
  color: var(--link);
}
.color-input {
  width: 46px;
  height: 38px;
  padding: 2px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  flex: none;
}
.swatch {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 2px solid transparent;
  box-shadow: inset 0 0 0 1px var(--line);
}
.swatch.on {
  border-color: var(--ink);
}
</style>
