import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  LockKeyhole,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  Users,
  PhoneCall,
  CalendarDays,
  ChartNoAxesColumn,
  ShieldCheck,
  Zap,
  TrendingUp,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { apiClient } from '@/services/apiClient'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.jpeg'
import loginBg from '@/assets/login_bg.png'

/* ------------------------------------------------------------------ */
/* Static content                                                      */
/* ------------------------------------------------------------------ */

const FEATURES = [
  { icon: Users, label: <>Customer<br />Management</> },
  { icon: PhoneCall, label: <>Calling &<br />Call Recording</> },
  { icon: CalendarDays, label: <>Booking<br />Management</> },
  { icon: ChartNoAxesColumn, label: <>Reports &<br />Analytics</> },
]

const BENEFITS = [
  { icon: ShieldCheck, label: <>Reliable<br />Operations</> },
  { icon: Zap, label: <>Better<br />Productivity</> },
  { icon: TrendingUp, label: <>Business<br />Growth</> },
]

const INPUT_CLASS =
  '!h-12 !rounded-xl !border-white/15 !bg-white/[0.07] !text-white placeholder:!text-slate-400 focus:!border-[#ffc66e] focus:!ring-[#ffc66e]/25'

function FeatureGrid({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {FEATURES.map(({ icon: Icon, label }, index) => (
        <div
          key={index}
          className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md transition-colors hover:bg-white/[0.1]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffd58c]/30 to-[#c88b35]/15 text-[#ffd18a] ring-1 ring-inset ring-[#ffd18a]/30">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold leading-snug text-white sm:text-[13px]">{label}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSubmitted, setForgotSubmitted] = useState(false)
  const [forgotSubmitting, setForgotSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#101827] text-white">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-200">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-[#ffc66e]" />
          Checking your session...
        </div>
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!identifier.trim() || !password) {
      setError('Enter your email or mobile number and password.')
      return
    }

    setSubmitting(true)

    try {
      await login(identifier.trim(), password)
      navigate('/', { replace: true })
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Unable to sign in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (forgotSubmitting) return
    const email = identifier.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid registered email address.')
      return
    }

    setForgotSubmitting(true)
    try {
      await apiClient.post('/auth/forgot-password.php', { email })
      setForgotSubmitted(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request a password reset.')
    } finally {
      setForgotSubmitting(false)
    }
  }

  const returnToSignIn = () => {
    setForgotMode(false)
    setForgotSubmitted(false)
    setError('')
  }

  return (
    <main className="relative isolate min-h-screen w-full overflow-hidden bg-[#101827]">
      {/* Background image */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
      />

      {/* Overlays: readability + brand glow */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#101827]/65" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#101827]/85 via-[#101827]/35 to-[#101827]/80" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(45% 55% at 78% 50%, rgba(248,189,98,0.16), transparent 70%), radial-gradient(40% 40% at 8% 0%, rgba(99,102,241,0.14), transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] items-center px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">

          {/* ============================ Left section ============================ */}
          <section className="mx-auto w-full max-w-2xl text-white">
            {/* Logo and brand */}
            <div className="mb-6 flex items-center gap-3.5 sm:mb-10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl shadow-black/30 ring-1 ring-white/40 sm:h-14 sm:w-14">
                <img src={logo} alt="vehico CRM" className="h-full w-full object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">vehico CRM</h2>
                <p className="text-sm font-medium text-slate-200">CAB Service CRM</p>
              </div>
            </div>

            {/* Tagline */}
            <p className="inline-flex items-center gap-2 rounded-full border border-[#ffd18a]/35 bg-[#f8bd62]/10 px-3.5 py-1.5 text-xs font-semibold text-[#ffd18a] backdrop-blur sm:text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Smart CRM for Vehicle Businesses
            </p>

            <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-[1.12] tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
              Everything Your
              <span className="block bg-gradient-to-r from-[#ffd58c] to-[#e8a64a] bg-clip-text text-transparent">
                Cab Business Needs,
              </span>
              <span className="block">In One CRM</span>
            </h1>

            <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-slate-100 drop-shadow-md sm:mt-5 sm:text-lg">
              Manage customers, leads, bookings, calls and team activities —
              smarter, faster, together.
            </p>

            {/* Features (desktop: here, mobile: below the sign-in card) */}
            <FeatureGrid className="mt-8 hidden lg:grid" />

            {/* Bottom benefits */}
            <div className="mt-8 hidden max-w-xl items-center justify-between border-t border-white/20 pt-6 sm:flex">
              {BENEFITS.map(({ icon: Icon, label }, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-[#ffc66e]" />
                  <span className="text-sm font-semibold leading-snug text-white">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ======================== Right login section ======================== */}
          <section className="mx-auto w-full max-w-[500px]">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="rounded-3xl bg-gradient-to-b from-[#ffd58c]/45 via-white/10 to-white/5 p-px shadow-2xl shadow-black/40"
            >
              <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-[#141922]/90 p-6 backdrop-blur-xl sm:p-9">
                {/* Top gold highlight + corner glow */}
                <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#ffc66e] to-transparent" />
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#f8bd62]/15 blur-3xl" />

                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-slate-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#ffc66e]" />
                    Secure sign-in
                  </div>

                  <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                    {forgotMode ? 'Reset your password' : <>Welcome Back <span className="text-2xl">👋</span></>}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                    {forgotMode ? 'Enter your registered email address to request a secure reset link.' : 'Sign in to access your CRM dashboard.'}
                  </p>

                  {forgotSubmitted ? (
                    <div className="mt-7 space-y-5">
                      <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100">
                        If an account exists for this email, a password reset link has been sent.
                      </p>
                      <Button type="button" variant="secondary" className="w-full" onClick={returnToSignIn}>Back to sign in</Button>
                    </div>
                  ) : <form onSubmit={forgotMode ? handleForgotSubmit : handleSubmit} className="mt-7 space-y-5">
                    {/* Email / phone */}
                    <div>
                      <Label htmlFor="identifier" className="mb-2 block text-sm font-semibold text-white">
                        {forgotMode ? 'Registered Email Address' : 'Email or Mobile Number'}
                      </Label>
                      <div className="relative">
                        <Input
                          id="identifier"
                          name="identifier"
                          type={forgotMode ? 'email' : 'text'}
                          autoComplete={forgotMode ? 'email' : 'username'}
                          autoFocus
                          required
                          value={identifier}
                          onChange={(event) => setIdentifier(event.target.value)}
                          placeholder={forgotMode ? 'Enter your registered email address' : 'Enter your email or mobile number'}
                          icon={
                            forgotMode || identifier.includes('@') ? (
                              <Mail className="h-4 w-4" />
                            ) : (
                              <Phone className="h-4 w-4" />
                            )
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    {!forgotMode && <div>
                      <Label htmlFor="password" className="mb-2 block text-sm font-semibold text-white">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Enter your password"
                          icon={<LockKeyhole className="h-4 w-4" />}
                          className={cn(INPUT_CLASS, '!pr-12')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc66e]/60"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>}

                    {/* Remember me */}
                    {!forgotMode && <div className="flex items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-200">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(event) => setRememberMe(event.target.checked)}
                          className="h-4 w-4 rounded accent-[#ffc66e]"
                        />
                        Remember me
                      </label>

                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setError('') }}
                        className="rounded-md px-1 py-0.5 text-sm font-semibold text-[#ffc66e] transition hover:text-[#ffe0a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc66e]/60"
                      >
                        Forgot Password?
                      </button>
                    </div>}

                    {/* Error */}
                    {error && (
                      <p
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-200"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </p>
                    )}

                    {/* Submit */}
                    <Button
                      type="submit"
                      variant="accent"
                      loading={forgotMode ? forgotSubmitting : submitting}
                      className="!h-12 w-full !rounded-xl !border-0 !bg-gradient-to-r !from-[#ffd58c] !to-[#c88b35] !text-base !font-bold !text-[#21170b] shadow-lg shadow-[#d99a43]/25 transition hover:!brightness-110"
                    >
                      <span className="flex items-center justify-center gap-3">
                        {forgotMode ? 'Send reset link' : 'Sign In'}
                        {!forgotMode && <ArrowRight className="h-5 w-5" />}
                      </span>
                    </Button>
                    {forgotMode && (
                      <button type="button" onClick={returnToSignIn} className="w-full text-sm font-semibold text-[#ffc66e] hover:text-[#ffe0a8]">
                        Back to sign in
                      </button>
                    )}
                  </form>}

                  {/* Secure access */}
                  <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/15" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Secure Access
                    </span>
                    <div className="h-px flex-1 bg-white/15" />
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffd58c]/25 to-[#c88b35]/10 ring-1 ring-inset ring-[#ffd18a]/25">
                      <ShieldCheck className="h-6 w-6 text-[#ffc66e]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#ffd18a]">Secure & Role-Based Access</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-300">For Admin and Calling Executive</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Features on mobile / tablet (below the card, so sign-in comes first) */}
            <FeatureGrid className="mt-6 lg:hidden" />

            <p className="mt-5 text-center text-xs font-medium text-white/75">
              © 2026 vehico CRM. All rights reserved.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}