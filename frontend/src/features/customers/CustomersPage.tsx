import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users, Search, Plus, Download, Trash2, UserCircle, Phone, MapPin, Crown, UserCheck,
  Wallet, X, ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { useToast } from '@/components/ui/Toast'
import { customerService, userService } from '@/services'
import type { Customer, User } from '@/types'
import { cn, formatDate, formatCurrency, formatNumber, downloadCSV } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 10

const CARD =
  'rounded-2xl border border-slate-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)]'

const STATUSES = ['Active', 'VIP', 'Inactive', 'Lead', 'Churned'] as const

const STATUS_DOT: Record<string, string> = {
  Active: '#10b981',
  VIP: '#8b5cf6',
  Inactive: '#94a3b8',
  Lead: '#0ea5e9',
  Churned: '#f43f5e',
}

type MobileSort = 'default' | 'name' | 'spend' | 'bookings' | 'recent'

/** Adds alpha to a #rrggbb colour. */
const alpha = (color: string, a: number) =>
  /^#[0-9a-f]{6}$/i.test(color) ? color + Math.round(a * 255).toString(16).padStart(2, '0') : color

const tileStyle = (accent: string) => ({
  background: `linear-gradient(135deg, ${alpha(accent, 0.18)}, ${alpha(accent, 0.06)})`,
  color: accent,
  boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.16)}`,
})

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/* ------------------------------------------------------------------ */
/* Presentational pieces                                               */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color: string }) {
  return (
    <div className={cn(CARD, 'relative overflow-hidden p-3.5 sm:p-4')}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${alpha(color, 0.11)}, transparent 55%)` }}
      />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={tileStyle(color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-xl font-bold leading-tight tracking-tight text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
        <Users className="h-7 w-7" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">No customers match the filters.</p>
      <p className="mt-0.5 text-xs text-slate-400">Try a different search or clear your filters.</p>
      <button
        onClick={onReset}
        className="mt-3 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        Reset filters
      </button>
    </div>
  )
}

