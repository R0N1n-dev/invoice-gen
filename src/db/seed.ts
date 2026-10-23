import type { Business, CatalogItem, Client, Invoice, LineItem, Settings } from '@/types'
import { computeTotals } from '@/lib/calc'
import { addDays, todayISO, toISODate } from '@/lib/dates'
import { uid } from '@/lib/utils'
import { db } from './db'

export const DEFAULT_BUSINESS: Business = {
  name: 'Northwind Studio',
  legalName: '',
  email: 'hello@northwind.studio',
  phone: '+351 912 000 118',
  website: 'northwind.studio',
  address1: 'Rua da Boavista 12',
  address2: '',
  city: 'Lisbon',
  postal: '1200-066',
  country: 'Portugal',
  taxId: 'PT512884221',
  bankName: 'Banco Comercial Portugues',
  accountName: 'Northwind Studio Lda',
  iban: 'PT50 0002 0123 1234 5678 9012 3',
  bic: 'BCOMPTPL',
  logo: '',
  accent: '#7C93FF',
  footerNote: 'Thank you for your business.',
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'USD',
  locale: 'en-US',
  dateFormat: 'medium',
  invoicePrefix: 'INV',
  numberWithYear: true,
  nextNumber: 1,
  defaultTaxRate: 8.5,
  paymentTermsDays: 14,
  defaultNotes: 'Thank you for your business. Payment by bank transfer, Net 14.',
  defaultTerms:
    'Payment is due within 14 days of the issue date. Please reference the invoice number with your transfer.',
  defaultTemplate: 'modern',
  autoBackup: true,
  onboarded: false,
}

const DAY = 86_400_000

function isoOffset(days: number): string {
  return toISODate(new Date(Date.now() + days * DAY))
}

export function makeNumber(prefix: string, withYear: boolean, n: number): string {
  const seq = String(n).padStart(4, '0')
  return withYear ? `${prefix}-${new Date().getFullYear()}-${seq}` : `${prefix}-${seq}`
}

function line(description: string, qty: number, unitPrice: number, taxRate: number, details = ''): LineItem {
  return {
    id: uid('li'),
    description,
    details,
    qty,
    unitPrice,
    unitLabel: 'unit',
    discountType: 'percent',
    discountValue: 0,
    taxRate,
  }
}

interface SeedSpec {
  client: number
  issue: string
  due: string
  status: Invoice['status']
  items: LineItem[]
  discount?: { type: 'percent' | 'fixed'; value: number }
  partial?: number
  number: string
}

