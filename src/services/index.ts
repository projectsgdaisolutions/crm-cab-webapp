import { apiClient } from '@/services/apiClient'
import type {
  Customer, Lead, FollowUp, Booking, CallRecord, Recording, Task, User, Notification,
  Activity, Note,
} from '@/types'

type ApiResponse<T> = { data: T }

async function listResource<T>(resource: string): Promise<T[]> {
  const { data } = await apiClient.get<ApiResponse<T[]>>(`/${resource}/index.php`)
  return data.data
}

async function getResource<T>(resource: string, id: string): Promise<T> {
  const { data } = await apiClient.get<ApiResponse<T>>(`/${resource}/index.php`, { params: { id } })
  return data.data
}

async function createResource<T>(resource: string, payload: unknown): Promise<T> {
  const { data } = await apiClient.post<ApiResponse<T>>(`/${resource}/index.php`, payload)
  return data.data
}

async function updateResource<T>(resource: string, id: string, payload: unknown): Promise<T> {
  const existing = await getResource<T>(resource, id)
  const merged = { ...(existing as object), ...(payload as object) }
  const { data } = await apiClient.put<ApiResponse<T>>(`/${resource}/index.php`, merged, { params: { id } })
  return data.data
}

async function deleteResource(resource: string, id: string): Promise<boolean> {
  const { data } = await apiClient.delete<{ success: boolean }>(`/${resource}/index.php`, { params: { id } })
  return data.success
}

export const customerService = {
  list: () => listResource<Customer>('customers'),
  get: (id: string) => getResource<Customer>('customers', id),
  create: (payload: Partial<Customer>) => createResource<Customer>('customers', payload),
  update: (id: string, payload: Partial<Customer>) => updateResource<Customer>('customers', id, payload),
  remove: (id: string) => deleteResource('customers', id),
}

export const leadService = {
  list: () => listResource<Lead>('leads'),
  get: (id: string) => getResource<Lead>('leads', id),
  create: (payload: Partial<Lead>) => createResource<Lead>('leads', payload),
  update: (id: string, payload: Partial<Lead>) => updateResource<Lead>('leads', id, payload),
  moveStage: (id: string, status: Lead['status']) => updateResource<Lead>('leads', id, { status }),
  async convertToCustomer(id: string): Promise<{ lead: Lead; customer: Customer }> {
    const { data } = await apiClient.post<{ data: { lead: Lead; customer: Customer } }>(`/leads/convert.php?id=${encodeURIComponent(id)}`, {})
    return data.data
  },
  remove: (id: string) => deleteResource('leads', id),
}

export const followUpService = {
  list: () => listResource<FollowUp>('followups'),
  get: (id: string) => getResource<FollowUp>('followups', id),
  create: (payload: Partial<FollowUp>) => createResource<FollowUp>('followups', payload),
  update: (id: string, payload: Partial<FollowUp>) => updateResource<FollowUp>('followups', id, payload),
  complete: (id: string) => updateResource<FollowUp>('followups', id, { status: 'Completed' }),
  cancel: (id: string) => updateResource<FollowUp>('followups', id, { status: 'Cancelled' }),
  remove: (id: string) => deleteResource('followups', id),
}

export const bookingService = {
  list: () => listResource<Booking>('bookings'),
  get: (id: string) => getResource<Booking>('bookings', id),
  create: (payload: Partial<Booking>) => createResource<Booking>('bookings', payload),
  update: (id: string, payload: Partial<Booking>) => updateResource<Booking>('bookings', id, payload),
  remove: (id: string) => deleteResource('bookings', id),
}

