import { useEffect, useState } from 'react'
import {
  BarChart3, Download, Phone, UserPlus, TrendingUp, CalendarCheck,
  Car, Users2, Printer,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { ChartCard } from '@/components/charts/ChartCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { analyticsService } from '@/services'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { useToast } from '@/components/ui/Toast'
import { cn, formatCurrency, formatNumber, formatDuration, downloadCSV } from '@/lib/utils'

type ReportType =
  | 'overview' | 'calls' | 'leads' | 'conversion'
  | 'followup' | 'bookings' | 'executive' | 'acquisition'

const reportTabs: { id: ReportType; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'calls', label: 'Call Performance', icon: Phone },
  { id: 'leads', label: 'Lead Generation', icon: UserPlus },
  { id: 'conversion', label: 'Lead Conversion', icon: TrendingUp },
  { id: 'followup', label: 'Follow-up Completion', icon: CalendarCheck },
  { id: 'bookings', label: 'Booking Report', icon: Car },
  { id: 'executive', label: 'Executive Performance', icon: Users2 },
  { id: 'acquisition', label: 'Customer Acquisition', icon: Users2 },
]

type ReportData = Awaited<ReturnType<typeof analyticsService.reports>>

const RANGE_LABELS = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
} as const

export default function ReportsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [activeReport, setActiveReport] = useState<ReportType>('overview')
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '12m'>('30d')

  useEffect(() => {
    const prepareCharts = () => {
      document.querySelectorAll<HTMLElement>('.print-report .recharts-responsive-container').forEach((node) => {
        const plot = node.closest('.chart-plot') as HTMLElement | null
        node.style.width = '100%'
        node.style.height = `${plot?.clientHeight || node.clientHeight || 220}px`
      })
    }
    const restoreCharts = () => {
      document.querySelectorAll<HTMLElement>('.print-report .recharts-responsive-container').forEach((node) => {
        node.style.width = ''
        node.style.height = ''
      })
    }
    window.addEventListener('beforeprint', prepareCharts)
    window.addEventListener('afterprint', restoreCharts)
    return () => {
      window.removeEventListener('beforeprint', prepareCharts)
      window.removeEventListener('afterprint', restoreCharts)
    }
  }, [])

  useEffect(() => {
    analyticsService.reports(range).then((d) => {
      setData(d as any)
      setLoading(false)
    }).catch((error: unknown) => toast.error('Could not load reports', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
  }, [range, toast])

  const handleExport = () => {
    if (!data) return
    if (activeReport === 'calls' || activeReport === 'executive' || activeReport === 'overview') {
      downloadCSV(`${activeReport}-report.csv`, data.callPerformanceByExec.map((r) => ({
        executive: r.name, calls: r.calls, answered: r.conversions, missed: r.missed,
        conversionRate: `${r.conversionRate}%`, avgDurationSec: r.avgDuration,
      })))
    } else if (activeReport === 'conversion' || activeReport === 'leads') {
      downloadCSV(`${activeReport}-report.csv`, data.leadConversionBySource.map((r) => ({
        source: r.name, total: r.value, converted: r.converted, lost: r.lost,
      })))
    } else if (activeReport === 'followup') {
      downloadCSV('followup-report.csv', data.followUpCompletion.map((r) => ({ week: r.week, scheduled: r.scheduled, completed: r.completed })))
    } else if (activeReport === 'acquisition') {
      downloadCSV('acquisition-report.csv', data.customerAcquisition.map((r) => ({ month: r.month, newCustomers: r.new, churned: r.churned })))
    } else {
      downloadCSV('bookings-report.csv', data.bookingTrends.map((r) => ({ month: r.month, bookings: r.bookings, revenue: r.revenue })))
    }
    toast.success('Report exported', `${activeReport} CSV downloaded.`)
  }

  const totalCalls = data?.callPerformanceByExec.reduce((sum, row) => sum + row.calls, 0) ?? 0
  const answeredCalls = data?.callPerformanceByExec.reduce((sum, row) => sum + row.conversions, 0) ?? 0
  const totalLeads = data?.leadConversionBySource.reduce((sum, row) => sum + row.value, 0) ?? 0
  const convertedLeads = data?.leadConversionBySource.reduce((sum, row) => sum + row.converted, 0) ?? 0
  const totalScheduled = data?.followUpCompletion.reduce((sum, row) => sum + row.scheduled, 0) ?? 0
  const totalCompleted = data?.followUpCompletion.reduce((sum, row) => sum + row.completed, 0) ?? 0
  const averageCallDuration = answeredCalls > 0
    ? Math.round(data!.callPerformanceByExec.reduce((sum, row) => sum + row.avgDuration * row.conversions, 0) / answeredCalls)
    : 0
  const totalNewCustomers = data?.customerAcquisition.reduce((sum, row) => sum + row.new, 0) ?? 0
  const totalChurnedCustomers = data?.customerAcquisition.reduce((sum, row) => sum + row.churned, 0) ?? 0

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const activeTab = reportTabs.find((tab) => tab.id === activeReport)

  return (
    <div className="print-report space-y-6">
      <ReportPrintHeader title={activeTab?.label ?? 'Overview'} rangeLabel={RANGE_LABELS[range]} />

      <div className="print:hidden">
      <PageHeader
        title="Reports & Analytics"
        description="Performance metrics across customers, leads, calls, and bookings"
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <>
            <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="w-32">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="12m">Last 12 months</option>
            </Select>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button variant="accent" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              <span className="hidden sm:inline">Export</span>
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1">
          {reportTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveReport(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
                activeReport === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      <div className="text-xs text-slate-500 print:hidden">Metrics are calculated from CRM records for the selected date range.</div>

      {/* Report body */}
      {activeReport === 'overview' && (
        <div className="space-y-6">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Calls" value={formatNumber(totalCalls)} tone="bg-info-50 text-info-700" icon={<Phone className="h-5 w-5" />} />
            <KpiCard label="Leads Generated" value={formatNumber(totalLeads)} tone="bg-purple-50 text-purple-700" icon={<UserPlus className="h-5 w-5" />} />
            <KpiCard label="Conversion Rate" value={`${totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0}%`} tone="bg-success-50 text-success-700" icon={<TrendingUp className="h-5 w-5" />} />
            <KpiCard label="Total Bookings" value={formatNumber(data.bookingTrends.reduce((sum, row) => sum + row.bookings, 0))} tone="bg-teal-50 text-teal-700" icon={<Car className="h-5 w-5" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Calls per executive" description="Total vs answered" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.callPerformanceByExec} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="calls" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={36} name="Total" />
                  <Bar dataKey="conversions" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={36} name="Answered" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Booking & revenue trend" description="Monthly comparison" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.bookingTrends} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="bookingsG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="bookings" stroke="#14b8a6" strokeWidth={2} fill="url(#bookingsG)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Lead conversion by source" description="Converted vs lost" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.leadConversionBySource} layout="vertical" margin={{ top: 5, right: 10, bottom: 0, left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
                  <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="converted" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="lost" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Customer acquisition vs churn" description="Monthly trend" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.customerAcquisition} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="new" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="New" />
                  <Line type="monotone" dataKey="churned" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name="Churned" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="hidden print:block">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Calls per executive</h2>
            <table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Executive</th>
                  <th className="py-2 pr-3 text-right font-semibold">Total</th>
                  <th className="py-2 pr-3 text-right font-semibold">Answered</th>
                  <th className="py-2 pr-3 text-right font-semibold">Missed</th>
                  <th className="py-2 text-right font-semibold">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.callPerformanceByExec.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2 pr-3 font-medium text-slate-900">{row.name}</td>
                    <td className="py-2 pr-3 text-right">{row.calls}</td>
                    <td className="py-2 pr-3 text-right">{row.conversions}</td>
                    <td className="py-2 pr-3 text-right">{row.missed}</td>
                    <td className="py-2 text-right">{row.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'calls' && (
        <div className="space-y-4">
          <KpiRow kpis={[
            { label: 'Total Calls', value: formatNumber(totalCalls), icon: <Phone className="h-5 w-5" /> },
            { label: 'Answered', value: formatNumber(answeredCalls), icon: <Phone className="h-5 w-5" /> },
            { label: 'Missed', value: formatNumber(data.callPerformanceByExec.reduce((s, e) => s + e.missed, 0)), icon: <Phone className="h-5 w-5" /> },
            { label: 'Avg Duration', value: formatDuration(averageCallDuration), icon: <Phone className="h-5 w-5" /> },
          ]} />
          <ChartCard title="Call performance by executive" description="Calls, answered, missed and conversion rate" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.callPerformanceByExec} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="calls" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={28} name="Total" />
                <Bar dataKey="conversions" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={28} name="Answered" />
                <Bar dataKey="missed" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={28} name="Missed" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ExecTable data={data.callPerformanceByExec} />
        </div>
      )}

      {activeReport === 'leads' && (
        <div className="space-y-4">
          <KpiRow kpis={[
            { label: 'Total Leads', value: formatNumber(totalLeads), icon: <UserPlus className="h-5 w-5" /> },
            { label: 'Converted', value: formatNumber(convertedLeads), icon: <TrendingUp className="h-5 w-5" /> },
            { label: 'Lost', value: formatNumber(data.leadConversionBySource.reduce((s, e) => s + e.lost, 0)), icon: <UserPlus className="h-5 w-5" /> },
            { label: 'Conversion Rate', value: `${totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0}%`, icon: <TrendingUp className="h-5 w-5" /> },
          ]} />
          <ChartCard title="Leads by source" description="Distribution of lead generation channels" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.leadConversionBySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {data.leadConversionBySource.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <Card>
            <CardHeader><CardTitle>Lead generation by source</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={[
                  { key: 'name', header: 'Source', sortable: true },
                  { key: 'value', header: 'Leads', sortable: true, render: (r: any) => <span className="font-medium">{r.value}</span> },
                  { key: 'converted', header: 'Converted', sortable: true, render: (r: any) => <Badge tone="success">{r.converted}</Badge> },
                  { key: 'lost', header: 'Lost', sortable: true, render: (r: any) => <Badge tone="danger">{r.lost}</Badge> },
                ]}
                data={data.leadConversionBySource}
                rowKey={(r: any) => r.name}
                pageSize={10}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeReport === 'conversion' && (
        <ChartCard title="Lead conversion funnel by source" description="Stacked: converted vs lost" height={350}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.leadConversionBySource} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="converted" stackId="a" fill="#10b981" radius={[6, 0, 0, 0]} maxBarSize={36} />
              <Bar dataKey="lost" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} maxBarSize={36} />
              <Bar dataKey="value" fill="#94a3b8" maxBarSize={36} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {activeReport === 'followup' && (
        <div className="space-y-4">
          <KpiRow kpis={[
            { label: 'Total Scheduled', value: formatNumber(totalScheduled), icon: <CalendarCheck className="h-5 w-5" /> },
            { label: 'Completed', value: formatNumber(totalCompleted), icon: <CalendarCheck className="h-5 w-5" /> },
            { label: 'Completion Rate', value: `${totalScheduled ? Math.round((totalCompleted / totalScheduled) * 100) : 0}%`, icon: <TrendingUp className="h-5 w-5" /> },
            { label: 'Avg per Week', value: formatNumber(data.followUpCompletion.length ? Math.round(totalScheduled / data.followUpCompletion.length) : 0), icon: <CalendarCheck className="h-5 w-5" /> },
          ]} />
          <ChartCard title="Follow-up completion" description="Scheduled vs completed by week" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.followUpCompletion} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="scheduled" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="completed" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {activeReport === 'bookings' && (
        <div className="space-y-4">
          <KpiRow kpis={[
            { label: 'Total Bookings', value: formatNumber(data.bookingTrends.reduce((s, b) => s + b.bookings, 0)), icon: <Car className="h-5 w-5" /> },
            { label: 'Total Revenue', value: formatCurrency(data.bookingTrends.reduce((s, b) => s + b.revenue, 0)), icon: <Car className="h-5 w-5" /> },
            { label: 'Avg Booking Value', value: formatCurrency(data.bookingTrends.reduce((sum, row) => sum + row.bookings, 0) ? Math.round(data.bookingTrends.reduce((sum, row) => sum + row.revenue, 0) / data.bookingTrends.reduce((sum, row) => sum + row.bookings, 0)) : 0), icon: <Car className="h-5 w-5" /> },
            { label: 'Months Reported', value: formatNumber(data.bookingTrends.length), icon: <TrendingUp className="h-5 w-5" /> },
          ]} />
          <ChartCard title="Booking & revenue trend" description="Monthly bookings vs revenue" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.bookingTrends} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {activeReport === 'executive' && (
        <div className="space-y-4">
          <ChartCard title="Executive performance comparison" description="Calls, conversions, conversion rate" height={350}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.executivePerformance} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="calls" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="conversions" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ExecTable data={data.callPerformanceByExec} />
        </div>
      )}

      {activeReport === 'acquisition' && (
        <div className="space-y-4">
          <KpiRow kpis={[
            { label: 'Total New Customers', value: formatNumber(data.customerAcquisition.reduce((s, e) => s + e.new, 0)), icon: <Users2 className="h-5 w-5" /> },
            { label: 'Total Churned', value: formatNumber(data.customerAcquisition.reduce((s, e) => s + e.churned, 0)), icon: <Users2 className="h-5 w-5" /> },
            { label: 'Net Acquisition', value: formatNumber(totalNewCustomers - totalChurnedCustomers), icon: <TrendingUp className="h-5 w-5" /> },
            { label: 'Churn Rate', value: `${totalNewCustomers + totalChurnedCustomers ? Math.round((totalChurnedCustomers / (totalNewCustomers + totalChurnedCustomers)) * 100) : 0}%`, icon: <Users2 className="h-5 w-5" /> },
          ]} />
          <ChartCard title="Customer acquisition vs churn" description="Monthly new customers and churned customers" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.customerAcquisition} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="newG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="chG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="new" stroke="#10b981" strokeWidth={2.5} fill="url(#newG)" name="New" />
                <Area type="monotone" dataKey="churned" stroke="#ef4444" strokeWidth={2.5} fill="url(#chG)" name="Churned" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <div className="hidden border-t border-slate-300 pt-3 text-[11px] text-slate-500 print:flex print:items-center print:justify-between">
        <span>vehico CRM · CAB Service CRM</span>
        <span>Confidential · {RANGE_LABELS[range]}</span>
      </div>
    </div>
  )
}

function ReportPrintHeader({ title, rangeLabel }: { title: string; rangeLabel: string }) {
  const printedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div className="mb-6 hidden print:block">
      <div className="flex items-start justify-between gap-8 border-b-2 border-slate-900 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">vehico CRM · CAB Service</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight text-slate-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm font-medium text-slate-700">{title}</p>
        </div>
        <div className="min-w-[180px] text-right text-xs leading-5 text-slate-600">
          <p><span className="font-semibold text-slate-900">Period</span> · {rangeLabel}</p>
          <p><span className="font-semibold text-slate-900">Generated</span> · {printedAt}</p>
          <p>Internal performance report</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Metrics are calculated from CRM records for the selected date range.</p>
    </div>
  )
}

function KpiCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: React.ReactNode }) {
  return (
    <Card hover>
      <CardContent className="p-5">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center mb-3', tone)}>{icon}</div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}

function KpiRow({ kpis }: { kpis: { label: string; value: string; icon: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{k.label}</p>
              <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                {k.icon}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 mt-2">{k.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ExecTable({ data }: { data: any[] }) {
  const cols: Column<any>[] = [
    {
      key: 'name', header: 'Executive', sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar name={r.name} size="xs" />
          <span className="text-sm font-medium text-slate-900">{r.name}</span>
        </div>
      ),
    },
    { key: 'calls', header: 'Calls', sortable: true, render: (r) => <span className="font-medium">{r.calls}</span> },
    { key: 'conversions', header: 'Answered', sortable: true, render: (r) => <Badge tone="success">{r.conversions}</Badge> },
    { key: 'missed', header: 'Missed', sortable: true, render: (r) => <Badge tone="danger">{r.missed}</Badge> },
    { key: 'conversionRate', header: 'Conv. Rate', sortable: true, render: (r) => <span className="font-medium text-teal-700">{r.conversionRate}%</span> },
    { key: 'avgDuration', header: 'Avg Duration', sortable: true, render: (r) => <span className="text-xs">{Math.floor(r.avgDuration / 60)}m {r.avgDuration % 60}s</span> },
  ]
  return (
    <Card>
      <CardHeader><CardTitle>Performance breakdown</CardTitle></CardHeader>
      <CardContent className="p-0">
        <DataTable columns={cols} data={data} rowKey={(r) => r.name} pageSize={10} />
      </CardContent>
    </Card>
  )
}