export async function seedDemoData(): Promise<{ clients: Client[]; items: CatalogItem[]; invoices: Invoice[] }> {
  const now = new Date().toISOString()
  const C = (name: string, extra: Partial<Client> = {}): Client => ({
    id: uid('cli'),
    name,
    currency: 'USD',
    paymentTerms: 14,
    country: 'Portugal',
    createdAt: now,
    updatedAt: now,
    ...extra,
  })

  const clients: Client[] = [
    C('Halcyon Coffee', {
      contact: 'Marta Silva',
      email: 'marta@halcyon.coffee',
      phone: '+351 913 552 087',
      address1: 'Rua do Alecrim 44',
      city: 'Lisbon',
      postal: '1200-018',
      taxId: 'PT509887341',
    }),
    C('Mira & Co.', {
      contact: 'Ines Duarte',
      email: 'ines@mira.co',
      address1: 'Avenida da Liberdade 210',
      city: 'Lisbon',
      postal: '1250-147',
      taxId: 'PT511223989',
    }),
    C('Northgate Labs', {
      contact: 'Tom Ferreira',
      email: 'billing@northgate.dev',
      address1: '12 Old Street',
      city: 'London',
      postal: 'EC1V 9BD',
      country: 'United Kingdom',
      taxId: 'GB412 887 221',
      paymentTerms: 30,
    }),
    C('Verity Health', {
      contact: 'Dr. Ana Rocha',
      email: 'finance@verity.health',
      address1: 'Praca do Comercio 8',
      city: 'Lisbon',
      postal: '1100-148',
      taxId: 'PT507441226',
    }),
    C('Atlas Foundry', {
      contact: 'Rui Matos',
      email: 'rui@atlasfoundry.com',
      address1: 'Rua de Cedofeita 88',
      city: 'Porto',
      postal: '4050-174',
      paymentTerms: 30,
    }),
  ]

  const it = (name: string, description: string, price: number, unitLabel: string, sku: string): CatalogItem => ({
    id: uid('itm'),
    name,
    description,
    unitPrice: price,
    unitLabel,
    taxRate: 8.5,
    sku,
    createdAt: now,
    updatedAt: now,
  })

  const items: CatalogItem[] = [
    it('Brand identity system', 'Logo suite, typography, voice and guidelines', 240000, 'project', 'BR-100'),
    it('Packaging design', 'Retail carton and label system', 28000, 'unit', 'PK-220'),
    it('Art direction photoshoot', 'Half-day studio session with retouching', 45000, 'session', 'AD-310'),
    it('Website design', 'Responsive marketing site, up to 6 pages', 320000, 'project', 'WD-400'),
    it('Design retainer', 'Monthly design support, 20 hours', 180000, 'month', 'RT-500'),
    it('Consulting', 'Strategy and design systems consulting', 9000, 'hour', 'CS-010'),
  ]

  const specs: SeedSpec[] = [
    {
      number: makeNumber('INV', true, 41),
      client: 0,
      issue: isoOffset(-24),
      due: isoOffset(-10),
      status: 'open',
      items: [
        line('Brand identity system', 1, 240000, 8.5, 'Logo suite, voice, guidelines'),
        line('Packaging design', 3, 28000, 8.5, 'Retail carton + label system'),
        line('Art direction photoshoot', 1, 45000, 8.5),
      ],
      discount: { type: 'percent', value: 5 },
    },
    {
      number: makeNumber('INV', true, 40),
      client: 1,
      issue: isoOffset(-8),
      due: isoOffset(6),
      status: 'open',
      items: [line('Website design', 1, 180000, 8.5, 'Marketing site, 5 pages')],
    },
    {
      number: makeNumber('INV', true, 39),
      client: 2,
      issue: isoOffset(-16),
      due: isoOffset(14),
      status: 'open',
      items: [line('Design retainer', 3, 180000, 0, 'January - March')],
    },
    {
      number: makeNumber('INV', true, 38),
      client: 3,
      issue: isoOffset(-38),
      due: isoOffset(-24),
      status: 'paid',
      items: [line('Website design', 1, 380000, 8.5), line('Consulting', 6, 9000, 8.5)],
    },
    {
      number: makeNumber('INV', true, 37),
      client: 4,
      issue: isoOffset(-52),
      due: isoOffset(-22),
      status: 'open',
      items: [line('Packaging design', 10, 28000, 8.5)],
      partial: 100000,
    },
    {
      number: makeNumber('INV', true, 36),
      client: 0,
      issue: isoOffset(-70),
      due: isoOffset(-56),
      status: 'paid',
      items: [line('Consulting', 12, 9000, 8.5), line('Art direction photoshoot', 1, 45000, 8.5)],
    },
    {
      number: makeNumber('INV', true, 35),
      client: 1,
      issue: isoOffset(-84),
      due: isoOffset(-70),
      status: 'paid',
      items: [line('Design retainer', 1, 180000, 0)],
    },
    {
      number: makeNumber('INV', true, 34),
      client: 3,
      issue: isoOffset(-100),
      due: isoOffset(-86),
      status: 'paid',
      items: [line('Brand identity system', 1, 240000, 8.5)],
    },
    {
      number: makeNumber('INV', true, 43),
      client: 4,
      issue: isoOffset(0),
      due: isoOffset(30),
      status: 'draft',
      items: [line('Packaging design', 6, 28000, 8.5, 'Spring range')],
    },
    {
      number: makeNumber('INV', true, 33),
      client: 2,
      issue: isoOffset(-150),
      due: isoOffset(-120),
      status: 'void',
      items: [line('Consulting', 4, 9000, 8.5)],
    },
  ]

  const invoices: Invoice[] = specs.map((s) => {
    const client = clients[s.client]
    const totals = computeTotals({
      items: s.items,
      discountType: s.discount?.type ?? 'percent',
      discountValue: s.discount?.value ?? 0,
      shipping: 0,
    })
    const payments: Invoice['payments'] =
      s.status === 'paid'
        ? [{ id: uid('pay'), date: s.due, amount: totals.total, method: 'Bank transfer', note: 'Paid in full' }]
        : s.partial
          ? [{ id: uid('pay'), date: isoOffset(-30), amount: s.partial, method: 'Bank transfer' }]
          : []
    return {
      id: uid('inv'),
      number: s.number,
      clientId: client.id,
      clientSnapshot: {
        name: client.name,
        contact: client.contact,
        email: client.email,
        address: [client.address1, `${client.postal ?? ''} ${client.city ?? ''}`.trim(), client.country]
          .filter(Boolean)
          .join('\n'),
        taxId: client.taxId,
      },
      status: s.status,
      issueDate: s.issue,
      dueDate: s.due,
      currency: 'USD',
      items: s.items,
      discountType: s.discount?.type ?? 'percent',
      discountValue: s.discount?.value ?? 0,
      shipping: 0,
      notes: 'Thank you for your business. Payment by bank transfer, Net 14.',
      terms: 'Payment is due within 14 days of the issue date.',
      poNumber: '',
      template: 'modern',
      payments,
      sentAt: s.status === 'draft' ? undefined : `${s.issue}T09:00:00.000Z`,
      paidAt: s.status === 'paid' ? `${s.due}T12:00:00.000Z` : undefined,
      createdAt: `${s.issue}T09:00:00.000Z`,
      updatedAt: `${s.due}T12:00:00.000Z`,
      total: totals.total,
    }
  })

  const settings: Settings = { ...DEFAULT_SETTINGS, nextNumber: 44, onboarded: true }

  await db.transaction('rw', db.clients, db.items, db.invoices, db.kv, async () => {
    await Promise.all([db.clients.clear(), db.items.clear(), db.invoices.clear()])
    await db.clients.bulkPut(clients)
    await db.items.bulkPut(items)
    await db.invoices.bulkPut(invoices)
    await db.kv.put({ key: 'business', value: DEFAULT_BUSINESS })
    await db.kv.put({ key: 'settings', value: settings })
  })

  return { clients, items, invoices }
}

