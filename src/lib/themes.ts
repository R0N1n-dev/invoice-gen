import type { Settings } from '@/types'
import { ensureContrast, hexToHsl, hsl, luminance, mix, readableInk, rgba, withLightness } from './colors'
import { setSystemBarStyle } from './native'

export type ColorMode = 'light' | 'dark' | 'system'
export type ResolvedMode = 'light' | 'dark'

export interface ThemeDef {
  id: string
  name: string
  useCase: string
  kind: 'dual' | 'triple'
  primary: string
  secondary: string
  accent: string
}

export const THEMES: ThemeDef[] = [
  {
    id: 'slate',
    name: 'Slate Indigo',
    useCase: 'The original Billfold look',
    kind: 'dual',
    primary: '#1B2350',
    secondary: '#7C93FF',
    accent: '#B78CFF',
  },
  {
    id: 'classic-corporate',
    name: 'Classic Corporate',
    useCase: 'Fintech, SaaS, crypto',
    kind: 'dual',
    primary: '#1E2761',
    secondary: '#408EC6',
    accent: '#408EC6',
  },
  {
    id: 'energetic-retail',
    name: 'Energetic Retail',
    useCase: 'E-commerce, delivery, travel',
    kind: 'dual',
    primary: '#2C3E50',
    secondary: '#E67E22',
    accent: '#E67E22',
  },
  {
    id: 'eco-organic',
    name: 'Eco-Organic',
    useCase: 'Sustainability, wellness',
    kind: 'dual',
    primary: '#2C5F2D',
    secondary: '#97BC62',
    accent: '#97BC62',
  },
  {
    id: 'cyber',
    name: 'Cyber High-Contrast',
    useCase: 'Developer tools, fitness',
    kind: 'dual',
    primary: '#1A1A1A',
    secondary: '#C1DD13',
    accent: '#C1DD13',
  },
  {
    id: 'editorial',
    name: 'Minimalist Editorial',
    useCase: 'Fashion, portfolio, lifestyle',
    kind: 'dual',
    primary: '#CC313D',
    secondary: '#F7C5CC',
    accent: '#CC313D',
  },
  {
    id: 'high-end-trio',
    name: 'The High-End Trio',
    useCase: 'Luxury retail, fine dining',
    kind: 'triple',
    primary: '#1E2761',
    secondary: '#408EC6',
    accent: '#7A2048',
  },
  {
    id: 'bright-tech',
    name: 'The Bright Tech Vibe',
    useCase: 'Dashboards, finance, data',
    kind: 'triple',
    primary: '#2D3047',
    secondary: '#2EC4B6',
    accent: '#FF7A59',
  },
  {
    id: 'playful-pastel',
    name: 'The Playful Pastel',
    useCase: 'Social, mindfulness, education',
    kind: 'triple',
    primary: '#B298E7',
    secondary: '#B8E3E9',
    accent: '#F5B8D5',
  },
  {
    id: 'earthy-muted',
    name: 'The Earthy Muted',
    useCase: 'Home decor, plants, architecture',
    kind: 'triple',
    primary: '#4A5842',
    secondary: '#EFEBE4',
    accent: '#D98A6C',
  },
]

export const DEFAULT_THEME_ID = 'slate'

export interface FontDef {
  id: string
  name: string
  vibe: string
  stack: string
}

export const FONTS: FontDef[] = [
  { id: 'jakarta', name: 'Plus Jakarta Sans', vibe: 'Friendly & professional', stack: "'Jakarta', system-ui, sans-serif" },
  { id: 'satoshi', name: 'Satoshi', vibe: 'Premium & sharp', stack: "'Satoshi', system-ui, sans-serif" },
  { id: 'outfit', name: 'Outfit', vibe: 'Warm & welcoming', stack: "'Outfit', system-ui, sans-serif" },
  { id: 'geist', name: 'Geist Sans', vibe: 'Precise & minimal', stack: "'Geist Sans', system-ui, sans-serif" },
  { id: 'cabinet', name: 'Cabinet Grotesk', vibe: 'Bold & stylized', stack: "'Cabinet Grotesk', system-ui, sans-serif" },
]

