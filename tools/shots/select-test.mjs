import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

const go = async (hash) => {
  await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (await page.locator('.sheet-title', { hasText: 'Discard changes?' }).count()) {
    await page.getByRole('button', { name: /Discard/i }).click()
    await page.waitForTimeout(700)
  }
}

async function pick(selectIndex, optionText) {
  await page.locator('.app-select').nth(selectIndex).click()
  await page.waitForTimeout(350)
  await page
    .locator('.as-option')
    .filter({ has: page.locator('.row-title', { hasText: new RegExp(`^${optionText}$`) }) })
    .first()
    .click()
  await page.waitForTimeout(350)
}

await go('/settings')
await page.waitForTimeout(600)

// currency
await pick(0, 'EUR')
console.log('currency button:', await page.locator('.app-select').nth(0).innerText())
// date format
await pick(2, '2026-03-24')
console.log('date format:', await page.locator('.app-select').nth(2).innerText())
// template
await pick(3, 'Classic')
console.log('template:', await page.locator('.app-select').nth(3).innerText())
// terms
await pick(4, 'Net 30')
console.log('terms:', await page.locator('.app-select').nth(4).innerText())

await page.getByRole('button', { name: /^Save$/ }).click()
await page.waitForTimeout(700)

// reload and confirm persistence
await go('/settings')
await page.waitForTimeout(800)
console.log('after reload:', {
  currency: await page.locator('.app-select').nth(0).innerText(),
  date: await page.locator('.app-select').nth(2).innerText(),
  template: await page.locator('.app-select').nth(3).innerText(),
  terms: await page.locator('.app-select').nth(4).innerText(),
})

// editor currency + discount type
await go('/invoices/new')
await page.waitForTimeout(600)
const editorSelects = await page.locator('.app-select').count()
console.log('editor selects:', editorSelects, 'currency:', await page.locator('.app-select').nth(0).innerText())
await page.locator('.app-select').nth(0).click()
await page.waitForTimeout(300)
await page.locator('.as-option', { hasText: /^GBP\s*$/ }).first().click()
await page.waitForTimeout(300)
console.log('editor currency after pick:', await page.locator('.app-select').nth(0).innerText())

// catalog unit + client terms
await go('/catalog')
await page.locator('.fab').click()
await page.waitForTimeout(400)
console.log('catalog unit:', await page.locator('.app-select').first().innerText())
await page.locator('.app-select').first().click()
await page.waitForTimeout(300)
await page.locator('.as-option', { hasText: /^hour$/ }).first().click()
await page.waitForTimeout(300)
console.log('catalog unit after pick:', await page.locator('.app-select').first().innerText())

await go('/clients')
await page.locator('.fab').click()
await page.waitForTimeout(400)
const clientSelects = await page.locator('.app-select').count()
console.log('client selects:', clientSelects)
await page.locator('.app-select').nth(1).click()
await page.waitForTimeout(300)
await page.locator('.as-option', { hasText: /^Net 45$/ }).first().click()
console.log('client terms after pick:', await page.locator('.app-select').nth(1).innerText())

console.log('ERRORS', JSON.stringify(errors))
await browser.close()
