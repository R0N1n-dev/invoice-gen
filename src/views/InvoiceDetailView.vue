<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Download,
  Pencil,
  Plus,
  Send,
  Share2,
  Trash2,
  Wallet,
} from '@lucide/vue'
import Money from '@/components/Money.vue'
import StatusPill from '@/components/StatusPill.vue'
import AppSheet from '@/components/AppSheet.vue'
import AppSelect from '@/components/AppSelect.vue'
import InvoicePreview from '@/components/InvoicePreview.vue'
import { useDataStore } from '@/stores/data'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { computeTotals, displayStatus } from '@/lib/calc'
import { formatDate, relativeDueLabel, todayISO } from '@/lib/dates'
import { amountInputValue, parseAmount, currencySymbol } from '@/lib/money'
import { savePdf, sharePdf } from '@/lib/native'
import type { PdfTemplate } from '@/types'

const props = defineProps<{ id: string }>()
const router = useRouter()
const data = useDataStore()
const settings = useSettingsStore()
const ui = useUiStore()

const invoice = computed(() => data.getInvoice(props.id))
const totals = computed(() => (invoice.value ? computeTotals(invoice.value) : null))
const status = computed(() => (invoice.value ? displayStatus(invoice.value) : 'draft'))
const symbol = computed(() => currencySymbol(invoice.value?.currency ?? 'USD', settings.locale))
const dt = (iso: string) => formatDate(iso, settings.locale, settings.dateFormat)

const methodOptions = ['Bank transfer', 'Cash', 'Credit card', 'PayPal', 'Stripe', 'Other'].map((m) => ({
  value: m,
  label: m,
}))

const busy = ref(false)
const showPay = ref(false)
const payAmount = ref(0)
const payDate = ref(todayISO())
const payMethod = ref('Bank transfer')
const payNote = ref('')

async function setTemplate(template: PdfTemplate) {
  if (!invoice.value) return
  await data.updateInvoice({ ...invoice.value, template })
}

async function generate(mode: 'save' | 'share') {
  if (!invoice.value) return
  busy.value = true
  try {
    const { buildInvoicePdf, pdfFilename } = await import('@/lib/pdf')
    const bytes = await buildInvoicePdf({
      invoice: invoice.value,
      business: settings.business,
      settings: settings.settings,
      template: invoice.value.template,
    })
    const name = pdfFilename(invoice.value)
    const result =
      mode === 'share'
        ? await sharePdf(name, bytes, `${invoice.value.number} · ${invoice.value.clientSnapshot.name}`)
        : await savePdf(name, bytes)
    if (result.ok) {
      ui.toast(mode === 'share' ? 'Share sheet opened' : `Saved to ${result.location ?? 'your device'}`)
    } else {
      ui.toast(result.error ?? 'Could not create the PDF', 'err')
    }
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'PDF generation failed', 'err')
  } finally {
    busy.value = false
  }
}

async function issue() {
  if (!invoice.value) return
  await data.setStatus(invoice.value.id, 'open')
  ui.toast('Invoice marked as sent')
}

async function markPaid() {
  if (!invoice.value) return
  await data.markPaid(invoice.value.id)
  ui.toast('Invoice marked as paid')
}

async function duplicate() {
  if (!invoice.value) return
  const copy = await data.duplicateInvoice(invoice.value.id)
  if (copy) {
    ui.toast('Duplicated as a new draft')
    router.push(`/invoices/${copy.id}/edit`)
  }
}