export function newInvoiceDefaults(client: Client | undefined, settings: Settings): Invoice {
  const today = todayISO()
  const number = makeNumber(settings.invoicePrefix, settings.numberWithYear, settings.nextNumber)
  const due = addDays(today, client?.paymentTerms ?? settings.paymentTermsDays)
  return {
    id: uid('inv'),
    number,
    clientId: client?.id ?? '',
    clientSnapshot: {
      name: client?.name ?? '',
      contact: client?.contact,
      email: client?.email,
      address: client
        ? [client.address1, `${client.postal ?? ''} ${client.city ?? ''}`.trim(), client.country]
            .filter(Boolean)
            .join('\n')
        : '',
      taxId: client?.taxId,
    },
    status: 'draft',
    issueDate: today,
    dueDate: due,
    currency: client?.currency || settings.currency,
    items: [
      {
        id: uid('li'),
        description: '',
        details: '',
        qty: 1,
        unitPrice: 0,
        unitLabel: 'unit',
        discountType: 'percent',
        discountValue: 0,
        taxRate: settings.defaultTaxRate,
      },
    ],
    discountType: 'percent',
    discountValue: 0,
    shipping: 0,
    notes: settings.defaultNotes,
    terms: settings.defaultTerms,
    poNumber: '',
    template: settings.defaultTemplate,
    payments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    total: 0,
  }
}
