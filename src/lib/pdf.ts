import { PDFDocument, rgb, degrees, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import type { Business, Invoice, PdfTemplate, Settings } from '@/types'
import { computeTotals, displayStatus } from './calc'
import { formatDate } from './dates'
import { formatAmount, currencySymbol } from './money'

const A4: [number, number] = [595.28, 841.89]
const M = 48
const PAGE_W = A4[0]
const CONTENT_W = PAGE_W - M * 2

const C = {
  ink: rgb(0.07, 0.08, 0.11),
  body: rgb(0.2, 0.22, 0.27),
  muted: rgb(0.45, 0.48, 0.54),
  faint: rgb(0.62, 0.65, 0.7),
  line: rgb(0.89, 0.9, 0.92),
  soft: rgb(0.965, 0.968, 0.975),
  white: rgb(1, 1, 1),
}

export interface PdfContext {
  invoice: Invoice
  business: Business
  settings: Settings
  accent: RGB
  fonts: Fonts
}

interface Fonts {
  regular: PDFFont
  medium: PDFFont
  semi: PDFFont
  bold: PDFFont
}

function parseHex(hex: string): RGB {
  const clean = (hex || '#7C93FF').replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = Number.parseInt(full.slice(0, 6) || '7C93FF', 16)
  if (!Number.isFinite(n)) return rgb(0.486, 0.576, 1)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function tint(color: RGB, amount: number): RGB {
  return rgb(
    color.red + (1 - color.red) * amount,
    color.green + (1 - color.green) * amount,
    color.blue + (1 - color.blue) * amount,
  )
}

/** WinAnsi-safe text: Helvetica's standard encoding cannot carry every script. */
const WIN_ANSI_EXTRA = '\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178'
const SYMBOL_FALLBACK: Record<string, string> = {
  '\u20b9': 'Rs. ',
  '\u20bd': 'RUB ',
  '\u20a9': 'KRW ',
  '\u20ba': 'TRY ',
  '\u20aa': 'ILS ',
  '\u20a6': 'NGN ',
  '\u20b4': 'UAH ',
  '\u20b1': 'PHP ',
  '\u20ab': 'VND ',
  '\u20b8': 'KZT ',
  '\u20bc': 'AZN ',
  '\u20be': 'GEL ',
  '\u0e3f': 'THB ',
}

function clean(text: string): string {
  let out = ''
  for (const ch of text ?? '') {
    const cp = ch.codePointAt(0) ?? 0
    if (cp === 10) {
      out += '\n'
      continue
    }
    if (cp === 9) {
      out += '    '
      continue
    }
    if (cp < 32) continue
    if (cp <= 255 || WIN_ANSI_EXTRA.includes(ch)) {
      out += ch
      continue
    }
    out += SYMBOL_FALLBACK[ch] ?? ''
  }
  return out
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = []
  for (const paragraph of clean(text).split('\n')) {
    if (!paragraph.trim()) {
      out.push('')
      continue
    }
    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
        continue
      }
      if (current) out.push(current)
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = ''
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) {
            out.push(chunk)
            chunk = ch
          } else {
            chunk += ch
          }
        }
        current = chunk
      } else {
        current = word
      }
    }
    if (current) out.push(current)
  }
  return out
}

function write(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB = C.body,
): void {
  if (!text) return
  page.drawText(clean(text), { x, y, size, font, color })
}

function writeRight(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB = C.body,
): void {
  if (!text) return
  const w = font.widthOfTextAtSize(clean(text), size)
  page.drawText(clean(text), { x: right - w, y, size, font, color })
}

function paragraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color: RGB = C.body,
  lineGap = 1.42,
): number {
  const lines = wrap(text, font, size, maxWidth)
  let cursor = y
  for (const line of lines) {
    if (!line) {
      cursor -= size * lineGap
      continue
    }
    write(page, line, x, cursor, font, size, color)
    cursor -= size * lineGap
  }
  return cursor
}

function currencyAmount(minor: number, ctx: PdfContext): string {
  return `${currencySymbol(ctx.invoice.currency, ctx.settings.locale)}${formatAmount(
    minor,
    ctx.invoice.currency,
    ctx.settings.locale,
  )}`
}

function plainAmount(minor: number, ctx: PdfContext): string {
  return formatAmount(minor, ctx.invoice.currency, ctx.settings.locale)
}

