import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4173'
const out = '/workspace/mockups/shots/themes'
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

const shot = async (name) => {
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${out}/${name}.png` })
  console.log('shot', name)
}

const go = async (hash) => {
  await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
}

await go('/')
await shot('01-dark-slate')

await go('/settings')
await shot('02-settings-dark')

// custom picker instead of a native select
await page.locator('.app-select').first().click()
await shot('03-picker-sheet')
await page.locator('.as-option', { hasText: /^EUR$/ }).first().click()
await page.waitForTimeout(400)

const setMode = async (mode) => {
  await page.locator('.segmented button', { hasText: mode }).first().click()
  await page.waitForTimeout(450)
}
const setTheme = async (name) => {
  await page.locator('.theme-card', { hasText: name }).first().click()
  await page.waitForTimeout(450)
}
const setFont = async (name) => {
  await page.locator('.font-row', { hasText: name }).first().click()
  await page.waitForTimeout(450)
}

await setMode('Light')
await shot('04-settings-light')
await go('/')
await shot('05-light-slate')

const lightThemes = ['Classic Corporate', 'Energetic Retail', 'Eco-Organic', 'Minimalist Editorial', 'The Playful Pastel', 'The Earthy Muted']
for (const [i, name] of lightThemes.entries()) {
  await go('/settings')
  await setTheme(name)
  await go('/')
  await shot(`1${i}-light-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`)
}

await go('/settings')
await setMode('Dark')
const darkThemes = ['Cyber High-Contrast', 'The High-End Trio', 'The Bright Tech Vibe']
for (const [i, name] of darkThemes.entries()) {
  await go('/settings')
  await setTheme(name)
  await go('/')
  await shot(`2${i}-dark-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`)
}

// fonts
await go('/settings')
await setTheme('Classic Corporate')
for (const [i, name] of ['Satoshi', 'Outfit', 'Geist Sans', 'Cabinet Grotesk'].entries()) {
  await go('/settings')
  await setFont(name)
  await go('/')
  await shot(`3${i}-font-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`)
}

// invoice + editor in light mode
await go('/settings')
await setMode('Light')
await setTheme('Earthy Muted')
await go('/invoices')
await page.locator('.inv-card').first().click()
await shot('40-light-invoice-detail')
await go('/invoices/new')
await shot('41-light-editor')

console.log('ERRORS', JSON.stringify(errors))
await browser.close()
