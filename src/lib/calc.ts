import type { DisplayStatus, Invoice, LineItem, Totals, TotalsLine } from '@/types'
import { daysOverdue, todayISO } from './dates'

export function lineGross(line: LineItem): number {
  return Math.round((Number(line.qty) || 0) * (Number(line.unitPrice) || 0))
}

export function lineDiscountAmount(line: LineItem): number {
  const gross = lineGross(line)
  if (!line.discountValue) return 0
  if (line.discountType === 'percent') {
    return Math.min(gross, Math.round((gross * line.discountValue) / 100))
  }
  return Math.min(gross, Math.round(line.discountValue))
}

export function lineNet(line: LineItem): number {
  return Math.max(0, lineGross(line) - lineDiscountAmount(line))
}

/**
 * All money is in minor units. Tax is exclusive, computed per line on the
 * line net minus its proportional share of the invoice-level discount, so a
 * global discount reduces the taxable base exactly as an accountant expects.
 */
export function computeTotals(invoice: {
  items: LineItem[]
  discountType: 'percent' | 'fixed'
  discountValue: number
  shipping: number
  payments?: { amount: number }[]
}): Totals {
  const nets = invoice.items.map(lineNet)
  const subtotal = nets.reduce((a, b) => a + b, 0)
  const lineDiscounts = invoice.items.reduce((a, l) => a + lineDiscountAmount(l), 0)

  let invoiceDiscount = 0
  if (subtotal > 0 && invoice.discountValue) {
    invoiceDiscount =
      invoice.discountType === 'percent'
        ? Math.min(subtotal, Math.round((subtotal * invoice.discountValue) / 100))
        : Math.min(subtotal, Math.round(invoice.discountValue))
  }

  const lines: TotalsLine[] = []
  const taxByRate = new Map<number, { base: number; amount: number }>()
  let allocated = 0

  invoice.items.forEach((line, index) => {
    const net = nets[index]
    let share = 0
    if (invoiceDiscount > 0 && subtotal > 0) {
      share =
        index === invoice.items.length - 1
          ? invoiceDiscount - allocated
          : Math.round((invoiceDiscount * net) / subtotal)
      allocated += share
    }
    const taxable = Math.max(0, net - share)
    const tax = Math.round((taxable * (Number(line.taxRate) || 0)) / 100)
    const bucket = taxByRate.get(Number(line.taxRate) || 0) ?? { base: 0, amount: 0 }
    bucket.base += taxable
    bucket.amount += tax
    taxByRate.set(Number(line.taxRate) || 0, bucket)
    lines.push({
      id: line.id,
      net,
      discount: lineDiscountAmount(line),
      taxable,
      tax,
      total: taxable + tax,
    })
  })

  const tax = lines.reduce((a, l) => a + l.tax, 0)
  const shipping = Math.round(Number(invoice.shipping) || 0)
  const total = subtotal - invoiceDiscount + tax + shipping
  const paid = (invoice.payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0)

  return {
    subtotal,
    lineDiscounts,
    invoiceDiscount,
    shipping,
    tax,
    total,
    paid,
    balance: total - paid,
    lines,
    taxByRate: [...taxByRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, v]) => ({ rate, base: v.base, amount: v.amount })),
  }
}

export function invoiceTotals(invoice: Invoice): Totals {
  return computeTotals(invoice)
}

export function displayStatus(invoice: Invoice, today = todayISO()): DisplayStatus {
  if (invoice.status === 'void') return 'void'
  if (invoice.status === 'draft') return 'draft'
  const paid = invoice.payments.reduce((a, p) => a + p.amount, 0)
  if (paid >= invoice.total && invoice.total > 0) return 'paid'
  if (invoice.status === 'paid') return 'paid'
  if (paid > 0) {
    return daysOverdue(invoice.dueDate, today) > 0 ? 'overdue' : 'partial'
  }
  if (daysOverdue(invoice.dueDate, today) > 0) return 'overdue'
  return 'sent'
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
}

export const STATUS_TONE: Record<DisplayStatus, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral',
  sent: 'info',
  partial: 'info',
  paid: 'ok',
  overdue: 'danger',
  void: 'neutral',
}
