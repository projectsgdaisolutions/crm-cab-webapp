import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User as UserIcon, Route, SlidersHorizontal, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Label, FieldError } from '@/components/ui/Input'
import { userService } from '@/services'
import type { Lead, User } from '@/types'

export const LEAD_STATUSES = ['New', 'Contacted', 'Follow-up', 'Interested', 'Booking Confirmed', 'Converted', 'Lost'] as const
export const LEAD_SOURCES = ['Website', 'Facebook', 'Instagram', 'Google Ads', 'Referral', 'Walk-in', 'Inbound Call', 'Outbound Call'] as const
export const LEAD_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const

const schema = z.object({
  name: z.string().trim().min(2, 'Customer name is required').max(150),
  phone: z.string().trim().regex(/^[+0-9() .-]{7,20}$/, 'Enter a valid mobile number').refine((value) => value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15, 'Mobile number must contain 7 to 15 digits'),
  email: z.string().email('Valid email required').or(z.literal('')),
  source: z.enum(LEAD_SOURCES),
  interestedService: z.string().trim().min(1, 'Cab requirement is required').max(100),
  pickupLocation: z.string().trim().min(2, 'Pickup location is required').max(500),
  dropLocation: z.string().trim().min(2, 'Drop location is required').max(500),
  travelAt: z.string().min(1, 'Travel date and time are required'),
  nextFollowUp: z.string().optional(),
  status: z.enum(LEAD_STATUSES),
  priority: z.enum(LEAD_PRIORITIES),
  assignedExecutiveId: z.string().min(1, 'Pick an executive'),
  estimatedValue: z.coerce.number().min(0),
  location: z.string().optional(),
  remarks: z.string().optional(),
}).superRefine((values, context) => {
  if (values.status === 'Follow-up' && !values.nextFollowUp) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['nextFollowUp'], message: 'Set a follow-up date and time for this status.' })
  }
})

type FormValues = z.infer<typeof schema>

interface LeadFormProps {
  lead?: Lead | null
  onSubmit: (values: Partial<Lead>) => void
  onCancel: () => void
}

const services = ['Airport Transfer', 'Outstation Cab', 'Hourly Rental', 'Corporate Travel', 'Wedding Car', 'City Taxi']
function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-navy-900 leading-tight">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">{children}</div>
    </section>
  )
}

