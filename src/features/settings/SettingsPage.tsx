import { useEffect, useState } from 'react'
import {
  Settings as SettingsIcon, User as UserIcon, Bell, Sliders, Shield, Save,
  Globe, Mail, Phone, Building, Lock, Smartphone, Clock, Check,
} from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Label } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthContext'
import { preferenceService } from '@/services'
import { apiClient } from '@/services/apiClient'
import { cn } from '@/lib/utils'

type Tab = 'profile' | 'notifications' | 'preferences' | 'access'

export default function SettingsPage() {
  const toast = useToast()
  const { user, updateProfile } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [tab, setTab] = useState<Tab>(isAdmin ? 'profile' : 'preferences')
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set())
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', timezone: 'Asia/Kolkata', bio: '' })
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, Record<string, boolean>>>({})
  const [crmPrefs, setCrmPrefs] = useState<Record<string, string | boolean>>({
    landingPage: 'dashboard', dateFormat: 'DD MMM YYYY', currency: 'INR (₹)', recordsPerPage: '10',
    autoRefresh: true, quickActions: true, keyboardShortcuts: true, compactTables: false,
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!isAdmin) setTab((current) => current === 'profile' || current === 'access' ? 'preferences' : current)
    if (user) {
      if (isAdmin) setProfile({ name: user.name, email: user.email, phone: user.phone ?? '', timezone: user.timezone ?? 'Asia/Kolkata', bio: user.bio ?? '' })
    }
    preferenceService.get().then((saved) => {
      const notifications = saved.notifications
      const crm = saved.crm
      if (notifications && typeof notifications === 'object') setNotificationPrefs(notifications as Record<string, Record<string, boolean>>)
      if (crm && typeof crm === 'object') setCrmPrefs((current) => ({ ...current, ...(crm as Record<string, string | boolean>) }))
    }).catch((error: unknown) => toast.error('Could not load settings', error instanceof Error ? error.message : 'Please try again.'))
  }, [user, toast, isAdmin])

  const handleSave = async (section: 'profile' | 'notifications' | 'preferences') => {
    try {
      if (section === 'profile') await updateProfile(profile)
      else await preferenceService.save({ notifications: notificationPrefs, crm: crmPrefs })
      setSavedItems((prev) => new Set(prev).add(section))
      toast.success('Settings saved', `${section} preferences updated.`)
      setTimeout(() => setSavedItems((prev) => { const next = new Set(prev); next.delete(section); return next }), 2000)
    } catch (error) {
      toast.error('Could not save settings', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handlePasswordUpdate = async () => {
    setPasswordError('')
    if (!currentPassword || newPassword.length < 12 || newPassword !== confirmPassword) {
      setPasswordError('Enter your current password, a new password of at least 12 characters, and matching confirmation.')
      return
    }
    try {
      await apiClient.post('/auth/password.php', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated', 'Your password has been changed.')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Unable to update your password.')
    }
  }

  const allTabs: { id: Tab; label: string; icon: typeof UserIcon }[] = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'CRM Preferences', icon: Sliders },
    { id: 'access', label: 'Access Control', icon: Shield },
  ]
  const tabs = isAdmin ? allTabs : allTabs.filter((item) => item.id === 'notifications' || item.id === 'preferences')

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Settings' : 'Preferences'}
        description={isAdmin ? 'Manage your profile, preferences, and access control' : 'Manage your notification and CRM preferences'}
        icon={<SettingsIcon className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        {/* Sidebar tabs */}
        <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
                tab === t.id ? 'bg-navy-900 text-white shadow-soft' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-6">
          {tab === 'profile' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal details and contact info</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={user?.name ?? ''} size="lg" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Full name</Label>
                      <Input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} icon={<UserIcon className="h-4 w-4" />} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} icon={<Mail className="h-4 w-4" />} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} icon={<Phone className="h-4 w-4" />} />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Input value={user?.role ?? ''} disabled />
                    </div>
                    <div>
                      <Label>Company</Label>
                      <Input value="vehico CRM" disabled icon={<Building className="h-4 w-4" />} />
                    </div>
                    <div>
                      <Label>Timezone</Label>
                      <Select value={profile.timezone} onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))}>
                        <option>Asia/Kolkata</option>
                        <option>Asia/Dubai</option>
                        <option>America/New_York</option>
                        <option>Europe/London</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <Textarea
                      rows={3}
                      value={profile.bio}
                      onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button variant="accent" icon={savedItems.has('profile') ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} onClick={() => handleSave('profile')}>
                      {savedItems.has('profile') ? 'Saved' : 'Save changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Change your account password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Current password</Label>
                      <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} icon={<Lock className="h-4 w-4" />} />
                    </div>
                    <div></div>
                    <div>
                      <Label>New password</Label>
                      <Input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} icon={<Lock className="h-4 w-4" />} />
                    </div>
                    <div>
                      <Label>Confirm password</Label>
                      <Input type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} icon={<Lock className="h-4 w-4" />} />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Two-factor authentication</p>
                        <p className="text-xs text-slate-500">Add an extra layer of security</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">Not configured</span>
                  </div>
                  {passwordError && <p role="alert" className="text-sm text-danger-600">{passwordError}</p>}
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button variant="accent" icon={<Save className="h-4 w-4" />} onClick={handlePasswordUpdate}>
                      Update password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what to be notified about and how</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { label: 'Follow-up reminders', desc: '15 minutes before scheduled time', channels: ['Email', 'SMS', 'In-app'] },
                  { label: 'New lead assignment', desc: 'When a lead is assigned to you', channels: ['Email', 'In-app'] },
                  { label: 'Booking updates', desc: 'Status changes on your bookings', channels: ['In-app'] },
                  { label: 'Task due alerts', desc: '24 hours before task is due', channels: ['Email', 'In-app'] },
                  { label: 'Missed call activity', desc: 'When calls are missed', channels: ['SMS', 'In-app'] },
                  { label: 'Daily summary', desc: 'End-of-day summary email', channels: ['Email'] },
                  { label: 'Weekly report', desc: 'Mondays at 9 AM', channels: ['Email'] },
                ].map((n) => (
                  <NotificationRow
                    key={n.label}
                    {...n}
                    enabledChannels={notificationPrefs[n.label] ?? {}}
                    onChange={(channel, enabled) => setNotificationPrefs((current) => ({
                      ...current,
                      [n.label]: { ...current[n.label], [channel]: enabled },
                    }))}
                  />
                ))}
                <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                  <Button variant="accent" icon={savedItems.has('notifications') ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} onClick={() => handleSave('notifications')}>
                    {savedItems.has('notifications') ? 'Saved' : 'Save preferences'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'preferences' && (
            <>
              {!isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle>My account</CardTitle>
                    <CardDescription>Profile details for the signed-in Calling Executive</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label>Name</Label><Input value={user?.name ?? ''} readOnly /></div>
                    <div><Label>Email</Label><Input value={user?.email ?? ''} readOnly /></div>
                    <div><Label>Phone</Label><Input value={user?.phone ?? ''} readOnly /></div>
                    <div><Label>Role</Label><Input value={user?.role ?? ''} readOnly /></div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>CRM Preferences</CardTitle>
                  <CardDescription>Customize how the CRM works for you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Default landing page</Label>
                      <Select value={String(crmPrefs.landingPage)} onChange={(event) => setCrmPrefs((current) => ({ ...current, landingPage: event.target.value }))}>
                        <option value="dashboard">Dashboard</option>
                        <option value="leads">Leads</option>
                        <option value="followups">Follow-ups</option>
                        <option value="calls">Call History</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Date format</Label>
                      <Select value={String(crmPrefs.dateFormat)} onChange={(event) => setCrmPrefs((current) => ({ ...current, dateFormat: event.target.value }))}>
                        <option>DD MMM YYYY</option>
                        <option>MM/DD/YYYY</option>
                        <option>DD-MM-YYYY</option>
                        <option>YYYY-MM-DD</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Select value={String(crmPrefs.currency)} onChange={(event) => setCrmPrefs((current) => ({ ...current, currency: event.target.value }))}>
                        <option>INR (₹)</option>
                        <option>USD ($)</option>
                        <option>AED (د.إ)</option>
                        <option>EUR (€)</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Records per page</Label>
                      <Select value={String(crmPrefs.recordsPerPage)} onChange={(event) => setCrmPrefs((current) => ({ ...current, recordsPerPage: event.target.value }))}>
                        <option>10</option><option>25</option><option>50</option><option>100</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <ToggleRow label="Auto-refresh dashboard" value={crmPrefs.autoRefresh === true} onChange={(value) => setCrmPrefs((current) => ({ ...current, autoRefresh: value }))} />
                    <ToggleRow label="Show quick action menu on dashboard" value={crmPrefs.quickActions === true} onChange={(value) => setCrmPrefs((current) => ({ ...current, quickActions: value }))} />
                    <ToggleRow label="Enable keyboard shortcuts" value={crmPrefs.keyboardShortcuts === true} onChange={(value) => setCrmPrefs((current) => ({ ...current, keyboardShortcuts: value }))} />
                    <ToggleRow label="Compact tables" value={crmPrefs.compactTables === true} onChange={(value) => setCrmPrefs((current) => ({ ...current, compactTables: value }))} />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button variant="accent" icon={savedItems.has('preferences') ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} onClick={() => handleSave('preferences')}>
                      {savedItems.has('preferences') ? 'Saved' : 'Save preferences'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API Configuration</CardTitle>
                    <CardDescription>Connection settings are managed by the deployment environment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>API base URL</Label>
                    <Input value={import.meta.env.VITE_API_BASE_URL} readOnly icon={<Globe className="h-4 w-4" />} />
                    <p className="text-xs text-slate-500 mt-1">Set VITE_API_BASE_URL in the deployment environment.</p>
                  </div>
                  <div>
                    <Label>Request timeout (ms)</Label>
                    <Input type="number" value={import.meta.env.VITE_API_TIMEOUT} readOnly icon={<Clock className="h-4 w-4" />} />
                  </div>
                  <div className="p-3 rounded-lg bg-warning-50/40 border border-warning-100 flex items-start gap-2">
                    <Shield className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600">Authentication uses an HTTP-only PHP session cookie. Database credentials remain server-side.</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'access' && (
            <Card>
              <CardHeader>
                <CardTitle>Access Control</CardTitle>
                <CardDescription>Role restrictions are enforced by frontend routes and PHP APIs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-info-50/40 border border-info-100 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-info-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600">
                    Calling Executives can access assigned operational records. Team management, reports, settings, and recordings require Admin access.
                  </p>
                </div>
                <div className="space-y-3">
                  <AccessRow role="Admin" desc="Full system access" canView={["Dashboard","Customers","Leads","Follow-ups","Bookings","Calls","Recordings","Tasks","Reports","Team","Settings"]} />
                  <AccessRow role="Calling Executive" desc="Day-to-day operations" canView={["Dashboard","Customers","Leads","Follow-ups","Bookings","Calls","Tasks"]} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function NotificationRow({
  label, desc, channels, enabledChannels, onChange,
}: {
  label: string
  desc: string
  channels: string[]
  enabledChannels: Record<string, boolean>
  onChange: (channel: string, enabled: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <div className="flex items-center gap-2">
        {channels.map((c) => (
          <label key={c} className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={enabledChannels[c] ?? true}
              onChange={(event) => onChange(c, event.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500/40"
            />
            {c}
          </label>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="sr-only peer" />
        <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-teal-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-5"></div>
      </label>
    </div>
  )
}

function AccessRow({ role, desc, canView }: { role: string; desc: string; canView: string[] }) {
  const tone = role === 'Admin' ? 'danger' : 'teal'
  return (
    <div className="p-4 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge tone={tone as any}>{role}</Badge>
          <span className="text-xs text-slate-500">{desc}</span>
        </div>
        <span className="text-xs text-slate-400">{canView.length} modules</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {canView.map((m) => (
          <Badge key={m} tone="default">{m}</Badge>
        ))}
      </div>
    </div>
  )
}
