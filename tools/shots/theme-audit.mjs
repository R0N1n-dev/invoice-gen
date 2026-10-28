import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

const themes = await page.locator('.theme-card .theme-name').allInnerTexts()
const results = []

async function audit(label) {
  const data = await page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const [r, g, b, a = 1] = m[1].split(',').map((v) => Number.parseFloat(v))
      return { r, g, b, a }
    }
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (fg, bg) => {
      const a = lum(fg)
      const b = lum(bg)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    const bgOf = (el) => {
      let node = el
      while (node) {
        const c = getComputedStyle(node).backgroundColor
        const p = parse(c)
        if (p && p.a > 0.5) return p
        node = node.parentElement
      }
      return parse(getComputedStyle(document.body).backgroundColor)
    }
    const checks = [
      ['title', 'h1.page-title'],
      ['body', '.page-sub'],
      ['section', '.settings-title'],
      ['row title', '.settings-row .st'],
      ['row subtitle', '.settings-row .ss'],
      ['field label', '.field .label'],
      ['inactive segmented', '.segmented button:not(.on)'],
      ['theme name', '.theme-card .theme-name'],
      ['theme kind', '.theme-kind'],
      ['tab', '.tab:not(.on)'],
    ]
    return checks.map(([name, selector]) => {
      const el = document.querySelector(selector)
      if (!el) return { name, ratio: null }
      const fg = parse(getComputedStyle(el).color)
      const bg = bgOf(el)
      return { name, ratio: fg && bg ? Number(ratio(fg, bg).toFixed(2)) : null }
    })
  })
  const worst = data.filter((d) => d.ratio !== null).sort((a, b) => a.ratio - b.ratio)[0]
  results.push({ label, worst: worst?.name, ratio: worst?.ratio, details: data })
  console.log(label.padEnd(30), 'worst:', String(worst?.ratio).padEnd(6), worst?.name)
}

for (const mode of ['Dark', 'Light']) {
  await page.locator('.segmented button', { hasText: mode }).first().click()
  await page.waitForTimeout(400)
  for (const theme of themes) {
    await page.locator('.theme-card', { hasText: theme }).first().click()
    await page.waitForTimeout(350)
    await audit(`${mode} · ${theme}`)
  }
}

// report anything below 3:1
const failures = []
for (const r of results) {
  for (const d of r.details) {
    if (d.ratio !== null && d.ratio < 3) failures.push(`${r.label} → ${d.name}: ${d.ratio}`)
  }
}
console.log('\nbelow 3:1:', failures.length ? failures.join('\n') : 'none')
console.log('ERRORS', JSON.stringify(errors))
fs.writeFileSync('/tmp/theme-audit.json', JSON.stringify(results, null, 2))
await browser.close()
