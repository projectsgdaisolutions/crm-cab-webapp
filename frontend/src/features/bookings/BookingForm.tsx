import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Label, FieldError } from '@/components/ui/Input'
import { customerService, leadService } from '@/services'
import { useAuth } from '@/auth/AuthContext'
import type { Booking, Customer, Lead } from '@/types'
import { formatDate, formatTime } from '@/lib/utils'

const BOOKING_STATUS_OPTIONS = ['Enquiry', 'Confirmed', 'Assigned', 'Completed', 'Cancelled'] as const
const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid', 'Refunded'] as const

const schema = z.object({
  customerOrLeadType: z.enum(['Customer', 'Lead']),
  customerOrLeadId: z.string().min(1, 'Select a customer or lead'),
  mobileNumber: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
  pickupLocation: z.string().min(2, 'Pickup location required'),
  dropLocation: z.string().min(2, 'Drop location required'),
  travelDate: z.string().min(1, 'Travel date required'),
  travelTime: z.string().min(1, 'Travel time required'),
  vehicleType: z.string().min(1, 'Pick a vehicle'),
  amount: z.coerce.number().min(0),
  passengerCount: z.coerce.number().int().min(1, 'Passenger count must be at least 1'),
  bookingStatus: z.enum(['Enquiry', 'Confirmed', 'Assigned', 'Completed', 'Cancelled']),
  paymentStatus: z.enum(['Unpaid', 'Partial', 'Paid', 'Refunded']),
  driverVehicleDetails: z.string().optional(),
  remarks: z.string().optional(),
}).superRefine((values, context) => {
  if (['Assigned', 'Completed'].includes(values.bookingStatus) && !values.driverVehicleDetails?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['driverVehicleDetails'], message: 'Driver / vehicle details are required' })
  }
})

type FormValues = z.infer<typeof schema>

interface BookingFormProps {
  booking?: Booking | null
  onSubmit: (values: Partial<Booking>) => void
  onCancel: () => void
}

