import { useEffect, useMemo, useState } from 'react'
import {
  Phone, PhoneIncoming, PhoneOutgoing, Search, Download,
  Clock, User as UserIcon, Calendar, Mic, Plus,
} from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea, Label } from '@/components/ui/Input'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { callService, customerService, leadService } from '@/services'
import { useAuth } from '@/auth/AuthContext'
import type { CallRecord, CallDirection, CallStatus, Customer, Lead } from '@/types'
import { cn, formatDate, formatTime, formatDuration, downloadCSV } from '@/lib/utils'

const directionIcon = {
  Incoming: PhoneIncoming,
  Outgoing: PhoneOutgoing,
}

const directionColor = {
  Incoming: 'bg-info-50 text-info-600',
  Outgoing: 'bg-teal-50 text-teal-600',
}

interface CallFormValues {
  type: 'Customer' | 'Lead'
  customerOrLeadId: string
  phoneNumber: string
  direction: CallDirection
  status: CallStatus
  durationSec: string
  timestamp: string
  notes: string
}

function newCallFormValues(): CallFormValues {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return { type: 'Lead', customerOrLeadId: '', phoneNumber: '', direction: 'Outgoing', status: 'Answered', durationSec: '0', timestamp: localNow, notes: '' }
}

export default function CallsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [query, setQuery] = useState('')
  const [dirFilter, setDirFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailCall, setDetailCall] = useState<CallRecord | null>(null)
  const [showCallForm, setShowCallForm] = useState(false)
  const [savingCall, setSavingCall] = useState(false)
  const [callForm, setCallForm] = useState<CallFormValues>(newCallFormValues)

  useEffect(() => {
    Promise.all([callService.list(), customerService.list(), leadService.list()])
      .then(([callData, customerData, leadData]) => {
        setCalls(callData)
        setCustomers(customerData)
        setLeads(leadData)
      })
      .catch((error: unknown) => toast.error('Could not load call history', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
  }, [toast])

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (query && !c.customerOrLeadName.toLowerCase().includes(query.toLowerCase()) && !c.phoneNumber.includes(query) && !c.callId.toLowerCase().includes(query.toLowerCase())) return false
      if (dirFilter && c.direction !== dirFilter) return false
      if (statusFilter && c.status !== statusFilter) return false
      return true
    })
  }, [calls, query, dirFilter, statusFilter])

  const columns: Column<CallRecord>[] = [
    { key: 'callId', header: 'Call ID', sortable: true, render: (c) => <span className="font-mono text-xs text-slate-600">{c.callId}</span> },
    {
      key: 'customerOrLeadName',
      header: 'Customer / Lead',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-2">
          <Avatar name={c.customerOrLeadName} size="xs" />
          <div>
            <p className="text-sm font-medium text-slate-900">{c.customerOrLeadName}</p>
            <p className="text-[10px] text-slate-500">{c.type}</p>
          </div>
        </div>
      ),
    },
    { key: 'phoneNumber', header: 'Phone', sortable: true, render: (c) => <span className="text-xs text-slate-700">{c.phoneNumber}</span> },
    {
      key: 'direction',
      header: 'Direction',
      sortable: true,
      render: (c) => {
        const Icon = directionIcon[c.direction]
        return (
          <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium', directionColor[c.direction])}>
            <Icon className="h-3 w-3" /> {c.direction}
          </span>
        )
      },
    },
    {
      key: 'timestamp',
      header: 'Date / Time',
      sortable: true,
      accessor: (c) => c.timestamp,
      render: (c) => (
        <div>
          <p className="text-xs font-medium text-slate-700">{formatDate(c.timestamp)}</p>
          <p className="text-[10px] text-slate-500">{formatTime(c.timestamp)}</p>
        </div>
      ),
    },
    { key: 'durationSec', header: 'Duration', sortable: true, render: (c) => <span className="text-xs text-slate-700">{c.durationSec > 0 ? formatDuration(c.durationSec) : '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (c) => <Badge tone={statusTone(c.status)} dot>{c.status}</Badge>,
    },
    {
      key: 'hasRecording',
      header: 'Recording',
      render: (c) => c.hasRecording ? (
        <Badge tone="info"><Mic className="h-3 w-3" /> Available</Badge>
      ) : (
        <Badge tone="default">—</Badge>
      ),
    },
    { key: 'executiveName', header: 'Executive', sortable: true, render: (c) => (
      <div className="flex items-center gap-1.5">
        <Avatar name={c.executiveName} size="xs" />
        <span className="text-xs text-slate-700 truncate">{c.executiveName}</span>
      </div>
    )},
  ]

  const handleExport = () => {
    downloadCSV('calls.csv', filtered.map((c) => ({
      callId: c.callId, customer: c.customerOrLeadName, phone: c.phoneNumber,
      executive: c.executiveName, direction: c.direction, timestamp: c.timestamp,
      durationSec: c.durationSec, status: c.status, recording: c.hasRecording ? 'Yes' : 'No',
    })))
    toast.success('CSV exported', `${filtered.length} call records.`)
  }

  const saveCall = async () => {
    if (savingCall) return
    if (!callForm.customerOrLeadId || !callForm.timestamp) {
      toast.error('Missing call details', 'Select a customer or lead and enter the call date and time.')
      return
    }
    setSavingCall(true)
    try {
      const records = callForm.type === 'Customer' ? customers : leads
      const relatedRecord = records.find((record) => record.id === callForm.customerOrLeadId)
      const created = await callService.create({
        ...callForm,
        phoneNumber: callForm.phoneNumber || relatedRecord?.phone || '',
        durationSec: Math.max(0, Number.parseInt(callForm.durationSec, 10) || 0),
        timestamp: new Date(callForm.timestamp).toISOString(),
      })
      setCalls((previous) => [created, ...previous])
      setCallForm(newCallFormValues())
      setShowCallForm(false)
      toast.success('Call outcome recorded', `${created.customerOrLeadName} · ${created.status}`)
    } catch (error) {
      toast.error('Could not record call', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSavingCall(false)
    }
  }

  const selectCallRelation = (id: string) => {
    const records = callForm.type === 'Customer' ? customers : leads
    const selected = records.find((record) => record.id === id)
    setCallForm((current) => ({ ...current, customerOrLeadId: id, phoneNumber: selected?.phone || '' }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call History"
        description={`${calls.length} calls · ${calls.filter((c) => c.direction === 'Incoming').length} incoming · ${calls.filter((c) => c.direction === 'Outgoing').length} outgoing`}
        icon={<Phone className="h-5 w-5" />}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => { setCallForm(newCallFormValues()); setShowCallForm(true) }}>
              <span className="hidden sm:inline">Record call outcome</span>
              <span className="sm:hidden">Log call</span>
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-warning-200 bg-warning-50/60 px-4 py-3 text-sm text-slate-700">
        This CRM can save a call record but does not initiate calls or connect to a telephony provider. Recording an outcome below does not place a call.
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Search by call ID, customer, phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="md:flex-1"
        />
        <Select value={dirFilter} onChange={(e) => setDirFilter(e.target.value)} className="md:w-40">
          <option value="">All directions</option>
          <option>Incoming</option>
          <option>Outgoing</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="md:w-40">
          <option value="">All statuses</option>
          <option>Answered</option><option>Missed</option><option>Busy</option>
          <option>Rejected</option><option>Failed</option>
        </Select>
      </div>

      {loading ? <SkeletonTable rows={6} cols={9} /> : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(c) => c.id}
          pageSize={10}
          onRowClick={(c) => setDetailCall(c)}
        />
      )}

      <Modal
        open={showCallForm}
        onClose={() => setShowCallForm(false)}
        title="Record call outcome"
        description="This saves a call record only. It does not place a phone call."
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Related record type *</Label>
              <Select
                value={callForm.type}
                onChange={(event) => setCallForm((current) => ({ ...current, type: event.target.value as CallFormValues['type'], customerOrLeadId: '', phoneNumber: '' }))}
              >
                <option>Lead</option><option>Customer</option>
              </Select>
            </div>
            <div>
              <Label>Customer / Lead *</Label>
              <Select value={callForm.customerOrLeadId} onChange={(event) => selectCallRelation(event.target.value)}>
                <option value="">Select {callForm.type.toLowerCase()}</option>
                {(callForm.type === 'Customer' ? customers : leads).map((record) => (
                  <option key={record.id} value={record.id}>{record.name} · {record.phone}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Phone number</Label>
              <Input type="tel" value={callForm.phoneNumber} onChange={(event) => setCallForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
            </div>
            <div>
              <Label>Direction *</Label>
              <Select value={callForm.direction} onChange={(event) => setCallForm((current) => ({ ...current, direction: event.target.value as CallDirection }))}>
                <option>Outgoing</option><option>Incoming</option>
              </Select>
            </div>
            <div>
              <Label>Call outcome *</Label>
              <Select value={callForm.status} onChange={(event) => setCallForm((current) => ({ ...current, status: event.target.value as CallStatus }))}>
                <option>Answered</option><option>Missed</option><option>Busy</option><option>Rejected</option><option>Failed</option>
              </Select>
            </div>
            <div>
              <Label>Duration (seconds)</Label>
              <Input type="number" min="0" step="1" value={callForm.durationSec} onChange={(event) => setCallForm((current) => ({ ...current, durationSec: event.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Date and time *</Label>
              <Input type="datetime-local" value={callForm.timestamp} onChange={(event) => setCallForm((current) => ({ ...current, timestamp: event.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Call notes</Label>
              <Textarea rows={3} value={callForm.notes} onChange={(event) => setCallForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => setShowCallForm(false)}>Cancel</Button>
            <Button variant="accent" loading={savingCall} onClick={saveCall}>Save call record</Button>
          </div>
        </div>
      </Modal>

      <Drawer
        open={!!detailCall}
        onClose={() => setDetailCall(null)}
        title={detailCall?.callId}
        description={detailCall ? `${detailCall.direction} · ${detailCall.status}` : ''}
        size="lg"
      >
        {detailCall && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={cn('h-12 w-12 rounded-full flex items-center justify-center', directionColor[detailCall.direction])}>
                {(() => {
                  const Icon = directionIcon[detailCall.direction]
                  return <Icon className="h-6 w-6" />
                })()}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{detailCall.customerOrLeadName}</p>
                <p className="text-sm text-slate-500">{detailCall.phoneNumber}</p>
              </div>
              <div className="ml-auto">
                <Badge tone={statusTone(detailCall.status)} dot>{detailCall.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoTile icon={<UserIcon className="h-4 w-4" />} label="Executive" value={detailCall.executiveName} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Date" value={`${formatDate(detailCall.timestamp)} ${formatTime(detailCall.timestamp)}`} />
              <InfoTile icon={<Clock className="h-4 w-4" />} label="Duration" value={detailCall.durationSec > 0 ? formatDuration(detailCall.durationSec) : '—'} />
              <InfoTile icon={<Phone className="h-4 w-4" />} label="Direction" value={detailCall.direction} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Notes & Remarks</p>
              <p className="text-sm text-slate-700 leading-relaxed">{detailCall.notes}</p>
            </div>

            {detailCall.hasRecording && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Recording</p>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-medium text-slate-900">Recording available</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {user?.role === 'Admin' ? 'Listen in the Call Recordings section.' : 'Recording playback is restricted to Admin accounts.'}
                  </p>
                </div>
              </div>
            )}

            {detailCall.followUpId && (
              <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-100">
                <p className="text-xs font-medium text-teal-700">Related follow-up</p>
                <p className="text-xs text-slate-600 mt-0.5">Follow-up ID: {detailCall.followUpId}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-sm text-slate-900 truncate">{value}</p>
      </div>
    </div>
  )
}