async function embedLogo(doc: PDFDocument, dataUrl?: string) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return undefined
  try {
    const [meta, base64] = dataUrl.split(',')
    if (!base64) return undefined
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    if (meta.includes('png')) return await doc.embedPng(bytes)
    if (meta.includes('jpeg') || meta.includes('jpg')) return await doc.embedJpg(bytes)
  } catch {
    /* unreadable logo, skip */
  }
  return undefined
}

type Doc = PDFDocument
type Ctx = PdfContext

const PAGE_H = A4[1]
const FOOTER_Y = 40

function metaBlocks(ctx: Ctx): { billTo: string; from: string } {
  const inv = ctx.invoice
  const b = ctx.business
  const billTo = [
    inv.clientSnapshot.name,
    inv.clientSnapshot.contact ? `Attn. ${inv.clientSnapshot.contact}` : '',
    inv.clientSnapshot.address ?? '',
    inv.clientSnapshot.email ?? '',
    inv.clientSnapshot.taxId ? `VAT ${inv.clientSnapshot.taxId}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const from = [
    b.name,
    b.address1 ?? '',
    [b.postal, b.city].filter(Boolean).join(' '),
    b.country ?? '',
    b.taxId ? `VAT ${b.taxId}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return { billTo, from }
}

function drawFooter(doc: Doc, ctx: Ctx): void {
  const pages = doc.getPages()
  pages.forEach((page, i) => {
    page.drawLine({
      start: { x: M, y: FOOTER_Y + 12 },
      end: { x: PAGE_W - M, y: FOOTER_Y + 12 },
      thickness: 0.6,
      color: C.line,
    })
    write(page, ctx.business.name, M, FOOTER_Y, ctx.fonts.medium, 7.5, C.faint)
    const label = `${ctx.invoice.number} · page ${i + 1} of ${pages.length}`
    writeRight(page, label, PAGE_W - M, FOOTER_Y, ctx.fonts.regular, 7.5, C.faint)
  })
}

function watermark(page: PDFPage, ctx: Ctx): void {
  const status = displayStatus(ctx.invoice)
  if (status !== 'draft' && status !== 'void') return
  page.drawText(status === 'draft' ? 'DRAFT' : 'VOID', {
    x: 110,
    y: 330,
    size: 92,
    font: ctx.fonts.bold,
    color: ctx.accent,
    opacity: 0.05,
    rotate: degrees(32),
  })
}

interface TableOpts {
  x: number
  y: number
  descWidth: number
  qtyX: number
  rateX: number
  amountX: number
  headerColor: RGB
  accentHeader?: boolean
}


function drawTableHeader(page: PDFPage, ctx: Ctx, o: TableOpts): number {
  const f = ctx.fonts
  const y = o.y
  write(page, 'DESCRIPTION', o.x, y, f.semi, 7, o.headerColor)
  writeRight(page, 'QTY', o.qtyX, y, f.semi, 7, o.headerColor)
  writeRight(page, 'RATE', o.rateX, y, f.semi, 7, o.headerColor)
  writeRight(page, 'AMOUNT', o.amountX, y, f.semi, 7, o.headerColor)
  page.drawLine({
    start: { x: o.x, y: y - 6 },
    end: { x: o.amountX, y: y - 6 },
    thickness: 0.8,
    color: o.accentHeader ? ctx.accent : C.line,
  })
  return y - 20
}

function fmtQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(2)))
}

function drawItems(
  doc: Doc,
  page: PDFPage,
  ctx: Ctx,
  startY: number,
  opts: Omit<TableOpts, 'y'>,
): { page: PDFPage; y: number } {
  const f = ctx.fonts
  const inv = ctx.invoice
  let y = drawTableHeader(page, ctx, { ...opts, y: startY })
  const totals = computeTotals(inv)

  inv.items.forEach((item, index) => {
    const descLines = wrap(item.description || 'Item', f.medium, 9.5, opts.descWidth)
    const detailLines = item.details ? wrap(item.details, f.regular, 8, opts.descWidth) : []
    const rowHeight = descLines.length * 12 + detailLines.length * 10.5 + 14
    if (y - rowHeight < M + 60) {
      page = doc.addPage(A4)
      y = PAGE_H - M
      write(page, `INVOICE ${inv.number} · continued`, M, y, f.medium, 8, C.faint)
      y -= 18
      y = drawTableHeader(page, ctx, { ...opts, y })
    }
    let cursor = y
    for (const line of descLines) {
      write(page, line, opts.x, cursor, f.medium, 9.5, C.ink)
      cursor -= 12
    }
    for (const line of detailLines) {
      write(page, line, opts.x, cursor, f.regular, 8, C.muted)
      cursor -= 10.5
    }
    const lineTotals = totals.lines[index]
    writeRight(page, fmtQty(item.qty), opts.qtyX, y, f.regular, 9, C.body)
    writeRight(page, plainAmount(item.unitPrice, ctx), opts.rateX, y, f.regular, 9, C.body)
    writeRight(page, plainAmount(lineTotals?.total ?? 0, ctx), opts.amountX, y, f.semi, 9.5, C.ink)
    y -= rowHeight
    page.drawLine({
      start: { x: opts.x, y: y + 6 },
      end: { x: opts.amountX, y: y + 6 },
      thickness: 0.5,
      color: C.line,
    })
  })
  return { page, y }
}

