import { type ReactNode } from 'react'
import { cn, initials as getInitials, avatarColor } from '@/lib/utils'

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: string
  className?: string
  src?: string
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({ name, size = 'md', color, className, src }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium flex-shrink-0 overflow-hidden',
        sizeClasses[size],
        color || avatarColor(name),
        className,
      )}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  )
}

export function AvatarStack({ names, max = 4, size = 'sm' }: { names: string[]; max?: number; size?: 'xs' | 'sm' | 'md' }) {
  const visible = names.slice(0, max)
  const remaining = names.length - max
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((name, i) => (
        <span key={i} className="ring-2 ring-white rounded-full">
          <Avatar name={name} size={size} />
        </span>
      ))}
      {remaining > 0 && (
        <span
          className={cn(
            'ring-2 ring-white rounded-full bg-slate-100 text-slate-600 inline-flex items-center justify-center font-medium',
            sizeClasses[size],
          )}
        >
          +{remaining}
        </span>
      )}
    </div>
  )
}

interface TooltipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function Tooltip({ label, children, side = 'right' }: TooltipProps) {
  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  }
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className={cn(
          'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-navy-900 rounded-md whitespace-nowrap',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none',
          sideClasses[side],
        )}
      >
        {label}
      </span>
    </span>
  )
}
