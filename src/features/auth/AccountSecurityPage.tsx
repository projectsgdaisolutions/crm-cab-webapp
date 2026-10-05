import { useState, type FormEvent } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Label } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { apiClient } from '@/services/apiClient'

export default function AccountSecurityPage() {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 12 || newPassword !== confirmPassword) {
      setError('Use at least 12 characters and make sure both new-password fields match.')
      return
    }

    setSaving(true)
    try {
      await apiClient.post('/auth/password.php', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated', 'Your password has been changed.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update your password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Account Security" description="Update your sign-in password" icon={<ShieldCheck className="h-5 w-5" />} />
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Your current password is required to save a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} icon={<LockKeyhole className="h-4 w-4" />} />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} icon={<LockKeyhole className="h-4 w-4" />} />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} icon={<LockKeyhole className="h-4 w-4" />} />
            </div>
            {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" variant="accent" loading={saving}>Update password</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
