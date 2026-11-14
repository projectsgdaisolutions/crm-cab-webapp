import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User as UserIcon, Phone, Mail, MapPin, Building2, UserCheck, StickyNote, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Label, FieldError } from '@/components/ui/Input'
import { userService } from '@/services'
import type { Customer, User } from '@/types'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().regex(/^[+0-9() .-]{7,20}$/, 'Enter a valid phone number').refine((value) => value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15, 'Phone number must contain 7 to 15 digits'),
  alternateNumber: z.string().trim().max(20, 'Alternate number must be at most 20 characters').refine((value) => !value || (/^[+0-9() .-]{7,20}$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15), 'Enter a valid alternate phone number'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  location: z.string().trim().min(2, 'Address is required').max(500),
  city: z.string().min(2, 'City is required'),
  pickupLocation: z.string().trim().max(500),
  dropLocation: z.string().trim().max(500),
  status: z.enum(['Active', 'Inactive', 'VIP', 'Lead', 'Churned']),
  assignedExecutiveId: z.string().min(1, 'Pick an executive'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface CustomerFormProps {
  customer?: Customer | null
  onSubmit: (values: Partial<Customer>) => void | Promise<void>
  onCancel: () => void
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS = [
  { value: 'Active', dot: '#10b981' },
  { value: 'VIP', dot: '#8b5cf6' },
  { value: 'Lead', dot: '#0ea5e9' },
  { value: 'Inactive', dot: '#94a3b8' },
  { value: 'Churned', dot: '#f43f5e' },
] as const

const alpha = (color: string, a: number) =>
  /^#[0-9a-f]{6}$/i.test(color) ? color + Math.round(a * 255).toString(16).padStart(2, '0') : color

const tileStyle = (accent: string) => ({
  background: `linear-gradient(135deg, ${alpha(accent, 0.18)}, ${alpha(accent, 0.06)})`,
  color: accent,
  boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.16)}`,
})

function Section({
  icon: Icon, accent, title, hint, children,
}: {
  icon: LucideIcon
  accent: string
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={tileStyle(accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight tracking-tight text-slate-900">{title}</h3>
          {hint && <p className="text-xs leading-tight text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

const Req = () => <span className="text-danger-500">*</span>

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

export function CustomerForm({ customer, onSubmit, onCancel }: CustomerFormProps) {
  const [executives, setExecutives] = useState<User[]>([])
  const [executivesLoading, setExecutivesLoading] = useState(true)
  const [executivesError, setExecutivesError] = useState('')
  const [executivesReload, setExecutivesReload] = useState(0)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: customer
      ? {
          name: customer.name,
          phone: customer.phone,
          alternateNumber: customer.alternateNumber ?? '',
          email: customer.email,
          location: customer.location,
          city: customer.city,
          pickupLocation: customer.pickupLocation ?? '',
          dropLocation: customer.dropLocation ?? '',
          status: customer.status,
          assignedExecutiveId: customer.assignedExecutiveId,
          notes: customer.notes,
        }
      : {
          alternateNumber: '',
          pickupLocation: '',
          dropLocation: '',
          status: 'Lead',
          assignedExecutiveId: executives[0]?.id,
        },
  })

  useEffect(() => {
    let active = true
    setExecutivesLoading(true)
    setExecutivesError('')
    userService.activeExecutives().then((data) => {
      if (!active) return
      setExecutives(data)
      if (!customer && data[0]) reset((values) => ({ ...values, assignedExecutiveId: data[0].id }))
    }).catch((error: unknown) => {
      if (active) setExecutivesError(error instanceof Error ? error.message : 'Could not load active Calling Executives.')
    }).finally(() => {
      if (active) setExecutivesLoading(false)
    })
    return () => { active = false }
  }, [customer, reset, executivesReload])

  const submit = async (values: FormValues) => {
    const exec = executives.find((u) => u.id === values.assignedExecutiveId)
    await onSubmit({ ...values, assignedExecutiveName: exec?.name || '' })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {/* ------------------------------ Contact ------------------------------ */}
      <Section icon={UserIcon} accent="#3b82f6" title="Contact details" hint="How we reach this customer">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Full name <Req /></Label>
            <Input
              {...register('name')}
              error={!!errors.name}
              icon={<UserIcon className="h-4 w-4" />}
              placeholder="Ramesh Iyer"
              autoComplete="name"
            />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label>Phone <Req /></Label>
            <Input
              {...register('phone')}
              error={!!errors.phone}
              icon={<Phone className="h-4 w-4" />}
              placeholder="+91 98765 43210"
              inputMode="tel"
              autoComplete="tel"
            />
            <FieldError>{errors.phone?.message}</FieldError>
          </div>
          <div>
            <Label>Alternate number</Label>
            <Input
              {...register('alternateNumber')}
              error={!!errors.alternateNumber}
              icon={<Phone className="h-4 w-4" />}
              placeholder="Optional alternate phone"
              inputMode="tel"
              autoComplete="tel"
            />
            <FieldError>{errors.alternateNumber?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label>Email <Req /></Label>
            <Input
              {...register('email')}
              error={!!errors.email}
              icon={<Mail className="h-4 w-4" />}
              placeholder="ramesh@email.com"
              inputMode="email"
              autoComplete="email"
            />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
        </div>
      </Section>

      {/* ------------------------------ Location ------------------------------ */}
      <Section icon={MapPin} accent="#14b8a6" title="Address & trip locations" hint="Customer address and pickup/drop points">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>City <Req /></Label>
            <Input
              {...register('city')}
              error={!!errors.city}
              icon={<Building2 className="h-4 w-4" />}
              placeholder="Bengaluru"
              autoComplete="address-level2"
            />
            <FieldError>{errors.city?.message}</FieldError>
          </div>
          <div>
            <Label>Address <Req /></Label>
            <Input
              {...register('location')}
              error={!!errors.location}
              icon={<MapPin className="h-4 w-4" />}
              placeholder="123, MG Road, Indiranagar"
              autoComplete="street-address"
            />
            <FieldError>{errors.location?.message}</FieldError>
          </div>
          <div>
            <Label>Pickup location</Label>
            <Input {...register('pickupLocation')} error={!!errors.pickupLocation} icon={<MapPin className="h-4 w-4" />} placeholder="Pickup location" />
            <FieldError>{errors.pickupLocation?.message}</FieldError>
          </div>
          <div>
            <Label>Drop location</Label>
            <Input {...register('dropLocation')} error={!!errors.dropLocation} icon={<MapPin className="h-4 w-4" />} placeholder="Drop location" />
            <FieldError>{errors.dropLocation?.message}</FieldError>
          </div>
        </div>
      </Section>

      {/* ------------------------------ Assignment ------------------------------ */}
      <Section icon={UserCheck} accent="#8b5cf6" title="Status & assignment" hint="Who looks after this customer">
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Status <Req /></legend>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <label key={s.value} className="cursor-pointer">
                  <input type="radio" value={s.value} {...register('status')} className="peer sr-only" />
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all duration-150',
                      'hover:border-slate-300 hover:bg-slate-50',
                      'peer-checked:border-transparent peer-checked:bg-gradient-to-r peer-checked:from-navy-900 peer-checked:to-navy-700 peer-checked:text-white peer-checked:shadow-md peer-checked:shadow-navy-900/20',
                      'peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 peer-focus-visible:ring-offset-1',
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.dot }} />
                    {s.value}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label>Assigned user <Req /></Label>
            <Select {...register('assignedExecutiveId')} disabled={executivesLoading || executives.length === 0}>
              <option value="">{executivesLoading ? 'Loading executives...' : executives.length ? 'Select an executive' : 'No active executives available'}</option>
              {executives.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
            <FieldError>{errors.assignedExecutiveId?.message}</FieldError>
            {executivesError ? (
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-danger-600" role="alert">
                <span>{executivesError}</span>
                <button type="button" className="font-semibold underline" onClick={() => setExecutivesReload((value) => value + 1)}>Retry</button>
              </div>
            ) : !executivesLoading && executives.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">Add or activate a Calling Executive in Team & Users to assign this customer.</p>
            ) : null}
          </div>
        </div>
      </Section>

      {/* ------------------------------ Notes ------------------------------ */}
      <Section icon={StickyNote} accent="#f59e0b" title="Notes" hint="Preferences or special requirements">
        <Textarea
          {...register('notes')}
          placeholder="Customer preferences, special requirements, etc."
          rows={3}
        />
      </Section>

      {/* ------------------------------ Actions ------------------------------ */}
      <div className="sticky bottom-0 z-10 -mb-1 border-t border-slate-100 bg-white/95 pb-1 pt-4 backdrop-blur">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <p className="hidden text-xs text-slate-400 sm:mr-auto sm:block">
            Fields marked <span className="text-danger-500">*</span> are required.
          </p>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="accent" loading={isSubmitting}>{customer ? 'Save changes' : 'Create customer'}</Button>
        </div>
      </div>
    </form>
  )
}