// Render a PDF page to PNG and dump its text, for QA of the generated invoice.
import fs from 'node:fs'
import path from 'node:path'
import { createCanvas } from '@napi-rs/canvas'

const file = process.argv[2] || '/tmp/billfold-test.pdf'
const outDir = '/workspace/mockups/shots/pdf'
fs.mkdirSync(outDir, { recursive: true })

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const data = new Uint8Array(fs.readFileSync(file))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise
console.log('pages', doc.numPages)

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  fs.writeFileSync(path.join(outDir, `page-${p}.png`), canvas.toBuffer('image/png'))
  const text = await page.getTextContent()
  console.log(`--- page ${p} ---`)
  console.log(text.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').slice(0, 1200))
}
