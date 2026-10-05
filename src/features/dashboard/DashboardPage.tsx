import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, UserPlus, PhoneCall, CalendarClock, Car, TrendingUp, Activity as ActivityIcon,
  Sparkles, ChevronRight, CheckCircle2,
  Phone, UserCheck, AlertCircle, CalendarDays, Download, Clock,
  ArrowUpRight, ArrowDownRight, Minus, Filter, BarChart3, Star, Flame, Inbox,
  PieChart as PieIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Badge, statusTone, priorityTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { cn, formatNumber, formatCurrency, formatRelative, formatDate, formatTime, formatDuration, downloadCSV } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { analyticsService } from '@/services'
import { useAuth } from '@/auth/AuthContext'
import type { Activity, Booking, CallRecord, Customer, FollowUp, Lead, User } from '@/types'
import heroBg from '@/assets/dashboard.smallbg.png'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const activityIcon = {
  call: Phone,
  'follow-up': CalendarClock,
  booking: Car,
  lead: UserPlus,
  task: CheckCircle2,
  note: AlertCircle,
  recording: PhoneCall,
  assignment: UserCheck,
}

const activityColor = {
  call: 'bg-info-50 text-info-600',
  'follow-up': 'bg-warning-50 text-warning-600',
  booking: 'bg-teal-50 text-teal-600',
  lead: 'bg-purple-50 text-purple-600',
  task: 'bg-success-50 text-success-600',
  note: 'bg-slate-100 text-slate-600',
  recording: 'bg-navy-50 text-navy-600',
  assignment: 'bg-danger-50 text-danger-600',
}

const axisTick = { fontSize: 12, fill: '#94a3b8' }

const EXEC_AVATAR = ['bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500']
const EXEC_BAR = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#f43f5e']

const CARD =
  'rounded-2xl border border-slate-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)]'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Adds alpha to a #rrggbb colour. Any other colour format is returned unchanged. */
const alpha = (color: string, a: number) =>
  /^#[0-9a-f]{6}$/i.test(color) ? color + Math.round(a * 255).toString(16).padStart(2, '0') : color

const tileStyle = (accent: string) => ({
  background: `linear-gradient(135deg, ${alpha(accent, 0.18)}, ${alpha(accent, 0.06)})`,
  color: accent,
  boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.16)}`,
})

const compact = (v: number) => {
  if (v >= 10000000) return `${+(v / 10000000).toFixed(1)}Cr`
  if (v >= 100000) return `${+(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}k`
  return String(v)
}

interface Trend { pct: number; compare: string }

function trendOf(series: number[] | undefined, compare: string): Trend | undefined {
  if (!series || series.length < 2) return undefined
  const prev = series[series.length - 2]
  const last = series[series.length - 1]
  const pct = prev === 0 ? (last === 0 ? 0 : 100) : Math.round(((last - prev) / prev) * 100)
  return { pct, compare }
}

interface Kpi {
  label: string
  value: number
  displayValue?: string
  suffix?: string
  icon: LucideIcon
  color: string
  series: number[]
  trend?: Trend
  note?: string
}

/* ------------------------------------------------------------------ */
/* Presentational components                                           */
/* ------------------------------------------------------------------ */

function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  if (data.length < 2) {
    return (
      <div className="flex h-full items-center">
        <div className="w-full border-t-2 border-dashed" style={{ borderColor: alpha(color, 0.35) }} />
      </div>
    )
  }
  const chart = data.map((v, i) => ({ i, v }))
  const last = chart.length - 1
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chart} margin={{ top: 6, right: 4, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, (max: number) => Math.max(1, max)]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#spark-${id})`}
          isAnimationActive={false}
          dot={(p: any) =>
            p.index === last ? (
              <circle key={`d-${id}`} cx={p.cx} cy={p.cy} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
            ) : (
              <g key={`d-${id}-${p.index}`} />
            )
          }
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function Delta({ trend }: { trend: Trend }) {
  const up = trend.pct > 0
  const down = trend.pct < 0
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <div className="space-y-1">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
          up && 'bg-emerald-50 text-emerald-700',
          down && 'bg-rose-50 text-rose-600',
          !up && !down && 'bg-slate-100 text-slate-500',
        )}
      >
        <Icon className="h-3 w-3" />
        {up ? '+' : ''}{trend.pct}%
      </span>
      <p className="text-[11px] leading-none text-slate-400">{trend.compare}</p>
    </div>
  )
}

