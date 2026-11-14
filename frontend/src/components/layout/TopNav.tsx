import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, Search, Bell, Plus, ChevronRight, User as UserIcon, Settings, LogOut, LockKeyhole, CheckCheck, RefreshCw,
  Users, UserPlus, Car, Phone, X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn, formatRelative } from '@/lib/utils'
import { navItems } from '@/routes/nav'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { bookingService, callService, customerService, leadService, notificationService } from '@/services'
import type { Booking, CallRecord, Customer, Lead, Notification } from '@/types'
import { ThemeSwitcher } from '@/theme/ThemeProvider'

interface TopNavProps {
  onMobileMenu: () => void
  onQuickAction: () => void
}

export function TopNav({ onMobileMenu, onQuickAction }: TopNavProps) {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [notificationError, setNotificationError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [results, setResults] = useState<{ customers: Customer[]; leads: Lead[]; bookings: Booking[]; calls: CallRecord[] }>({ customers: [], leads: [], bookings: [], calls: [] })
  const [notifications, setNotifications] = useState<Notification[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Compute breadcrumbs from path
  const crumbs = useMemo(() => {
    if (location.pathname === '/admin/dashboard' || location.pathname === '/executive/dashboard') {
      return [{ label: 'Dashboard', to: location.pathname }]
    }
    const path = location.pathname.split('/').filter(Boolean)
    if (path.length === 0) return [{ label: 'Dashboard', to: '/' }]
    return path.map((seg, i) => {
      const item = navItems.find((n) => n.to === `/${seg}`)
      return { label: item?.label || seg.charAt(0).toUpperCase() + seg.slice(1), to: `/${path.slice(0, i + 1).join('/')}` }
    })
  }, [location.pathname])

  // Keyboard shortcut: Cmd/Ctrl + K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setNotifOpen(false)
        setProfileOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  const refreshNotifications = useCallback(async (showToast = false) => {
    if (showToast) setNotificationsLoading(true)
    try {
      const result = await notificationService.listWithUnreadCount()
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
      setNotificationError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      setNotificationError(message)
      if (showToast) toast.error('Could not load notifications', message)
    } finally {
      setNotificationsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    setNotifications([])
    setNotificationsLoading(true)
    void refreshNotifications()
    const interval = window.setInterval(() => void refreshNotifications(), 60000)
    return () => window.clearInterval(interval)
  }, [refreshNotifications, user?.id])

  useEffect(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      setResults({ customers: [], leads: [], bookings: [], calls: [] })
      return
    }
    let active = true
    Promise.all([customerService.list(), leadService.list(), bookingService.list(), callService.list()])
      .then(([customers, leads, bookings, calls]) => {
        if (!active) return
        setResults({
          customers: customers.filter((customer) => customer.name.toLowerCase().includes(normalizedQuery) || customer.phone.includes(normalizedQuery) || customer.email.toLowerCase().includes(normalizedQuery)).slice(0, 4),
          leads: leads.filter((lead) => lead.name.toLowerCase().includes(normalizedQuery) || lead.phone.includes(normalizedQuery)).slice(0, 4),
          bookings: bookings.filter((booking) => booking.customerName.toLowerCase().includes(normalizedQuery) || booking.bookingId.toLowerCase().includes(normalizedQuery)).slice(0, 4),
          calls: calls.filter((call) => call.customerOrLeadName.toLowerCase().includes(normalizedQuery) || call.phoneNumber.includes(normalizedQuery)).slice(0, 4),
        })
      })
      .catch((error: unknown) => toast.error('Search failed', error instanceof Error ? error.message : 'Please try again.'))
    return () => { active = false }
  }, [query, toast])

  const hasResults = results.customers.length + results.leads.length + results.bookings.length + results.calls.length > 0

  const goToNotificationTarget = useCallback((notification: Notification) => {
    const routeMap: Record<string, string> = {
      customer: '/customers',
      lead: '/leads',
      'follow-up': '/followups',
      booking: '/bookings',
      task: '/tasks',
      call: '/calls',
    }

    const targetType = notification.relatedType ?? notification.type
    const route = targetType ? routeMap[targetType] : null
    if (route) {
      navigate(route)
      setNotifOpen(false)
    }
  }, [navigate])

  const markNotificationRead = async (notification: Notification) => {
    if (notification.read) return
    try {
      await notificationService.markRead(notification.id)
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (error) {
      toast.error('Could not update notification', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const markAllNotificationsRead = async () => {
    try {
      await notificationService.markAllRead()
      setNotifications((items) => items.map((item) => ({ ...item, read: true })))
      setUnreadCount(0)
    } catch (error) {
      toast.error('Could not update notifications', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <>
      <header className="app-chrome sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4">
        <button
          onClick={onMobileMenu}
          className="lg:hidden text-slate-500 hover:text-slate-900 p-1.5"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {crumbs.map((c, i) => (
            <span key={c.to} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
              <Link
                to={c.to}
                className={cn(
                  'hover:text-slate-900 transition-colors',
                  i === crumbs.length - 1 ? 'text-slate-900 font-medium' : 'text-slate-500',
                )}
              >
                {c.label}
              </Link>
            </span>
          ))}
        </nav>

        {/* Global Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="ml-auto hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors w-64"
        >
          <Search className="h-4 w-4" />
          <span className="text-sm">Search anything...</span>
          <kbd className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-400">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden ml-auto text-slate-500 hover:text-slate-900 p-1.5"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Quick action */}
        <button
          onClick={onQuickAction}
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors shadow-soft"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden lg:inline">Quick Action</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              const opening = !notifOpen
              setNotifOpen(opening)
              if (opening) void refreshNotifications(true)
            }}
            aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-danger-500 text-[9px] font-semibold text-white ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-elevated z-40 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                    <div className="flex items-center gap-1.5">
                      <Badge tone="danger">{unreadCount} unread</Badge>
                      <button
                        type="button"
                        onClick={() => void refreshNotifications(true)}
                        aria-label="Refresh notifications"
                        title="Refresh notifications"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notificationsLoading ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">Loading notifications...</p>
                    ) : notificationError ? (
                      <div className="px-4 py-6 text-center">
                        <p role="alert" className="text-sm text-danger-600">{notificationError}</p>
                        <button type="button" onClick={() => void refreshNotifications(true)} className="mt-2 text-xs font-medium text-teal-700 hover:underline">Try again</button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications.</p>
                    ) : notifications.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          void markNotificationRead(n)
                          goToNotificationTarget(n)
                        }}
                        className={cn(
                          'w-full px-4 py-3 border-b border-slate-50 text-left hover:bg-slate-50',
                          !n.read && 'bg-teal-50/40',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className={cn(
                            'h-2 w-2 rounded-full mt-1.5 flex-shrink-0',
                            n.read ? 'bg-slate-300' : 'bg-teal-500',
                          )} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.description}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{formatRelative(n.timestamp)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      disabled={unreadCount === 0 || notificationsLoading}
                      onClick={() => void markAllNotificationsRead()}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Avatar name={user?.name ?? 'User'} size="sm" />
            <span className="hidden md:inline text-sm font-medium text-slate-700">{(user?.name ?? 'User').trim().split(/\s+/)[0]}</span>
          </button>
          <AnimatePresence>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-elevated z-40 overflow-hidden py-1"
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-500">{user?.email || 'No email available'}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <ThemeSwitcher compact />
                  </div>
                  <div className="py-1">
                    {[
                      { icon: LockKeyhole, label: 'Account Security', to: '/account/security' },
                      ...(user?.role === 'Admin' ? [
                        { icon: UserIcon, label: 'My Profile', to: '/settings' },
                        { icon: Settings, label: 'Settings', to: '/settings' },
                      ] : [{ icon: Settings, label: 'Preferences', to: '/settings' }]),
                    ].map((i) => (
                      <button
                        key={i.label}
                        onClick={() => {
                          navigate(i.to)
                          setProfileOpen(false)
                        }}
                        className="w-full px-4 py-2 flex items-center gap-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <i.icon className="h-4 w-4 text-slate-400" />
                        {i.label}
                      </button>
                    ))}
                  </div>
                  <div className="py-1 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        try {
                          await logout()
                        } catch (error) {
                          toast.error('Sign out failed', error instanceof Error ? error.message : 'Please try again.')
                        } finally {
                          setProfileOpen(false)
                        }
                      }}
                      className="w-full px-4 py-2 flex items-center gap-2.5 text-sm text-danger-600 hover:bg-danger-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Global Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchOpen(false)}
              className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-elevated border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search customers, leads, bookings, calls..."
                  className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                />
                <kbd className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-400">
                  ESC
                </kbd>
                <button onClick={() => setSearchOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {!query.trim() && (
                  <div className="p-8 text-center text-sm text-slate-400">
                    Start typing to search across the entire CRM.
                  </div>
                )}
                {query.trim() && !hasResults && (
                  <div className="p-8 text-center text-sm text-slate-400">
                    No results found for "<span className="text-slate-600 font-medium">{query}</span>"
                  </div>
                )}
                {hasResults && (
                  <div className="py-2">
                    {[
                      { label: 'Customers', items: results.customers, icon: Users, to: (id: string) => `/customers/${id}` },
                      { label: 'Leads', items: results.leads, icon: UserPlus, to: (_id: string) => `/leads` },
                      { label: 'Bookings', items: results.bookings, icon: Car, to: (_id: string) => `/bookings` },
                      { label: 'Calls', items: results.calls, icon: Phone, to: (_id: string) => `/calls` },
                    ].map(({ label, items, icon: Icon, to }) => items.length > 0 && (
                      <div key={label}>
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                        {items.map((item: { id: string; name?: string; customerName?: string; bookingId?: string; phoneNumber?: string }) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              navigate(to(item.id))
                              setSearchOpen(false)
                              setQuery('')
                            }}
                            className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-left"
                          >
                            <Icon className="h-4 w-4 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {item.name || item.customerName || item.bookingId}
                              </p>
                              <p className="text-xs text-slate-500">{item.phoneNumber || '—'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
