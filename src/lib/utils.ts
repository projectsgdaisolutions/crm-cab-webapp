import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combine class names with Tailwind merge logic. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number with thousands separators. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

/** Format currency (INR by default for CAB service context). */
export function formatCurrency(n: number, currency: 'INR' | 'USD' = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

/** Format seconds → mm:ss for call durations. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

/** Format ISO date → readable date. */
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...opts,
    }).format(d)
  } catch {
    return iso
  }
}

/** Format ISO date → readable time. */
export function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return iso
  }
}

/** Format ISO date → relative ("2h ago", "3d ago"). */
export function formatRelative(iso: string): string {
  const d = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return formatDate(iso)
}

/** Generate initials from a name. */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Pick a deterministic color for an avatar based on the name. */
export function avatarColor(name: string): string {
  const colors = [
    'bg-navy-700 text-white',
    'bg-teal-600 text-white',
    'bg-info-600 text-white',
    'bg-purple-600 text-white',
    'bg-warning-600 text-white',
    'bg-success-600 text-white',
    'bg-danger-600 text-white',
    'bg-slate-700 text-white',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

/** Truncate text with ellipsis. */
export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/** True if two dates fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Export an array of objects as a CSV string. */
export function toCSV(rows: Record<string, string | number | boolean | null>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\n')
}

/** Trigger a CSV file download in the browser. */
export function downloadCSV(filename: string, rows: Record<string, string | number | boolean | null>[]) {
  const csv = toCSV(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
