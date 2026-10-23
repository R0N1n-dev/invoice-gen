/** Currencies with a non-two-decimal minor unit. Everything else uses 2. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'XAF', 'XOF', 'PYG', 'RWF'])
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])

export function currencyDigits(code: string): number {
  const c = (code || 'USD').toUpperCase()
  if (ZERO_DECIMAL.has(c)) return 0
  if (THREE_DECIMAL.has(c)) return 3
  return 2
}

export function toMajor(minor: number, currency: string): number {
  return minor / Math.pow(10, currencyDigits(currency))
}

export function toMinor(major: number, currency: string): number {
  return Math.round(major * Math.pow(10, currencyDigits(currency)))
}

/** Parse a user-typed amount ("1 234,56", "1,234.56", "12.5") into minor units. */
export function parseAmount(input: string | number, currency: string): number {
  if (typeof input === 'number') return toMinor(input, currency)
  const cleaned = input
    .replace(/[^\d.,-]/g, '')
    .replace(/\s/g, '')
  if (!cleaned) return 0
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized = cleaned
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = cleaned.replace(/,/g, '')
  }
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? toMinor(n, currency) : 0
}

/** A plain, dot-decimal string suitable for an <input type="number">. */
export function amountInputValue(minor: number, currency: string): string {
  const digits = currencyDigits(currency)
  const value = toMajor(minor, currency)
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits)
}

export function formatMoney(
  minor: number,
  currency = 'USD',
  locale = 'en-US',
  opts: { compact?: boolean; signed?: boolean } = {},
): string {
  const digits = currencyDigits(currency)
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      notation: opts.compact ? 'compact' : 'standard',
    }).format(toMajor(minor, currency))
    if (opts.signed && minor > 0) return `+${ formatted }`
    return formatted
  } catch {
    return `${currency} ${toMajor(minor, currency).toFixed(digits)}`
  }
}

/** Plain grouped number, no symbol — used inside PDF tables. */
export function formatAmount(minor: number, currency = 'USD', locale = 'en-US'): string {
  const digits = currencyDigits(currency)
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toMajor(minor, currency))
}

export function currencySymbol(currency: string, locale = 'en-US'): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK',
  'DKK', 'PLN', 'CZK', 'BRL', 'MXN', 'ZAR', 'NGN', 'AED', 'SAR', 'SGD',
  'HKD', 'NZD', 'TRY', 'KRW', 'CNY', 'THB', 'IDR', 'MYR', 'PHP', 'VND',
  'ILS', 'EGP', 'KES', 'GHS', 'PKR', 'BDT', 'LKR', 'UAH', 'RON', 'HUF',
]

export const LOCALES = [
  'en-US', 'en-GB', 'en-IN', 'en-CA', 'en-AU', 'de-DE', 'fr-FR', 'es-ES',
  'it-IT', 'pt-PT', 'pt-BR', 'nl-NL', 'sv-SE', 'nb-NO', 'da-DK', 'fi-FI',
  'pl-PL', 'cs-CZ', 'tr-TR', 'ja-JP', 'ko-KR', 'zh-CN', 'hi-IN', 'id-ID',
]
