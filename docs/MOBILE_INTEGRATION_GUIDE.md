# React Native Integration Guide

This guide targets the existing PHP API in this repository. Its authentication contract is a PHP session cookie plus a CSRF token, not JWT/Bearer authentication. No backend changes are required to start a development integration, but mobile cookie behavior must be tested on the target iOS and Android versions.

## Configure the Base URL

Use a mobile build-time configuration value. The backend's local base is `http://localhost:8000/api` when PHP is served with `php -S localhost:8000 -t backend` from the repository root. `localhost` from a physical device refers to that device. Use the appropriate emulator host bridge or a reachable development machine/LAN URL. Production base URL is pending; do not use the frontend web URL or the `.env.example` future `/v1` comment as a verified API endpoint.

```ts
// src/api/config.ts
// Supply API_BASE_URL through the mobile app's environment/flavor configuration.
export const API_BASE_URL = 'http://localhost:8000/api'
```

Use HTTPS outside isolated local development. No production host or certificate is configured in this project.

## Axios Client and CSRF

```ts
// src/api/client.ts
import axios, { AxiosError } from 'axios'
import { API_BASE_URL } from './config'

let csrfToken = ''
export const setCsrfToken = (value: string) => { csrfToken = value }
export const clearCsrfToken = () => { csrfToken = '' }

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Client': 'gdai-cab-crm-mobile',
  },
})

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method && !['get', 'head', 'options'].includes(method) && config.url !== '/auth/login.php') {
    config.headers.set('X-CSRF-Token', csrfToken)
  }
  return config
})

export function apiMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: string } | undefined
    if (body?.message) return body.message
    if (!error.response) return 'Network error. Check the API URL and connection.'
    return `Request failed (${error.response.status}).`
  }
  return error instanceof Error ? error.message : 'Unexpected error.'
}
```

The browser client in the React CRM uses Axios `withCredentials: true`, and the PHP session cookie is HttpOnly. In React Native, verify the selected networking stack sends/stores the PHP session cookie for both platforms. Do not copy the HttpOnly cookie into AsyncStorage or add a fake `Authorization: Bearer` header. If the React Native version does not persist/send cookies reliably, configure a compatible native cookie manager and verify it with `GET /auth/me.php`; this project does not include a React Native app or cookie-manager dependency.

CSRF is required on every POST/PUT/PATCH/DELETE other than login. Login and `/auth/me.php` return `csrfToken`. Hold it in memory; re-fetch `/auth/me.php` after app startup if the cookie was restored. There is no token refresh endpoint. The server's fixed session lifetime is 8 hours from login.

## Authentication Service

```ts
// src/api/auth.ts
import { api, setCsrfToken, clearCsrfToken } from './client'

export interface SessionUser {
  id: string | number
  name: string
  email: string
  phone: string | null
  role: 'admin' | 'executive'
  timezone?: string
  bio?: string | null
}

export async function login(identifier: string, password: string) {
  const response = await api.post<{ success: true; user: SessionUser; csrfToken: string }>(
    '/auth/login.php', { identifier, password },
  )
  setCsrfToken(response.data.csrfToken)
  return response.data.user
}

export async function restoreSession() {
  const response = await api.get<{ success: true; user: SessionUser; csrfToken: string }>('/auth/me.php')
  setCsrfToken(response.data.csrfToken)
  return response.data.user
}

export async function logout() {
  await api.post('/auth/logout.php', {})
  clearCsrfToken()
}
```

Login accepts email or mobile in `identifier` and password. It sets the cookie and returns the user and CSRF token. Handle 401 by returning to sign-in; 403 means inactive/unsupported account. Logout requires the session cookie and CSRF header. Clear app-specific cached user data on logout. The native networking layer is responsible for cookie removal when the server clears its cookie; verify that behavior on device.

## Resource Service Examples

Every resource API response is wrapped as `{ success, data }`, except auth routes described above. Use the backend's exact casing and field names. IDs should be treated as strings. The examples use `customerOrLeadId`/`customerOrLeadType`; they are not `customer_id` / `lead_id` fields.

