// Branded Android splash screens: gradient tile + wordmark + tagline.
import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

GlobalFonts.registerFromPath('/tmp/splashfonts/jakarta-800.ttf', 'JakartaExtraBold')
GlobalFonts.registerFromPath('/tmp/splashfonts/jakarta-500.ttf', 'JakartaMedium')

const res = '/workspace/android/app/src/main/res'
const BG = '#080B10'
const A = '#7C93FF'
const B = '#B78CFF'

function drawTile(ctx, cx, cy, size) {
  const x = cx - size / 2
  const y = cy - size / 2
  const r = size * 0.24
  const grad = ctx.createLinearGradient(x, y, x + size, y + size)
  grad.addColorStop(0, A)
  grad.addColorStop(1, B)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, r)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(x, y, size, size * 0.55, [r, r, 0, 0])
  const gloss = ctx.createLinearGradient(0, y, 0, y + size * 0.55)
  gloss.addColorStop(0, 'rgba(255,255,255,0.22)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  ctx.fill()
  ctx.fillStyle = BG
  ctx.font = `800 ${Math.round(size * 0.62)}px JakartaExtraBold`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', cx, cy + size * 0.03)
  ctx.restore()
}

function splash(width, height) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, width, height)

  const tile = Math.round(Math.min(width, height) * 0.26)
  const cy = height * 0.42
  drawTile(ctx, width / 2, cy, tile)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#F4F6FF'
  ctx.font = `800 ${Math.round(width * 0.105)}px JakartaExtraBold`
  ctx.fillText('Billfold', width / 2, cy + tile / 2 + width * 0.12)

  ctx.fillStyle = 'rgba(214, 221, 240, 0.62)'
  ctx.font = `500 ${Math.round(width * 0.036)}px JakartaMedium`
  ctx.fillText('INVOICE  GENERATOR', width / 2, cy + tile / 2 + width * 0.175)

  return canvas.toBuffer('image/png')
}

const sizes = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const base = { w: 360, h: 640 }

for (const dir of fs.readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const target = path.join(res, dir, 'splash.png')
  if (!fs.existsSync(target)) continue
  const density = dir.split('-').pop() ?? ''
  const scale = sizes[density] ?? 2
  const landscape = dir.includes('land')
  const w = Math.round(base.w * scale)
  const h = Math.round(base.h * scale)
  const png = landscape ? splash(h, w) : splash(w, h)
  fs.writeFileSync(target, png)
  console.log(dir, `${w}x${h}`, png.length)
}