function Panel({
  icon: Icon, accent, title, description, action, className, flush, children,
}: {
  icon: LucideIcon
  accent: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
  flush?: boolean
  children: ReactNode
}) {
  return (
    <section className={cn(CARD, 'overflow-hidden', className)}>
      <header
        className={cn(
          'flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5',
          flush ? 'border-b border-slate-100 pb-3.5' : 'pb-3',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={tileStyle(accent)}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
            {description && <p className="truncate text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      <div className={flush ? 'pb-1' : 'px-4 pb-4 sm:px-5 sm:pb-5'}>{children}</div>
    </section>
  )
}

function SeeAll({ to, label = 'See all' }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-0.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {label} <ChevronRight className="h-3 w-3" />
    </Link>
  )
}

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
      <span className="h-8 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0">
        <p className="truncate text-[11px] text-slate-500">{label}</p>
        <p className="truncate text-sm font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  )
}

function LegendPills({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-4">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

function ChartTooltip({
  active, payload, label, colors, format,
}: {
  active?: boolean
  payload?: any[]
  label?: string | number
  colors?: Record<string, string>
  format?: (name: string, value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[9.5rem] rounded-xl border border-slate-100 bg-white/95 px-3 py-2.5 shadow-xl backdrop-blur">
      {label !== undefined && <p className="mb-1.5 text-xs font-semibold text-slate-900">{label}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          const name = String(p.name ?? p.dataKey ?? '')
          const dot = colors?.[name] ?? p.payload?.color ?? p.color
          return (
            <li key={`${name}-${i}`} className="flex items-center justify-between gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
                {name}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {format ? format(name, Number(p.value)) : p.value}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-9 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-400 ring-1 ring-slate-100">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-0.5 max-w-[16rem] text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const toast = useToast()
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let active = true
    const loadDashboard = async () => {
      setLoading(true)
      try {
        const result = await analyticsService.dashboard(range, user?.role === 'Admin')
        if (active) {
          setData(result)
          setDashboardError('')
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : 'Please try again.'
          setDashboardError(message)
          toast.error('Could not load dashboard', message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadDashboard()
    window.addEventListener('focus', loadDashboard)
    return () => {
      active = false
      window.removeEventListener('focus', loadDashboard)
    }
  }, [range, refreshVersion, toast, user?.role])

  const customers = (data?.customers ?? []) as Customer[]
  const leads = (data?.leads ?? []) as Lead[]
  const calls = (data?.calls ?? []) as CallRecord[]
  const followups = (data?.followups ?? []) as FollowUp[]
  const bookings = (data?.bookings ?? []) as Booking[]
  const users = (data?.users ?? []) as User[]
  const activities = (data?.activities ?? []) as Activity[]
  const callsOverTime = data?.callsOverTime ?? []
  const leadsOverTime = data?.leadsOverTime ?? []
  const leadFunnel = data?.leadFunnel ?? []
  const bookingTrends = data?.bookingTrends ?? []
  const executivePerformance = data?.executivePerformance ?? []
  const leadSourceDistribution = data?.leadSourceDistribution ?? []
  const adminMetrics = data?.adminMetrics ?? {}

  const todayCallRecords = calls.filter((c) => new Date(c.timestamp).toDateString() === new Date().toDateString())
  const todayCalls = todayCallRecords.length
  const answeredToday = todayCallRecords.filter((call) => call.status === 'Answered').length
  const missedToday = todayCallRecords.filter((call) => call.status === 'Missed').length
  const newLeads = leads.filter((l) => l.status === 'New').length
  const dueFollowups = followups.filter((f) => f.status === 'Pending' && new Date(f.scheduledAt).toDateString() === new Date().toDateString()).length
  const completedFollowups = followups.filter((followup) => followup.status === 'Completed').length
  const convertedLeads = leads.filter((lead) => lead.status === 'Converted').length
  const upcomingBookings = bookings.filter((b) => ['Enquiry', 'Confirmed', 'Assigned'].includes(b.bookingStatus)).length
  const conversionRate = leads.length
    ? Math.round((leads.filter((l) => l.status === 'Converted').length / leads.length) * 100)
    : 0
  const activeExecutives = users.filter((u) => u.active && u.role === 'Calling Executive').length

  /* Trend series derived only from the analytics data already loaded. */
  const callSeries: number[] = callsOverTime.map((p: any) => Number(p.calls) || 0)
  const leadSeries: number[] = leadsOverTime.map((p: any) => Number(p.leads) || 0)
  const rateSeries: number[] = leadsOverTime.map((p: any) => {
    const total = Number(p.leads) || 0
    return total ? Math.round(((Number(p.converted) || 0) / total) * 100) : 0
  })
  const bookingSeries: number[] = bookingTrends.map((p: any) => Number(p.bookings) || 0)

  const adminKpis: Kpi[] = [
    { label: 'Total Customers', value: customers.length, icon: Users, color: '#3b82f6', series: [], note: 'All time' },
    { label: 'Total Leads', value: leads.length, icon: UserPlus, color: '#8b5cf6', series: leadSeries, trend: trendOf(leadSeries, 'vs last week') },
    { label: 'New Leads', value: newLeads, icon: Sparkles, color: '#f43f5e', series: leadSeries, trend: trendOf(leadSeries, 'vs last week') },
    { label: 'Calls Today', value: todayCalls, icon: PhoneCall, color: '#14b8a6', series: callSeries, trend: trendOf(callSeries, 'vs yesterday') },
    { label: 'Follow-ups Due', value: dueFollowups, icon: CalendarClock, color: '#f59e0b', series: [], note: 'Scheduled today' },
    { label: 'Upcoming Bookings', value: upcomingBookings, icon: Car, color: '#10b981', series: bookingSeries, trend: trendOf(bookingSeries, 'vs last month') },
    { label: 'Conversion Rate', value: conversionRate, suffix: '%', icon: TrendingUp, color: '#ec4899', series: rateSeries, trend: trendOf(rateSeries, 'vs last week') },
    { label: 'Team Activity', value: activeExecutives, suffix: ' active', icon: ActivityIcon, color: '#0ea5e9', series: [], note: 'Calling executives' },
  ]
  const executiveKpis: Kpi[] = [
    { label: 'Assigned Leads', value: leads.length, icon: UserPlus, color: '#0d9488', series: leadSeries, note: 'Visible to your account' },
    { label: 'New Leads', value: newLeads, icon: Sparkles, color: '#f43f5e', series: leadSeries, note: 'Status: New' },
    { label: 'Converted Leads', value: convertedLeads, icon: TrendingUp, color: '#10b981', series: rateSeries, note: 'Status: Converted' },
    { label: 'Assigned Customers', value: customers.length, icon: Users, color: '#3b82f6', series: [], note: 'Visible to your account' },
    { label: 'Pending Follow-ups', value: followups.filter((followup) => followup.status === 'Pending').length, icon: CalendarClock, color: '#f59e0b', series: [], note: 'All pending' },
    { label: "Today's Follow-ups", value: dueFollowups, icon: CalendarDays, color: '#ea580c', series: [], note: 'Scheduled today' },
    { label: 'Completed Follow-ups', value: completedFollowups, icon: CheckCircle2, color: '#10b981', series: [], note: 'Completed status' },
    { label: "Today's Calls", value: todayCalls, icon: PhoneCall, color: '#2563eb', series: callSeries, note: `${answeredToday} answered · ${missedToday} missed` },
  ]
  const kpis = user?.role === 'Calling Executive' ? executiveKpis : adminKpis

  const adminDashboardKpis: Kpi[] = [
    { label: 'Total Calling Executives', value: Number(adminMetrics.total_calling_executives) || 0, icon: Users, color: '#0ea5e9', series: [] },
    { label: 'Total Customers', value: Number(adminMetrics.total_customers) || 0, icon: Users, color: '#3b82f6', series: [] },
    { label: 'Total Leads', value: Number(adminMetrics.total_leads) || 0, icon: UserPlus, color: '#8b5cf6', series: [] },
    { label: 'New Leads', value: Number(adminMetrics.new_leads) || 0, icon: Sparkles, color: '#f43f5e', series: [] },
    { label: 'Active Leads', value: Number(adminMetrics.active_leads) || 0, icon: TrendingUp, color: '#14b8a6', series: [] },
    { label: 'Converted Leads', value: Number(adminMetrics.converted_leads) || 0, icon: CheckCircle2, color: '#10b981', series: [] },
    { label: 'Pending Follow-ups', value: Number(adminMetrics.pending_followups) || 0, icon: CalendarClock, color: '#f59e0b', series: [] },
    { label: 'Completed Follow-ups', value: Number(adminMetrics.completed_followups) || 0, icon: CalendarDays, color: '#22c55e', series: [] },
    { label: 'Total Calls', value: Number(adminMetrics.total_calls) || 0, icon: PhoneCall, color: '#2563eb', series: [] },
    { label: 'Missed Calls', value: Number(adminMetrics.missed_calls) || 0, icon: Phone, color: '#ef4444', series: [] },
    { label: 'Answered Calls', value: Number(adminMetrics.answered_calls) || 0, icon: PhoneCall, color: '#10b981', series: [] },
    { label: 'Recorded Calls', value: Number(adminMetrics.recorded_calls) || 0, icon: ActivityIcon, color: '#6366f1', series: [] },
    { label: 'Total Call Duration', value: Number(adminMetrics.total_call_duration_seconds) || 0, displayValue: formatDuration(Number(adminMetrics.total_call_duration_seconds) || 0), icon: Clock, color: '#0d9488', series: [] },
    { label: 'Total Bookings', value: Number(adminMetrics.total_bookings) || 0, icon: Car, color: '#14b8a6', series: [] },
    { label: 'Confirmed Bookings', value: Number(adminMetrics.confirmed_bookings) || 0, icon: CheckCircle2, color: '#10b981', series: [] },
    { label: 'Cancelled Bookings', value: Number(adminMetrics.cancelled_bookings) || 0, icon: AlertCircle, color: '#ef4444', series: [] },
  ]

  // Today's follow-ups
  const todaysFollowups = followups.filter((f) => f.status === 'Pending' && new Date(f.scheduledAt).toDateString() === new Date().toDateString()).slice(0, 5)
  // Upcoming bookings
  const upcomingBookingsList = bookings.filter((b) => ['Enquiry', 'Confirmed', 'Assigned'].includes(b.bookingStatus)).slice(0, 5)
  // Recent calls
  const recentCalls = [...calls].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 5)
  // Priority leads
  const priorityLeads = leads.filter((l) => l.priority === 'Hot' || l.priority === 'High').slice(0, 4)

  /* Hero */
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const dateLabel = `${now.toLocaleDateString('en-US', { weekday: 'long' })}, ${String(now.getDate()).padStart(2, '0')} ${now.toLocaleDateString('en-US', { month: 'short' })} ${now.getFullYear()}`

  /* Calls summary */
  const totalCalls = callSeries.reduce((a, b) => a + b, 0)
  const answeredCalls = callsOverTime.reduce((a: number, p: any) => a + (Number(p.answered) || 0), 0)
  const answerRate = totalCalls ? Math.round((answeredCalls / totalCalls) * 100) : 0

  /* Lead source donut */
  const leadTotal = leadSourceDistribution.reduce((sum: number, s: any) => sum + (Number(s.value) || 0), 0)
  const donutData = leadTotal > 0 ? leadSourceDistribution : [{ name: 'No leads', value: 1, color: '#e2e8f0' }]

  /* Leads generated summary */
  const weeklyLeadsTotal = leadSeries.reduce((a, b) => a + b, 0)
  const weeklyConverted = leadsOverTime.reduce((a: number, p: any) => a + (Number(p.converted) || 0), 0)

  /* Funnel */
  const funnelTop = Number(leadFunnel[0]?.value) || 1
  const convertedStage = leadFunnel.find((s: any) => /convert/i.test(String(s.stage)))
  const funnelConversion = convertedStage ? Math.round((Number(convertedStage.value) / funnelTop) * 100) : null

  /* Booking summary */
  const bookingsTotal = bookingSeries.reduce((a, b) => a + b, 0)
  const revenueTotal = bookingTrends.reduce((a: number, p: any) => a + (Number(p.revenue) || 0), 0)
  const avgBooking = bookingsTotal ? Math.round(revenueTotal / bookingsTotal) : 0

  if (user?.role !== 'Calling Executive') {
    return (
      <div className="space-y-4 pb-4 sm:space-y-6">
        {dashboardError && !loading && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <span>Dashboard data could not be loaded: {dashboardError}</span>
            <Button variant="secondary" onClick={() => setRefreshVersion((version) => version + 1)}>Retry</Button>
          </div>
        )}
        <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: adminDashboardKpis.length }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {adminDashboardKpis.map((kpi) => {
                const Icon = kpi.icon
                return (
                  <Card key={kpi.label} className={cn(CARD, 'relative overflow-hidden p-3.5 sm:p-5')}>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{ backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${alpha(kpi.color, 0.11)}, transparent 55%)` }}
                    />
                    <div className="relative">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11" style={tileStyle(kpi.color)}>
                          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                        </div>
                        <p className="truncate text-xs font-medium text-slate-500 sm:text-sm">{kpi.label}</p>
                      </div>
                      <p className="mt-4 text-[26px] font-bold leading-none tracking-tight text-slate-900 sm:text-3xl">
                        {kpi.displayValue ?? formatNumber(kpi.value)}
                        {kpi.suffix && <span className="ml-0.5 text-sm font-semibold text-slate-400 sm:text-base">{kpi.suffix}</span>}
                      </p>
                      {kpi.note && <p className="mt-2 text-[11px] text-slate-400">{kpi.note}</p>}
                    </div>
                  </Card>
                )
              })}
            </div>

            <Panel icon={ActivityIcon} accent="#0ea5e9" title="Team Activities" description="Latest updates from your team">
              {activities.length === 0 ? (
                <EmptyState icon={Inbox} title="No team activities yet" hint="Updates from calls, leads and bookings will show up here." />
              ) : (
                <ol className="relative ml-3 mt-1 space-y-5 border-l border-slate-200">
                  {activities.slice(0, 8).map((activity) => {
                    const Icon = activityIcon[activity.type] ?? AlertCircle
                    const iconColor = activityColor[activity.type] ?? 'bg-slate-100 text-slate-600'
                    return (
                      <li key={activity.id} className="relative ml-5 pl-1">
                        <div className={cn('absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white', iconColor)}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{activity.description}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{formatRelative(activity.timestamp)} · {activity.actor}</p>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Panel>
          </>
        ) : null}
      </div>
    )
  }

  const rangeSelect = (
    <Select
      value={range}
      onChange={(e) => setRange(e.target.value as '7d' | '30d' | '90d')}
      className="w-[7.5rem] text-xs sm:w-32"
      aria-label="Date range"
    >
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
    </Select>
  )

  return (
    <div className="space-y-4 pb-4 sm:space-y-6">
      {dashboardError && !loading && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <span>Dashboard data could not be loaded: {dashboardError}</span>
          <Button variant="secondary" onClick={() => setRefreshVersion((version) => version + 1)}>Retry</Button>
        </div>
      )}
      {/* ============================== HERO ============================== */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-white/70 bg-sky-50 shadow-[0_20px_50px_-24px_rgba(14,116,144,0.45)]">
        <img
          src={heroBg}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full select-none object-cover object-right"
        />

        {/* 1. Readability veil – mobile (text sits over the artwork) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 sm:hidden"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.84) 55%, rgba(255,255,255,0.3) 100%)',
          }}
        />
        {/* 1. Readability veil – tablet / desktop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden sm:block"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.78) 32%, rgba(255,255,255,0.22) 62%, rgba(255,255,255,0) 100%)',
          }}
        />
        {/* 2. Brand colour wash (teal glow top-right, indigo depth bottom) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 90% at 100% 0%, rgba(20,184,166,0.22), transparent 60%), linear-gradient(0deg, rgba(30,58,138,0.22) 0%, rgba(30,58,138,0) 45%)',
          }}
        />
        {/* 3. Soft inner highlight */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/60" />

        <div className="relative flex min-h-[188px] flex-col justify-center px-5 py-6 sm:min-h-[212px] sm:px-8">
          <div className="max-w-[78%] sm:max-w-lg">
            <p className="text-sm font-semibold text-teal-700 sm:text-base">{greeting},</p>
            <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Welcome back{user?.name ? `, ${user.name}` : ''}!
            </h1>
            <p className="mt-2 text-sm text-slate-700 sm:text-base">
              Here's what's happening at vehico CRM today.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-white/70 backdrop-blur sm:hidden">
              <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
              {dateLabel}
            </p>
            <div className="mt-4">
              <Button
                variant="accent"
                icon={<Download className="h-4 w-4" />}
                onClick={() => downloadCSV('dashboard.csv', kpis.map(({ label, value }) => ({ metric: label, value })))}
              >
                Export
              </Button>
            </div>
          </div>

          {/* Date card (tablet / desktop) – glass */}
          <div className="absolute right-5 top-5 hidden items-center gap-3 rounded-xl border border-white/70 bg-white/70 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur-md sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sky-600 ring-1 ring-sky-100">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{dateLabel}</p>
              <p className="text-xs text-slate-500">Have a productive day!</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== KPI GRID ============================== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((kpi, i) => {
              const Icon = kpi.icon
              const sparkId = kpi.label.replace(/\s+/g, '-').toLowerCase()
              return (
                <motion.div
                  key={kpi.label}
                  className="h-full"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card
                    hover
                    className={cn(
                      CARD,
                      'relative h-full overflow-hidden p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-16px_rgba(15,23,42,0.22)] sm:p-5',
                    )}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{ backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${alpha(kpi.color, 0.11)}, transparent 55%)` }}
                    />
                    <div className="relative">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
                          style={tileStyle(kpi.color)}
                        >
                          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                        </div>
                        <p className="truncate text-xs font-medium text-slate-500 sm:text-sm">{kpi.label}</p>
                      </div>

                      <div className="mt-3.5 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[26px] font-bold leading-none tracking-tight text-slate-900 sm:text-3xl">
                            {formatNumber(kpi.value)}
                            {kpi.suffix && <span className="ml-0.5 text-sm font-semibold text-slate-400 sm:text-base">{kpi.suffix}</span>}
                          </p>
                          <div className="mt-2.5 flex min-h-[2.1rem] items-start">
                            {kpi.trend ? (
                              <Delta trend={kpi.trend} />
                            ) : (
                              <p className="text-[11px] text-slate-400">{kpi.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="h-11 w-16 flex-shrink-0 sm:h-12 sm:w-24 xl:w-28">
                          <Sparkline data={kpi.series} color={kpi.color} id={sparkId} />
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
      </div>

      {/* ============================== CHARTS ROW 1 ============================== */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {loading ? (
          <>
            <SkeletonCard className="lg:col-span-2" />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Calls over time */}
            <Panel
              icon={Phone}
              accent="#2563eb"
              title="Calls over time"
              description="Answered vs total calls this week"
              action={rangeSelect}
              className="lg:col-span-2"
            >
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="Total calls" value={totalCalls} color="#2563eb" />
                <StatChip label="Answered" value={answeredCalls} color="#10b981" />
                <StatChip label="Answer rate" value={`${answerRate}%`} color="#8b5cf6" />
              </div>

              <div className="relative mt-4 h-56 sm:h-64">
                {totalCalls === 0 && (
                  <div className="pointer-events-none absolute inset-x-0 top-[34%] z-10 flex justify-center">
                    <span className="rounded-full border border-slate-100 bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur">
                      No calls recorded in this period
                    </span>
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={callsOverTime} margin={{ top: 10, right: 12, bottom: 0, left: -24 }}>
                    <defs>
                      <linearGradient id="callsTotalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="callsAnsweredGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="#e8edf3" vertical={false} />
                    <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      domain={[0, (max: number) => Math.max(4, Math.ceil(max))]}
                    />
                    <RTooltip
                      cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                      content={<ChartTooltip colors={{ 'Total Calls': '#2563eb', Answered: '#10b981' }} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fill="url(#callsTotalGrad)"
                      name="Total Calls"
                      dot={{ r: 3.5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="answered"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#callsAnsweredGrad)"
                      name="Answered"
                      dot={{ r: 3.5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <LegendPills items={[{ label: 'Total Calls', color: '#2563eb' }, { label: 'Answered', color: '#10b981' }]} />
            </Panel>

            {/* Lead sources */}
            <Panel
              icon={PieIcon}
              accent="#6366f1"
              title="Lead sources"
              description="Where leads come from"
              action={<div className="hidden sm:block lg:hidden xl:block">{rangeSelect}</div>}
            >
              <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
                <div className="relative h-44 w-44 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="70%"
                        outerRadius="100%"
                        paddingAngle={donutData.length > 1 ? 3 : 0}
                        cornerRadius={donutData.length > 1 ? 6 : 0}
                        stroke="none"
                      >
                        {donutData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      {leadTotal > 0 && <RTooltip content={<ChartTooltip />} />}
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold leading-none tracking-tight text-slate-900">{leadTotal}</span>
                    <span className="mt-1 text-[11px] text-slate-500">Total Leads</span>
                  </div>
                </div>

                <ul className="w-full flex-1 space-y-3">
                  {leadSourceDistribution.map((s: any) => {
                    const value = Number(s.value) || 0
                    const pct = leadTotal ? Math.round((value / leadTotal) * 100) : 0
                    return (
                      <li key={s.name}>
                        <div className="flex items-center gap-2.5 text-sm">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="flex-1 truncate text-slate-700">{s.name}</span>
                          <span className="w-6 text-right font-semibold tabular-nums text-slate-900">{value}</span>
                          <span className="w-10 text-right text-xs tabular-nums text-slate-400">{pct}%</span>
                        </div>
                        <div className="ml-5 mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Panel>
          </>
        )}
      </div>

      {/* ============================== CHARTS ROW 2 ============================== */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Leads generated */}
            <Panel
              icon={BarChart3}
              accent="#10b981"
              title="Leads generated"
              description="Weekly trend over 6 weeks"
            >
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Total leads" value={weeklyLeadsTotal} color="#2dd4bf" />
                <StatChip label="Converted" value={weeklyConverted} color="#1e3a8a" />
              </div>
              <div className="mt-4 h-48 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadsOverTime} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} barGap={3}>
                    <defs>
                      <linearGradient id="leadsBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5eead4" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                      <linearGradient id="convBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1e3a8a" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="#e8edf3" vertical={false} />
                    <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RTooltip
                      cursor={{ fill: 'rgba(148,163,184,0.1)', radius: 8 }}
                      content={<ChartTooltip colors={{ 'Total Leads': '#14b8a6', Converted: '#1e3a8a' }} />}
                    />
                    <Bar dataKey="leads" fill="url(#leadsBarGrad)" radius={[8, 8, 2, 2]} maxBarSize={24} name="Total Leads" />
                    <Bar dataKey="converted" fill="url(#convBarGrad)" radius={[8, 8, 2, 2]} maxBarSize={24} name="Converted" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <LegendPills items={[{ label: 'Total Leads', color: '#14b8a6' }, { label: 'Converted', color: '#1e3a8a' }]} />
            </Panel>

            {/* Funnel */}
            <Panel
              icon={Filter}
              accent="#8b5cf6"
              title="Lead conversion funnel"
              description="Stage by stage drop-off"
            >
              <div className="flex min-h-[19rem] flex-col justify-between gap-4">
                <div className="flex flex-1 flex-col justify-center gap-4">
                  {leadFunnel.map((stage: any, i: number) => {
                    const value = Number(stage.value) || 0
                    const pct = Math.round((value / funnelTop) * 100)
                    const width = value > 0 ? Math.max(pct, 5) : 0
                    return (
                      <div key={stage.stage} className="grid grid-cols-[5rem_minmax(0,1fr)_1.25rem_2.5rem] items-center gap-2.5">
                        <span className="truncate text-xs font-medium text-slate-700">{stage.stage}</span>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
                          <motion.div
                            initial={reduceMotion ? false : { width: 0 }}
                            animate={{ width: `${width}%` }}
                            transition={{ duration: 0.7, delay: i * 0.08 }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${alpha(stage.color, 0.7)}, ${stage.color})` }}
                          />
                        </div>
                        <span className="text-right text-xs font-semibold tabular-nums text-slate-900">{value}</span>
                        <span className="text-right text-xs tabular-nums text-slate-400">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
                {funnelConversion !== null && (
                  <div className="flex items-center justify-between rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-white px-3.5 py-2.5">
                    <span className="text-xs font-medium text-slate-600">Overall conversion</span>
                    <span className="text-sm font-bold tabular-nums text-violet-700">{funnelConversion}%</span>
                  </div>
                )}
              </div>
            </Panel>

            {/* Executive performance */}
            <Panel
              icon={Star}
              accent="#f59e0b"
              title="Executive performance"
              description="Calls & conversions"
            >
              <div className="min-h-[19rem]">
                <div className="grid grid-cols-[minmax(0,1.5fr)_2.25rem_3.25rem_minmax(0,1.5fr)] items-center gap-2 border-b border-slate-100 pb-2 text-[11px] font-medium text-slate-400">
                  <span>Executive</span>
                  <span className="text-right">Calls</span>
                  <span className="text-right">Conv.</span>
                  <span>Rate</span>
                </div>
                {executivePerformance.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No executive activity yet"
                    hint="Calls and conversions will appear here once your team starts calling."
                  />
                ) : (
                  <div className="divide-y divide-slate-50">
                    {executivePerformance.map((ex: any, i: number) => {
                      const exCalls = Number(ex.calls) || 0
                      const conversions = Number(ex.conversions) || 0
                      const rate = exCalls ? Math.round((conversions / exCalls) * 100) : 0
                      return (
                        <div
                          key={ex.name}
                          className="grid grid-cols-[minmax(0,1.5fr)_2.25rem_3.25rem_minmax(0,1.5fr)] items-center gap-2 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm', EXEC_AVATAR[i % EXEC_AVATAR.length])}>
                              {String(ex.name ?? '?').charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate text-sm font-medium text-slate-800">{ex.name}</span>
                          </div>
                          <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{exCalls}</span>
                          <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{conversions}</span>
                          <div className="flex items-center gap-2">
                            <span className="w-8 text-right text-xs font-medium tabular-nums text-slate-600">{rate}%</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${rate}%`, backgroundColor: EXEC_BAR[i % EXEC_BAR.length] }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Panel>
          </>
        )}
      </div>

      {/* ============================== BOOKING TRENDS ============================== */}
      {loading ? (
        <SkeletonCard className="h-72" />
      ) : (
        <Panel
          icon={Car}
          accent="#14b8a6"
          title="Booking trends"
          description="Monthly bookings and revenue (₹)"
        >
          <div className="grid grid-cols-3 gap-2">
            <StatChip label="Bookings" value={formatNumber(bookingsTotal)} color="#2563eb" />
            <StatChip label="Revenue" value={formatCurrency(revenueTotal)} color="#14b8a6" />
            <StatChip label="Avg. booking" value={formatCurrency(avgBooking)} color="#f59e0b" />
          </div>
          <div className="mt-4 h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bookingTrends} margin={{ top: 10, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="bookingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="#e8edf3" vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => compact(v)}
                />
                <RTooltip
                  cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                  content={
                    <ChartTooltip
                      colors={{ Bookings: '#2563eb', 'Revenue (₹)': '#14b8a6' }}
                      format={(name, value) => (name.startsWith('Revenue') ? formatCurrency(value) : String(value))}
                    />
                  }
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="bookings"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#bookingsGrad)"
                  name="Bookings"
                  dot={{ r: 3.5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  name="Revenue (₹)"
                  dot={{ r: 3.5, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <LegendPills items={[{ label: 'Bookings', color: '#2563eb' }, { label: 'Revenue (₹)', color: '#14b8a6' }]} />
        </Panel>
      )}

      {/* ============================== ACTIVITY + FOLLOW-UPS ============================== */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <Panel
          icon={ActivityIcon}
          accent="#0ea5e9"
          title="Recent Activity"
          description="Latest updates from your team"
          action={<SeeAll to="/calls" label="View all" />}
          className="lg:col-span-2"
        >
          {activities.length === 0 ? (
            <EmptyState icon={Inbox} title="No recent activity" hint="Updates from calls, leads and bookings will show up here." />
          ) : (
            <ol className="relative ml-3 mt-1 space-y-5 border-l border-slate-200">
              {activities.slice(0, 8).map((act) => {
                const Icon = activityIcon[act.type] ?? AlertCircle
                const iconColor = activityColor[act.type] ?? 'bg-slate-100 text-slate-600'
                return (
                  <li key={act.id} className="relative ml-5 pl-1">
                    <div className={cn('absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white', iconColor)}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">{act.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{act.description}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatRelative(act.timestamp)} · {act.actor}</p>
                  </li>
                )
              })}
            </ol>
          )}
        </Panel>

        {/* Today's follow-ups */}
        <Panel
          icon={CalendarClock}
          accent="#f59e0b"
          title="Today's Follow-ups"
          description="Pending for today"
          action={<SeeAll to="/followups" />}
          flush
        >
          <div className="divide-y divide-slate-100">
            {todaysFollowups.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No follow-ups due today" hint="You're all caught up." />
            ) : (
              todaysFollowups.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70">
                  <Avatar name={f.assignedExecutiveName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{f.customerOrLeadName}</p>
                    <p className="text-xs text-slate-500">{f.assignedExecutiveName} · {formatTime(f.scheduledAt)}</p>
                  </div>
                  <Badge tone={priorityTone(f.priority)}>{f.priority}</Badge>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* ============================== LISTS ROW ============================== */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Upcoming bookings */}
        <Panel
          icon={Car}
          accent="#10b981"
          title="Upcoming Bookings"
          description="Enquiry, confirmed & assigned"
          action={<SeeAll to="/bookings" />}
          flush
        >
          <div className="divide-y divide-slate-100">
            {upcomingBookingsList.length === 0 ? (
              <EmptyState icon={Car} title="No upcoming bookings" hint="New enquiries and confirmed trips will appear here." />
            ) : (
              upcomingBookingsList.map((b) => (
                <div key={b.id} className="px-5 py-3 transition-colors hover:bg-slate-50/70">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{b.customerName}</p>
                      <p className="truncate text-xs text-slate-500">{b.pickupLocation} → {b.dropLocation}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-semibold text-slate-900">{formatCurrency(b.amount)}</p>
                      <p className="text-[10px] text-slate-400">{b.vehicleType}</p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">{formatDate(b.travelDate)} · {formatTime(b.travelDate)}</p>
                    <Badge tone={statusTone(b.bookingStatus)}>{b.bookingStatus}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Recent calls */}
        <Panel
          icon={PhoneCall}
          accent="#3b82f6"
          title="Recent Calls"
          description="Latest incoming & outgoing"
          action={<SeeAll to="/calls" />}
          flush
        >
          <div className="divide-y divide-slate-100">
            {recentCalls.length === 0 ? (
              <EmptyState icon={PhoneCall} title="No calls yet" hint="Call activity will be listed here." />
            ) : (
              recentCalls.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70">
                  <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                    c.direction === 'Incoming' ? 'bg-info-50 text-info-600' : 'bg-teal-50 text-teal-600',
                  )}>
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.customerOrLeadName}</p>
                    <p className="text-xs text-slate-500">{c.executiveName} · {formatRelative(c.timestamp)}</p>
                  </div>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Priority leads */}
        <Panel
          icon={Flame}
          accent="#f43f5e"
          title="Priority Leads"
          description="Hot & high priority"
          action={<SeeAll to="/leads" label="Pipeline" />}
          flush
        >
          <div className="divide-y divide-slate-100">
            {priorityLeads.length === 0 ? (
              <EmptyState icon={Flame} title="No priority leads" hint="Hot and high priority leads will be pinned here." />
            ) : (
              priorityLeads.map((l) => (
                <div key={l.id} className="px-5 py-3 transition-colors hover:bg-slate-50/70">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={l.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{l.name}</p>
                        <p className="truncate text-xs text-slate-500">{l.interestedService}</p>
                      </div>
                    </div>
                    <Badge tone={priorityTone(l.priority)}>{l.priority}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">{l.source}</p>
                    <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* ============================== QUICK ACTIONS ============================== */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-navy-800 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 shadow-[0_20px_40px_-20px_rgba(15,23,42,0.6)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="flex flex-col items-start justify-between gap-4 p-5 sm:p-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-base font-semibold text-white">Need to act fast?</h3>
            <p className="mt-0.5 text-sm text-slate-300">Jump straight to the most common CRM workflows.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Link to="/leads?new=1" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">
              <UserPlus className="h-4 w-4" /> New Lead
            </Link>
            <Link to="/bookings?new=1" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">
              <Car className="h-4 w-4" /> New Booking
            </Link>
            <Link to="/followups?new=1" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-3.5 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition-colors hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <CalendarClock className="h-4 w-4" /> Schedule Follow-up
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}