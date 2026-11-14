import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, Mail, MapPin, User as UserIcon, Car, PhoneCall,
  CalendarClock, FileText, Edit, Plus, TrendingUp, CalendarDays,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Textarea, Label } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { activityService, bookingService, callService, customerService, followUpService } from '@/services'
import type { Activity, Booking, CallRecord, Customer, FollowUp } from '@/types'
import { cn, formatDate, formatTime, formatCurrency, formatRelative, formatDuration } from '@/lib/utils'

export default function CustomerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'followups' | 'bookings' | 'activity'>('overview')
  const [noteModal, setNoteModal] = useState(false)
  const [newNote, setNewNote] = useState('')

  useEffect(() => {
    Promise.all([
      customerService.get(id),
      callService.list(),
      bookingService.list(),
      followUpService.list(),
      activityService.list(),
    ]).then(([customerData, callData, bookingData, followupData, activityData]) => {
      setCustomer(customerData)
      setCalls(callData.filter((call) => call.type === 'Customer' && call.customerOrLeadId === id))
      setBookings(bookingData.filter((booking) => booking.customerId === id))
      setFollowups(followupData.filter((followup) => followup.type === 'Customer' && followup.customerOrLeadId === id))
      setActivities(activityData.filter((activity) => activity.relatedId === id).slice(0, 10))
    }).catch((error: unknown) => {
      toast.error('Could not load customer details', error instanceof Error ? error.message : 'Please try again.')
    }).finally(() => setLoading(false))
  }, [id, toast])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Customer not found.</p>
        <Link to="/customers" className="text-teal-600 hover:underline text-sm mt-2 inline-block">Back to customers</Link>
      </div>
    )
  }

  const custCalls = calls
  const custBookings = bookings
  const custFollowups = followups
  const custActivities = activities

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'calls', label: `Calls (${custCalls.length})`, icon: PhoneCall },
    { id: 'followups', label: `Follow-ups (${custFollowups.length})`, icon: CalendarClock },
    { id: 'bookings', label: `Bookings (${custBookings.length})`, icon: Car },
    { id: 'activity', label: 'Activity', icon: TrendingUp },
  ] as const

  const saveNote = async () => {
    if (!newNote.trim()) return
    const notes = `${customer.notes}\n\n${new Date().toLocaleString()}: ${newNote}`
    try {
      const updated = await customerService.update(customer.id, { notes })
      setCustomer(updated)
      setNewNote('')
      setNoteModal(false)
      toast.success('Note added', 'Customer notes updated.')
    } catch (error) {
      toast.error('Could not save note', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      {/* Customer header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <Avatar name={customer.name} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-navy-900">{customer.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone={statusTone(customer.status)} dot>{customer.status}</Badge>
                    <span className="text-xs text-slate-500">Created {formatDate(customer.joinedOn)} · Updated {formatDate(customer.updatedOn || customer.joinedOn)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setNoteModal(true)}>
                    Add note
                  </Button>
                  <Button variant="accent" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/customers?edit=${encodeURIComponent(customer.id)}`)}>Edit profile</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                <ContactItem icon={<Phone className="h-4 w-4" />} label="Phone" value={customer.phone} />
                <ContactItem icon={<Phone className="h-4 w-4" />} label="Alternate number" value={customer.alternateNumber || '—'} />
                <ContactItem icon={<Mail className="h-4 w-4" />} label="Email" value={customer.email} />
                <ContactItem icon={<MapPin className="h-4 w-4" />} label="Address" value={[customer.location, customer.city].filter(Boolean).join(', ') || '—'} />
                <ContactItem icon={<MapPin className="h-4 w-4" />} label="Pickup location" value={customer.pickupLocation || '—'} />
                <ContactItem icon={<MapPin className="h-4 w-4" />} label="Drop location" value={customer.dropLocation || '—'} />
                <ContactItem icon={<UserIcon className="h-4 w-4" />} label="Assigned user" value={customer.assignedExecutiveName || '—'} />
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <ContactItem icon={<CalendarDays className="h-4 w-4" />} label="Created date" value={formatDate(customer.joinedOn, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
              <ContactItem icon={<CalendarDays className="h-4 w-4" />} label="Updated date" value={formatDate(customer.updatedOn || customer.joinedOn, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100">
            <Stat label="Total bookings" value={customer.totalBookings.toString()} />
            <Stat label="Total spend" value={formatCurrency(customer.totalSpend)} />
            <Stat label="Last contact" value={formatRelative(customer.lastContact)} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
                activeTab === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Customer notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{customer.notes || 'No notes added yet.'}</p>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {customer.tags.map((t) => (
                  <Badge key={t} tone="info">{t}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Assigned executive</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar name={customer.assignedExecutiveName} size="md" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{customer.assignedExecutiveName}</p>
                  <p className="text-xs text-slate-500">Calling Executive</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'calls' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {custCalls.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">No call records for this customer.</p>
              ) : custCalls.map((c) => (
                <div key={c.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/60">
                  <div className={cn('h-9 w-9 rounded-full flex items-center justify-center',
                    c.direction === 'Incoming' ? 'bg-info-50 text-info-600' : 'bg-teal-50 text-teal-600',
                  )}>
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{c.direction} call · {c.status}</p>
                    <p className="text-xs text-slate-500">{formatDate(c.timestamp)} at {formatTime(c.timestamp)} · {formatDuration(c.durationSec)}</p>
                  </div>
                  {c.hasRecording && <Badge tone="info">Recording</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'followups' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {custFollowups.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">No follow-ups scheduled.</p>
              ) : custFollowups.map((f) => (
                <div key={f.id} className="p-4 flex items-center gap-3 hover:bg-slate-50/60">
                  <CalendarClock className="h-4 w-4 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{f.notes}</p>
                    <p className="text-xs text-slate-500">{formatDate(f.scheduledAt)} at {formatTime(f.scheduledAt)} · {f.channel}</p>
                  </div>
                  <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'bookings' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {custBookings.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">No bookings for this customer.</p>
              ) : custBookings.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <Car className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{b.bookingId} · {b.vehicleType}</p>
                      <p className="text-xs text-slate-500">{b.pickupLocation} → {b.dropLocation}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(b.amount)}</p>
                    <Badge tone={statusTone(b.bookingStatus)}>{b.bookingStatus}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardContent>
            <ol className="relative border-l border-slate-200 ml-2 space-y-4">
              {custActivities.length === 0 ? (
                <p className="text-sm text-slate-400">No recent activity.</p>
              ) : custActivities.map((a) => (
                <li key={a.id} className="ml-4">
                  <div className="absolute -left-3 h-2 w-2 rounded-full bg-teal-500 ring-4 ring-white" />
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{formatRelative(a.timestamp)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Modal open={noteModal} onClose={() => setNoteModal(false)} title="Add note" size="md">
        <div className="space-y-3">
          <Label>Note</Label>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add context about this customer — preferences, complaints, follow-up context..."
            rows={5}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setNoteModal(false)}>Cancel</Button>
            <Button variant="accent" onClick={saveNote}>Save note</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ContactItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-navy-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