interface CustomerCardProps {
  c: Customer
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

function CustomerCard({ c, selected, onToggle, onOpen, onEdit, onDelete }: CustomerCardProps) {
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') onOpen()
      }}
      className={cn(
        CARD,
        'relative cursor-pointer p-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 active:scale-[0.99]',
        selected && 'border-teal-300 bg-teal-50/40 ring-2 ring-teal-400/60',
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <label className="-m-2 flex flex-shrink-0 p-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${c.name}`}
            className="h-4 w-4 rounded border-slate-300 accent-teal-600"
          />
        </label>
        <Avatar name={c.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{c.name}</p>
          <p className="truncate text-xs text-slate-500">{c.email}</p>
        </div>
        <Badge tone={statusTone(c.status)} dot>{c.status}</Badge>
      </div>

      {/* Contact */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
        <a
          href={`tel:${c.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-teal-700"
        >
          <Phone className="h-3.5 w-3.5 text-slate-400" />
          {c.phone}
        </a>
        {c.alternateNumber && (
          <a href={`tel:${c.alternateNumber}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-teal-700">
            <Phone className="h-3.5 w-3.5 text-slate-400" /> {c.alternateNumber}
          </a>
        )}
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {c.city}
        </span>
      </div>
      {(c.pickupLocation || c.dropLocation) && (
        <p className="mt-1 truncate pl-0.5 text-[11px] text-slate-500">{c.pickupLocation || '—'} → {c.dropLocation || '—'}</p>
      )}

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-slate-400">Bookings</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{c.totalBookings}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-slate-400">Spend</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(c.totalSpend)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-slate-400">Last contact</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-900">{formatDate(c.lastContact)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={c.assignedExecutiveName} size="xs" />
          <span className="truncate text-xs text-slate-600">{c.assignedExecutiveName}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            aria-label={`Edit ${c.name}`}
            title="Edit"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <UserCircle className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            aria-label={`Delete ${c.name}`}
            title="Delete"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [execFilter, setExecFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [mobilePage, setMobilePage] = useState(1)
  const [mobileSort, setMobileSort] = useState<MobileSort>('default')

  useEffect(() => {
    Promise.all([customerService.list(), userService.list()])
      .then(([customerData, userData]) => {
        setCustomers(customerData)
        setUsers(userData)
      })
      .catch((error: unknown) => toast.error('Could not load customers', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    const editId = searchParams.get('edit')
    const isNew = searchParams.get('new') === '1'
    if (!editId && !isNew) return
    if (editId && loading) return
    if (editId) {
      const customer = customers.find((item) => item.id === editId)
      if (customer) {
        setEditing(customer)
        setShowForm(true)
      } else {
        toast.error('Customer not found', 'The requested customer is unavailable.')
      }
    } else {
      setEditing(null)
      setShowForm(true)
    }
    setSearchParams({}, { replace: true })
  }, [customers, loading, searchParams, setSearchParams, toast])

  // The table (desktop) and the card list (mobile) keep separate selection state,
  // so start clean whenever the layout switches.
  useEffect(() => {
    setSelectedIds((prev) => (prev.length ? [] : prev))
  }, [isDesktop])

  // Back to the first mobile page whenever the result set changes.
  useEffect(() => {
    setMobilePage(1)
  }, [query, statusFilter, execFilter, mobileSort])

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.phone.includes(query) && !(c.alternateNumber ?? '').includes(query) && !c.email.toLowerCase().includes(query.toLowerCase())) return false
      if (statusFilter && c.status !== statusFilter) return false
      if (execFilter && c.assignedExecutiveName !== execFilter) return false
      return true
    })
  }, [customers, query, statusFilter, execFilter])

  /* Summary (derived from loaded data only) */
  const statusCount = useMemo(
    () => customers.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1
      return acc
    }, {}),
    [customers],
  )
  const totalSpend = useMemo(() => customers.reduce((sum, c) => sum + (Number(c.totalSpend) || 0), 0), [customers])

  /* Mobile list: sort + paginate */
  const sorted = useMemo(() => {
    const list = [...filtered]
    switch (mobileSort) {
      case 'name': return list.sort((a, b) => a.name.localeCompare(b.name))
      case 'spend': return list.sort((a, b) => (Number(b.totalSpend) || 0) - (Number(a.totalSpend) || 0))
      case 'bookings': return list.sort((a, b) => (Number(b.totalBookings) || 0) - (Number(a.totalBookings) || 0))
      case 'recent': return list.sort((a, b) => +new Date(b.lastContact) - +new Date(a.lastContact))
      default: return list
    }
  }, [filtered, mobileSort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(mobilePage, pageCount)
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const allOnPageSelected = pageItems.length > 0 && pageItems.every((c) => selectedIds.includes(c.id))

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const togglePage = () => {
    const ids = pageItems.map((c) => c.id)
    setSelectedIds((prev) => (allOnPageSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]))
  }

  const hasFilters = !!(query || statusFilter || execFilter)
  const resetFilters = () => { setQuery(''); setStatusFilter(''); setExecFilter('') }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{c.name}</p>
            <p className="text-xs text-slate-500">{c.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', sortable: true, render: (c) => <span className="tabular-nums text-slate-700">{c.phone}{c.alternateNumber && <span className="block text-[10px] text-slate-400">Alt: {c.alternateNumber}</span>}</span> },
    {
      key: 'city',
      header: 'Location',
      sortable: true,
      render: (c) => (
        <span className="inline-flex items-center gap-1.5 text-slate-700">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span><span className="block">{c.city}</span>{(c.pickupLocation || c.dropLocation) && <span className="block max-w-40 truncate text-[10px] text-slate-400">{c.pickupLocation || '—'} → {c.dropLocation || '—'}</span>}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (c) => <Badge tone={statusTone(c.status)} dot>{c.status}</Badge>,
    },
    {
      key: 'assignedExecutiveName',
      header: 'Executive',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-2">
          <Avatar name={c.assignedExecutiveName} size="xs" />
          <span className="text-xs text-slate-700">{c.assignedExecutiveName}</span>
        </div>
      ),
    },
    { key: 'totalBookings', header: 'Bookings', sortable: true, render: (c) => <span className="font-semibold tabular-nums text-slate-700">{c.totalBookings}</span> },
    { key: 'totalSpend', header: 'Spend', sortable: true, render: (c) => <span className="font-semibold tabular-nums text-slate-700">{formatCurrency(c.totalSpend)}</span> },
    { key: 'lastContact', header: 'Last Contact', sortable: true, accessor: (c) => c.lastContact, render: (c) => <span className="text-xs text-slate-500">{formatDate(c.lastContact)}</span> },
    {
      key: 'actions',
      header: '',
      width: '40px',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(c); setShowForm(true) }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            title="Edit"
            aria-label={`Edit ${c.name}`}
          >
            <UserCircle className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(c) }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
            title="Delete"
            aria-label={`Delete ${c.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const handleExport = () => {
    downloadCSV('customers.csv', filtered.map((c) => ({
      id: c.id, name: c.name, phone: c.phone, alternateNumber: c.alternateNumber, email: c.email,
      address: c.location, city: c.city, pickupLocation: c.pickupLocation, dropLocation: c.dropLocation,
      status: c.status, assignedUserId: c.assignedExecutiveId, executive: c.assignedExecutiveName,
      notes: c.notes, totalBookings: c.totalBookings, totalSpend: c.totalSpend,
      lastContact: c.lastContact, joinedOn: c.joinedOn, updatedOn: c.updatedOn,
    })))
    toast.success('CSV exported', `${filtered.length} customers downloaded.`)
  }

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await customerService.remove(id)
    }
    setCustomers((prev) => prev.filter((c) => !selectedIds.includes(c.id)))
    toast.success('Customers deleted', `${selectedIds.length} customers removed.`)
    setSelectedIds([])
    setConfirmBulkDelete(false)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    await customerService.remove(confirmDelete.id)
    setCustomers((prev) => prev.filter((c) => c.id !== confirmDelete.id))
    setSelectedIds((prev) => prev.filter((id) => id !== confirmDelete.id))
    toast.success('Customer deleted', `${confirmDelete.name} has been removed.`)
    setConfirmDelete(null)
  }

  const stats = [
    { label: 'Total customers', value: formatNumber(customers.length), icon: Users, color: '#3b82f6' },
    { label: 'Active', value: formatNumber(statusCount['Active'] ?? 0), icon: UserCheck, color: '#10b981' },
    { label: 'VIP', value: formatNumber(statusCount['VIP'] ?? 0), icon: Crown, color: '#8b5cf6' },
    { label: 'Total spend', value: formatCurrency(totalSpend), icon: Wallet, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-4 pb-4 sm:space-y-5">
      {/* ============================== HEADER ============================== */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-r from-sky-50 via-white to-teal-50 p-4 shadow-[0_20px_50px_-28px_rgba(14,116,144,0.4)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 h-48 w-48 rounded-full bg-teal-300/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/4 -z-10 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 text-teal-300 shadow-lg shadow-navy-900/20">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Customers</h1>
              <p className="truncate text-sm text-slate-600">{customers.length} customers in your CRM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setShowForm(true) }}>
              Add Customer
            </Button>
          </div>
        </div>
      </section>

      {/* ============================== STATS ============================== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ============================== FILTERS ============================== */}
      <section className={cn(CARD, 'space-y-3 p-3.5 sm:p-4')}>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            placeholder="Search name, phone, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
            className="md:flex-1"
          />
          <Select value={execFilter} onChange={(e) => setExecFilter(e.target.value)} className="md:w-52">
            <option value="">All executives</option>
            {users.filter((u) => u.role === 'Calling Executive').map((u) => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </Select>
        </div>

        {/* Status chips (same filter as before, one tap away) */}
        <div className="-mx-3.5 overflow-x-auto px-3.5 sm:-mx-4 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2 pb-0.5">
            {(['', ...STATUSES] as string[]).map((s) => {
              const active = statusFilter === s
              const count = s ? statusCount[s] ?? 0 : customers.length
              return (
                <button
                  key={s || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                    active
                      ? 'border-transparent bg-gradient-to-r from-navy-900 to-navy-700 text-white shadow-md shadow-navy-900/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {s && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_DOT[s] }} />}
                  {s || 'All statuses'}
                  <span className={cn('rounded-full px-1.5 py-px text-[10px] tabular-nums', active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <p>
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{customers.length}</span>
          </p>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-teal-700 transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </section>

      {/* ============================== LIST ============================== */}
      {loading ? (
        isDesktop ? (
          <SkeletonTable rows={6} cols={8} />
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )
      ) : isDesktop ? (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(c) => c.id}
          pageSize={PAGE_SIZE}
          bulkSelect
          onBulkSelect={setSelectedIds}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          emptyState={<EmptyState onReset={resetFilters} />}
        />
      ) : (
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className={CARD}>
              <EmptyState onReset={resetFilters} />
            </div>
          ) : (
            <>
              {/* Mobile toolbar */}
              <div className="flex items-center justify-between gap-3 px-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={togglePage}
                    aria-label="Select all customers on this page"
                    className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                  />
                  Select page
                </label>
                <Select
                  value={mobileSort}
                  onChange={(e) => setMobileSort(e.target.value as MobileSort)}
                  className="w-44 text-xs"
                  aria-label="Sort customers"
                >
                  <option value="default">Sort: Default</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="spend">Highest spend</option>
                  <option value="bookings">Most bookings</option>
                  <option value="recent">Recent contact</option>
                </Select>
              </div>

              {pageItems.map((c) => (
                <CustomerCard
                  key={c.id}
                  c={c}
                  selected={selectedIds.includes(c.id)}
                  onToggle={() => toggleOne(c.id)}
                  onOpen={() => navigate(`/customers/${c.id}`)}
                  onEdit={() => { setEditing(c); setShowForm(true) }}
                  onDelete={() => setConfirmDelete(c)}
                />
              ))}

              {pageCount > 1 && (
                <div className={cn(CARD, 'flex items-center justify-between p-2.5')}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ChevronLeft className="h-4 w-4" />}
                    onClick={() => setMobilePage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                  >
                    Prev
                  </Button>
                  <p className="text-xs font-medium text-slate-500">
                    Page <span className="font-semibold text-slate-800">{safePage}</span> of {pageCount}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ChevronRight className="h-4 w-4" />}
                    onClick={() => setMobilePage(Math.min(pageCount, safePage + 1))}
                    disabled={safePage === pageCount}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================== BULK ACTION BAR ============================== */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-3 z-20">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-white/90 p-3 shadow-[0_20px_40px_-16px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-teal-500 px-2 text-xs font-bold tabular-nums text-white">
                {selectedIds.length}
              </span>
              <p className="truncate text-sm font-medium text-slate-700">selected</p>
              {!isDesktop && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={handleExport}>Export</Button>
              <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmBulkDelete(true)}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        description={editing ? `Editing ${editing.name}` : 'Create a new customer profile'}
        size="lg"
      >
        <CustomerForm
          customer={editing}
          onSubmit={async (values) => {
            try {
              if (editing) {
                const updated = await customerService.update(editing.id, values)
                if (updated) {
                  setCustomers((prev) => prev.map((c) => (c.id === editing.id ? updated : c)))
                  toast.success('Customer updated', `${updated.name} has been saved.`)
                }
              } else {
                const created = await customerService.create(values)
                setCustomers((prev) => [created, ...prev])
                toast.success('Customer created', `${created.name} added.`)
              }
              setShowForm(false)
            } catch (error) {
              toast.error('Could not save customer', error instanceof Error ? error.message : 'Please try again.')
            }
          }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete customer?"
        description={`This will permanently remove ${confirmDelete?.name} and their profile data. This action cannot be undone.`}
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title="Delete selected customers?"
        description={`${selectedIds.length} customers will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete all"
      />
    </div>
  )
}