```ts
// src/api/bookings.ts
import { api } from './client'

export type BookingStatus = 'Enquiry' | 'Confirmed' | 'Assigned' | 'Completed' | 'Cancelled'
export interface Booking {
  id: string
  bookingId: string
  customerOrLeadType: 'Customer' | 'Lead'
  customerOrLeadId: string
  customerId?: string | null
  leadId?: string | null
  customerName: string
  mobileNumber: string
  pickupLocation: string
  dropLocation: string
  travelDate: string
  vehicleType: string
  passengerCount: number
  bookingStatus: BookingStatus
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid' | 'Refunded'
  amount: number
  driverVehicleDetails: string
  remarks: string
  createdBy: string
  createdAt: string
}

type ApiResponse<T> = { success: true; data: T }

export const listBookings = async () =>
  (await api.get<ApiResponse<Booking[]>>('/bookings/index.php')).data.data

export const getBooking = async (id: string) =>
  (await api.get<ApiResponse<Booking>>('/bookings/index.php', { params: { id } })).data.data

export type CreateBooking = {
  customerOrLeadType: 'Customer' | 'Lead'
  customerOrLeadId: string
  mobileNumber: string
  pickupLocation: string
  dropLocation: string
  travelDate: string // ISO 8601 datetime, including timezone
  vehicleType: string
  passengerCount: number
  bookingStatus?: BookingStatus // create must be Enquiry
  paymentStatus?: Booking['paymentStatus']
  amount?: number
  driverVehicleDetails?: string
  remarks?: string
}

export const createBooking = async (body: CreateBooking) =>
  (await api.post<ApiResponse<Booking>>('/bookings/index.php', body)).data.data

export const updateBooking = async (id: string, body: CreateBooking) =>
  (await api.put<ApiResponse<Booking>>('/bookings/index.php', body, { params: { id } })).data.data
```

For update, send the full schema expected by the resource validator; the shared handler treats PATCH like a full update too. Every update validates the relation, required fields, and status transition. A new booking must start as Enquiry. Assigned/Completed require non-empty `driverVehicleDetails`.

### Customer / Lead Selection

Fetch `/customers/index.php` and `/leads/index.php` with the authenticated session to populate selectors. Send the selected record's `id` and correct type. Mobile must be a valid 7–15 digit telephone number after punctuation removal (max 20 characters). Customer/lead list endpoints return all records visible to the session; they do not support query search or pagination.

### Generic List, Create, Update, Delete

```ts
// List (unpaged)
const { data } = await api.get('/customers/index.php')
const customers = data.data

// Create
const created = await api.post('/customers/index.php', {
  name: 'Taylor Example',
  phone: '+15551234567',
  email: 'taylor@example.test',
  location: '1 Main Street',
  city: 'Metro',
  status: 'Active',
  notes: '',
  tags: [],
  assignedExecutiveId: '7', // Admin must specify an active Calling Executive
})

// Update full resource body; id is a query parameter
const updated = await api.put('/customers/index.php', customerBody, { params: { id: '12' } })

// DELETE physically removes a record; use only where the mobile workflow intends deletion
await api.delete('/customers/index.php', { params: { id: '12' } })
```

The resource endpoints supporting generic CRUD are customers, leads, followups, bookings, calls, and tasks. `activities` and `recordings/index.php` are read-only. Follow-ups, calls, and tasks have more specific request rules documented in `MOBILE_API_DOCUMENTATION.md`.

## Errors

```ts
try {
  const booking = await createBooking(payload)
} catch (error) {
  const message = apiMessage(error)
  // Set a visible error state; keep entered form values for correction/retry.
}
```

API JSON errors use `{ success: false, message: string }`. Handle at least:

- `400`: malformed body or identifier.
- `401`: no/expired session, invalid login, or incorrect current password.
- `403`: role, ownership, or CORS origin denied.
- `404`: resource/record not found.
- `405`: unsupported method or write to a read-only resource.
- `409`: state transition or uniqueness/foreign-key conflict.
- `419`: CSRF missing/invalid; call `/auth/me.php` if the cookie is still valid, otherwise sign in again.
- `422`: field/business rule validation; show the backend message near the form.
- `500`: server/database failure; show retry affordance without discarding the form.

`/recordings/media.php` returns binary content, not the JSON envelope. It supports 206 partial content for byte ranges and 416 for invalid ranges.

## Loading, Empty, Search, and Pagination

Use explicit loading, error, empty, and populated states. List responses are arrays in `response.data.data`; an empty array is a successful empty state. The API has no general pagination, server-side text search, or arbitrary filters. Do not send invented `page`, `limit`, `q`, or status query parameters expecting backend filtering. For small returned lists, filter in the app; for larger data volumes, pagination/search are backend gaps to resolve. Notifications are capped at 100. Reports accept only their documented `range` values (`dashboard`: 7d/30d/90d; Admin reports: 7d/30d/90d/12m).

## Mobile Readiness Checks

1. Point a device/emulator to a reachable development PHP host and confirm `POST /auth/login.php` stores the session cookie.
2. Call `GET /auth/me.php` after app restart; confirm session persistence and save the returned CSRF token in memory.
3. Make one protected POST and verify cookie plus `X-CSRF-Token` arrive at PHP.
4. Verify 401 after the 8-hour session expires; the backend has no refresh endpoint.
5. Test role behavior using an Admin account and a Calling Executive account; do not infer access from hidden mobile UI.
6. Use HTTPS and configure deployment CORS/session settings before production. Production API URL is not yet known.
