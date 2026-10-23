export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void'
export type DisplayStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void'
export type DiscountType = 'percent' | 'fixed'
export type PdfTemplate = 'modern' | 'classic' | 'minimal'

export interface Payment {
  id: string
  date: string
  amount: number
  method: string
  note?: string
}

export interface LineItem {
  id: string
  description: string
  details?: string
  qty: number
  unitLabel?: string
  unitPrice: number
  discountType: DiscountType
  discountValue: number
  taxRate: number
}

export interface ClientSnapshot {
  name: string
  contact?: string
  email?: string
  address?: string
  taxId?: string
}

export interface Invoice {
  id: string
  number: string
  clientId: string
  clientSnapshot: ClientSnapshot
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: string
  items: LineItem[]
  discountType: DiscountType
  discountValue: number
  shipping: number
  notes: string
  terms: string
  poNumber: string
  template: PdfTemplate
  payments: Payment[]
  sentAt?: string
  paidAt?: string
  createdAt: string
  updatedAt: string
  total: number
}

export interface Client {
  id: string
  name: string
  contact?: string
  email?: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  postal?: string
  country?: string
  taxId?: string
  currency?: string
  paymentTerms?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CatalogItem {
  id: string
  name: string
  description?: string
  unitLabel: string
  unitPrice: number
  taxRate: number
  sku?: string
  createdAt: string
  updatedAt: string
}

export interface Business {
  name: string
  legalName?: string
  email?: string
  phone?: string
  website?: string
  address1?: string
  address2?: string
  city?: string
  postal?: string
  country?: string
  taxId?: string
  bankName?: string
  accountName?: string
  iban?: string
  bic?: string
  logo?: string
  accent: string
  footerNote?: string
}

export interface Settings {
  currency: string
  locale: string
  dateFormat: 'medium' | 'short' | 'iso'
  invoicePrefix: string
  numberWithYear: boolean
  nextNumber: number
  defaultTaxRate: number
  paymentTermsDays: number
  defaultNotes: string
  defaultTerms: string
  defaultTemplate: PdfTemplate
  autoBackup: boolean
  onboarded: boolean
}

export interface TotalsLine {
  id: string
  net: number
  discount: number
  taxable: number
  tax: number
  total: number
}

export interface Totals {
  subtotal: number
  lineDiscounts: number
  invoiceDiscount: number
  shipping: number
  tax: number
  total: number
  paid: number
  balance: number
  lines: TotalsLine[]
  taxByRate: { rate: number; base: number; amount: number }[]
}
