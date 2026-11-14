import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'teal' | 'purple'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  dot?: boolean
  children: React.ReactNode
}

const toneClasses: Record<Tone, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-info-100 text-info-700',
  teal: 'bg-teal-100 text-teal-700',
  purple: 'bg-purple-100 text-purple-700',
}

const dotClasses: Record<Tone, string> = {
  default: 'bg-slate-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
}

export function Badge({ tone = 'default', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotClasses[tone])} />}
      {children}
    </span>
  )
}

// Convenience helpers for status-based badges
export function statusTone(status: string): Tone {
  const map: Record<string, Tone> = {
    Active: 'success',
    VIP: 'teal',
    Inactive: 'default',
    Lead: 'info',
    Churned: 'danger',
    New: 'info',
    Contacted: 'default',
    Interested: 'teal',
    'Follow-up': 'warning',
    Converted: 'success',
    Lost: 'danger',
    Pending: 'warning',
    Confirmed: 'info',
    Assigned: 'teal',
    'In Progress': 'info',
    Completed: 'success',
    Cancelled: 'danger',
    Unpaid: 'danger',
    Partial: 'warning',
    Paid: 'success',
    Refunded: 'default',
    Answered: 'success',
    Missed: 'danger',
    Busy: 'warning',
    Rejected: 'default',
    Failed: 'danger',
    Available: 'success',
    Processing: 'warning',
    Unavailable: 'default',
    'Permission Denied': 'danger',
    Todo: 'default',
    Review: 'warning',
    Done: 'success',
  }
  return map[status] || 'default'
}

export function priorityTone(p: string): Tone {
  const map: Record<string, Tone> = {
    Low: 'default',
    Medium: 'info',
    High: 'warning',
    Hot: 'danger',
    Urgent: 'danger',
  }
  return map[p] || 'default'
}