function drawTotals(
  page: PDFPage,
  ctx: Ctx,
  y: number,
  right: number,
  opts: { boxed?: boolean; accentTotal?: boolean } = {},
): number {
  const f = ctx.fonts
  const totals = computeTotals(ctx.invoice)
  const labels: [string, string][] = [['Subtotal', plainAmount(totals.subtotal, ctx)]]
  if (totals.invoiceDiscount > 0) labels.push(['Discount', `−${plainAmount(totals.invoiceDiscount, ctx)}`])
  if (totals.shipping > 0) labels.push(['Shipping', plainAmount(totals.shipping, ctx)])
  for (const rate of totals.taxByRate) labels.push([`Tax ${rate.rate}%`, plainAmount(rate.amount, ctx)])
  if (totals.paid > 0) {
    labels.push(['Paid', `−${plainAmount(totals.paid, ctx)}`])
    labels.push(['Balance due', plainAmount(totals.balance, ctx)])
  }

  const boxW = 210
  const left = right - boxW
  let cursor = y
  for (const [label, value] of labels) {
    write(page, label, left, cursor, f.regular, 8.6, C.muted)
    writeRight(page, value, right, cursor, f.regular, 8.6, C.body)
    cursor -= 14
  }
  cursor -= 4
  const due = totals.balance > 0 ? totals.balance : totals.total
  if (opts.boxed) {
    page.drawRectangle({
      x: left - 10,
      y: cursor - 9,
      width: boxW + 10,
      height: 26,
      color: opts.accentTotal ? ctx.accent : C.ink,
    })
    write(
      page,
      totals.paid >= totals.total && totals.total > 0 ? 'PAID' : 'TOTAL DUE',
      left,
      cursor,
      f.semi,
      7,
      opts.accentTotal ? rgb(1, 1, 1) : rgb(0.75, 0.78, 0.85),
    )
    writeRight(page, plainAmount(due, ctx), right - 10, cursor, f.bold, 12, C.white)
    cursor -= 30
  } else {
    page.drawLine({
      start: { x: left, y: cursor + 8 },
      end: { x: right, y: cursor + 8 },
      thickness: 0.8,
      color: C.ink,
    })
    write(page, 'TOTAL DUE', left, cursor, f.semi, 7.5, C.muted)
    writeRight(page, plainAmount(due, ctx), right, cursor - 2, f.bold, 16, C.ink)
    cursor -= 28
  }
  return cursor
}

function paymentLines(ctx: Ctx): string[] {
  const b = ctx.business
  return [
    b.bankName ? `Bank: ${b.bankName}` : '',
    b.accountName ? `Account: ${b.accountName}` : '',
    b.iban ? `IBAN: ${b.iban}` : '',
    b.bic ? `BIC: ${b.bic}` : '',
  ].filter(Boolean)
}

function drawNotesAndTerms(page: PDFPage, ctx: Ctx, y: number): number {
  const f = ctx.fonts
  let cursor = y
  const notes = ctx.invoice.notes?.trim()
  const terms = ctx.invoice.terms?.trim()
  const pay = paymentLines(ctx)
  if (pay.length) {
    write(page, 'PAYMENT DETAILS', M, cursor, f.semi, 7, C.faint)
    cursor -= 12
    cursor = paragraph(page, pay.join('\n'), M, cursor, 260, f.regular, 8, C.muted) - 8
  }
  if (notes) {
    write(page, 'NOTES', M, cursor, f.semi, 7, C.faint)
    cursor -= 12
    cursor = paragraph(page, notes, M, cursor, CONTENT_W - 10, f.regular, 8, C.body) - 8
  }
  if (terms) {
    write(page, 'TERMS', M, cursor, f.semi, 7, C.faint)
    cursor -= 12
    cursor = paragraph(page, terms, M, cursor, CONTENT_W - 10, f.regular, 7.6, C.muted) - 4
  }
  return cursor
}