const vehicles = ['Sedan', 'SUV', 'MUV', 'Tempo Traveller', 'Mini Bus', 'Luxury']
export function BookingForm({ booking, onSubmit, onCancel }: BookingFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const { user } = useAuth()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: booking
      ? {
          customerOrLeadType: booking.customerOrLeadType,
          customerOrLeadId: booking.customerOrLeadId,
          mobileNumber: booking.mobileNumber,
          pickupLocation: booking.pickupLocation,
          dropLocation: booking.dropLocation,
          travelDate: toDateTimeLocal(booking.travelDate).split('T')[0],
          travelTime: toDateTimeLocal(booking.travelDate).split('T')[1],
          vehicleType: booking.vehicleType,
          amount: booking.amount,
          passengerCount: booking.passengerCount,
          bookingStatus: booking.bookingStatus,
          paymentStatus: booking.paymentStatus,
          driverVehicleDetails: booking.driverVehicleDetails,
          remarks: booking.remarks,
        }
      : {
          customerOrLeadType: 'Customer',
          customerOrLeadId: '',
          mobileNumber: '',
          travelDate: '',
          travelTime: '',
          vehicleType: 'Sedan',
          passengerCount: 1,
          bookingStatus: 'Enquiry',
          paymentStatus: 'Unpaid',
          amount: 0,
          driverVehicleDetails: '',
          remarks: '',
        },
  })

  useEffect(() => {
    Promise.all([customerService.list(), leadService.list()]).then(([customerData, leadData]) => {
      setCustomers(customerData)
      setLeads(leadData)
    }).catch(() => {
      setCustomers([])
      setLeads([])
    })
  }, [])

  const customerOrLeadType = watch('customerOrLeadType')
  const customerOrLeadTypeField = register('customerOrLeadType')
  const customerOrLeadIdField = register('customerOrLeadId')

  const submit = (values: FormValues) => {
    onSubmit({
      ...values,
      bookingStatus: values.bookingStatus as Booking['bookingStatus'],
      paymentStatus: values.paymentStatus as Booking['paymentStatus'],
      vehicleType: values.vehicleType as Booking['vehicleType'],
      travelDate: new Date(`${values.travelDate}T${values.travelTime}`).toISOString(),
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Customer or lead type *</Label>
          <Select
            {...customerOrLeadTypeField}
            onChange={(event) => {
              customerOrLeadTypeField.onChange(event)
              setValue('customerOrLeadId', '')
              setValue('mobileNumber', '')
            }}
          >
            <option value="Customer">Customer</option>
            <option value="Lead">Lead</option>
          </Select>
        </div>
        <div>
          <Label>Customer / lead *</Label>
          <Select
            {...customerOrLeadIdField}
            error={!!errors.customerOrLeadId}
            onChange={(event) => {
              const relatedId = event.target.value
              customerOrLeadIdField.onChange(event)
              const relatedRecords = customerOrLeadType === 'Customer' ? customers : leads
              const relatedRecord = relatedRecords.find((record) => record.id === relatedId)
              setValue('mobileNumber', relatedRecord?.phone ?? '', { shouldValidate: true })
            }}
          >
            <option value="">Select {customerOrLeadType.toLowerCase()}</option>
            {(customerOrLeadType === 'Customer' ? customers : leads).map((record) => (
              <option key={record.id} value={record.id}>{record.name} · {record.phone}</option>
            ))}
          </Select>
          <FieldError>{errors.customerOrLeadId?.message}</FieldError>
        </div>
        <div>
          <Label>Mobile number *</Label>
          <Input type="tel" {...register('mobileNumber')} error={!!errors.mobileNumber} />
          <FieldError>{errors.mobileNumber?.message}</FieldError>
        </div>
        <div>
          <Label>Travel date *</Label>
          <Input type="date" {...register('travelDate')} error={!!errors.travelDate} />
          <FieldError>{errors.travelDate?.message}</FieldError>
        </div>
        <div>
          <Label>Travel time *</Label>
          <Input type="time" {...register('travelTime')} error={!!errors.travelTime} />
          <FieldError>{errors.travelTime?.message}</FieldError>
        </div>
        <div>
          <Label>Pickup location *</Label>
          <Input {...register('pickupLocation')} error={!!errors.pickupLocation} placeholder="Bengaluru Airport, Terminal 1" />
          <FieldError>{errors.pickupLocation?.message}</FieldError>
        </div>
        <div>
          <Label>Drop location *</Label>
          <Input {...register('dropLocation')} error={!!errors.dropLocation} placeholder="MG Road, Bengaluru" />
          <FieldError>{errors.dropLocation?.message}</FieldError>
        </div>
        <div>
          <Label>Cab / vehicle type *</Label>
          <Select {...register('vehicleType')}>
            {vehicles.map((v) => <option key={v}>{v}</option>)}
          </Select>
        </div>
        <div>
          <Label>Passenger count *</Label>
          <Input type="number" min="1" step="1" {...register('passengerCount')} error={!!errors.passengerCount} />
          <FieldError>{errors.passengerCount?.message}</FieldError>
        </div>
        <div>
          <Label>Fare *</Label>
          <Input type="number" min="0" step="0.01" {...register('amount')} error={!!errors.amount} />
          <FieldError>{errors.amount?.message}</FieldError>
        </div>
        <div>
          <Label>Booking status</Label>
          <Select {...register('bookingStatus')}>
            {BOOKING_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </div>
        <div>
          <Label>Payment status</Label>
          <Select {...register('paymentStatus')}>
            {PAYMENT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Driver / vehicle details</Label>
          <Textarea {...register('driverVehicleDetails')} rows={2} />
          <FieldError>{errors.driverVehicleDetails?.message}</FieldError>
        </div>
        <div className="md:col-span-2">
          <Label>Remarks</Label>
          <Textarea {...register('remarks')} rows={2} />
        </div>
        <div>
          <Label>Booking ID</Label>
          <Input value={booking?.bookingId ?? 'Generated on save'} readOnly />
        </div>
        <div>
          <Label>Created by</Label>
          <Input value={booking?.createdBy || user?.name || 'Signed-in user'} readOnly />
        </div>
        <div>
          <Label>Created date</Label>
          <Input
            value={booking ? `${formatDate(booking.createdAt)} ${formatTime(booking.createdAt)}` : 'Generated on save'}
            readOnly
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="accent" loading={isSubmitting}>{booking ? 'Save changes' : 'Create booking'}</Button>
      </div>
    </form>
  )
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
