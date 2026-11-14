import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarClock, List, Calendar, Plus, ChevronLeft, ChevronRight, Phone, Mail,
  MessageCircle, MapPin, Clock, CheckCircle2, XCircle, AlertCircle, Pencil,
} from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select, Label, Textarea } from '@/components/ui/Input'
import { Badge, priorityTone } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { customerService, followUpService, leadService, userService } from '@/services'
import type { Customer, FollowUp, Lead, User } from '@/types'
import { cn, formatDate, formatTime, isSameDay } from '@/lib/utils'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format,
  addMonths, subMonths, isToday, isSameMonth,
} from 'date-fns'

const channelIcon = {
  Phone: Phone,
  WhatsApp: MessageCircle,
  Email: Mail,
  Visit: MapPin,
}

export default function FollowUpsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [search, setSearch] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [statusFilter, setStatusFilter] = useState('')
  const [prioFilter, setPrioFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingFollowup, setEditingFollowup] = useState<FollowUp | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState<FollowUp | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<FollowUp | null>(null)
  const [cursor, setCursor] = useState(new Date())
  const [formValues, setFormValues] = useState({
    customerOrLeadName: '',
    customerOrLeadId: '',
    type: 'Lead' as 'Customer' | 'Lead',
    scheduledAt: '',
    priority: 'Medium' as FollowUp['priority'],
    channel: 'Phone' as FollowUp['channel'],
    status: 'Pending' as FollowUp['status'],
    notes: '',
    assignedExecutiveId: '',
  })

  useEffect(() => {
    Promise.all([followUpService.list(), userService.list(), customerService.list(), leadService.list()])
      .then(([followupData, userData, customerData, leadData]) => {
        setFollowups(followupData)
        setUsers(userData.filter((user) => user.role === 'Calling Executive' && user.active))
        setCustomers(customerData)
        setLeads(leadData)
        const defaultExecutive = userData.find((user) => user.role === 'Calling Executive' && user.active)
        setFormValues((values) => ({ ...values, assignedExecutiveId: values.assignedExecutiveId || defaultExecutive?.id || '' }))
      })
      .catch((error: unknown) => toast.error('Could not load follow-ups', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
    if (search.get('new') === '1') {
      setShowForm(true)
      setSearch({})
    }
  }, [search, setSearch, toast])

  const filtered = useMemo(() => {
    return followups.filter((f) => {
      if (statusFilter && f.status !== statusFilter) return false
      if (prioFilter && f.priority !== prioFilter) return false
      return true
    })
  }, [followups, statusFilter, prioFilter])

  const today = new Date()
  const todays = filtered.filter((f) => f.status === 'Pending' && isSameDay(new Date(f.scheduledAt), today))
  const upcoming = filtered.filter((f) => f.status === 'Pending' && new Date(f.scheduledAt) > today && !isSameDay(new Date(f.scheduledAt), today))
  const overdue = filtered.filter((f) => f.status === 'Pending' && new Date(f.scheduledAt) < today && !isSameDay(new Date(f.scheduledAt), today))
  const completed = filtered.filter((followup) => followup.status === 'Completed')
  const rescheduled = filtered.filter((followup) => followup.status === 'Rescheduled')

  // Calendar grid
  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getByDay = (day: Date) =>
    filtered.filter((f) => isSameDay(new Date(f.scheduledAt), day))

  const handleSave = async () => {
    if (saving) return
    const selectedEntity = formValues.type === 'Customer'
      ? customers.find((customer) => customer.id === formValues.customerOrLeadId)
      : leads.find((lead) => lead.id === formValues.customerOrLeadId)
    if (!selectedEntity || !formValues.scheduledAt) {
      toast.error('Missing follow-up details', 'Select a customer or lead and a scheduled time.')
      return
    }
    const exec = users.find((u) => u.id === formValues.assignedExecutiveId)
    const payload = {
      ...formValues,
      customerOrLeadName: selectedEntity.name,
      assignedExecutiveName: exec?.name || '',
      scheduledAt: new Date(formValues.scheduledAt).toISOString(),
    }
    setSaving(true)
    try {
      if (editingFollowup) {
        const updated = await followUpService.update(editingFollowup.id, payload)
        setFollowups((previous) => previous.map((followup) => followup.id === updated.id ? updated : followup))
        toast.success('Follow-up updated', `${updated.customerOrLeadName} · ${formatDate(updated.scheduledAt)}`)
      } else {
        const created = await followUpService.create(payload)
        setFollowups((previous) => [created, ...previous])
        toast.success('Follow-up scheduled', `${created.customerOrLeadName} · ${formatDate(created.scheduledAt)}`)
      }
      setShowForm(false)
      setEditingFollowup(null)
      setFormValues({ customerOrLeadName: '', customerOrLeadId: '', type: 'Lead', scheduledAt: '', priority: 'Medium', channel: 'Phone', status: 'Pending', notes: '', assignedExecutiveId: users[0]?.id || '' })
    } catch (error) {
      toast.error('Could not save follow-up', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const editFollowup = (followup: FollowUp) => {
    setEditingFollowup(followup)
    setFormValues({
      customerOrLeadName: followup.customerOrLeadName,
      customerOrLeadId: followup.customerOrLeadId,
      type: followup.type,
      scheduledAt: toDateTimeLocal(followup.scheduledAt),
      priority: followup.priority,
      channel: followup.channel,
      status: followup.status,
      notes: followup.notes,
      assignedExecutiveId: followup.assignedExecutiveId,
    })
    setShowForm(true)
  }

  const startNewFollowup = () => {
    setEditingFollowup(null)
    setFormValues({
      customerOrLeadName: '',
      customerOrLeadId: '',
      type: 'Lead',
      scheduledAt: '',
      priority: 'Medium',
      channel: 'Phone',
      status: 'Pending',
      notes: '',
      assignedExecutiveId: users[0]?.id || user?.id || '',
    })
    setShowForm(true)
  }

  const handleComplete = async () => {
    if (!confirmComplete) return
    try {
      const updated = await followUpService.complete(confirmComplete.id)
      if (updated) {
        setFollowups((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
        toast.success('Follow-up completed', confirmComplete.customerOrLeadName)
      }
    } catch (error) {
      toast.error('Could not complete follow-up', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setConfirmComplete(null)
    }
  }

  const handleCancel = async () => {
    if (!confirmCancel) return
    try {
      const updated = await followUpService.cancel(confirmCancel.id)
      if (updated) {
        setFollowups((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
        toast.info('Follow-up cancelled', confirmCancel.customerOrLeadName)
      }
    } catch (error) {
      toast.error('Could not cancel follow-up', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setConfirmCancel(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description={`${todays.length} today · ${upcoming.length} upcoming · ${overdue.length} overdue`}
        icon={<CalendarClock className="h-5 w-5" />}
        actions={
          <>
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md', view === 'list' ? 'bg-navy-900 text-white' : 'text-slate-500')}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setView('calendar')} className={cn('p-1.5 rounded-md', view === 'calendar' ? 'bg-navy-900 text-white' : 'text-slate-500')}>
                <Calendar className="h-4 w-4" />
              </button>
            </div>
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={startNewFollowup}>
              Schedule
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-col md:flex-row gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="md:w-44">
          <option value="">All statuses</option>
          <option>Pending</option><option>Completed</option><option>Cancelled</option><option>Rescheduled</option>
        </Select>
        <Select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)} className="md:w-44">
          <option value="">All priorities</option>
          <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : view === 'list' ? (
        <div className="space-y-6">
          {/* Today */}
          <Section title="Today's Follow-ups" icon={<Clock className="h-4 w-4 text-teal-600" />} tone="teal" items={todays} onAction={(f) => setConfirmComplete(f)} onCancel={(f) => setConfirmCancel(f)} onEdit={editFollowup} />
          {/* Overdue */}
          <Section title="Overdue" icon={<AlertCircle className="h-4 w-4 text-danger-600" />} tone="danger" items={overdue} onAction={(f) => setConfirmComplete(f)} onCancel={(f) => setConfirmCancel(f)} onEdit={editFollowup} />
          {/* Upcoming */}
          <Section title="Upcoming" icon={<CalendarClock className="h-4 w-4 text-info-600" />} tone="info" items={upcoming} onAction={(f) => setConfirmComplete(f)} onCancel={(f) => setConfirmCancel(f)} onEdit={editFollowup} />
          <Section title="Rescheduled" icon={<CalendarClock className="h-4 w-4 text-info-600" />} tone="info" items={rescheduled} onAction={(f) => setConfirmComplete(f)} onCancel={(f) => setConfirmCancel(f)} onEdit={editFollowup} />
          <Section title="Completed" icon={<CheckCircle2 className="h-4 w-4 text-success-600" />} tone="teal" items={completed} onAction={(f) => setConfirmComplete(f)} onCancel={(f) => setConfirmCancel(f)} readOnly />
          {filtered.length === 0 && (
            <div className="card px-5 py-10 text-center text-sm text-slate-500">No follow-ups match this view.</div>
          )}
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">{format(cursor, 'MMMM yyyy')}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setCursor(subMonths(cursor, 1))} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setCursor(new Date())} className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-slate-100 text-slate-600">
                Today
              </button>
              <button onClick={() => setCursor(addMonths(cursor, 1))} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const items = getByDay(day)
              const inMonth = isSameMonth(day, cursor)
              const isTodayDay = isToday(day)
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[80px] rounded-lg border p-1.5 transition-colors',
                    !inMonth && 'bg-slate-50/50 border-slate-100',
                    inMonth && 'bg-white border-slate-100 hover:border-slate-200',
                    isTodayDay && 'border-teal-400 bg-teal-50/30',
                  )}
                >
                  <div className={cn(
                    'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-medium',
                    isTodayDay ? 'bg-teal-600 text-white' : inMonth ? 'text-slate-600' : 'text-slate-300',
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 mt-1">
                    {items.slice(0, 3).map((f) => {
                      const Icon = channelIcon[f.channel]
                      return (
                        <div
                          key={f.id}
                          className={cn(
                            'text-[10px] px-1 py-0.5 rounded flex items-center gap-1 truncate',
                            f.status === 'Completed' ? 'bg-success-100 text-success-700 line-through' :
                            f.status === 'Cancelled' ? 'bg-slate-100 text-slate-400 line-through' :
                            f.priority === 'Urgent' ? 'bg-danger-100 text-danger-700' :
                            f.priority === 'High' ? 'bg-warning-100 text-warning-700' : 'bg-info-100 text-info-700',
                          )}
                          title={`${f.customerOrLeadName} · ${formatTime(f.scheduledAt)}`}
                        >
                          <Icon className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="truncate">{f.customerOrLeadName.split(' ')[0]}</span>
                        </div>
                      )
                    })}
                    {items.length > 3 && (
                      <p className="text-[10px] text-slate-400 px-1">+{items.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create follow-up modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingFollowup(null) }}
        title={editingFollowup ? 'Edit / Reschedule Follow-up' : 'Schedule Follow-up'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label>Customer / Lead *</Label>
            <Select
              value={formValues.customerOrLeadId}
              onChange={(e) => {
                const selected = (formValues.type === 'Customer' ? customers : leads).find((entity) => entity.id === e.target.value)
                setFormValues((values) => ({ ...values, customerOrLeadId: e.target.value, customerOrLeadName: selected?.name || '' }))
              }}
            >
              <option value="">Select {formValues.type.toLowerCase()}</option>
              {(formValues.type === 'Customer' ? customers : leads).map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={formValues.type}
                onChange={(e) => setFormValues((v) => ({ ...v, type: e.target.value as 'Customer' | 'Lead', customerOrLeadId: '', customerOrLeadName: '' }))}
              >
                <option>Customer</option>
                <option>Lead</option>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select
                value={formValues.channel}
                onChange={(e) => setFormValues((v) => ({ ...v, channel: e.target.value as FollowUp['channel'] }))}
              >
                <option>Phone</option>
                <option>WhatsApp</option>
                <option>Email</option>
                <option>Visit</option>
              </Select>
            </div>
            <div>
              <Label>Scheduled at *</Label>
              <Input
                type="datetime-local"
                value={formValues.scheduledAt}
                onChange={(e) => setFormValues((v) => ({ ...v, scheduledAt: e.target.value }))}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={formValues.priority}
                onChange={(e) => setFormValues((v) => ({ ...v, priority: e.target.value as FollowUp['priority'] }))}
              >
                <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
              </Select>
            </div>
          </div>
          {user?.role === 'Admin' && <div>
            <Label>Assigned to</Label>
            <Select
              value={formValues.assignedExecutiveId}
              onChange={(e) => setFormValues((v) => ({ ...v, assignedExecutiveId: e.target.value }))}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>}
          {editingFollowup && <div>
            <Label>Status</Label>
            <Select value={formValues.status} onChange={(e) => setFormValues((values) => ({ ...values, status: e.target.value as FollowUp['status'] }))}>
              <option>Pending</option><option>Completed</option><option>Rescheduled</option><option>Cancelled</option>
            </Select>
          </div>}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={formValues.notes}
              onChange={(e) => setFormValues((v) => ({ ...v, notes: e.target.value }))}
              placeholder="Context, purpose, expected outcome..."
              rows={3}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingFollowup(null) }}>Cancel</Button>
            <Button variant="accent" loading={saving} onClick={handleSave}>{editingFollowup ? 'Save changes' : 'Schedule'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmComplete}
        onClose={() => setConfirmComplete(null)}
        onConfirm={handleComplete}
        title="Mark follow-up complete?"
        description={`${confirmComplete?.customerOrLeadName} will be marked as completed.`}
        confirmLabel="Complete"
        tone="accent"
      />
      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancel}
        title="Cancel follow-up?"
        description={`${confirmCancel?.customerOrLeadName}'s follow-up will be cancelled.`}
        confirmLabel="Cancel follow-up"
      />
    </div>
  )
}

function Section({
  title, icon, tone, items, onAction, onCancel,
  onEdit, readOnly = false,
}: {
  title: string
  icon: React.ReactNode
  tone: 'teal' | 'danger' | 'info'
  items: FollowUp[]
  onAction: (f: FollowUp) => void
  onCancel: (f: FollowUp) => void
  onEdit?: (f: FollowUp) => void
  readOnly?: boolean
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <div className={cn(
        'px-5 py-3 border-b border-slate-100 flex items-center gap-2',
        tone === 'teal' && 'bg-teal-50/40',
        tone === 'danger' && 'bg-danger-50/40',
        tone === 'info' && 'bg-info-50/40',
      )}>
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Badge tone="default">{items.length}</Badge>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((f) => {
          const Icon = channelIcon[f.channel]
          return (
            <div key={f.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50/60">
              <div className={cn(
                'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
                f.channel === 'Phone' && 'bg-info-50 text-info-600',
                f.channel === 'WhatsApp' && 'bg-success-50 text-success-600',
                f.channel === 'Email' && 'bg-purple-50 text-purple-600',
                f.channel === 'Visit' && 'bg-warning-50 text-warning-600',
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{f.customerOrLeadName}</p>
                  <Badge tone={priorityTone(f.priority)}>{f.priority}</Badge>
                  <Badge tone="default">{f.type}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{f.notes}</p>
                {readOnly && f.completedAt && (
                  <p className="text-[10px] text-success-700 mt-0.5">Completed {formatDate(f.completedAt)} · {formatTime(f.completedAt)}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-medium text-slate-700">{formatDate(f.scheduledAt)}</p>
                <p className="text-[10px] text-slate-500">{formatTime(f.scheduledAt)}</p>
              </div>
              {!readOnly && <div className="flex items-center gap-1">
                {onEdit && <button onClick={() => onEdit(f)} aria-label={`Edit follow-up for ${f.customerOrLeadName}`} className="text-slate-400 hover:text-teal-600 p-1.5 hover:bg-teal-50 rounded-md" title="Edit or reschedule">
                  <Pencil className="h-4 w-4" />
                </button>}
                <button onClick={() => onAction(f)} aria-label={`Complete follow-up for ${f.customerOrLeadName}`} className="text-slate-400 hover:text-success-600 p-1.5 hover:bg-success-50 rounded-md" title="Complete">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button onClick={() => onCancel(f)} aria-label={`Cancel follow-up for ${f.customerOrLeadName}`} className="text-slate-400 hover:text-danger-600 p-1.5 hover:bg-danger-50 rounded-md" title="Cancel">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Re-export Card, etc. for internal use
import { Card } from '@/components/ui/Card'
