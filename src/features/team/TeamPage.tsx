import { useEffect, useState } from 'react'
import {
  UsersRound, Plus, Search, Phone, Shield, Activity as ActivityIcon,
  Edit, Lock, History, PhoneCall, Clock, Download,
} from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select, Label } from '@/components/ui/Input'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { activityService, callService, recordingService, userService } from '@/services'
import type { Activity, CallRecord, Recording, User, UserRole } from '@/types'
import { formatDate, formatDuration, formatRelative, formatTime } from '@/lib/utils'

const roleTone: Record<UserRole, 'danger' | 'teal'> = {
  Admin: 'danger',
  'Calling Executive': 'teal',
}

const roleDesc: Record<UserRole, string> = {
  Admin: 'Full system access — manage users, settings, billing',
  'Calling Executive': 'Handle leads, calls, follow-ups and bookings',
}

const permissionMatrix: { feature: string; admin: boolean; exec: boolean }[] = [
  { feature: 'Dashboard', admin: true, exec: true },
  { feature: 'Customer Management', admin: true, exec: true },
  { feature: 'Lead Management', admin: true, exec: true },
  { feature: 'Booking Management', admin: true, exec: true },
  { feature: 'Call History', admin: true, exec: true },
  { feature: 'Call Recordings', admin: true, exec: false },
  { feature: 'Team Management', admin: true, exec: false },
  { feature: 'Reports & Analytics', admin: true, exec: false },
  { feature: 'Settings', admin: true, exec: false },
  { feature: 'Bulk Delete', admin: true, exec: false },
]

