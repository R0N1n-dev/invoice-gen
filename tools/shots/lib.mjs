/** Shared helpers for the Playwright smoke tests. */
export const BASE = 'http://127.0.0.1:4173'

/** The app now ships empty; load the demo studio when a test needs invoices. */
export async function ensureSampleData(page, base = BASE) {
  await page.goto(base + '/#/invoices', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if (await page.locator('.inv-card').count()) return
  await page.goto(base + '/#/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /Load sample data/i }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /^Load sample$/ }).click()
  await page.waitForTimeout(1600)
}
