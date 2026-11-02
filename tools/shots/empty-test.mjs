import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4173'
const out = '/workspace/mockups/shots/app'
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

const go = async (hash) => {
  await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
}

// fresh install must be empty
await go('/')
console.log('invoices on first run:', await page.evaluate(async () => {
  const req = indexedDB.open('billfold')
  const db = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const count = await new Promise((res) => {
    const tx = db.transaction('invoices').objectStore('invoices').count()
    tx.onsuccess = () => res(tx.result)
  })
  return count
}))
console.log('setup banner:', await page.locator('.setup-card').count())
console.log('empty state text:', (await page.locator('.empty p').first().innerText()).slice(0, 80))
await page.screenshot({ path: `${out}/00-empty-dashboard.png` })

await go('/invoices')
await page.screenshot({ path: `${out}/00-empty-invoices.png` })
console.log('empty invoice cards:', await page.locator('.inv-card').count())

await go('/settings')
await page.screenshot({ path: `${out}/00-settings-sample-data.png` })
const sampleRow = page.getByRole('button', { name: /Load sample data/i })
console.log('sample row visible:', await sampleRow.count())

// load it
await sampleRow.click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^Load sample$/ }).click()
await page.waitForTimeout(1800)
await go('/invoices')
console.log('after sample load:', await page.locator('.inv-card').count())

// and clear again
await go('/settings')
await page
  .locator('.settings-row')
  .filter({ has: page.locator('.st', { hasText: /^Erase all data$/ }) })
  .click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Erase everything/i }).click()
await page.waitForTimeout(1600)
await go('/invoices')
console.log('after erase:', await page.locator('.inv-card').count())

console.log('ERRORS', JSON.stringify(errors))
await browser.close()
