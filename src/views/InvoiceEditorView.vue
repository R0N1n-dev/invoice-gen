<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { ArrowLeft, BookPlus, Plus, Trash2, Users } from '@lucide/vue'
import Money from '@/components/Money.vue'
import AppSheet from '@/components/AppSheet.vue'
import AppSelect from '@/components/AppSelect.vue'
import ClientForm from '@/components/ClientForm.vue'
import { useDataStore } from '@/stores/data'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { computeTotals } from '@/lib/calc'
import { addDays, todayISO } from '@/lib/dates'
import { CURRENCIES, amountInputValue, currencySymbol, parseAmount } from '@/lib/money'
import { newInvoiceDefaults } from '@/db/seed'
import { uid } from '@/lib/utils'
import type { Client, Invoice, LineItem, PdfTemplate } from '@/types'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const data = useDataStore()
const settings = useSettingsStore()
const ui = useUiStore()

const existing = props.id ? data.getInvoice(props.id) : undefined
if (props.id && !existing) router.replace('/invoices')

const blank = newInvoiceDefaults(undefined, settings.settings)
const draft = reactive<Invoice>(
  existing ? (JSON.parse(JSON.stringify(existing)) as Invoice) : blank,
)

const dirty = ref(false)
const saving = ref(false)
const showClientPicker = ref(false)
const showItemPicker = ref(false)
const showClientForm = ref(false)
const clientQuery = ref('')

watch(
  draft,
  () => {
    if (!saving.value) dirty.value = true
  },
  { deep: true },
)

const isNew = computed(() => !existing)
const currency = computed(() => draft.currency || settings.settings.currency)
const totals = computed(() => computeTotals(draft))
const selectedClient = computed(() => data.getClient(draft.clientId))
const symbol = computed(() => currencySymbol(currency.value, settings.locale))
const nextNumberPreview = computed(() =>
  `${settings.settings.invoicePrefix}-${new Date().getFullYear()}-${String(
    settings.settings.nextNumber,
  ).padStart(4, '0')}`,
)

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }))
const discountOptions = computed(() => [
  { value: 'percent', label: '%' },
  { value: 'fixed', label: symbol.value },
])

const filteredClients = computed(() => {
  const q = clientQuery.value.trim().toLowerCase()
  return q ? data.clients.filter((c) => c.name.toLowerCase().includes(q)) : data.clients
})

function markDirty() {
  dirty.value = true
}

function priceValue(line: LineItem): number {
  return Number(amountInputValue(line.unitPrice, currency.value))
}

function onPrice(line: LineItem, event: Event) {
  line.unitPrice = parseAmount((event.target as HTMLInputElement).value, currency.value)
  markDirty()
}

const invoiceDiscountValue = computed({
  get: () => {
    if (draft.discountType === 'percent') return draft.discountValue
    return Number(amountInputValue(draft.discountValue, currency.value))
  },
  set: (value: number) => {
    draft.discountValue =
      draft.discountType === 'percent' ? Number(value) : parseAmount(String(value), currency.value)
    markDirty()
  },
})

const shippingValue = computed({
  get: () => Number(amountInputValue(draft.shipping, currency.value)),
  set: (value: number) => {
    draft.shipping = parseAmount(String(value), currency.value)
    markDirty()
  },
})

function addLine() {
  draft.items.push({
    id: uid('li'),
    description: '',
    details: '',
    qty: 1,
    unitPrice: 0,
    unitLabel: 'unit',
    discountType: 'percent',
    discountValue: 0,
    taxRate: settings.settings.defaultTaxRate,
  })
  markDirty()
}

function removeLine(id: string) {
  if (draft.items.length === 1) {
    Object.assign(draft.items[0], {
      description: '',
      details: '',
      qty: 1,
      unitPrice: 0,
      discountValue: 0,
    })
    markDirty()
    return
  }
  draft.items = draft.items.filter((l) => l.id !== id)
  markDirty()
}

function setDue(days: number) {
  draft.dueDate = addDays(draft.issueDate || todayISO(), days)
  markDirty()
}

function setTemplate(template: PdfTemplate) {
  draft.template = template
  markDirty()
}

function chooseClient(client: Client) {
  draft.clientId = client.id
  draft.clientSnapshot = {
    name: client.name,
    contact: client.contact,
    email: client.email,
    address: [client.address1, [client.postal, client.city].filter(Boolean).join(' '), client.country]
      .filter(Boolean)
      .join('\n'),
    taxId: client.taxId,
  }
  if (client.currency) draft.currency = client.currency
  if (typeof client.paymentTerms === 'number') {
    draft.dueDate = addDays(draft.issueDate, client.paymentTerms)
  }
  showClientPicker.value = false
  markDirty()
}

