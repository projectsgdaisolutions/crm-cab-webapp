import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'vehico-theme'

const ThemeContext = createContext<{
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
} | null>(null)

export function readStoredTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    /* storage can be unavailable */
  }
  return 'light'
}

export function applyTheme(theme: ThemeMode) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    const beforePrint = () => {
      document.documentElement.classList.add('printing')
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    }
    const afterPrint = () => {
      document.documentElement.classList.remove('printing')
      applyTheme(theme)
    }
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
    }
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme: (next: ThemeMode) => setThemeState(next),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

const OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light Mode' },
  { id: 'dark', label: 'Dark Mode' },
  { id: 'system', label: 'System Default' },
]

export function ThemeSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={className}>
      <p className={cn('font-medium text-slate-700', compact ? 'mb-2 text-xs' : 'mb-2 text-sm')}>Theme</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
        {OPTIONS.map((option) => {
          const selected = theme === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option.id)}
              className={cn(
                'rounded-full border font-medium transition-colors',
                compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
                selected
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
