import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelLeftClose, PanelLeft, Sparkles, ChevronRight, LogOut, X } from 'lucide-react'
import { navItems } from '@/routes/nav'
import { Avatar, Tooltip } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ui/Toast'
import logo from '@/assets/logo.jpeg'

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

/** Hides the scrollbar but keeps the list reachable on very short screens. */
const NO_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/** Soft brand glows behind the sidebar content. */
function Glows() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 -z-10 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-20 -z-10 h-56 w-56 rounded-full bg-indigo-300/15 blur-3xl" />
    </>
  )
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const { user, logout } = useAuth()
  const toast = useToast()
  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.includes(user?.role ?? 'Calling Executive'))

  // While the mobile drawer is open, stop the page behind it from scrolling.
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  const Brand = (
    <div
      className={cn(
        'relative flex h-[68px] flex-shrink-0 items-center gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white/0 px-4',
        collapsed && 'lg:justify-center lg:px-0',
      )}
    >
      <div className="theme-keep flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
        <img src={logo} alt="vehico CRM" className="h-full w-full object-contain" />
      </div>
      {(!collapsed || mobileOpen) && (
        <div className="min-w-0">
          <p className="brand-title truncate bg-gradient-to-r from-navy-900 to-navy-700 bg-clip-text text-[15px] font-extrabold leading-tight tracking-tight text-transparent">
            vehico CRM
          </p>
          <p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-teal-600">CAB Service CRM</p>
        </div>
      )}
      <button
        onClick={() => setMobileOpen(false)}
        aria-label="Close menu"
        className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 lg:hidden"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )

  const NavList = (
    <nav
      className={cn(
        'min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4',
        NO_SCROLLBAR,
      )}
    >
      {visibleNavItems.map((item) => {
        const Icon = item.icon
        const target = item.to === '/'
          ? user?.role === 'Admin' ? '/admin/dashboard' : '/executive/dashboard'
          : item.to
        const link = (
          <NavLink
            key={target}
            to={target}
            end={target.endsWith('/dashboard')}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
                collapsed && 'lg:justify-center lg:px-0',
                isActive
                  ? 'bg-gradient-to-r from-navy-900 to-navy-700 text-white shadow-lg shadow-navy-900/25 ring-1 ring-inset ring-white/10'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm hover:ring-1 hover:ring-inset hover:ring-slate-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.9)]"
                  />
                )}
                <span
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-white/10 text-teal-300 ring-1 ring-inset ring-white/10'
                      : 'bg-slate-100/80 text-slate-500 group-hover:-translate-y-px group-hover:bg-gradient-to-br group-hover:from-teal-50 group-hover:to-white group-hover:text-teal-700 group-hover:shadow-sm',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                {(!collapsed || mobileOpen) && item.badge && (
                  <span
                    className={cn(
                      'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      item.badgeTone === 'danger' && 'bg-danger-100 text-danger-700',
                      item.badgeTone === 'warning' && 'bg-warning-100 text-warning-700',
                      item.badgeTone === 'info' && 'bg-info-100 text-info-700',
                      !item.badgeTone && 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        )
        return collapsed && !mobileOpen ? (
          <Tooltip key={target} label={item.label} side="right">
            {link}
          </Tooltip>
        ) : (
          link
        )
      })}
    </nav>
  )

  // Hidden on short screens so the sidebar never needs to scroll.
  const UpgradeCard = !collapsed && !mobileOpen && (
    <div className="flex-shrink-0 px-3 pb-3 [@media(max-height:720px)]:hidden">
      <div className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-4 text-white shadow-lg shadow-navy-900/25 ring-1 ring-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 -z-10 h-28 w-28 rounded-full bg-teal-400/30 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-6 -z-10 h-24 w-24 rounded-full bg-indigo-400/25 blur-2xl" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 backdrop-blur">
          <Sparkles className="h-[18px] w-[18px] text-teal-300" />
        </div>
        <p className="text-sm font-semibold leading-tight">Premium CRM Suite</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-300">Built on Innovation. Powered by Intelligence.</p>
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-teal-300 ring-1 ring-inset ring-white/10">
          <span>v1.0 Enterprise</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  )

  const UserArea = (
    <div className="flex-shrink-0 border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 p-2 shadow-sm backdrop-blur transition-colors hover:bg-white',
          collapsed && 'lg:justify-center lg:border-transparent lg:bg-transparent lg:shadow-none',
        )}
      >
        <div className="relative flex-shrink-0">
          <Avatar name={user?.name ?? ''} size="sm" />
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
          />
        </div>
        {(!collapsed || mobileOpen) && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-[10px] font-medium text-slate-500">{user?.role}</p>
          </div>
        )}
        {(!collapsed || mobileOpen) && (
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              try {
                await logout()
              } catch (error) {
                toast.error('Sign out failed', error instanceof Error ? error.message : 'Please try again.')
              }
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )

  const CollapseToggle = (
    <button
      onClick={() => setCollapsed(!collapsed)}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="absolute -right-3 top-20 z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-soft transition-all hover:scale-110 hover:border-teal-300 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 lg:flex"
    >
      {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
    </button>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'app-chrome fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 bg-white shadow-[4px_0_24px_-12px_rgba(15,23,42,0.12)] transition-all duration-300 lg:block',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        {CollapseToggle}
        {/* Inner wrapper clips content so the sidebar itself never scrolls. */}
        <div className="relative isolate flex h-full flex-col overflow-hidden">
          <Glows />
          {Brand}
          {NavList}
          {UpgradeCard}
          {UserArea}
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="print-hide fixed inset-0 z-40 bg-navy-950/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
              className="app-chrome fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden rounded-r-3xl border-r border-slate-200/80 bg-white shadow-2xl lg:hidden"
            >
              <div className="relative isolate flex h-full flex-col overflow-hidden">
                <Glows />
                {Brand}
                {NavList}
                {UserArea}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}