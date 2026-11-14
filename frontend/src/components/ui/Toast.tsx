import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info' | 'warning'
interface Toast {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

interface ToastCtx {
  push: (toast: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastCtx | null>(null)

const toneConfig: Record<ToastTone, { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-success-600' },
  error: { icon: XCircle, color: 'text-danger-600' },
  warning: { icon: AlertCircle, color: 'text-warning-600' },
  info: { icon: Info, color: 'text-info-600' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { ...toast, id }])
      setTimeout(() => remove(id), 4500)
    },
    [remove],
  )

  const value = useMemo<ToastCtx>(() => ({
    push,
    success: (title, description) => push({ title, description, tone: 'success' }),
    error: (title, description) => push({ title, description, tone: 'error' }),
    info: (title, description) => push({ title, description, tone: 'info' }),
    warning: (title, description) => push({ title, description, tone: 'warning' }),
  }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => {
              const Icon = toneConfig[t.tone].icon
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: 40, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.9 }}
                  transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                  className="pointer-events-auto bg-white border border-slate-200 shadow-elevated rounded-xl p-4 flex gap-3 items-start"
                >
                  <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', toneConfig[t.tone].color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    className="text-slate-400 hover:text-slate-700 rounded p-0.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
