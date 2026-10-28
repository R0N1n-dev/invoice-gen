/** Small colour toolkit used by the theme engine. Everything is plain hex in/out. */

export interface HSL {
  h: number
  s: number
  l: number
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#000000').replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0')
  const n = Number.parseInt(full.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function hexToHsl(hex: string): HSL {
  const [r0, g0, b0] = hexToRgb(hex)
  const r = r0 / 255
  const g = g0 / 255
  const b = b0 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hsl(h: number, s: number, l: number): string {
  const sN = Math.max(0, Math.min(100, s)) / 100
  const lN = Math.max(0, Math.min(100, l)) / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sN * Math.min(lN, 1 - lN)
  const f = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

export function withLightness(hex: string, lightness: number): string {
  const c = hexToHsl(hex)
  return hsl(c.h, c.s, lightness)
}

export function withSaturation(hex: string, saturation: number): string {
  const c = hexToHsl(hex)
  return hsl(c.h, saturation, c.l)
}

export function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount)
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** WCAG relative luminance, 0..1 */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

/** Black or white, whichever reads better on the given background. */
export function readableInk(background: string): string {
  return contrastRatio(background, '#0A0E15') >= contrastRatio(background, '#FFFFFF')
    ? '#0A0E15'
    : '#FFFFFF'
}

/** Darken/lighten until the colour reaches the required contrast against a background. */
export function ensureContrast(color: string, background: string, target = 4.5): string {
  const bgIsLight = luminance(background) > 0.45
  let out = color
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(out, background) >= target) return out
    const c = hexToHsl(out)
    out = hsl(c.h, c.s, bgIsLight ? Math.max(8, c.l - 3) : Math.min(96, c.l + 3))
  }
  return out
}
