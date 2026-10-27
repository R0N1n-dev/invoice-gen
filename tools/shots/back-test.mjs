import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const back = async () => {
  await page.evaluate(() => { window.__billfoldBack() })
  await page.waitForTimeout(600)
}
const state = async () => {
  const sheets = await page.locator('.overlay').count()
  const title = sheets ? await page.locator('.sheet-title').first().innerText() : ''
  return { url: new URL(page.url()).hash, sheet: sheets, title }
}

await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2200)

// 1. root -> exit confirmation, cancel with back
await back()
console.log('root back:', await state())
await back() // back cancels the dialog
console.log('after cancel:', await state())

// 2. deep route -> parent
await page.goto(BASE + '/#/invoices', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
await page.locator('.inv-card').first().click()
await page.waitForTimeout(700)
await back()
console.log('detail back:', await state())

// 3. open sheet -> back closes it, stays on route
await page.goto(BASE + '/#/invoices/new', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: /Select a client/i }).click()
await page.waitForTimeout(400)
await back()
console.log('sheet back:', await state())

// 4. focused input -> back blurs before navigating
await page.locator('.line-top input').first().fill('Focused')
await page.locator('.line-top input').first().focus()
await back()
console.log('input back:', await state())

// 5. unsaved editor changes -> discard guard
await page.locator('.line-top input').first().fill('Dirty line')
await page.waitForTimeout(300)
await back() // hides the keyboard / blurs first
await back() // now the discard guard
console.log('dirty back:', await state())
await page.getByRole('button', { name: /Discard/i }).click()
await page.waitForTimeout(800)
console.log('after discard:', await state())

console.log('ERRORS', JSON.stringify(errors))
await browser.close()
