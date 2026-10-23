import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// --- template PDFs on an invoice with several items ---
await page.goto(BASE + '/#/invoices', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const cards = page.locator('.inv-card')
console.log('cards', await cards.count())
await cards.nth(2).click()
await page.waitForTimeout(800)

for (const tpl of ['modern', 'classic', 'minimal']) {
  await page.locator('.filters .chip', { hasText: new RegExp(tpl, 'i') }).first().click()
  await page.waitForTimeout(400)
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: /Save PDF/i }).click(),
  ])
  await dl.saveAs(`/tmp/tpl-${tpl}.pdf`)
  console.log('pdf', tpl, fs.statSync(`/tmp/tpl-${tpl}.pdf`).size)
}

// --- record a payment ---
const balanceBefore = await page.locator('.balance').innerText()
await page.getByRole('button', { name: /Add payment/i }).click()
await page.waitForTimeout(400)
await page.locator('.sheet input[type="number"]').first().fill('50')
await page.getByRole('button', { name: /Record payment/i }).click()
await page.waitForTimeout(800)
const balanceAfter = await page.locator('.balance').innerText()
const payRows = await page.locator('.pay-row').count()
console.log('payment', { balanceBefore, balanceAfter, payRows })

// --- add a client ---
await page.goto(BASE + '/#/clients', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const clientsBefore = await page.locator('.list-row').count()
await page.locator('.fab').click()
await page.waitForTimeout(400)
await page.getByPlaceholder('Halcyon Coffee').fill('Test Bakery')
await page.getByRole('button', { name: /Save client/i }).click()
await page.waitForTimeout(800)
const clientsAfter = await page.locator('.list-row').count()
console.log('clients', clientsBefore, clientsAfter)

// --- save a draft from the editor ---
await page.goto(BASE + '/#/invoices/new', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByRole('button', { name: /Select a client/i }).click()
await page.waitForTimeout(400)
await page.locator('.sheet .quick').first().click()
await page.waitForTimeout(300)
await page.getByPlaceholder('What are you charging for?').fill('Draft line')
await page.getByRole('button', { name: /Save draft/i }).click()
await page.waitForTimeout(1200)
console.log('draft url', page.url())

await page.goto(BASE + '/#/invoices', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const draftCount = await page.locator('.inv-card.s-draft').count()
console.log('drafts in list', draftCount)

// --- settings save ---
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('.toggle-row .toggle').first().click()
await page.getByRole('button', { name: /^Save$/ }).click()
await page.waitForTimeout(700)
const toast = await page.locator('.toast').allInnerTexts()
console.log('settings toast', toast)

// --- filter check ---
await page.goto(BASE + '/#/invoices', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Overdue', exact: true }).click()
await page.waitForTimeout(500)
console.log('overdue rows', await page.locator('.inv-card').count())

console.log('ERRORS', JSON.stringify(errors))
await browser.close()