interface LogoImage {
  scale: (h: number) => number
  draw: (page: PDFPage, x: number, y: number, h: number) => void
}

function logoHelper(image: Awaited<ReturnType<typeof embedLogo>>): LogoImage | undefined {
  if (!image) return undefined
  const ratio = image.width / image.height
  return {
    scale: (h: number) => h * ratio,
    draw: (page, x, y, h) => {
      page.drawImage(image, { x, y, width: h * ratio, height: h })
    },
  }
}

function metaColumns(ctx: Ctx): { label: string; body: string; x: number }[] {
  const { billTo, from } = metaBlocks(ctx)
  const inv = ctx.invoice
  return [
    { label: 'BILL TO', body: billTo, x: M },
    { label: 'FROM', body: from, x: M + 164 },
    {
      label: 'DETAILS',
      body: [
        `Issued ${formatDate(inv.issueDate, ctx.settings.locale, ctx.settings.dateFormat)}`,
        `Due ${formatDate(inv.dueDate, ctx.settings.locale, ctx.settings.dateFormat)}`,
        inv.poNumber ? `PO ${inv.poNumber}` : '',
        inv.currency,
      ]
        .filter(Boolean)
        .join('\n'),
      x: M + 328,
    },
  ]
}

function drawColumns(page: PDFPage, ctx: Ctx, y: number): number {
  let lowest = y - 14
  for (const col of metaColumns(ctx)) {
    write(page, col.label, col.x, y, ctx.fonts.semi, 7, C.faint)
    const end = paragraph(page, col.body, col.x, y - 14, 150, ctx.fonts.regular, 8.3, C.body)
    lowest = Math.min(lowest, end)
  }
  return lowest
}

async function renderModern(doc: Doc, ctx: Ctx) {
  const f = ctx.fonts
  const inv = ctx.invoice
  const totals = computeTotals(inv)
  const logo = logoHelper(await embedLogo(doc, ctx.business.logo))
  const bandH = 152
  const page = doc.addPage(A4)
  page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: ctx.accent })
  page.drawCircle({
    x: PAGE_W - 40,
    y: PAGE_H + 40,
    size: 150,
    color: tint(ctx.accent, 0.16),
    opacity: 0.55,
  })

  if (logo) logo.draw(page, M, PAGE_H - 58, 26)
  else {
    write(page, ctx.business.name, M, PAGE_H - 52, f.bold, 15, C.white)
    if (ctx.business.website)
      write(page, ctx.business.website, M, PAGE_H - 64, f.regular, 7.5, tint(ctx.accent, 0.55))
  }

  writeRight(page, 'INVOICE', PAGE_W - M, PAGE_H - 50, f.semi, 8, tint(ctx.accent, 0.7))
  writeRight(page, inv.number, PAGE_W - M, PAGE_H - 66, f.bold, 13, C.white)
  writeRight(
    page,
    formatDate(inv.issueDate, ctx.settings.locale, ctx.settings.dateFormat),
    PAGE_W - M,
    PAGE_H - 78,
    f.regular,
    8,
    tint(ctx.accent, 0.55),
  )
  write(page, 'TOTAL DUE', M, PAGE_H - bandH + 44, f.semi, 7.5, tint(ctx.accent, 0.7))
  write(
    page,
    currencyAmount(totals.balance > 0 ? totals.balance : totals.total, ctx),
    M,
    PAGE_H - bandH + 20,
    f.bold,
    26,
    C.white,
  )

  let y = PAGE_H - bandH - 26
  y = drawColumns(page, ctx, y) - 26
  const table = drawItems(doc, page, ctx, y, {
    x: M,
    descWidth: 235,
    qtyX: M + 320,
    rateX: M + 400,
    amountX: PAGE_W - M,
    headerColor: C.faint,
  })
  y = drawTotals(table.page, ctx, table.y - 6, PAGE_W - M, { boxed: true, accentTotal: true }) - 4
  if (y < M + 90) {
    drawNotesAndTerms(doc.addPage(A4), ctx, PAGE_H - M)
  } else {
    drawNotesAndTerms(table.page, ctx, y)
  }
}

