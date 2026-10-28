<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { BookPlus, Package, Plus, Search, Trash2 } from '@lucide/vue'
import AppSheet from '@/components/AppSheet.vue'
import AppSelect from '@/components/AppSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import Money from '@/components/Money.vue'
import { useDataStore } from '@/stores/data'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { amountInputValue, currencySymbol, parseAmount } from '@/lib/money'
import type { CatalogItem } from '@/types'

const data = useDataStore()
const settings = useSettingsStore()
const ui = useUiStore()

const query = ref('')
const showForm = ref(false)
const editing = ref<CatalogItem | null>(null)
const error = ref('')

const form = reactive({
  name: '',
  description: '',
  unitLabel: 'unit',
  price: 0,
  taxRate: settings.settings.defaultTaxRate,
  sku: '',
})

const unitOptions = ['unit', 'hour', 'day', 'project', 'session', 'month', 'word', 'page'].map((u) => ({
  value: u,
  label: u,
}))

const symbol = computed(() => currencySymbol(settings.currency, settings.locale))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return data.items
  return data.items.filter((i) =>
    [i.name, i.description, i.sku].filter(Boolean).join(' ').toLowerCase().includes(q),
  )
})

watch(showForm, (open) => {
  if (!open) return
  error.value = ''
  const item = editing.value
  form.name = item?.name ?? ''
  form.description = item?.description ?? ''
  form.unitLabel = item?.unitLabel ?? 'unit'
  form.price = item ? Number(amountInputValue(item.unitPrice, settings.currency)) : 0
  form.taxRate = item?.taxRate ?? settings.settings.defaultTaxRate
  form.sku = item?.sku ?? ''
})

function openNew() {
  editing.value = null
  showForm.value = true
}

function openEdit(item: CatalogItem) {
  editing.value = item
  showForm.value = true
}

async function submit() {
  if (!form.name.trim()) {
    error.value = 'Give this item a name.'
    return
  }
  await data.saveItem(
    {
      name: form.name,
      description: form.description,
      unitLabel: form.unitLabel,
      unitPrice: parseAmount(form.price, settings.currency),
      taxRate: Number(form.taxRate) || 0,
      sku: form.sku,
    },
    editing.value?.id,
  )
  showForm.value = false
  ui.toast(editing.value ? 'Item updated' : 'Item added to catalog')
}

async function remove() {
  if (!editing.value) return
  const ok = await ui.confirm({
    title: `Delete ${editing.value.name}?`,
    message: 'Invoices that already use this item are not affected.',
    confirmLabel: 'Delete item',
    danger: true,
  })
  if (!ok) return
  await data.deleteItem(editing.value.id)
  showForm.value = false
  ui.toast('Item deleted')
}
</script>

<template>
  <div class="content">
    <div class="page-head">
      <div>
        <h1 class="page-title">Catalog</h1>
        <div class="page-sub">{{ data.items.length }} reusable products &amp; services</div>
      </div>
      <button class="fab" type="button" aria-label="Add item" @click="openNew"><Plus :size="20" /></button>
    </div>

    <label class="search-box">
      <Search :size="15" />
      <input v-model="query" type="search" placeholder="Search items or SKU" />
    </label>

    <div v-if="!filtered.length" class="mt-14">
      <EmptyState
        title="Your catalog is empty"
        message="Add the things you bill for once, then drop them into any invoice with a tap."
      >
        <button class="btn primary sm" type="button" @click="openNew">Add an item</button>
      </EmptyState>
    </div>

    <button
      v-for="item in filtered"
      :key="item.id"
      class="list-row"
      type="button"
      style="width: 100%; text-align: left"
      @click="openEdit(item)"
    >
      <span class="avatar"><Package :size="15" /></span>
      <span class="row-main">
        <span class="row-title">{{ item.name }}</span>
        <span class="row-sub">
          {{ item.description || item.unitLabel }}<template v-if="item.sku"> · {{ item.sku }}</template>
        </span>
      </span>
      <span class="row-right">
        <span class="row-amount"><Money :amount="item.unitPrice" :currency="settings.currency" /></span>
        <span class="tiny dim" style="display: block; margin-top: 3px">
          per {{ item.unitLabel }} · {{ item.taxRate }}% tax
        </span>
      </span>
    </button>

    <div class="card pad mt-14" style="display: flex; gap: 11px; align-items: flex-start">
      <span class="avatar accent"><BookPlus :size="15" /></span>
      <div>
        <div style="font-size: 12px; font-weight: 600">Prices are stored per item</div>
        <div class="tiny dim" style="margin-top: 3px; line-height: 1.6">
          Changing a catalog price never rewrites invoices that already used it — line items keep the price you saved
          them with.
        </div>
      </div>
    </div>

    <AppSheet :open="showForm" :title="editing ? 'Edit item' : 'New catalog item'" wide @close="showForm = false">
      <label class="field">
        <span class="label">Name *</span>
        <input v-model="form.name" type="text" placeholder="Brand identity system" />
      </label>
      <label class="field">
        <span class="label">Description</span>
        <input v-model="form.description" type="text" placeholder="Logo suite, typography, guidelines" />
      </label>
      <div class="grid-2">
        <label class="field">
          <span class="label">Price ({{ symbol }})</span>
          <input v-model.number="form.price" type="number" min="0" step="0.01" inputmode="decimal" />
        </label>
        <label class="field">
          <span class="label">Unit</span>
          <AppSelect v-model="form.unitLabel" label="Unit" :options="unitOptions" />
        </label>
      </div>
      <div class="grid-2">
        <label class="field">
          <span class="label">Tax rate %</span>
          <input v-model.number="form.taxRate" type="number" min="0" step="0.1" inputmode="decimal" />
        </label>
        <label class="field">
          <span class="label">SKU / code</span>
          <input v-model="form.sku" type="text" placeholder="BR-100" />
        </label>
      </div>
      <p v-if="error" class="tiny" style="color: var(--danger)">{{ error }}</p>
      <div class="sheet-foot">
        <button class="btn ghost grow" type="button" @click="showForm = false">Cancel</button>
        <button class="btn primary grow" type="button" @click="submit">
          {{ editing ? 'Save item' : 'Add item' }}
        </button>
      </div>
      <button v-if="editing" class="btn danger block" type="button" style="margin-top: 8px" @click="remove">
        <Trash2 :size="14" /> Delete item
      </button>
    </AppSheet>
  </div>
</template>
