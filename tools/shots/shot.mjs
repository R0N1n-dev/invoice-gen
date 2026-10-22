import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const dir = '/workspace/mockups';
const out = path.join(dir, 'shots');
fs.mkdirSync(out, { recursive: true });

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['ledger.html', 'slate.html', 'bloom.html', 'swiss.html'];
const browser = await chromium.launch();
for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) { console.log('skip', f); continue; }
  const page = await browser.newPage({ viewport: { width: 1776, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8123/' + f, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const name = f.replace('.html', '');
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
  const size = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
  console.log(name, size);
  await page.close();
}
await browser.close();
