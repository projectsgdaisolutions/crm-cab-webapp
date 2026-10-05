import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Car, Search, Plus, Download, MapPin, User as UserIcon, Phone, Calendar,
  DollarSign, Edit, UserCheck,
} from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { BookingForm } from '@/features/bookings/BookingForm'
import { useToast } from '@/components/ui/Toast'
import { bookingService } from '@/services'
import type { Booking } from '@/types'
import { formatDate, formatTime, formatCurrency, downloadCSV } from '@/lib/utils'

export default function BookingsPage() {
  const toast = useToast()
  const [search, setSearch] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Booking | null>(null)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)

  useEffect(() => {
    bookingService.list()
      .then(setBookings)
      .catch((error: unknown) => toast.error('Could not load bookings', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
    if (search.get('new') === '1') {
      setShowForm(true)
      setSearch({})
    }
  }, [search, setSearch, toast])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return bookings.filter((booking) => {
      if (normalizedQuery && ![
        booking.bookingId,
        booking.customerName,
        booking.customerOrLeadType,
        booking.mobileNumber,
        booking.pickupLocation,
        booking.dropLocation,
        booking.driverVehicleDetails,
        booking.remarks,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))) {
        return false
      }
      if (statusFilter && booking.bookingStatus !== statusFilter) return false
      if (paymentFilter && booking.paymentStatus !== paymentFilter) return false
      return true
    })
  }, [bookings, query, statusFilter, paymentFilter])

  const columns: Column<Booking>[] = [
    { key: 'bookingId', header: 'Booking ID', sortable: true, render: (booking) => <span className="font-mono text-xs font-medium text-navy-900">{booking.bookingId}</span> },
    {
      key: 'customerOrLeadId',
      header: 'Customer / Lead',
      render: (booking) => (
        <div className="flex items-center gap-2">
          <Avatar name={booking.customerName} size="xs" />
          <div>
            <p className="text-sm font-medium text-slate-900">{booking.customerName}</p>
            <p className="text-xs text-slate-500">{booking.customerOrLeadType}</p>
          </div>
        </div>
      ),
    },
    { key: 'mobileNumber', header: 'Mobile Number', render: (booking) => <span className="whitespace-nowrap">{booking.mobileNumber}</span> },
    { key: 'pickupLocation', header: 'Pickup Location', render: (booking) => <span className="block max-w-48 truncate" title={booking.pickupLocation}>{booking.pickupLocation}</span> },
    { key: 'dropLocation', header: 'Drop Location', render: (booking) => <span className="block max-w-48 truncate" title={booking.dropLocation}>{booking.dropLocation}</span> },
    { key: 'travelDate', header: 'Travel Date', sortable: true, accessor: (booking) => booking.travelDate, render: (booking) => <span className="whitespace-nowrap">{formatDate(booking.travelDate)}</span> },
    { key: 'travelTime', header: 'Travel Time', accessor: (booking) => booking.travelDate, render: (booking) => <span className="whitespace-nowrap">{formatTime(booking.travelDate)}</span> },
    { key: 'vehicleType', header: 'Cab / Vehicle Type', sortable: true, render: (booking) => <Badge tone="default">{booking.vehicleType}</Badge> },
    { key: 'passengerCount', header: 'Passenger Count', sortable: true, render: (booking) => booking.passengerCount },
    { key: 'amount', header: 'Fare', sortable: true, render: (booking) => <span className="whitespace-nowrap font-medium text-slate-900">{formatCurrency(booking.amount)}</span> },
    { key: 'paymentStatus', header: 'Payment Status', sortable: true, render: (booking) => <Badge tone={statusTone(booking.paymentStatus)}>{booking.paymentStatus}</Badge> },
    { key: 'bookingStatus', header: 'Booking Status', sortable: true, render: (booking) => <Badge tone={statusTone(booking.bookingStatus)} dot>{booking.bookingStatus}</Badge> },
    { key: 'driverVehicleDetails', header: 'Driver / Vehicle Details', render: (booking) => <span className="block max-w-48 truncate" title={booking.driverVehicleDetails}>{booking.driverVehicleDetails || '—'}</span> },
    { key: 'remarks', header: 'Remarks', render: (booking) => <span className="block max-w-48 truncate" title={booking.remarks}>{booking.remarks || '—'}</span> },
    { key: 'createdBy', header: 'Created By', render: (booking) => booking.createdBy || '—' },
    { key: 'createdAt', header: 'Created Date', sortable: true, render: (booking) => <span className="whitespace-nowrap">{formatDate(booking.createdAt)} {formatTime(booking.createdAt)}</span> },
  ]

  const handleExport = () => {
    const rows = filtered.map((booking) => ({
      bookingId: booking.bookingId,
      customerOrLead: `${booking.customerOrLeadType}: ${booking.customerName}`,
      mobileNumber: booking.mobileNumber,
      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropLocation,
      travelDate: formatDate(booking.travelDate),
      travelTime: formatTime(booking.travelDate),
      vehicleType: booking.vehicleType,
      passengerCount: booking.passengerCount,
      fare: booking.amount,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      driverVehicleDetails: booking.driverVehicleDetails,
      remarks: booking.remarks,
      createdBy: booking.createdBy,
      createdAt: booking.createdAt,
    }))
    downloadCSV('bookings.csv', rows)
    toast.success('Bookings exported', `${filtered.length} rows downloaded.`)
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={`${bookings.length} bookings · ${bookings.filter((booking) => ['Enquiry', 'Confirmed', 'Assigned'].includes(booking.bookingStatus)).length} active`}
        icon={<Car className="h-5 w-5" />}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setShowForm(true) }}>
              New Booking
            </Button>
          </>
        }
      />

      <div className="card p-4 mb-4 flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Search booking, customer / lead, mobile, location..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="md:flex-1"
        />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="md:w-44">
          <option value="">All statuses</option>
          <option>Enquiry</option><option>Confirmed</option><option>Assigned</option>
          <option>Completed</option><option>Cancelled</option>
        </Select>
        <Select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="md:w-40">
          <option value="">All payments</option>
          <option>Unpaid</option><option>Partial</option><option>Paid</option><option>Refunded</option>
        </Select>
      </div>

      {loading ? <SkeletonTable rows={6} cols={8} /> : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(booking) => booking.id}
          pageSize={10}
          onRowClick={(booking) => setDetailBooking(booking)}
        />
      )}

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? 'Edit Booking' : 'New Booking'}
        description={editing ? editing.bookingId : 'Create a cab service booking'}
        size="xl"
      >
        <BookingForm
          booking={editing}
          onSubmit={async (values) => {
            try {
              if (editing) {
                const updated = await bookingService.update(editing.id, values)
                setBookings((previous) => previous.map((booking) => booking.id === editing.id ? updated : booking))
                toast.success('Booking updated', updated.bookingId)
              } else {
                const created = await bookingService.create(values)
                setBookings((previous) => [created, ...previous])
                toast.success('Booking created', created.bookingId)
              }
              setShowForm(false)
              setEditing(null)
            } catch (error) {
              toast.error('Could not save booking', error instanceof Error ? error.message : 'Please try again.')
            }
          }}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      </Modal>

      <Drawer
        open={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        title={detailBooking?.bookingId}
        description={detailBooking ? `${detailBooking.customerOrLeadType}: ${detailBooking.customerName}` : ''}
        size="xl"
      >
        {detailBooking && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoTile icon={<UserIcon className="h-4 w-4" />} label="Customer / Lead" value={`${detailBooking.customerOrLeadType}: ${detailBooking.customerName}`} />
              <InfoTile icon={<Phone className="h-4 w-4" />} label="Mobile Number" value={detailBooking.mobileNumber} />
              <InfoTile icon={<MapPin className="h-4 w-4" />} label="Pickup Location" value={detailBooking.pickupLocation} />
              <InfoTile icon={<MapPin className="h-4 w-4" />} label="Drop Location" value={detailBooking.dropLocation} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Travel Date" value={formatDate(detailBooking.travelDate)} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Travel Time" value={formatTime(detailBooking.travelDate)} />
              <InfoTile icon={<Car className="h-4 w-4" />} label="Cab / Vehicle Type" value={detailBooking.vehicleType} />
              <InfoTile icon={<UserCheck className="h-4 w-4" />} label="Passenger Count" value={String(detailBooking.passengerCount)} />
              <InfoTile icon={<DollarSign className="h-4 w-4" />} label="Fare" value={formatCurrency(detailBooking.amount)} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Payment Status" value={detailBooking.paymentStatus} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Booking Status" value={detailBooking.bookingStatus} />
              <InfoTile icon={<Car className="h-4 w-4" />} label="Driver / Vehicle Details" value={detailBooking.driverVehicleDetails || '—'} />
              <InfoTile icon={<UserCheck className="h-4 w-4" />} label="Created By" value={detailBooking.createdBy || '—'} />
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Created Date" value={`${formatDate(detailBooking.createdAt)} ${formatTime(detailBooking.createdAt)}`} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Remarks</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{detailBooking.remarks || '—'}</p>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => { setEditing(detailBooking); setDetailBooking(null); setShowForm(true) }}>
                Edit booking
              </Button>
            </div>
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
        <p className="text-sm text-slate-900 break-words">{value}</p>
      </div>
    </div>
  )
}