async function remove() {
  if (!invoice.value) return
  const ok = await ui.confirm({
    title: 'Delete this invoice?',
    message: `${invoice.value.number} and its payment history will be removed from this device.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await data.deleteInvoice(invoice.value.id)
  ui.toast('Invoice deleted')
  router.replace('/invoices')
}

async function voidInvoice() {
  if (!invoice.value) return
  const ok = await ui.confirm({
    title: 'Void this invoice?',
    message: 'A void invoice stays in your records but is excluded from outstanding totals.',
    confirmLabel: 'Void invoice',
    danger: true,
  })
  if (!ok) return
  await data.setStatus(invoice.value.id, 'void')
  ui.toast('Invoice voided')
}

function openPayment() {
  if (!totals.value) return
  payAmount.value = Number(amountInputValue(totals.value.balance, invoice.value?.currency ?? 'USD'))
  payDate.value = todayISO()
  payMethod.value = 'Bank transfer'
  payNote.value = ''
  showPay.value = true
}

async function addPayment() {
  if (!invoice.value) return
  const amount = parseAmount(payAmount.value, invoice.value.currency)
  if (amount <= 0) {
    ui.toast('Enter a payment amount', 'err')
    return
  }
  await data.addPayment(invoice.value.id, {
    amount,
    date: payDate.value,
    method: payMethod.value,
    note: payNote.value.trim() || undefined,
  })
  showPay.value = false
  ui.toast('Payment recorded')
}

async function removePayment(paymentId: string) {
  if (!invoice.value) return
  const ok = await ui.confirm({
    title: 'Remove this payment?',
    message: 'The invoice balance will be recalculated.',
    confirmLabel: 'Remove',
    danger: true,
  })
  if (!ok) return
  await data.removePayment(invoice.value.id, paymentId)
  ui.toast('Payment removed')
}
</script>

<template>
  <div v-if="invoice && totals" class="content wide">
    <div class="between" style="margin-bottom: 14px">
      <button class="icon-btn" type="button" aria-label="Back" @click="router.push('/invoices')">
        <ArrowLeft :size="17" />
      </button>
      <div style="text-align: center">
        <div class="mono" style="font-size: 12.5px; font-weight: 600">{{ invoice.number }}</div>
        <div class="tiny dim" style="margin-top: 2px">{{ dt(invoice.issueDate) }}</div>
      </div>
      <StatusPill :status="status" />
    </div>

    <div class="timeline">
      <span :class="{ done: invoice.status !== 'draft' }">{{ invoice.status === 'draft' ? 'Draft' : 'Issued' }}</span>
      <span
        :class="{
          done: invoice.sentAt || status === 'paid',
          now: status === 'sent' || status === 'overdue' || status === 'partial',
        }"
      >
        Sent
      </span>
      <span :class="{ done: totals.paid > 0, now: status === 'partial' }">Part paid</span>
      <span :class="{ done: status === 'paid', now: status === 'paid' }">Paid</span>
    </div>

    <div class="detail-grid">
      <div>
        <div class="pdf-stage">
          <InvoicePreview
            :invoice="invoice"
            :business="settings.business"
            :locale="settings.locale"
            :date-format="settings.dateFormat"
          />
        </div>
        <div class="filters mt-8" style="justify-content: center">
          <button
            v-for="t in (['modern', 'classic', 'minimal'] as PdfTemplate[])"
            :key="t"
            class="chip"
            :class="{ on: invoice.template === t }"
            type="button"
            style="text-transform: capitalize"
            @click="setTemplate(t)"
          >
            {{ t }}
          </button>
        </div>
        <div class="row mt-8">
          <button class="btn ghost grow" type="button" :disabled="busy" @click="generate('share')">
            <Share2 :size="14" /> Share
          </button>
          <button class="btn primary grow" type="button" :disabled="busy" @click="generate('save')">
            <Download :size="14" /> {{ busy ? 'Building…' : 'Save PDF' }}
          </button>
        </div>
      </div>

      <div>
        <div class="card pad">
          <div class="between" style="align-items: baseline">
            <span class="eyebrow">Balance due</span>
            <span class="tiny dim">{{ relativeDueLabel(invoice.dueDate) }}</span>
          </div>
          <div class="balance num">
            <Money :amount="totals.balance > 0 ? totals.balance : 0" :currency="invoice.currency" />
          </div>
          <div class="sum-row">
            <span>Total</span><span><Money :amount="totals.total" :currency="invoice.currency" /></span>
          </div>
          <div class="sum-row">
            <span>Paid</span><span><Money :amount="totals.paid" :currency="invoice.currency" /></span>
          </div>
          <div class="row mt-14" style="gap: 8px">
            <button
              v-if="status !== 'paid' && invoice.status !== 'void'"
              class="btn primary grow"
              type="button"
              @click="openPayment"
            >
              <Plus :size="14" /> Add payment
            </button>
            <button
              v-if="status !== 'paid' && invoice.status !== 'void'"
              class="btn ghost"
              type="button"
              @click="markPaid"
            >
              <Check :size="14" /> Mark paid
            </button>
          </div>
          <button v-if="invoice.status === 'draft'" class="btn primary block mt-8" type="button" @click="issue">
            <Send :size="14" /> Mark as sent
          </button>
        </div>

        <div class="section-head">
          <h2>Payments</h2>
          <span class="tiny dim">{{ invoice.payments.length }} recorded</span>
        </div>
        <div class="list">
          <div v-for="p in invoice.payments" :key="p.id" class="pay-row">
            <div class="avatar"><CreditCard :size="14" /></div>
            <div class="grow">
              <div style="font-size: 12px; font-weight: 600">
                <Money :amount="p.amount" :currency="invoice.currency" />
              </div>
              <div class="tiny dim">{{ dt(p.date) }} · {{ p.method }}</div>
            </div>
            <button
              class="icon-btn"
              type="button"
              aria-label="Remove payment"
              style="width: 32px; height: 32px"
              @click="removePayment(p.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
          <div v-if="!invoice.payments.length" class="tiny dim" style="padding: 14px 0">
            No payments recorded yet.
          </div>
        </div>

        <div class="section-head"><h2>Details</h2></div>
        <div class="card pad">
          <div class="kv"><span class="k">Client</span><span class="v">{{ invoice.clientSnapshot.name }}</span></div>
          <div v-if="invoice.clientSnapshot.contact" class="kv">
            <span class="k">Contact</span><span class="v">{{ invoice.clientSnapshot.contact }}</span>
          </div>
          <div v-if="invoice.clientSnapshot.email" class="kv">
            <span class="k">Email</span><span class="v">{{ invoice.clientSnapshot.email }}</span>
          </div>
          <div class="kv"><span class="k">Issued</span><span class="v">{{ dt(invoice.issueDate) }}</span></div>
          <div class="kv"><span class="k">Due</span><span class="v">{{ dt(invoice.dueDate) }}</span></div>
          <div v-if="invoice.poNumber" class="kv">
            <span class="k">PO number</span><span class="v">{{ invoice.poNumber }}</span>
          </div>
          <div class="kv"><span class="k">Currency</span><span class="v">{{ invoice.currency }} · {{ symbol }}</span></div>
          <div class="kv"><span class="k">Line items</span><span class="v">{{ invoice.items.length }}</span></div>
        </div>

        <div class="row mt-14" style="gap: 8px">
          <button class="btn ghost grow" type="button" @click="router.push(`/invoices/${invoice.id}/edit`)">
            <Pencil :size="14" /> Edit
          </button>
          <button class="btn ghost grow" type="button" @click="duplicate"><Copy :size="14" /> Duplicate</button>
        </div>
        <div class="row mt-8" style="gap: 8px">
          <button class="btn ghost grow" type="button" @click="voidInvoice"><Wallet :size="14" /> Void</button>
          <button class="btn danger grow" type="button" @click="remove"><Trash2 :size="14" /> Delete</button>
        </div>
      </div>
    </div>

    <AppSheet
      :open="showPay"
      title="Record a payment"
      :subtitle="`Balance ${symbol}${amountInputValue(totals.balance, invoice.currency)}`"
      @close="showPay = false"
    >
      <div class="grid-2">
        <label class="field">
          <span class="label">Amount ({{ invoice.currency }})</span>
          <input v-model.number="payAmount" type="number" min="0" step="0.01" inputmode="decimal" />
        </label>
        <label class="field">
          <span class="label">Date received</span>
          <input v-model="payDate" type="date" />
        </label>
      </div>
      <label class="field">
        <span class="label">Method</span>
        <AppSelect v-model="payMethod" label="Payment method" :options="methodOptions" />
      </label>
      <label class="field">
        <span class="label">Note</span>
        <input v-model="payNote" type="text" placeholder="Reference or note" />
      </label>
      <template #footer>
        <button class="btn ghost grow" type="button" @click="showPay = false">Cancel</button>
        <button class="btn primary grow" type="button" @click="addPayment">Record payment</button>
      </template>
    </AppSheet>
  </div>

  <div v-else class="content">
    <div class="empty">
      <h3>Invoice not found</h3>
      <p>It may have been deleted on this device.</p>
      <button class="btn primary sm" type="button" @click="router.push('/invoices')">Back to invoices</button>
    </div>
  </div>
</template>

<style scoped>
.balance {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.04em;
  margin: 6px 0 12px;
}
</style>