export function LeadForm({ lead, onSubmit, onCancel }: LeadFormProps) {
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
    defaultValues: lead
      ? {
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          source: lead.source,
          interestedService: lead.interestedService,
          status: lead.status ?? 'New',
          priority: lead.priority === 'Hot' ? 'Urgent' : (lead.priority ?? 'Medium'),
          assignedExecutiveId: lead.assignedExecutiveId,
          estimatedValue: lead.estimatedValue,
          location: lead.location,
          remarks: lead.remarks,
          pickupLocation: lead.pickupLocation,
          dropLocation: lead.dropLocation,
          travelAt: lead.travelAt ? new Date(lead.travelAt).toISOString().slice(0, 16) : '',
          nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString().slice(0, 16) : '',
        }
      : {
          status: 'New',
          priority: 'Medium',
          source: 'Website',
          interestedService: 'City Taxi',
          assignedExecutiveId: executives[0]?.id,
          estimatedValue: 1500,
          pickupLocation: '',
          dropLocation: '',
          travelAt: '',
          nextFollowUp: '',
        },
  })

  useEffect(() => {
    let active = true
    setExecutivesLoading(true)
    setExecutivesError('')
    userService.activeExecutives().then((data) => {
      if (!active) return
      setExecutives(data)
      if (!lead && data[0]) reset((values) => ({ ...values, assignedExecutiveId: data[0].id }))
    }).catch((error: unknown) => {
      if (active) setExecutivesError(error instanceof Error ? error.message : 'Could not load active Calling Executives.')
    }).finally(() => {
      if (active) setExecutivesLoading(false)
    })
    return () => { active = false }
  }, [lead, reset, executivesReload])

  const submit = (values: FormValues) => {
    const exec = executives.find((u) => u.id === values.assignedExecutiveId)
    onSubmit({
      ...values,
      status: values.status ?? lead?.status ?? 'New',
      priority: values.priority as Lead['priority'],
      source: values.source as Lead['source'],
      travelAt: new Date(values.travelAt).toISOString(),
      nextFollowUp: values.nextFollowUp ? new Date(values.nextFollowUp).toISOString() : '',
      assignedExecutiveName: exec?.name || '',
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3.5 bg-slate-50/60 -mx-1 px-1">
      <Section icon={<UserIcon className="h-4 w-4" />} title="Customer" hint="Who is asking for the cab?">
        <div className="sm:col-span-2">
          <Label>Customer name *</Label>
          <Input {...register('name')} error={!!errors.name} placeholder="Aditya Shah" autoComplete="name" />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label>Phone *</Label>
          <Input type="tel" inputMode="tel" {...register('phone')} error={!!errors.phone} placeholder="+91 98765 43210" autoComplete="tel" />
          <FieldError>{errors.phone?.message}</FieldError>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" inputMode="email" {...register('email')} error={!!errors.email} placeholder="aditya@email.com" autoComplete="email" />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
      </Section>

      <Section icon={<Route className="h-4 w-4" />} title="Trip details" hint="Where and when they travel">
        <div>
          <Label>Pickup location *</Label>
          <Input {...register('pickupLocation')} error={!!errors.pickupLocation} placeholder="Bengaluru Airport" />
          <FieldError>{errors.pickupLocation?.message}</FieldError>
        </div>
        <div>
          <Label>Drop location *</Label>
          <Input {...register('dropLocation')} error={!!errors.dropLocation} placeholder="MG Road, Bengaluru" />
          <FieldError>{errors.dropLocation?.message}</FieldError>
        </div>
        <div>
          <Label>Cab requirement *</Label>
          <Select {...register('interestedService')}>
            {services.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <div>
          <Label>Travel date and time *</Label>
          <Input type="datetime-local" {...register('travelAt')} error={!!errors.travelAt} />
          <FieldError>{errors.travelAt?.message}</FieldError>
        </div>
      </Section>

      <Section icon={<SlidersHorizontal className="h-4 w-4" />} title="Lead details" hint="Source, owner and value">
        <div>
          <Label>Source *</Label>
          <Select {...register('source')}>
            {LEAD_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
          </Select>
        </div>
        <div>
          <Label>Priority *</Label>
          <Select {...register('priority')}>
            {LEAD_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </Select>
        </div>
        <div>
          <Label>Lead status *</Label>
          <Select {...register('status')}>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Assigned user *</Label>
          <Select {...register('assignedExecutiveId')} disabled={executivesLoading || executives.length === 0}>
            <option value="">{executivesLoading ? 'Loading executives...' : executives.length ? 'Select an executive' : 'No active executives available'}</option>
            {executives.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <FieldError>{errors.assignedExecutiveId?.message}</FieldError>
          {executivesError && (
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-danger-600" role="alert">
              <span>{executivesError}</span>
              <button type="button" className="font-semibold underline" onClick={() => setExecutivesReload((value) => value + 1)}>Retry</button>
            </div>
          )}
          {!executivesLoading && !executivesError && executives.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">Add or activate a Calling Executive in Team & Users to assign this lead.</p>
          )}
        </div>
        <div>
          <Label>Estimated value (₹) *</Label>
          <Input type="number" inputMode="numeric" {...register('estimatedValue')} error={!!errors.estimatedValue} />
          <FieldError>{errors.estimatedValue?.message}</FieldError>
        </div>
        <div className="sm:col-span-2">
          <Label>Schedule follow-up</Label>
          <Input type="datetime-local" {...register('nextFollowUp')} error={!!errors.nextFollowUp} />
          <FieldError>{errors.nextFollowUp?.message}</FieldError>
        </div>
      </Section>

      <Section icon={<StickyNote className="h-4 w-4" />} title="Remarks">
        <div className="sm:col-span-2">
          <Textarea {...register('remarks')} rows={3} placeholder="Lead context, requirements, urgency..." />
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/90 backdrop-blur border-t border-slate-200/80 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="accent" className="w-full sm:w-auto" loading={isSubmitting}>{lead ? 'Save changes' : 'Create lead'}</Button>
      </div>
    </form>
  )
}