export default function TeamPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [historyUser, setHistoryUser] = useState<User | null>(null)
  const [historyTab, setHistoryTab] = useState<'activity' | 'calls'>('activity')
  const [historyActivities, setHistoryActivities] = useState<Activity[]>([])
  const [historyCalls, setHistoryCalls] = useState<CallRecord[]>([])
  const [historyRecordings, setHistoryRecordings] = useState<Recording[]>([])
  const [historyActivitiesLoaded, setHistoryActivitiesLoaded] = useState(false)
  const [historyCallsLoaded, setHistoryCallsLoaded] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [formError, setFormError] = useState('')
  const [formValues, setFormValues] = useState({
    name: '', email: '', phone: '', role: 'Calling Executive' as UserRole, active: true, password: '',
  })
  const historyUserId = historyUser?.id

  useEffect(() => {
    if (!historyUserId) return
    if (historyTab === 'activity' && historyActivitiesLoaded) return
    if (historyTab === 'calls' && historyCallsLoaded) return
    let active = true
    setHistoryLoading(true)
    setHistoryError('')
    const loadHistory = async () => {
      try {
        if (historyTab === 'activity') {
          const activities = await activityService.listForUser(historyUserId)
          if (active) {
            setHistoryActivities(activities)
            setHistoryActivitiesLoaded(true)
          }
        } else {
          const [calls, recordings] = await Promise.all([
            callService.listForExecutive(historyUserId),
            recordingService.listForExecutive(historyUserId),
          ])
          if (active) {
            setHistoryCalls(calls)
            setHistoryRecordings(recordings)
            setHistoryCallsLoaded(true)
          }
        }
      } catch (error) {
        if (active) setHistoryError(error instanceof Error ? error.message : 'Could not load user history.')
      } finally {
      if (active) setHistoryLoading(false)
      }
    }
    void loadHistory()
    return () => { active = false }
  }, [historyUserId, historyTab, historyRefresh, historyActivitiesLoaded, historyCallsLoaded])

  useEffect(() => {
    userService.list()
      .then(setUsers)
      .catch((error: unknown) => toast.error('Could not load users', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
  }, [toast])

  const filtered = users.filter((u) => {
    if (query && !u.name.toLowerCase().includes(query.toLowerCase()) && !u.email.toLowerCase().includes(query.toLowerCase())) return false
    if (roleFilter && u.role !== roleFilter) return false
    return true
  })

  const handleSave = async () => {
    setFormError('')
    if (!formValues.name.trim() || !formValues.email.trim() || !formValues.phone.trim()) {
      setFormError('Name, email, and phone are required.')
      return
    }
    if ((!editing || formValues.password) && formValues.password.length < 12) {
      setFormError('Password must be at least 12 characters.')
      return
    }

    try {
      if (editing) {
        const updated = await userService.update(editing.id, formValues)
        setUsers((prev) => prev.map((u) => (u.id === editing.id ? updated : u)))
        toast.success('User updated', updated.name)
      } else {
        const created = await userService.create({ ...formValues, role: 'Calling Executive' })
        setUsers((prev) => [...prev, created])
        toast.success('Calling Executive created', created.name)
      }
      setShowForm(false)
      setFormValues({ name: '', email: '', phone: '', role: 'Calling Executive', active: true, password: '' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save this user.')
    }
  }

  const openHistory = (user: User, tab: 'activity' | 'calls') => {
    setHistoryUser(user)
    setHistoryTab(tab)
    setHistoryActivities([])
    setHistoryCalls([])
    setHistoryRecordings([])
    setHistoryActivitiesLoaded(false)
    setHistoryCallsLoaded(false)
    setHistoryError('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Users"
        description={`${users.length} team members · ${users.filter((u) => u.active).length} active`}
        icon={<UsersRound className="h-5 w-5" />}
        actions={
          <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormError(''); setFormValues({ name: '', email: '', phone: '', role: 'Calling Executive', active: true, password: '' }); setShowForm(true) }}>
            Add Calling Executive
          </Button>
        }
      />

      {/* Role summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Admins</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{users.filter((u) => u.role === 'Admin').length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-danger-50 text-danger-600 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Calling Executives</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{users.filter((u) => u.role === 'Calling Executive').length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Phone className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Search team members..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="md:flex-1"
        />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="md:w-48">
          <option value="">All roles</option>
          <option>Admin</option><option>Calling Executive</option>
        </Select>
      </div>

      {/* User grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => (
            <Card key={u.id} hover>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                  <Badge tone={roleTone[u.role]}>{u.role}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {u.phone}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <ActivityIcon className="h-3.5 w-3.5 text-slate-400" /> {u.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{u.leadCount}</p>
                    <p className="text-[10px] text-slate-500">Leads</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{u.callCount}</p>
                    <p className="text-[10px] text-slate-500">Calls</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-teal-700">{u.conversionRate}%</p>
                    <p className="text-[10px] text-slate-500">Conv. Rate</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{u.lastActive === 'Not signed in' ? u.lastActive : `Last active ${formatRelative(u.lastActive)}`}</span>
                  {u.role === 'Calling Executive' && (
                    <button
                      onClick={() => { setEditing(u); setFormError(''); setFormValues({ name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active, password: '' }); setShowForm(true) }}
                      className="text-xs text-teal-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Edit className="h-3 w-3" /> Edit
                    </button>
                  )}
                </div>
                {u.role === 'Calling Executive' && (
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => openHistory(u, 'activity')}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-700"
                    >
                      <History className="h-3.5 w-3.5" /> User activity
                    </button>
                    <button
                      type="button"
                      onClick={() => openHistory(u, 'calls')}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-700"
                    >
                      <PhoneCall className="h-3.5 w-3.5" /> Calling activity
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Permission matrix */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Role & Permission Matrix</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Access enforced by protected routes and PHP APIs</p>
          </div>
          <Lock className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Feature</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-danger-600 uppercase tracking-wider">Admin</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider">Executive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissionMatrix.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-sm text-slate-700">{row.feature}</td>
                    <td className="px-5 py-3 text-center">{row.admin ? <span className="text-success-600 text-lg">✓</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 text-center">{row.exec ? <span className="text-success-600 text-lg">✓</span> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit User' : 'Add User'}
        description={editing ? `Editing ${editing.name}` : 'Create a Calling Executive account'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="team-name">Full name *</Label>
            <Input id="team-name" autoComplete="name" value={formValues.name} onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))} placeholder="Sneha Reddy" />
          </div>
          <div>
            <Label htmlFor="team-password">{editing ? 'Reset password (optional)' : 'Initial password *'}</Label>
            <Input
              id="team-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required={!editing}
              value={formValues.password}
              onChange={(e) => setFormValues((v) => ({ ...v, password: e.target.value }))}
              placeholder={editing ? 'Leave blank to keep current password' : 'At least 12 characters'}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="team-email">Email *</Label>
              <Input id="team-email" autoComplete="email" type="email" value={formValues.email} onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))} placeholder="sneha@gdaisolutions.com" />
            </div>
            <div>
              <Label htmlFor="team-phone">Phone *</Label>
              <Input id="team-phone" autoComplete="tel" value={formValues.phone} onChange={(e) => setFormValues((v) => ({ ...v, phone: e.target.value }))} placeholder="+91 98456 77889" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Input value="Calling Executive" disabled />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formValues.active ? 'Active' : 'Inactive'} onChange={(e) => setFormValues((v) => ({ ...v, active: e.target.value === 'Active' }))}>
                <option>Active</option><option>Inactive</option>
              </Select>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="font-medium">{formValues.role}:</span> {roleDesc[formValues.role]}
          </div>
          {formError && <p role="alert" className="text-sm text-danger-600">{formError}</p>}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="accent" onClick={handleSave}>{editing ? 'Save changes' : 'Add user'}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!historyUser}
        onClose={() => setHistoryUser(null)}
        title={historyUser ? `${historyUser.name} history` : 'User history'}
        description={historyUser?.email}
        size="lg"
      >
        <div className="space-y-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="User history">
            <button
              type="button"
              role="tab"
              aria-selected={historyTab === 'activity'}
              onClick={() => setHistoryTab('activity')}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${historyTab === 'activity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              User activity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={historyTab === 'calls'}
              onClick={() => setHistoryTab('calls')}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${historyTab === 'calls' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Calling activity
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-3" aria-live="polite">
              <SkeletonCard className="h-20" />
              <SkeletonCard className="h-20" />
            </div>
          ) : historyError ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-700" role="alert">
              <span>{historyError}</span>
              <Button variant="secondary" onClick={() => {
                if (historyTab === 'activity') setHistoryActivitiesLoaded(false)
                else setHistoryCallsLoaded(false)
                setHistoryRefresh((value) => value + 1)
              }}>Retry</Button>
            </div>
          ) : historyTab === 'activity' ? (
            historyActivities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
                <History className="mx-auto h-5 w-5 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700">No activity available</p>
                <p className="mt-1 text-xs text-slate-500">Actions for this user will appear here.</p>
              </div>
            ) : (
              <ol className="divide-y divide-slate-100">
                {historyActivities.map((activity) => (
                  <li key={activity.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{activity.title || activity.description}</p>
                      <time className="text-xs text-slate-400" dateTime={activity.timestamp}>{formatDate(activity.timestamp)} · {formatTime(activity.timestamp)}</time>
                    </div>
                    {activity.description && activity.description !== activity.title && <p className="mt-1 text-xs text-slate-600">{activity.description}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">
                      {activity.actor ? `By ${activity.actor}` : 'System'}
                      {activity.relatedType ? ` · ${activity.relatedType}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )
          ) : historyCalls.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
              <PhoneCall className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">No calls available</p>
              <p className="mt-1 text-xs text-slate-500">Call history for this Executive will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyCalls.map((call) => {
                const callRecordings = historyRecordings.filter((recording) => recording.callId === call.id)
                return (
                  <article key={call.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{call.customerOrLeadName || 'Unknown contact'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{call.type} · {formatDate(call.timestamp)} · {formatTime(call.timestamp)}</p>
                      </div>
                      <Badge tone={statusTone(call.status)}>{call.status}</Badge>
                    </div>
                    <p className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> {formatDuration(Math.max(0, Number(call.durationSec) || 0))}
                    </p>
                    {callRecordings.some((recording) => recording.status === 'Available' && recording.fileRef && ['Admin', 'Public'].includes(recording.accessLevel)) && (
                      <div className="space-y-2 border-t border-slate-100 pt-2">
                        {callRecordings.filter((recording) => recording.status === 'Available' && recording.fileRef && ['Admin', 'Public'].includes(recording.accessLevel)).map((recording) => (
                          <div key={recording.id} className="flex flex-wrap items-center gap-3">
                            <audio
                              controls
                              preload="none"
                              src={recording.fileRef}
                              className="h-9 min-w-0 flex-1"
                              onError={() => toast.error('Recording unavailable', 'The recording could not be played from its private storage.')}
                            />
                            <a
                              href={`${recording.fileRef}${recording.fileRef?.includes('?') ? '&' : '?'}download=1`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
