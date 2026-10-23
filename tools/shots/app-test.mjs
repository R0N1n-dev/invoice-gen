import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:4173'
const out = '/workspace/mockups/shots/app'
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
})
const page = await context.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

const shot = async (name) => {
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(out, name + '.png') })
  console.log('shot', name)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('01-dashboard')

// Invoices list
await page.getByRole('link', { name: 'Invoices' }).first().click()
await page.waitForTimeout(400)
await shot('02-invoices')

// Open the first invoice
await page.locator('.inv-card').first().click()
await page.waitForTimeout(900)
await shot('03-detail')

// Save PDF via the real generator
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByRole('button', { name: /Save PDF/i }).click(),
])
const pdfPath = '/tmp/billfold-test.pdf'
await download.saveAs(pdfPath)
const head = fs.readFileSync(pdfPath).subarray(0, 5).toString()
const size = fs.statSync(pdfPath).size
console.log('PDF', head, size, 'bytes', 'filename', download.suggestedFilename())

// Template switch + edit flow
await page.getByRole('button', { name: /classic/i }).click()
await page.waitForTimeout(500)
await shot('04-detail-classic')

await page.getByRole('button', { name: /^Edit$/i }).first().click()
await page.waitForTimeout(500)
await shot('05-editor')

// New invoice: pick client, fill line, issue
await page.goto(BASE + '/#/invoices/new', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.getByRole('button', { name: /Select a client/i }).click()
await page.waitForTimeout(400)
await page.locator('.sheet .quick').first().click()
await page.waitForTimeout(400)
await page.getByPlaceholder('What are you charging for?').fill('Design sprint')
await page.locator('.line-grid input').nth(1).fill('1250')
await page.waitForTimeout(300)
await shot('06-editor-filled')
await page.getByRole('button', { name: /Issue invoice/i }).click()
await page.waitForTimeout(1500)
const toastText = await page.locator('.toast').allInnerTexts().catch(() => [])
console.log('toasts', toastText)
const urlAfterIssue = page.url()
await shot('07-issued')

// Reload and confirm IndexedDB persistence
await page.goto(BASE + '/#/invoices', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
const countBefore = await page.locator('.inv-card').count()
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
const countAfter = await page.locator('.inv-card').count()
console.log('persist', countBefore, countAfter)

// Settings
await page.getByRole('link', { name: 'Settings' }).first().click()
await page.waitForTimeout(500)
await shot('08-settings')

// Desktop layout
const desktop = await context.newPage()
await desktop.setViewportSize({ width: 1280, height: 900 })
await desktop.goto(BASE + '/#/', { waitUntil: 'networkidle' })
await desktop.waitForTimeout(900)
await desktop.screenshot({ path: path.join(out, '09-desktop.png') })
await desktop.goto(BASE + '/#/invoices', { waitUntil: 'networkidle' })
await desktop.waitForTimeout(700)
await desktop.screenshot({ path: path.join(out, '10-desktop-invoices.png') })
await desktop.close()

console.log('issued url', urlAfterIssue)
console.log('ERRORS', JSON.stringify(errors, null, 1))
await browser.close()
