// ============================================================
// vehico CRM — CAB Service CRM
// Core entity type definitions
// ============================================================

export type ID = string

export type CustomerStatus = 'Active' | 'Inactive' | 'VIP' | 'Lead' | 'Churned'
export type LeadStatus = 'New' | 'Contacted' | 'Follow-up' | 'Interested' | 'Booking Confirmed' | 'Converted' | 'Lost'
export type LeadPriority = 'Low' | 'Medium' | 'High' | 'Urgent' | 'Hot'
export type LeadSource =
  | 'Website'
  | 'Facebook'
  | 'Instagram'
  | 'Google Ads'
  | 'Referral'
  | 'Walk-in'
  | 'Inbound Call'
  | 'Outbound Call'

export type BookingStatus =
  | 'Enquiry'
  | 'Confirmed'
  | 'Assigned'
  | 'Completed'
  | 'Cancelled'
export type BookingRelationType = 'Customer' | 'Lead'
export type PaymentStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Refunded'
export type VehicleType = 'Sedan' | 'SUV' | 'MUV' | 'Tempo Traveller' | 'Mini Bus' | 'Luxury'

export type CallDirection = 'Incoming' | 'Outgoing'
export type CallStatus = 'Answered' | 'Missed' | 'Busy' | 'Rejected' | 'Failed'
export type RecordingStatus = 'Available' | 'Processing' | 'Unavailable' | 'Permission Denied'

export type FollowUpStatus = 'Pending' | 'Completed' | 'Cancelled' | 'Rescheduled'
export type FollowUpPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed'
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

export type UserRole = 'Admin' | 'Calling Executive'

export interface User {
  id: ID
  name: string
  email: string
  phone: string
  role: UserRole
  avatarColor?: string
  active: boolean
  leadCount: number
  callCount: number
  conversionRate: number
  joinedOn: string
  lastActive: string
}

export interface Customer {
  id: ID
  name: string
  phone: string
  alternateNumber: string
  email: string
  location: string
  city: string
  pickupLocation: string
  dropLocation: string
  status: CustomerStatus
  assignedExecutiveId: ID
  assignedExecutiveName: string
  totalBookings: number
  totalSpend: number
  lastContact: string
  joinedOn: string
  updatedOn: string
  notes: string
  tags: string[]
}

export interface Lead {
  id: ID
  leadId: string
  name: string
  phone: string
  email: string
  source: LeadSource
  interestedService: string
  pickupLocation: string
  dropLocation: string
  travelAt: string
  status: LeadStatus
  priority: LeadPriority
  assignedExecutiveId: ID
  assignedExecutiveName: string
  nextFollowUp: string
  createdOn: string
  updatedOn: string
  convertedCustomerId?: ID | null
  estimatedValue: number
  remarks: string
  location: string
}

export interface FollowUp {
  id: ID
  customerOrLeadName: string
  customerOrLeadId: ID
  type: 'Customer' | 'Lead'
  assignedExecutiveId: ID
  assignedExecutiveName: string
  scheduledAt: string
  status: FollowUpStatus
  completedAt?: string | null
  priority: FollowUpPriority
  notes: string
  reminderSent: boolean
  channel: 'Phone' | 'WhatsApp' | 'Email' | 'Visit'
}

export interface Booking {
  id: ID
  bookingId: string
  customerOrLeadType: BookingRelationType
  customerOrLeadId: ID
  customerId?: ID | null
  leadId?: ID | null
  customerName: string
  mobileNumber: string
  pickupLocation: string
  dropLocation: string
  travelDate: string
  vehicleType: VehicleType
  passengerCount: number
  bookingStatus: BookingStatus
  paymentStatus: PaymentStatus
  amount: number
  driverVehicleDetails: string
  remarks: string
  createdBy: string
  createdAt: string
}

export interface CallRecord {
  id: ID
  callId: string
  customerOrLeadName: string
  customerOrLeadId: ID
  type: 'Customer' | 'Lead'
  phoneNumber: string
  executiveId: ID
  executiveName: string
  direction: CallDirection
  timestamp: string
  durationSec: number
  status: CallStatus
  hasRecording: boolean
  recordingId?: string
  followUpId?: ID
  notes: string
}


export interface Note {
  id: ID
  entityType: 'Customer' | 'Lead' | 'Call' | 'Booking' | 'FollowUp' | 'Task'
  entityId: ID
  text: string
  authorId: ID
  authorName: string
  createdAt: string
}

export interface Recording {
  id: ID
  recordingId: string
  callId: ID
  customerOrLeadName: string
  phoneNumber: string
  executiveName: string
  callDate: string
  durationSec: number
  status: RecordingStatus
  fileRef?: string
  fileSizeKb?: number
  transcript?: string
  accessLevel: 'Public' | 'Admin'
}

export interface Task {
  id: ID
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  startDate?: string | null
  dueDate: string
  assignedToId: ID
  assignedToName: string
  relatedToType?: 'Customer' | 'Lead' | 'Booking'
  relatedToId?: ID
  relatedToName?: string
  createdOn: string
  completedOn?: string
}

export type ActivityType =
  | 'call'
  | 'follow-up'
  | 'booking'
  | 'lead'
  | 'task'
  | 'note'
  | 'recording'
  | 'assignment'

export interface Activity {
  id: ID
  type: ActivityType
  title: string
  description: string
  actor: string
  actorId?: ID
  actorRole: UserRole
  timestamp: string
  relatedId?: ID
  relatedType?: 'Customer' | 'Lead' | 'Booking' | 'Call' | 'Follow-up' | 'Task' | 'User'
}

export interface Notification {
  id: ID
  type?: 'follow-up' | 'lead' | 'booking' | 'task' | 'call'
  relatedType?: 'customer' | 'lead' | 'follow-up' | 'booking' | 'task' | 'call'
  relatedId?: ID
  title: string
  description: string
  timestamp: string
  read: boolean
  priority?: FollowUpPriority
}

export interface KpiStat {
  label: string
  value: number
  delta?: number
  deltaDir?: 'up' | 'down' | 'flat'
  format?: 'number' | 'currency' | 'percent'
  icon: string
}


export interface Driver { id: ID; name: string; phone: string; licenseNumber: string; status: 'active' | 'inactive'; address?: string; vehicleCount?: number }
export interface Vehicle { id: ID; registrationNumber: string; vehicleType: string; makeModel?: string; capacity: number; status: 'active' | 'inactive' | 'maintenance'; driverId?: ID | null; driverName?: string }
export interface MobileDevice { id: ID; deviceToken: string; platform: string; appVersion?: string; active: boolean; lastSeenAt?: string }
export interface Permission { role: string; permissionKey: string; allowed: boolean }
