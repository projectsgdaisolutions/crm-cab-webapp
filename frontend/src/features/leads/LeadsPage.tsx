import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Search, LayoutGrid, List, Plus, Phone, Mail, MapPin, Calendar,
  ArrowUpRight, DollarSign, Sparkles, GripVertical, UserCheck, Trash2, SlidersHorizontal, ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge, statusTone, priorityTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { LeadForm, LEAD_PRIORITIES, LEAD_SOURCES } from '@/features/leads/LeadForm'
import { useToast } from '@/components/ui/Toast'
import { leadService, userService } from '@/services'
import type { Lead, LeadStatus, User } from '@/types'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

const PIPELINE_STAGES: { id: LeadStatus; label: string; color: string; bg: string; dot: string }[] = [
  { id: 'New', label: 'New', color: 'text-info-700', bg: 'bg-info-50', dot: 'bg-info-500' },
  { id: 'Contacted', label: 'Contacted', color: 'text-navy-700', bg: 'bg-navy-50', dot: 'bg-navy-500' },
  { id: 'Follow-up', label: 'Follow-up', color: 'text-warning-700', bg: 'bg-warning-50', dot: 'bg-warning-500' },
  { id: 'Interested', label: 'Interested', color: 'text-teal-700', bg: 'bg-teal-50', dot: 'bg-teal-500' },
  { id: 'Booking Confirmed', label: 'Booking Confirmed', color: 'text-success-700', bg: 'bg-success-50', dot: 'bg-success-500' },
  { id: 'Converted', label: 'Converted', color: 'text-success-700', bg: 'bg-success-50', dot: 'bg-success-500' },
  { id: 'Lost', label: 'Lost', color: 'text-danger-700', bg: 'bg-danger-50', dot: 'bg-danger-500' },
]

const NEXT_LEAD_STATUSES: Record<LeadStatus, LeadStatus[]> = {
  New: ['Contacted'],
  Contacted: ['Follow-up'],
  'Follow-up': ['Interested'],
  Interested: ['Booking Confirmed'],
  'Booking Confirmed': ['Lost'],
  Converted: [],
  Lost: [],
}

const dateOrDash = (value?: string | null) => (value ? formatDate(value) : '—')