async function createClient(payload: Partial<Client>) {
  const created = await data.saveClient({ ...payload, name: payload.name ?? '' } as Client)
  chooseClient(created)
  showClientForm.value = false
  ui.toast('Client added')
}

function addCatalogItem(itemId: string) {
  const item = data.getItem(itemId)
  if (!item) return
  draft.items.push({
    id: uid('li'),
    description: item.name,
    details: item.description ?? '',
    qty: 1,
    unitPrice: item.unitPrice,
    unitLabel: item.unitLabel,
    discountType: 'percent',
    discountValue: 0,
    taxRate: item.taxRate,
  })
  showItemPicker.value = false
  markDirty()
}

function validate(): string | null {
  if (!draft.clientId) return 'Pick a client first.'
  if (!draft.items.some((l) => l.description.trim() && l.qty > 0)) {
    return 'Add at least one line item with a description.'
  }
  if (!draft.issueDate || !draft.dueDate) return 'Set the issue and due dates.'
  return null
}

async function persist(issue: boolean) {
  const problem = validate()
  if (problem) {
    ui.toast(problem, 'err')
    return
  }
  saving.value = true
  try {
    draft.items.forEach((line) => {
      line.description = line.description.trim()
      line.details = line.details?.trim()
    })
    draft.total = totals.value.total

    let id = draft.id
    if (isNew.value) {
      const created = await data.createInvoice({ ...draft }, { issue })
      id = created.id
      dirty.value = false
      ui.toast(issue ? 'Invoice issued' : 'Invoice saved as draft')
      await router.replace(`/invoices/${id}${issue ? '' : '/edit'}`)
    } else {
      await data.updateInvoice({ ...draft })
      if (issue && draft.status === 'draft') {
        await data.setStatus(id, 'open')
        draft.status = 'open'
      }
      dirty.value = false
      ui.toast(issue ? 'Invoice issued' : 'Changes saved')
      await router.replace(`/invoices/${id}`)
    }
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'Could not save the invoice', 'err')
  } finally {
    saving.value = false
  }
}

