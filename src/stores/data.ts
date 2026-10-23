import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CatalogItem, Client, Invoice, Payment } from '@/types'
import { db } from '@/db/db'
import { makeNumber } from '@/db/seed'
import { computeTotals, displayStatus } from '@/lib/calc'
import { daysOverdue, lastMonths, todayISO } from '@/lib/dates'
import { uid } from '@/lib/utils'
import { useSettingsStore } from './settings'

export const useDataStore = defineStore('data', () => {
  const clients = ref<Client[]>([])
  const items = ref<CatalogItem[]>([])
  const invoices = ref<Invoice[]>([])
  const loaded = ref(false)
  const revision = ref(0)

  /** Vue proxies cannot be structured-cloned into IndexedDB — strip them. */
  function plain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  function touch() {
    revision.value++
  }

  async function load() {
    const [c, i, v] = await Promise.all([db.clients.toArray(), db.items.toArray(), db.invoices.toArray()])
    clients.value = c.sort((a, b) => a.name.localeCompare(b.name))
    items.value = i.sort((a, b) => a.name.localeCompare(b.name))
    invoices.value = v.sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))
    loaded.value = true
    touch()
  }

  function getClient(id: string): Client | undefined {
    return clients.value.find((c) => c.id === id)
  }
  function getInvoice(id: string): Invoice | undefined {
    return invoices.value.find((i) => i.id === id)
  }
  function getItem(id: string): CatalogItem | undefined {
    return items.value.find((i) => i.id === id)
  }

  /* ---------------- clients ---------------- */
  async function saveClient(input: Partial<Client> & { name: string }, id?: string): Promise<Client> {
    const now = new Date().toISOString()
    const existing = id ? getClient(id) : undefined
    const client: Client = {
      id: existing?.id ?? uid('cli'),
      name: input.name.trim(),
      contact: input.contact?.trim() || undefined,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      address1: input.address1?.trim() || undefined,
      address2: input.address2?.trim() || undefined,
      city: input.city?.trim() || undefined,
      postal: input.postal?.trim() || undefined,
      country: input.country?.trim() || undefined,
      taxId: input.taxId?.trim() || undefined,
      currency: input.currency || undefined,
      paymentTerms: input.paymentTerms,
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await db.clients.put(client)
    const idx = clients.value.findIndex((c) => c.id === client.id)
    if (idx >= 0) clients.value[idx] = client
    else clients.value = [...clients.value, client].sort((a, b) => a.name.localeCompare(b.name))
    touch()
    return client
  }

  async function deleteClient(id: string) {
    await db.clients.delete(id)
    clients.value = clients.value.filter((c) => c.id !== id)
    touch()
  }

  async function deleteItem(id: string) {
    await db.items.delete(id)
    items.value = items.value.filter((i) => i.id !== id)
    touch()
  }

  /* ---------------- catalog ---------------- */
  async function saveItem(input: Partial<CatalogItem> & { name: string }, id?: string): Promise<CatalogItem> {
    const now = new Date().toISOString()
    const existing = id ? getItem(id) : undefined
    const item: CatalogItem = {
      id: existing?.id ?? uid('itm'),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      unitLabel: input.unitLabel?.trim() || 'unit',
      unitPrice: Math.max(0, Math.round(input.unitPrice ?? 0)),
      taxRate: Number(input.taxRate ?? 0),
      sku: input.sku?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await db.items.put(item)
    const idx = items.value.findIndex((i) => i.id === item.id)
    if (idx >= 0) items.value[idx] = item
    else items.value = [...items.value, item].sort((a, b) => a.name.localeCompare(b.name))
    touch()
    return item
  }

  /* ---------------- invoices ---------------- */
  async function createInvoice(draft: Invoice, opts: { issue: boolean } = { issue: false }): Promise<Invoice> {
    const settings = useSettingsStore()
    const seq = await settings.consumeNumber()
    const source = plain(draft)
    const totals = computeTotals(source)
    const now = new Date().toISOString()
    const invoice: Invoice = {
      ...source,
      id: source.id || uid('inv'),
      number: makeNumber(settings.settings.invoicePrefix, settings.settings.numberWithYear, seq),
      status: opts.issue ? 'open' : 'draft',
      sentAt: opts.issue ? now : undefined,
      createdAt: source.createdAt || now,
      updatedAt: now,
      total: totals.total,
    }
    await db.invoices.put(plain(invoice))
    invoices.value = [invoice, ...invoices.value].sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))
    touch()
    return invoice
  }

  async function updateInvoice(input: Invoice): Promise<Invoice> {
    const source = plain(input)
    const totals = computeTotals(source)
    const invoice: Invoice = { ...source, total: totals.total, updatedAt: new Date().toISOString() }
    await db.invoices.put(plain(invoice))
    const idx = invoices.value.findIndex((i) => i.id === invoice.id)
    if (idx >= 0) invoices.value[idx] = invoice
    touch()
    return invoice
  }

  async function setStatus(id: string, status: Invoice['status']) {
    const inv = getInvoice(id)
    if (!inv) return
    const now = new Date().toISOString()
    const patch: Invoice = { ...inv, status }
    if (status === 'open' && !inv.sentAt) patch.sentAt = now
    if (status === 'paid') patch.paidAt = now
    if (status === 'void') patch.paidAt = undefined
    await updateInvoice(patch)
  }

  async function deleteInvoice(id: string) {
    await db.invoices.delete(id)
    invoices.value = invoices.value.filter((i) => i.id !== id)
    touch()
  }

  async function duplicateInvoice(id: string): Promise<Invoice | undefined> {
    const source = getInvoice(id)
    if (!source) return
    const clone = JSON.parse(JSON.stringify(source)) as Invoice
    const copy: Invoice = {
      ...clone,
      id: uid('inv'),
      status: 'draft',
      payments: [],
      sentAt: undefined,
      paidAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: clone.items.map((l) => ({ ...l, id: uid('li') })),
    }
    return createInvoice(copy)
  }

  async function addPayment(id: string, payment: Omit<Payment, 'id'>) {
    const inv = getInvoice(id)
    if (!inv) return
    const payments = [
      ...inv.payments,
      { id: uid('pay'), ...payment, amount: Math.max(0, Math.round(payment.amount)) },
    ]
    const totals = computeTotals({ ...inv, payments })
    const patch: Invoice = { ...inv, payments }
    if (totals.balance <= 0) {
      patch.status = 'paid'
      patch.paidAt = new Date().toISOString()
    } else if (inv.status === 'paid') {
      patch.status = 'open'
      patch.paidAt = undefined
    }
    await updateInvoice(patch)
  }

  async function removePayment(id: string, paymentId: string) {
    const inv = getInvoice(id)
    if (!inv) return
    const payments = inv.payments.filter((p) => p.id !== paymentId)
    const totals = computeTotals({ ...inv, payments })
    const patch: Invoice = { ...inv, payments }
    if (totals.balance > 0 && inv.status === 'paid') {
      patch.status = 'open'
      patch.paidAt = undefined
    }
    await updateInvoice(patch)
  }

  async function markPaid(id: string) {
    const inv = getInvoice(id)
    if (!inv) return
    const totals = computeTotals(inv)
    if (totals.balance > 0) {
      await addPayment(id, {
        date: todayISO(),
        amount: totals.balance,
        method: 'Bank transfer',
        note: 'Marked as paid',
      })
    } else {
      await setStatus(id, 'paid')
    }
  }


  /* ---------------- derived ---------------- */
  const openInvoices = computed(() => invoices.value.filter((i) => i.status === 'open'))
  const outstanding = computed(() =>
    openInvoices.value.reduce((sum, i) => sum + computeTotals(i).balance, 0),
  )
  const overdueInvoices = computed(() =>
    openInvoices.value.filter((i) => computeTotals(i).balance > 0 && daysOverdue(i.dueDate) > 0),
  )
  const overdueTotal = computed(() =>
    overdueInvoices.value.reduce((sum, i) => sum + computeTotals(i).balance, 0),
  )
  const draftInvoices = computed(() => invoices.value.filter((i) => i.status === 'draft'))
  const draftTotal = computed(() => draftInvoices.value.reduce((sum, i) => sum + i.total, 0))

  const paidThisYear = computed(() => {
    const year = String(new Date().getFullYear())
    return invoices.value.reduce(
      (sum, inv) =>
        sum +
        inv.payments.filter((p) => p.date.slice(0, 4) === year).reduce((a, p) => a + p.amount, 0),
      0,
    )
  })

  const paidCount = computed(() => invoices.value.filter((i) => i.status === 'paid').length)

  const monthly = computed(() =>
    lastMonths(6).map((m) => {
      const total = invoices.value
        .filter((i) => i.issueDate.slice(0, 7) === m.key && i.status !== 'void' && i.status !== 'draft')
        .reduce((sum, i) => sum + i.total, 0)
      return { ...m, total }
    }),
  )

  const recent = computed(() =>
    [...invoices.value].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 4),
  )

  function clientBalance(clientId: string): number {
    return invoices.value
      .filter((i) => i.clientId === clientId && i.status === 'open')
      .reduce((sum, i) => sum + computeTotals(i).balance, 0)
  }

  function clientStats(clientId: string) {
    const list = invoices.value.filter((i) => i.clientId === clientId)
    return {
      count: list.length,
      billed: list.filter((i) => i.status !== 'void').reduce((a, i) => a + i.total, 0),
      outstanding: clientBalance(clientId),
      last: list[0]?.issueDate,
    }
  }

  const statusCounts = computed(() => {
    const counts = { draft: 0, sent: 0, partial: 0, paid: 0, overdue: 0, void: 0 }
    for (const inv of invoices.value) counts[displayStatus(inv)]++
    return counts
  })

  return {
    clients,
    items,
    invoices,
    loaded,
    revision,
    load,
    getClient,
    getInvoice,
    getItem,
    saveClient,
    deleteClient,
    saveItem,
    deleteItem,
    createInvoice,
    updateInvoice,
    setStatus,
    deleteInvoice,
    duplicateInvoice,
    addPayment,
    removePayment,
    markPaid,
    openInvoices,
    outstanding,
    overdueInvoices,
    overdueTotal,
    draftInvoices,
    draftTotal,
    paidThisYear,
    paidCount,
    monthly,
    recent,
    clientBalance,
    clientStats,
    statusCounts,
  }
})