export default function LeadsPage() {
  const toast = useToast()
  const [search, setSearch] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [prioFilter, setPrioFilter] = useState('')
  const [execFilter, setExecFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null)
  const [confirmConvert, setConfirmConvert] = useState<Lead | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null)

  const loadLeads = async () => {
    const [leadData, userData] = await Promise.all([leadService.list(), userService.activeExecutives()])
    setLeads(leadData)
    setUsers(userData)
  }

  useEffect(() => {
    loadLeads()
      .catch((error: unknown) => toast.error('Could not load leads', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
    if (search.get('new') === '1') {
      setShowForm(true)
      setSearch({})
    }
  }, [search, setSearch, toast])

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const normalizedQuery = query.toLowerCase()
      if (query && !l.leadId.toLowerCase().includes(normalizedQuery) && !l.name.toLowerCase().includes(normalizedQuery) && !l.phone.includes(query) && !l.email.toLowerCase().includes(normalizedQuery)) return false
      if (sourceFilter && l.source !== sourceFilter) return false
      if (statusFilter && l.status !== statusFilter) return false
      if (prioFilter && (l.priority === 'Hot' ? 'Urgent' : l.priority) !== prioFilter) return false
      if (execFilter && l.assignedExecutiveId !== execFilter) return false
      return true
    })
  }, [leads, query, sourceFilter, statusFilter, prioFilter, execFilter])

  const activeFilterCount = [statusFilter, sourceFilter, prioFilter, execFilter].filter(Boolean).length

  const moveStage = async (leadId: string, status: LeadStatus) => {
    try {
      const updated = await leadService.moveStage(leadId, status)
      setLeads((previous) => previous.map((lead) => lead.id === leadId ? updated : lead))
      setDetailLead((current) => current?.id === leadId ? updated : current)
      toast.success('Lead moved', `${updated.leadId} → ${status}`)
    } catch (error) {
      toast.error('Lead stage change rejected', error instanceof Error ? error.message : 'Follow the lead workflow.')
    }
  }

  const handleDrop = (stage: LeadStatus) => {
    if (draggedId) {
      const lead = leads.find((item) => item.id === draggedId)
      if (lead && NEXT_LEAD_STATUSES[lead.status].includes(stage)) moveStage(draggedId, stage)
      else if (lead && lead.status !== stage) toast.error('Invalid lead transition', `Move ${lead.status} to ${NEXT_LEAD_STATUSES[lead.status].join(' or ') || 'no further stage'}.`)
      setDraggedId(null)
      setDragOverStage(null)
    }
  }

  const handleConvert = async () => {
    if (!confirmConvert) return
    try {
      const result = await leadService.convertToCustomer(confirmConvert.id)
      await loadLeads()
      setDetailLead(null)
      toast.success('Lead converted', `${result.lead.leadId} linked to customer ${result.customer.id}.`)
    } catch (error) {
      toast.error('Could not convert lead', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setConfirmConvert(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await leadService.remove(confirmDelete.id)
      setLeads((previous) => previous.filter((lead) => lead.id !== confirmDelete.id))
      if (detailLead?.id === confirmDelete.id) setDetailLead(null)
      toast.success('Lead deleted', `${confirmDelete.leadId} was removed.`)
    } catch (error) {
      toast.error('Could not delete lead', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setConfirmDelete(null)
    }
  }

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead',
      sortable: true,
      render: (l) => (
        <div className="flex items-center gap-3">
          <Avatar name={l.name} size="sm" />
          <div>
            <p className="text-[10px] text-slate-400">{l.leadId}</p>
            <p className="font-medium text-slate-900">{l.name}</p>
            <p className="text-xs text-slate-500">{l.interestedService}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', sortable: true },
    { key: 'travelAt', header: 'Travel date', sortable: true, render: (l) => <span className="text-xs text-slate-600">{formatDate(l.travelAt)}</span> },
    { key: 'source', header: 'Source', sortable: true, render: (l) => <Badge tone="default">{l.source}</Badge> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (l) => <Badge tone={statusTone(l.status)} dot>{l.status}</Badge>,
    },
    { key: 'priority', header: 'Priority', sortable: true, render: (l) => <Badge tone={priorityTone(l.priority)}>{l.priority}</Badge> },
    { key: 'assignedExecutiveName', header: 'Executive', sortable: true, render: (l) => (
      <div className="flex items-center gap-2">
        <Avatar name={l.assignedExecutiveName} size="xs" />
        <span className="text-xs text-slate-700">{l.assignedExecutiveName}</span>
      </div>
    )},
    { key: 'estimatedValue', header: 'Value', sortable: true, render: (l) => <span className="font-medium">{formatCurrency(l.estimatedValue)}</span> },
    { key: 'nextFollowUp', header: 'Next Follow-up', sortable: true, accessor: (l) => l.nextFollowUp, render: (l) => <span className="text-xs text-slate-500">{dateOrDash(l.nextFollowUp)}</span> },
    { key: 'createdOn', header: 'Created', sortable: true, render: (l) => <span className="text-xs text-slate-500">{formatDate(l.createdOn)}</span> },
    { key: 'updatedOn', header: 'Updated', sortable: true, render: (l) => <span className="text-xs text-slate-500">{formatDate(l.updatedOn)}</span> },
    { key: 'actions', header: '', width: '40px', render: (lead) => (
      <button onClick={(event) => { event.stopPropagation(); setConfirmDelete(lead) }} className="text-slate-400 hover:text-danger-600 p-1.5 hover:bg-danger-50 rounded-md" title="Delete lead">
        <Trash2 className="h-4 w-4" />
      </button>
    ) },
  ]

  const urgentCount = leads.filter((l) => l.priority === 'Urgent' || l.priority === 'Hot').length
  const newCount = leads.filter((l) => l.status === 'New').length

  return (
    <div className="pb-24 md:pb-6">
      <PageHeader
        title="Leads"
        description={`${leads.length} leads · ${newCount} new · ${urgentCount} urgent`}
        icon={<UserPlus className="h-5 w-5" />}
        actions={
          <>
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-soft">
              <button
                aria-label="Board view"
                onClick={() => setView('kanban')}
                className={cn('p-2 rounded-lg transition-all', view === 'kanban' ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                aria-label="List view"
                onClick={() => setView('list')}
                className={cn('p-2 rounded-lg transition-all', view === 'list' ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button className="hidden md:inline-flex" variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setShowForm(true) }}>
              Add Lead
            </Button>
          </>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        {[
          { label: 'Total', value: leads.length },
          { label: 'New', value: newCount },
          { label: 'Urgent', value: urgentCount },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-soft">
            <p className="text-[11px] text-slate-500">{s.label}</p>
            <p className="text-lg sm:text-xl font-semibold text-navy-900 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur p-3 sm:p-4 mb-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search name, phone, ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
            className="flex-1"
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              'md:hidden relative h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center transition-colors',
              showFilters || activeFilterCount ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-slate-600 border-slate-200',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-teal-500 text-white text-[10px] flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>
        <div className={cn('grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-3', showFilters ? 'grid' : 'hidden md:grid')}>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {PIPELINE_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          </Select>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            {LEAD_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
          </Select>
          <Select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)}>
            <option value="">All priorities</option>
            {LEAD_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </Select>
          <Select value={execFilter} onChange={(e) => setExecFilter(e.target.value)}>
            <option value="">All executives</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        view === 'kanban'
          ? <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">{PIPELINE_STAGES.map((stage) => <SkeletonCard key={stage.id} />)}</div>
          : <Skeleton className="h-96" />
      ) : view === 'kanban' ? (
        <div className="overflow-x-auto pb-3 -mx-4 px-4 sm:-mx-2 sm:px-2 snap-x snap-mandatory md:snap-none scroll-px-4">
          <div className="grid grid-flow-col auto-cols-[84%] sm:auto-cols-[300px] gap-3 sm:gap-4 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = filtered.filter((l) => l.status === stage.id)
              const totalValue = stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0)
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id) }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={() => handleDrop(stage.id)}
                  className={cn(
                    'snap-start flex flex-col rounded-2xl border transition-colors',
                    dragOverStage === stage.id ? 'border-teal-400 bg-teal-50/50 ring-4 ring-teal-100' : 'border-slate-200/80 bg-slate-50/60',
                  )}
                >
                  <div className="px-3.5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', stage.dot)} />
                      <span className={cn('text-sm font-semibold truncate', stage.color)}>{stage.label}</span>
                      <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-1.5 min-w-5 text-center">{stageLeads.length}</span>
                    </div>
                    {totalValue > 0 && (
                      <span className="text-[11px] font-medium text-slate-500">{formatCurrency(totalValue)}</span>
                    )}
                  </div>
                  <div className="flex-1 px-2.5 pb-2.5 space-y-2.5 min-h-[160px] max-h-[65vh] md:max-h-[600px] overflow-y-auto">
                    <AnimatePresence>
                      {stageLeads.map((lead) => (
                        <motion.div
                          layout
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggedId(lead.id)}
                          onDragEnd={() => { setDraggedId(null); setDragOverStage(null) }}
                          onClick={() => setDetailLead(lead)}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className={cn(
                            'bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-soft cursor-pointer md:cursor-grab md:active:cursor-grabbing hover:border-teal-300 hover:shadow-md transition-all',
                            draggedId === lead.id && 'opacity-50',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar name={lead.name} size="sm" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
                                <p className="text-[11px] text-slate-400">{lead.leadId}</p>
                              </div>
                            </div>
                            <GripVertical className="hidden md:block h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                          </div>
                          <p className="text-xs text-slate-600 mt-2.5 truncate">{lead.interestedService}</p>
                          {(lead.pickupLocation || lead.dropLocation) && (
                            <p className="text-[11px] text-slate-400 mt-1 truncate flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />{lead.pickupLocation} → {lead.dropLocation}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2.5">
                            <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                            <span className="text-[11px] text-slate-400">{lead.source}</span>
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Avatar name={lead.assignedExecutiveName} size="xs" />
                              <span className="text-[11px] text-slate-500 truncate">{lead.assignedExecutiveName.split(' ')[0]}</span>
                            </div>
                            <span className="text-sm font-semibold text-navy-900">{formatCurrency(lead.estimatedValue)}</span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {stageLeads.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">No leads here</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.length === 0 && <div className="text-center text-sm text-slate-400 py-10">No leads match filters.</div>}
            {filtered.map((lead) => (
              <button
                key={lead.id}
                onClick={() => setDetailLead(lead)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-soft active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={lead.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
                      <span className="text-sm font-semibold text-navy-900">{formatCurrency(lead.estimatedValue)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{lead.leadId} · {lead.interestedService}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge tone={statusTone(lead.status)} dot>{lead.status}</Badge>
                      <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(lead.travelAt)}</span>
                      <span className="flex items-center gap-1">{lead.assignedExecutiveName}<ChevronRight className="h-3 w-3 text-slate-300" /></span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(l) => l.id}
              pageSize={10}
              onRowClick={(l) => setDetailLead(l)}
              emptyState={<div className="text-slate-400 text-sm">No leads match filters.</div>}
            />
          </div>
        </>
      )}

      {/* Mobile floating add button */}
      <button
        onClick={() => { setEditing(null); setShowForm(true) }}
        aria-label="Add lead"
        className="md:hidden fixed right-4 bottom-5 z-30 h-14 px-5 rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/25 flex items-center gap-2 font-medium active:scale-95 transition-transform"
      >
        <Plus className="h-5 w-5" /> Add lead
      </button>

      {/* Lead form */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Lead' : 'Add Lead'}
        description={editing ? `Editing ${editing.name}` : 'Capture a new lead'}
        size="lg"
      >
        <LeadForm
          lead={editing}
          onSubmit={async (values) => {
            try {
              if (editing) {
                const updated = await leadService.update(editing.id, values)
                setLeads((prev) => prev.map((lead) => (lead.id === editing.id ? updated : lead)))
                toast.success('Lead updated', updated.leadId)
              } else {
                const created = await leadService.create(values)
                setLeads((prev) => [created, ...prev])
                toast.success('Lead created', created.leadId)
              }
              setShowForm(false)
            } catch (error) {
              toast.error('Could not save lead', error instanceof Error ? error.message : 'Please try again.')
            }
          }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      {/* Lead detail drawer */}
      <Drawer
        open={!!detailLead}
        onClose={() => setDetailLead(null)}
        title={detailLead ? `${detailLead.leadId} · ${detailLead.name}` : undefined}
        description={detailLead ? `${detailLead.status} · ${detailLead.priority} priority` : ''}
        size="xl"
      >
        {detailLead && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(detailLead.status)} dot>{detailLead.status}</Badge>
              <Badge tone={priorityTone(detailLead.priority)}>{detailLead.priority}</Badge>
              <Badge tone="info">{detailLead.interestedService}</Badge>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 text-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-white/60">Estimated value</p>
                <p className="text-2xl font-semibold">{formatCurrency(detailLead.estimatedValue)}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`tel:${detailLead.phone}`} aria-label="Call" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><Phone className="h-4 w-4" /></a>
                {detailLead.email && <a href={`mailto:${detailLead.email}`} aria-label="Email" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><Mail className="h-4 w-4" /></a>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <InfoTile icon={<UserPlus className="h-4 w-4" />} label="Lead ID" value={detailLead.leadId} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Travel date & time" value={formatDate(detailLead.travelAt)} />
              <InfoTile icon={<Phone className="h-4 w-4" />} label="Phone" value={detailLead.phone} />
              <InfoTile icon={<Mail className="h-4 w-4" />} label="Email" value={detailLead.email || '—'} />
              <InfoTile icon={<MapPin className="h-4 w-4" />} label="Pickup" value={detailLead.pickupLocation} />
              <InfoTile icon={<MapPin className="h-4 w-4" />} label="Drop" value={detailLead.dropLocation} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Next Follow-up" value={detailLead.nextFollowUp ? formatDate(detailLead.nextFollowUp) : 'Not scheduled'} />
              <InfoTile icon={<Sparkles className="h-4 w-4" />} label="Source" value={detailLead.source} />
              <InfoTile icon={<DollarSign className="h-4 w-4" />} label="Est. Value" value={formatCurrency(detailLead.estimatedValue)} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Created" value={formatDate(detailLead.createdOn)} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Updated" value={formatDate(detailLead.updatedOn)} />
            </div>

            <div className="rounded-2xl border border-slate-200/80 p-4">
              <p className="text-xs font-medium text-slate-500 mb-1.5">Notes</p>
              <p className="text-sm text-slate-700 leading-relaxed">{detailLead.remarks || 'No notes added.'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 p-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Assigned executive</p>
              <div className="flex items-center gap-2.5">
                <Avatar name={detailLead.assignedExecutiveName} size="sm" />
                <span className="text-sm font-medium text-slate-900">{detailLead.assignedExecutiveName}</span>
              </div>
            </div>

            {/* Stage mover */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Move to next stage</p>
              <div className="flex flex-wrap gap-2">
                {NEXT_LEAD_STATUSES[detailLead.status].map((nextStatus) => {
                  const s = PIPELINE_STAGES.find((stage) => stage.id === nextStatus)!
                  return (
                    <button
                      key={s.id}
                      onClick={() => moveStage(detailLead.id, s.id)}
                      className={cn(
                        'px-3.5 py-2 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                        detailLead.status === s.id
                          ? `${s.bg} ${s.color} border-transparent`
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                      {s.label}
                    </button>
                  )
                })}
                {NEXT_LEAD_STATUSES[detailLead.status].length === 0 && <span className="text-xs text-slate-500">No further stage</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => { setEditing(detailLead); setDetailLead(null); setShowForm(true) }}>
                Edit
              </Button>
              {detailLead.status !== 'Converted' && (
                <Button variant="accent" icon={<UserCheck className="h-4 w-4" />} disabled={detailLead.status !== 'Booking Confirmed'} onClick={() => setConfirmConvert(detailLead)}>
                  Convert to Customer
                </Button>
              )}
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(detailLead)}>Delete</Button>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirmConvert}
        onClose={() => setConfirmConvert(null)}
        onConfirm={handleConvert}
        title="Convert lead to customer?"
        description={`${confirmConvert?.leadId} will be linked to a new customer. The lead and its history will be retained.`}
        confirmLabel="Convert"
        tone="accent"
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete lead?"
        description={`${confirmDelete?.leadId} and its pending follow-up records will be removed. This cannot be undone.`}
        confirmLabel="Delete lead"
      />
    </div>
  )
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="text-sm text-slate-900 break-words">{value}</p>
      </div>
    </div>
  )
}