async function removeInvoice() {
  if (isNew.value) return
  const ok = await ui.confirm({
    title: 'Delete this invoice?',
    message: 'This removes the invoice and its payment history from this device. It cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await data.deleteInvoice(draft.id)
  dirty.value = false
  ui.toast('Invoice deleted')
  await router.replace('/invoices')
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return await ui.confirm({
    title: 'Discard changes?',
    message: 'You have unsaved changes on this invoice.',
    confirmLabel: 'Discard',
    danger: true,
  })
})
</script>

<template>
  <div class="content flush" style="padding-top: calc(16px + var(--safe-top))">
    <div class="between" style="margin-bottom: 14px">
      <button class="icon-btn" type="button" aria-label="Back" @click="router.back()">
        <ArrowLeft :size="17" />
      </button>
      <div style="text-align: center">
        <div style="font-size: 13px; font-weight: 650">{{ isNew ? 'New invoice' : 'Edit invoice' }}</div>
        <div class="tiny dim mono" style="margin-top: 2px">
          {{ isNew ? 'Number assigned on save' : draft.number }}
        </div>
      </div>
      <button class="btn ghost sm" type="button" :disabled="saving" @click="persist(false)">Save</button>
    </div>

    <div class="field">
      <span class="label">Bill to</span>
      <button v-if="selectedClient" class="client-pick" type="button" @click="showClientPicker = true">
        <span class="avatar accent">{{ selectedClient.name.slice(0, 2).toUpperCase() }}</span>
        <span class="grow" style="text-align: left">
          <span class="row-title">{{ selectedClient.name }}</span>
          <span class="row-sub">{{ selectedClient.contact || selectedClient.email || 'No contact' }}</span>
        </span>
        <span class="tiny link">Change</span>
      </button>
      <button v-else class="client-pick empty-pick" type="button" @click="showClientPicker = true">
        <span class="avatar"><Users :size="15" /></span>
        <span class="grow" style="text-align: left">
          <span class="row-title">Select a client</span>
          <span class="row-sub">Or create one in a second</span>
        </span>
        <span class="tiny link">Choose</span>
      </button>
    </div>

    <div class="grid-2">
      <label class="field">
        <span class="label">Issue date</span>
        <input v-model="draft.issueDate" type="date" @change="markDirty" />
      </label>
      <label class="field">
        <span class="label">Due date</span>
        <input v-model="draft.dueDate" type="date" @change="markDirty" />
      </label>
    </div>
    <div class="row wrap" style="margin: -4px 0 12px">
      <button v-for="d in [0, 7, 14, 30]" :key="d" class="chip" type="button" @click="setDue(d)">
        {{ d === 0 ? 'On receipt' : `Net ${d}` }}
      </button>
    </div>

    <div class="grid-2">
      <label class="field">
        <span class="label">Currency</span>
        <AppSelect v-model="draft.currency" label="Currency" :options="currencyOptions" @update:model-value="markDirty" />
      </label>
      <label class="field">
        <span class="label">PO number</span>
        <input v-model="draft.poNumber" type="text" placeholder="Optional" />
      </label>
    </div>

    <div class="section-head">
      <h2>Line items</h2>
      <button class="section-link" type="button" style="display: flex; align-items: center; gap: 4px" @click="showItemPicker = true">
        <BookPlus :size="13" /> Catalog
      </button>
    </div>

    <div v-for="(line, index) in draft.items" :key="line.id" class="line-item">
      <div class="line-top">
        <input v-model="line.description" type="text" placeholder="What are you charging for?" @input="markDirty" />
        <button class="icon-btn" type="button" aria-label="Remove line" style="width: 32px; height: 32px" @click="removeLine(line.id)">
          <Trash2 :size="14" />
        </button>
      </div>
      <input
        v-model="line.details"
        class="details-input"
        type="text"
        placeholder="Optional description shown under the title"
        @input="markDirty"
      />
      <div class="line-grid">
        <label>
          <span>Qty</span>
          <input v-model.number="line.qty" type="number" min="0" step="0.01" inputmode="decimal" @input="markDirty" />
        </label>
        <label>
          <span>Price ({{ symbol }})</span>
          <input type="number" :value="priceValue(line)" min="0" step="0.01" inputmode="decimal" @input="onPrice(line, $event)" />
        </label>
        <label>
          <span>Tax %</span>
          <input v-model.number="line.taxRate" type="number" min="0" step="0.1" inputmode="decimal" @input="markDirty" />
        </label>
        <label>
          <span>Disc %</span>
          <input v-model.number="line.discountValue" type="number" min="0" max="100" step="1" inputmode="decimal" @input="markDirty" />
        </label>
      </div>
      <div class="between" style="margin-top: 7px">
        <span class="tiny dim">Line total</span>
        <span class="tiny" style="font-weight: 600">
          <Money :amount="totals.lines[index]?.total ?? 0" :currency="currency" />
        </span>
      </div>
    </div>

    <div class="row" style="gap: 8px">
      <button class="btn ghost grow" type="button" @click="addLine"><Plus :size="14" /> Add line</button>
      <button class="btn ghost grow" type="button" @click="showItemPicker = true"><BookPlus :size="14" /> From catalog</button>
    </div>

    <div class="grid-2 mt-14">
      <label class="field">
        <span class="label">Invoice discount</span>
        <div class="row">
          <AppSelect v-model="draft.discountType" label="Discount type" compact :options="discountOptions" @update:model-value="markDirty" />
          <input v-model.number="invoiceDiscountValue" type="number" min="0" step="0.01" inputmode="decimal" />
        </div>
      </label>
      <label class="field">
        <span class="label">Shipping ({{ symbol }})</span>
        <input v-model.number="shippingValue" type="number" min="0" step="0.01" inputmode="decimal" />
      </label>
    </div>

    <div class="field">
      <span class="label">PDF template</span>
      <div class="filters">
        <button
          v-for="t in (['modern', 'classic', 'minimal'] as PdfTemplate[])"
          :key="t"
          class="chip"
          :class="{ on: draft.template === t }"
          type="button"
          style="text-transform: capitalize"
          @click="setTemplate(t)"
        >
          {{ t }}
        </button>
      </div>
    </div>

    <div class="summary">
      <div class="sum-row"><span>Subtotal</span><span><Money :amount="totals.subtotal" :currency="currency" /></span></div>
      <div v-if="totals.invoiceDiscount" class="sum-row">
        <span>Discount</span><span>−<Money :amount="totals.invoiceDiscount" :currency="currency" /></span>
      </div>
      <div v-if="totals.shipping" class="sum-row">
        <span>Shipping</span><span><Money :amount="totals.shipping" :currency="currency" /></span>
      </div>
      <div v-for="rate in totals.taxByRate" :key="rate.rate" class="sum-row">
        <span>Tax {{ rate.rate }}%</span><span><Money :amount="rate.amount" :currency="currency" /></span>
      </div>
      <div class="sum-row sum-total">
        <span>Total</span><b><Money :amount="totals.total" :currency="currency" /></b>
      </div>
    </div>

    <div class="section-head"><h2>Notes &amp; terms</h2></div>
    <label class="field">
      <span class="label">Notes shown on the PDF</span>
      <textarea v-model="draft.notes" rows="3" placeholder="Thank you for your business…" @input="markDirty"></textarea>
    </label>
    <label class="field">
      <span class="label">Terms</span>
      <textarea v-model="draft.terms" rows="2" placeholder="Payment is due within 14 days…" @input="markDirty"></textarea>
    </label>

    <button v-if="!isNew" class="btn danger block mt-8" type="button" @click="removeInvoice">
      <Trash2 :size="14" /> Delete invoice
    </button>

    <div style="height: 24px"></div>

    <div class="dock">
      <button v-if="draft.status === 'draft'" class="btn ghost" type="button" :disabled="saving" @click="persist(false)">
        Save draft
      </button>
      <button v-else class="btn ghost" type="button" @click="router.push(`/invoices/${draft.id}`)">Preview</button>
      <button class="btn primary grow" type="button" :disabled="saving" @click="persist(draft.status === 'draft')">
        {{ saving ? 'Saving…' : draft.status === 'draft' ? 'Issue invoice' : 'Save changes' }}
      </button>
    </div>

    <AppSheet :open="showClientPicker" title="Bill to" subtitle="Pick a client for this invoice" @close="showClientPicker = false">
      <label class="search-box">
        <Users :size="15" />
        <input v-model="clientQuery" type="search" placeholder="Search clients" />
      </label>
      <div class="scrim-list">
        <button v-for="c in filteredClients" :key="c.id" class="quick" type="button" @click="chooseClient(c)">
          <span class="avatar accent">{{ c.name.slice(0, 2).toUpperCase() }}</span>
          <span class="grow" style="text-align: left">
            <span class="row-title">{{ c.name }}</span>
            <span class="row-sub">{{ c.contact || c.email || 'No contact details' }}</span>
          </span>
        </button>
      </div>
      <p v-if="!filteredClients.length" class="tiny dim" style="margin-top: 12px">No clients match.</p>
      <template #footer>
        <button class="btn primary block" type="button" @click="showClientForm = true">
          <Plus :size="14" /> New client
        </button>
      </template>
    </AppSheet>

    <AppSheet :open="showItemPicker" title="Add from catalog" subtitle="Reusable products and services" @close="showItemPicker = false">
      <div class="scrim-list">
        <button v-for="item in data.items" :key="item.id" class="quick" type="button" @click="addCatalogItem(item.id)">
          <span class="qi a"><BookPlus :size="14" /></span>
          <span class="grow" style="text-align: left">
            <span class="row-title">{{ item.name }}</span>
            <span class="row-sub">{{ item.description || item.unitLabel }}</span>
          </span>
          <span class="tiny" style="font-weight: 600"><Money :amount="item.unitPrice" :currency="currency" /></span>
        </button>
      </div>
      <p v-if="!data.items.length" class="tiny dim" style="margin-top: 12px">
        Your catalog is empty — add items in the Items tab.
      </p>
      <template #footer>
        <button class="btn ghost block" type="button" @click="showItemPicker = false; router.push('/catalog')">
          Manage catalog
        </button>
      </template>
    </AppSheet>

    <AppSheet :open="showClientForm" title="New client" wide @close="showClientForm = false">
      <ClientForm @save="createClient" @cancel="showClientForm = false" />
    </AppSheet>
  </div>
</template>

<style scoped>
.client-pick {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 11px 12px;
  text-align: left;
}
.empty-pick {
  border-style: dashed;
  background: transparent;
}
.details-input {
  margin-top: 7px;
  font-size: 12px;
  padding: 8px 10px;
  background: var(--field);
  border-color: var(--line);
}
.line-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
  margin-top: 8px;
}
.line-grid label {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.line-grid span {
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 600;
}
.line-grid input {
  padding: 7px 8px;
  font-size: 12px;
  border-radius: 8px;
  background: var(--field);
  border-color: var(--line);
}
</style>
