import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

GlobalFonts.registerFromPath(
  '/workspace/node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
  'InterBold',
)

const res = '/workspace/android/app/src/main/res'
const BG = '#080B10'
const A = '#7C93FF'
const B = '#B78CFF'

function tile(ctx, size, opts = {}) {
  const { radius = size * 0.23, inset = 0 } = opts
  const s = size - inset * 2
  const x = inset
  const y = inset
  const r = Math.min(radius, s / 2)
  const grad = ctx.createLinearGradient(x, y, x + s, y + s)
  grad.addColorStop(0, A)
  grad.addColorStop(1, B)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, s, s, r)
  ctx.fillStyle = grad
  ctx.fill()
  // subtle highlight
  ctx.beginPath()
  ctx.roundRect(x, y, s, s * 0.55, [r, r, 0, 0])
  const gloss = ctx.createLinearGradient(0, y, 0, y + s * 0.55)
  gloss.addColorStop(0, 'rgba(255,255,255,0.22)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  ctx.fill()
  // B
  ctx.fillStyle = BG
  ctx.font = `700 ${Math.round(s * 0.62)}px InterBold`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', x + s / 2, y + s * 0.53)
  ctx.restore()
}

function icon(size, round = false) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  if (round) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, size, size)
    tile(ctx, size, { radius: size * 0.5 })
    ctx.restore()
  } else {
    tile(ctx, size)
  }
  return canvas.toBuffer('image/png')
}

function foreground(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const inner = Math.round(size * 0.52)
  const inset = Math.round((size - inner) / 2)
  tile(ctx, size, { radius: inner * 0.24, inset })
  return canvas.toBuffer('image/png')
}

function splash(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, size, size)
  const inner = Math.round(size * 0.2)
  const inset = Math.round((size - inner) / 2)
  tile(ctx, size, { radius: inner * 0.24, inset })
  return canvas.toBuffer('image/png')
}

const legacy = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}
const fg = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
}

for (const [dir, size] of Object.entries(legacy)) {
  fs.writeFileSync(path.join(res, dir, 'ic_launcher.png'), icon(size))
  fs.writeFileSync(path.join(res, dir, 'ic_launcher_round.png'), icon(size, true))
}
for (const [dir, size] of Object.entries(fg)) {
  fs.writeFileSync(path.join(res, dir, 'ic_launcher_foreground.png'), foreground(size))
}
for (const dir of fs.readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const p = path.join(res, dir, 'splash.png')
  if (fs.existsSync(p)) fs.writeFileSync(p, splash(1200))
}

// web / PWA icons
const pub = '/workspace/public'
fs.writeFileSync(path.join(pub, 'icon-192.png'), icon(192))
fs.writeFileSync(path.join(pub, 'icon-512.png'), icon(512))
fs.writeFileSync(path.join(pub, 'icon-maskable-512.png'), foreground(512))
console.log('icons generated')