async function renderClassic(doc: Doc, ctx: Ctx) {
  const f = ctx.fonts
  const inv = ctx.invoice
  const logo = logoHelper(await embedLogo(doc, ctx.business.logo))
  const page = doc.addPage(A4)
  let y = PAGE_H - M

  if (logo) logo.draw(page, M, y - 24, 30)
  else write(page, ctx.business.name, M, y - 12, f.bold, 16, C.ink)
  writeRight(page, 'INVOICE', PAGE_W - M, y - 4, f.semi, 9, ctx.accent)
  writeRight(page, inv.number, PAGE_W - M, y - 20, f.bold, 14, C.ink)
  y -= 44
  if (!logo && ctx.business.website) write(page, ctx.business.website, M, y, f.regular, 8, C.muted)
  y -= 12
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1.2, color: C.ink })
  y -= 26
  y = drawColumns(page, ctx, y) - 26

  const table = drawItems(doc, page, ctx, y + 2, {
    x: M + 8,
    descWidth: 230,
    qtyX: M + 320,
    rateX: M + 400,
    amountX: PAGE_W - M - 8,
    headerColor: C.muted,
  })
  const totalY = drawTotals(table.page, ctx, table.y - 8, PAGE_W - M, { boxed: false })
  drawNotesAndTerms(table.page, ctx, Math.max(totalY - 6, M + 40))
}

async function renderMinimal(doc: Doc, ctx: Ctx) {
  const f = ctx.fonts
  const inv = ctx.invoice
  const totals = computeTotals(inv)
  const logo = logoHelper(await embedLogo(doc, ctx.business.logo))
  const page = doc.addPage(A4)
  let y = PAGE_H - M

  page.drawRectangle({ x: M, y: y + 6, width: CONTENT_W, height: 4, color: C.ink })
  y -= 6
  write(page, 'INVOICE', M, y - 8, f.semi, 7.5, C.muted)
  write(page, inv.number, M, y - 32, f.bold, 24, C.ink)
  if (logo) logo.draw(page, PAGE_W - M - 70, y - 34, 24)
  else writeRight(page, ctx.business.name, PAGE_W - M, y - 6, f.semi, 9, C.ink)
  writeRight(
    page,
    formatDate(inv.issueDate, ctx.settings.locale, ctx.settings.dateFormat),
    PAGE_W - M,
    y - 22,
    f.regular,
    8,
    C.muted,
  )
  y -= 52
  y = drawColumns(page, ctx, y) - 26

  const table = drawItems(doc, page, ctx, y, {
    x: M,
    descWidth: 240,
    qtyX: M + 330,
    rateX: M + 405,
    amountX: PAGE_W - M,
    headerColor: C.ink,
    accentHeader: true,
  })
  const totalY = drawTotals(table.page, ctx, table.y - 8, PAGE_W - M, { boxed: true })
  drawNotesAndTerms(table.page, ctx, totalY - 6)
}

export interface BuildPdfOptions {
  invoice: Invoice
  business: Business
  settings: Settings
  template?: PdfTemplate
}

async function getFonts(doc: PDFDocument): Promise<Fonts> {
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  return { regular, medium: regular, semi: bold, bold }
}

/** Build a complete, print-ready A4 PDF for one invoice. */
export async function buildInvoicePdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { invoice, business, settings } = options
  const doc = await PDFDocument.create()
  doc.setTitle(`${invoice.number} — ${business.name}`)
  doc.setSubject(`Invoice ${invoice.number} for ${invoice.clientSnapshot.name}`)
  doc.setAuthor(business.name)
  doc.setProducer('Billfold')
  doc.setCreator('Billfold · offline invoice generator')
  doc.setCreationDate(new Date())

  const ctx: Ctx = {
    invoice,
    business,
    settings,
    accent: parseHex(business.accent),
    fonts: await getFonts(doc),
  }

  const template = options.template ?? invoice.template ?? 'modern'
  if (template === 'classic') await renderClassic(doc, ctx)
  else if (template === 'minimal') await renderMinimal(doc, ctx)
  else await renderModern(doc, ctx)

  for (const page of doc.getPages()) {
    watermark(page, ctx)
  }
  drawFooter(doc, ctx)
  return doc.save()
}

export function pdfBlobUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
}

export function pdfFilename(invoice: Invoice): string {
  const client = invoice.clientSnapshot.name.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-')
  return `${invoice.number}-${client || 'invoice'}.pdf`.replace(/-+\.pdf$/, '.pdf')
}
