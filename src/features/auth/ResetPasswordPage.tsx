import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { apiClient } from '@/services/apiClient'
import logo from '@/assets/logo.jpeg'
import loginBg from '@/assets/login_bg.png'

function resetTokenFromFragment(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
}

export default function ResetPasswordPage() {
  const [token] = useState(resetTokenFromFragment)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const tokenValid = /^[a-f0-9]{64}$/.test(token)

  useEffect(() => {
    const existingMeta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]')
    const previousContent = existingMeta?.content
    const referrerMeta = existingMeta ?? document.createElement('meta')
    referrerMeta.name = 'referrer'
    referrerMeta.content = 'no-referrer'
    if (!existingMeta) document.head.appendChild(referrerMeta)

    if (window.location.hash) {
      window.history.replaceState(window.history.state, document.title, `${window.location.pathname}${window.location.search}`)
    }

    return () => {
      if (existingMeta && previousContent !== undefined) existingMeta.content = previousContent
      else referrerMeta.remove()
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!tokenValid) {
      setError('This reset link is invalid or expired. Request a new link.')
      return
    }
    if (password.length < 12 || password.length > 4096) {
      setError('Choose a password between 12 and 4096 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post('/auth/reset-password.php', { token, newPassword: password })
      setPassword('')
      setConfirmPassword('')
      setComplete(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reset your password. Request a new link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#101827] px-4 py-8">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${loginBg})` }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#101827]/75" />
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-[#141922]/95 p-6 text-white shadow-2xl backdrop-blur sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white p-1">
            <img src={logo} alt="vehico CRM" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-bold">vehico CRM</p>
            <p className="text-xs text-slate-300">Secure password reset</p>
          </div>
        </div>

        {complete ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="h-5 w-5" /><h1 className="text-xl font-bold">Password updated</h1></div>
            <p className="text-sm leading-relaxed text-slate-300">Your password has been changed. Sign in with your new password.</p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[#ffd18a] hover:text-[#ffe0a8]"><ArrowLeft className="h-4 w-4" /> Return to Login</Link>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-5">
            <h1 className="text-xl font-bold">Reset link unavailable</h1>
            <p role="alert" className="text-sm leading-relaxed text-slate-300">This reset link is invalid or expired. Request a new link from the login page.</p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[#ffd18a] hover:text-[#ffe0a8]"><ArrowLeft className="h-4 w-4" /> Return to Login</Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold">Choose a new password</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Use at least 12 characters. This reset link can only be used once.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="reset-password" className="mb-2 block text-sm font-semibold text-white">New password</Label>
                <Input id="reset-password" type="password" autoComplete="new-password" minLength={12} maxLength={4096} required value={password} onChange={(event) => setPassword(event.target.value)} icon={<LockKeyhole className="h-4 w-4" />} className="!h-12 !rounded-xl !border-white/15 !bg-white/[0.07] !text-white placeholder:!text-slate-400 focus:!border-[#ffc66e] focus:!ring-[#ffc66e]/25" />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-white">Confirm new password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={4096} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} icon={<LockKeyhole className="h-4 w-4" />} className="!h-12 !rounded-xl !border-white/15 !bg-white/[0.07] !text-white placeholder:!text-slate-400 focus:!border-[#ffc66e] focus:!ring-[#ffc66e]/25" />
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</p>}
              <Button type="submit" variant="accent" loading={submitting} className="!h-12 w-full !rounded-xl !border-0 !bg-gradient-to-r !from-[#ffd58c] !to-[#c88b35] !text-base !font-bold !text-[#21170b]">Reset password</Button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
