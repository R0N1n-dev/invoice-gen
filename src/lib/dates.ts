const DATE_FMT: Record<string, Intl.DateTimeFormatOptions> = {
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  iso: { year: 'numeric', month: '2-digit', day: '2-digit' },
}

/** Parse a stored YYYY-MM-DD as a local date (avoids UTC drift). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function formatDate(
  iso: string,
  locale = 'en-US',
  style: 'medium' | 'short' | 'iso' = 'medium',
): string {
  if (!iso) return '—'
  const d = parseISODate(iso)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(locale, DATE_FMT[style] ?? DATE_FMT.medium).format(d)
  } catch {
    return iso
  }
}

export function monthKey(iso: string): string {
  return (iso || '').slice(0, 7)
}

export function monthLabel(iso: string, locale = 'en-US'): string {
  const d = parseISODate(iso)
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
  } catch {
    return monthKey(iso)
  }
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO).getTime()
  const b = parseISODate(toISO).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function daysOverdue(dueISO: string, today = todayISO()): number {
  return Math.max(0, daysBetween(dueISO, today))
}

export function relativeDueLabel(dueISO: string, today = todayISO()): string {
  const diff = daysBetween(today, dueISO)
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff > 1) return `Due in ${diff} days`
  if (diff === -1) return '1 day late'
  return `${Math.abs(diff)} days late`
}

export function lastMonths(count: number): { key: string; label: string; start: string }[] {
  const out: { key: string; label: string; start: string }[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d).toUpperCase(),
      start: toISODate(d),
    })
  }
  return out
}
