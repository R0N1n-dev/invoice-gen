import fs from 'node:fs'
import { createRequire } from 'node:module'
import { Document, Matrix, ColorSpace } from 'mupdf'
const require = createRequire('/workspace/package.json')
const { PDFDocument, rgb } = require('pdf-lib')
const fontkit = require('@pdf-lib/fontkit')

const cases = [
  ['inter-sub', '/tmp/inter-gf-400.ttf', true],
  ['inter-full', '/tmp/inter-gf-400.ttf', false],
  ['dejavu-sub', '/workspace/.libs/root/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', true],
]
for (const [name, file, subset] of cases) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(fs.readFileSync(file), { subset })
  const page = doc.addPage([420, 170])
  page.drawText('Northwind Studio - Invoice INV-2026-0043', { x: 20, y: 120, size: 12, font, color: rgb(0, 0, 0) })
  page.drawText('Total due $1,822.80 EUR GBP INR', { x: 20, y: 88, size: 12, font, color: rgb(0, 0, 0) })
  page.drawText('The quick brown fox jumps over the lazy dog 0123456789', { x: 20, y: 56, size: 10, font, color: rgb(0, 0, 0) })
  const bytes = await doc.save()
  fs.writeFileSync('/tmp/' + name + '.pdf', bytes)
  const mdoc = Document.openDocument(bytes, 'application/pdf')
  const pix = mdoc.loadPage(0).toPixmap(Matrix.scale(2, 2), ColorSpace.DeviceRGB, false)
  fs.writeFileSync('/workspace/mockups/shots/pdf/' + name + '.png', pix.asPNG())
  console.log(name, bytes.length)
}
