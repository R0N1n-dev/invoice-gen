const fs = require('fs')
const fontkit = require('@pdf-lib/fontkit')

const [src, dst] = process.argv.slice(2)
const font = fontkit.create(fs.readFileSync(src))
const subset = font.createSubset()
const chars = []
for (let cp = 32; cp <= 126; cp++) chars.push(cp)
for (let cp = 160; cp <= 255; cp++) chars.push(cp)
;[0x20ac, 0x00a3, 0x00a5, 0x20b9, 0x20bd, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x2022, 0x00b7, 0x00d7, 0x00f7, 0x2030, 0x2116, 0x2192, 0x2190, 0x00a0].forEach((c) => chars.push(c))
let included = 0
for (const cp of chars) {
  const g = font.glyphForCodePoint(cp)
  if (g && g.id) {
    subset.includeGlyph(g)
    included++
  }
}
const out = subset.encode()
fs.writeFileSync(dst, Buffer.from(out))
console.log(src.split('/').pop(), '->', dst.split('/').pop(), included, 'glyphs', out.length, 'bytes')
