import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20'
              : 'border-slate-200 focus:border-teal-500',
            icon && 'pl-10',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20',
          'disabled:opacity-50',
          error
            ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20'
            : 'border-slate-200 focus:border-teal-500',
          className,
        )}
        rows={3}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20'
            : 'border-slate-200 focus:border-teal-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, children, ...props }, ref) => (
    <label ref={ref} className={cn('block text-sm font-medium text-slate-700 mb-1.5', className)} {...props}>
      {children}
    </label>
  ),
)
Label.displayName = 'Label'

export const FieldError = ({ children }: { children?: React.ReactNode }) =>
  children ? <p className="mt-1 text-xs text-danger-600">{children}</p> : null

export const FieldHelp = ({ children }: { children?: React.ReactNode }) =>
  children ? <p className="mt-1 text-xs text-slate-500">{children}</p> : null