export const DEFAULT_FONT_ID = 'jakarta'

export function themeById(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function fontById(id: string): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0]
}

export function resolveMode(mode: ColorMode): ResolvedMode {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'
  }
  return mode
}

function heroGradient(theme: ThemeDef, mode: ResolvedMode): string {
  const base =
    mode === 'dark'
      ? [withLightness(theme.primary, 30), withLightness(theme.secondary, 44), withLightness(theme.accent, 40)]
      : [withLightness(theme.primary, 32), withLightness(theme.secondary, 46), withLightness(theme.accent, 50)]
  const [a, b, c] = base.map((color) => ensureContrast(color, '#FFFFFF', 3.4))
  return `linear-gradient(150deg, ${a} 0%, ${b} 48%, ${c} 100%)`
}

/** Build the complete CSS custom property set for a theme + mode. */
export function resolveTokens(theme: ThemeDef, mode: ResolvedMode): Record<string, string> {
  const p = hexToHsl(theme.primary)
  const isDark = mode === 'dark'

  const bg = isDark ? hsl(p.h, p.s * 0.34, 4.6) : hsl(p.h, Math.min(p.s, 40) * 0.4, 97.4)
  const surface = isDark ? hsl(p.h, p.s * 0.3, 8.2) : '#FFFFFF'
  const surface2 = isDark ? hsl(p.h, p.s * 0.26, 11.6) : hsl(p.h, Math.min(p.s, 40) * 0.32, 96.2)
  const surface3 = isDark ? hsl(p.h, p.s * 0.24, 15.5) : hsl(p.h, Math.min(p.s, 40) * 0.3, 93.4)
  const field = isDark ? hsl(p.h, p.s * 0.26, 9.6) : hsl(p.h, Math.min(p.s, 40) * 0.26, 96.8)
  const line = isDark ? hsl(p.h, p.s * 0.2, 17.5) : hsl(p.h, Math.min(p.s, 40) * 0.24, 89)
  const lineStrong = isDark ? hsl(p.h, p.s * 0.2, 25) : hsl(p.h, Math.min(p.s, 40) * 0.24, 79)
  const ink = isDark ? hsl(p.h, Math.min(p.s, 60) * 0.18, 96) : hsl(p.h, Math.min(p.s, 60) * 0.5, 13)
  const ink2 = isDark ? hsl(p.h, Math.min(p.s, 60) * 0.16, 84) : hsl(p.h, Math.min(p.s, 60) * 0.42, 24)
  const muted = isDark ? hsl(p.h, Math.min(p.s, 60) * 0.16, 66) : hsl(p.h, Math.min(p.s, 60) * 0.22, 40)
  const dim = isDark ? hsl(p.h, Math.min(p.s, 60) * 0.14, 56) : hsl(p.h, Math.min(p.s, 60) * 0.2, 46)

  // Pick the most usable brand colour for interactive elements.
  const candidates = [theme.secondary, theme.accent].filter(Boolean)
  let accent = candidates.sort((a, b) => luminance(b) - luminance(a))[0] ?? theme.primary
  if (luminance(accent) < 0.2) accent = withLightness(accent, 52)
  if (!isDark) accent = ensureContrast(accent, surface, 3.2)
  const accent2 = withLightness(accent, Math.min(isDark ? 78 : 62, hexToHsl(accent).l + 12))
  const accent3 = theme.accent === accent ? theme.secondary : theme.accent

  const accentInk = readableInk(accent)
  const link = ensureContrast(accent, surface, 4.6)
  const hero = heroGradient(theme, mode)
  const heroBase = withLightness(theme.primary, isDark ? 34 : 40)

  const ok = isDark ? '#3FDD9B' : '#0F9F6E'
  const warn = isDark ? '#FFB86B' : '#B45309'
  const danger = isDark ? '#FF6B81' : '#D22C45'

  return {
    '--bg': bg,
    '--surface': surface,
    '--surface-2': surface2,
    '--surface-3': surface3,
    '--field': field,
    '--line': line,
    '--line-strong': lineStrong,
    '--ink': ink,
    '--ink-2': ink2,
    '--muted': muted,
    '--dim': dim,
    '--accent': accent,
    '--accent-2': accent2,
    '--accent-3': accent3,
    '--accent-ink': accentInk,
    '--accent-soft': rgba(accent, isDark ? 0.16 : 0.12),
    '--accent-line': rgba(accent, isDark ? 0.4 : 0.55),
    '--link': link,
    '--ok': ok,
    '--ok-soft': rgba(ok, isDark ? 0.14 : 0.12),
    '--ok-line': rgba(ok, isDark ? 0.35 : 0.4),
    '--warn': warn,
    '--warn-soft': rgba(warn, isDark ? 0.15 : 0.12),
    '--danger': danger,
    '--danger-soft': rgba(danger, isDark ? 0.15 : 0.1),
    '--danger-line': rgba(danger, isDark ? 0.42 : 0.45),
    '--hero': hero,
    '--hero-ink': '#FFFFFF',
    '--hero-muted': 'rgba(255, 255, 255, 0.8)',
    '--hero-badge-bg': 'rgba(0, 0, 0, 0.22)',
    '--hero-badge-border': 'rgba(255, 255, 255, 0.24)',
    '--hero-shadow': `0 18px 40px -18px ${rgba(heroBase, isDark ? 0.75 : 0.45)}`,
    '--chrome': isDark ? hsl(p.h, p.s * 0.3, 7.2) : '#FFFFFF',
    '--chrome-alpha': isDark ? rgba(hsl(p.h, p.s * 0.3, 7.2), 0.94) : 'rgba(255, 255, 255, 0.92)',
    '--chrome-2': isDark ? hsl(p.h, p.s * 0.28, 6.2) : hsl(p.h, Math.min(p.s, 40) * 0.3, 96.6),
    '--scrim': isDark ? 'rgba(3, 6, 11, 0.68)' : 'rgba(23, 20, 31, 0.38)',
    '--hover': isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(10, 12, 20, 0.045)',
    '--glow-1': rgba(accent, isDark ? 0.14 : 0.1),
    '--glow-2': rgba(accent2, isDark ? 0.11 : 0.08),
    '--shadow': isDark
      ? '0 18px 40px -24px rgba(0, 0, 0, 0.9)'
      : '0 18px 40px -26px rgba(24, 20, 40, 0.35)',
    '--seg-on-bg': isDark ? surface3 : surface,
    '--seg-on-ink': ink,
    '--chip-on-bg': ink,
    '--chip-on-ink': bg,
  }
}

/** Apply a settings snapshot to the document + native system bars. */
export function applyAppearance(
  settings: Pick<Settings, 'themeId' | 'colorMode' | 'fontId'>,
): { mode: ResolvedMode; tokens: Record<string, string> } {
  const mode = resolveMode(settings.colorMode)
  const tokens = resolveTokens(themeById(settings.themeId), mode)
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value)
  root.style.setProperty('--font-ui', fontById(settings.fontId).stack)
  root.dataset.mode = mode
  root.dataset.theme = settings.themeId
  root.style.colorScheme = mode

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? tokens['--bg'] : tokens['--chrome'])

  // Keep the mobile status bar legible: dark UI -> light icons, light UI -> dark icons.
  void setSystemBarStyle(mode === 'dark')

  return { mode, tokens }
}

export function themeSwatches(theme: ThemeDef): string[] {
  return theme.kind === 'dual' ? [theme.primary, mix(theme.primary, theme.secondary, 0.35), theme.secondary] : [theme.primary, theme.secondary, theme.accent]
}