export const callService = {
  list: () => listResource<CallRecord>('calls'),
  async listForExecutive(executiveId: string): Promise<CallRecord[]> {
    const { data } = await apiClient.get<ApiResponse<CallRecord[]>>('/calls/index.php', { params: { executiveId } })
    return data.data
  },
  get: (id: string) => getResource<CallRecord>('calls', id),
  create: (payload: Partial<CallRecord>) => createResource<CallRecord>('calls', payload),
  async bulkSync(calls: Array<Partial<CallRecord> & { syncId?: string }>): Promise<{ created: CallRecord[]; duplicates: string[] }> {
    const { data } = await apiClient.post<{ success: boolean; data: { created: CallRecord[]; duplicates: string[] } }>('/calls/bulk-sync.php', { calls })
    return data.data
  },
}

export const noteService = {
  async list(entityType: Note['entityType'], entityId: string): Promise<Note[]> {
    const { data } = await apiClient.get<ApiResponse<Note[]>>('/notes/index.php', { params: { entityType, entityId } })
    return data.data
  },
  async create(entityType: Note['entityType'], entityId: string, text: string): Promise<Note> {
    const { data } = await apiClient.post<ApiResponse<Note>>('/notes/index.php', { entityType, entityId, text })
    return data.data
  },
}

export const recordingService = {
  list: () => listResource<Recording>('recordings'),
  async listForExecutive(executiveId: string): Promise<Recording[]> {
    const { data } = await apiClient.get<ApiResponse<Recording[]>>('/recordings/index.php', { params: { executiveId } })
    return data.data
  },
  get: (id: string) => getResource<Recording>('recordings', id),
  async upload(callId: string, file: File, durationSec = 0, accessLevel: 'Admin' | 'Public' = 'Admin'): Promise<Recording> {
    const form = new FormData()
    form.append('callId', callId)
    form.append('durationSec', String(Math.max(0, Math.floor(durationSec))))
    form.append('accessLevel', accessLevel)
    form.append('file', file)
    const { data } = await apiClient.post<ApiResponse<Recording>>('/recordings/upload.php', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  },
}

export const taskService = {
  list: () => listResource<Task>('tasks'),
  get: (id: string) => getResource<Task>('tasks', id),
  create: (payload: Partial<Task>) => createResource<Task>('tasks', payload),
  update: (id: string, payload: Partial<Task>) => updateResource<Task>('tasks', id, payload),
  complete: (id: string) => updateResource<Task>('tasks', id, { status: 'Completed' }),
  remove: (id: string) => deleteResource('tasks', id),
}

export const activityService = {
  list: () => listResource<Activity>('activities'),
  async listForUser(userId: string): Promise<Activity[]> {
    const { data } = await apiClient.get<ApiResponse<Activity[]>>('/activities/index.php', { params: { userId } })
    return data.data
  },
}

export const userService = {
  async list(): Promise<User[]> {
    const { data } = await apiClient.get<ApiResponse<User[]>>('/users/index.php')
    return data.data
  },
  async activeExecutives(): Promise<User[]> {
    const { data } = await apiClient.get<ApiResponse<User[]>>('/users/index.php', { params: { activeExecutives: 1 } })
    return data.data
  },
  async get(id: string): Promise<User> {
    return (await this.list()).find((user) => user.id === id) as User
  },
  async create(payload: Partial<User> & { password: string }): Promise<User> {
    const { data } = await apiClient.post<ApiResponse<User>>('/users/index.php', payload)
    return data.data
  },
  async update(id: string, payload: Partial<User> & { password?: string }): Promise<User> {
    const { data } = await apiClient.put<ApiResponse<User>>('/users/index.php', payload, { params: { id } })
    return data.data
  },
  async remove(id: string): Promise<boolean> {
    const { data } = await apiClient.delete<{ success: boolean }>('/users/index.php', { params: { id } })
    return data.success
  },
}

export const notificationService = {
  list: () => listResource<Notification>('notifications'),
  async listWithUnreadCount(): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const { data } = await apiClient.get<ApiResponse<Notification[]> & { unreadCount: number }>('/notifications/index.php')
    return { notifications: data.data, unreadCount: data.unreadCount }
  },
  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/index.php?id=${encodeURIComponent(id)}`, { read: true })
  },
  async markAllRead(): Promise<void> {
    await apiClient.patch('/notifications/index.php', { readAll: true })
  },
}

export const preferenceService = {
  async get(): Promise<Record<string, unknown>> {
    const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>('/auth/preferences.php')
    return data.data
  },
  async save(preferences: Record<string, unknown>): Promise<void> {
    await apiClient.put('/auth/preferences.php', preferences)
  },
}

export const analyticsService = {
  async dashboard(range: '7d' | '30d' | '90d' = '7d', summary = false) {
    const params = summary ? { range, summary: 1 } : { range }
    const { data } = await apiClient.get<ApiResponse<Record<string, any>>>('/reports/dashboard.php', { params })
    return data.data
  },
  async reports(range: '7d' | '30d' | '90d' | '12m' = '30d') {
    const { data } = await apiClient.get<ApiResponse<Record<string, any[]>>>('/reports/index.php', { params: { range } })
    return data.data
  },
}


export const driverService = {
  list: (params?: Record<string, string | number>) => apiClient.get<ApiResponse<any[]>>('/drivers/index.php', { params }).then(r => r.data.data),
  create: (payload: Record<string, unknown>) => apiClient.post<ApiResponse<any>>('/drivers/index.php', payload).then(r => r.data.data),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put<ApiResponse<any>>('/drivers/index.php', payload, { params: { id } }).then(r => r.data.data),
}

export const vehicleService = {
  list: (params?: Record<string, string | number>) => apiClient.get<ApiResponse<any[]>>('/vehicles/index.php', { params }).then(r => r.data.data),
  create: (payload: Record<string, unknown>) => apiClient.post<ApiResponse<any>>('/vehicles/index.php', payload).then(r => r.data.data),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put<ApiResponse<any>>('/vehicles/index.php', payload, { params: { id } }).then(r => r.data.data),
  assignToBooking: (bookingId: string, payload: { driverId?: string; vehicleId?: string; driverVehicleDetails?: string }) => apiClient.put<ApiResponse<any>>('/bookings/assign-driver.php', payload, { params: { id: bookingId } }).then(r => r.data.data),
}

export const mobileDeviceService = {
  register: (payload: { deviceToken: string; platform?: string; appVersion?: string }) => apiClient.post<ApiResponse<any>>('/mobile/devices.php', payload).then(r => r.data.data),
  unregister: (deviceToken: string) => apiClient.delete('/mobile/devices.php', { data: { deviceToken } }),
  list: () => apiClient.get<ApiResponse<any[]>>('/mobile/devices.php').then(r => r.data.data),
}

export const permissionService = {
  list: () => apiClient.get<ApiResponse<any[]>>('/permissions/index.php').then(r => r.data.data),
  set: (payload: { role: string; permissionKey: string; allowed: boolean }) => apiClient.put<ApiResponse<any>>('/permissions/index.php', payload).then(r => r.data.data),
}

export const registrationService = {
  register: (payload: { name: string; email: string; phone?: string; password: string }) => apiClient.post<ApiResponse<any>>('/auth/register.php', payload).then(r => r.data.data),
}

export const reportExportService = {
  csvUrl: (resource: string, dateFrom?: string, dateTo?: string) => {
    const base = import.meta.env.VITE_API_BASE_URL || '/api'
    const p = new URLSearchParams({ resource, format: 'csv' }); if (dateFrom) p.set('dateFrom', dateFrom); if (dateTo) p.set('dateTo', dateTo);
    return `${base}/reports/export.php?${p.toString()}`
  },
}

export async function listResourcePage<T>(resource: string, params: { page?: number; limit?: number; search?: string; status?: string; dateFrom?: string; dateTo?: string } = {}) {
  const response = await apiClient.get<ApiResponse<T[]>>(`/${resource}/index.php`, { params })
  return { data: response.data.data, total: Number(response.headers['x-total-count'] || response.data.data.length), page: Number(response.headers['x-page'] || params.page || 1), limit: Number(response.headers['x-page-size'] || params.limit || response.data.data.length) }
}
