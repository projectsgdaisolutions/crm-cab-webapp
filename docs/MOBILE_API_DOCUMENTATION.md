# CAB CRM Mobile API Documentation

**Contract source:** the PHP route files, shared handlers, MySQL schema, and current frontend service layer in this repository. This document describes implemented behavior, not a proposed API. No backend code or schema was changed to produce it.

## Base URL

- Local development: `http://localhost:8000/api` when the PHP server is started from the repository root with `php -S localhost:8000 -t backend`.
- Route prefix: `/api`; endpoints use `.php` paths (there is no `/v1` route prefix).
- Production: **pending**. No deployed backend URL is configured. `.env.example` mentions a future `https://api.gdaisolutions.com/v1`; it is a comment, not a verified URL or implemented route. Do not use the frontend hosting URL as the API base.
- React Native note: `localhost` points to the device/emulator, not necessarily the developer PC. Use the platform emulator host mapping or a reachable development host/LAN address. Set the actual reachable URL in the mobile build environment.

Unless noted otherwise, JSON endpoints return `Content-Type: application/json` and `Cache-Control: no-store`. A normal success envelope is `{"success":true,"data":...}`. List endpoints put an array in `data`; single-resource endpoints put an object there. Authentication endpoints use top-level `user` and `csrfToken` instead. Errors use `{"success":false,"message":"..."}`.

## Authentication and Common Headers

All endpoints below require a valid authenticated PHP session except `POST /auth/login.php` and CORS preflight. Login sets an HTTP-only session cookie and returns a CSRF token. Send the session cookie on later calls; there is no bearer token, refresh-token API, or API key in this implementation. Session authentication expires 8 hours after login and is not refreshed by activity. A fresh login is required after expiry.

For JSON requests send `Accept: application/json` and `Content-Type: application/json`. Every state-changing request also requires `X-CSRF-Token: <csrfToken>`; this includes POST, PUT, PATCH, and DELETE. Login itself does not require CSRF. `GET /auth/me.php` returns a CSRF token that can restore app state when a valid cookie persists. Do not store passwords or the HTTP-only session cookie in AsyncStorage. Keep the CSRF token in memory where practical; if persistence is required, use platform-secure storage and clear it at logout/expiry. Confirm cookie persistence on both target mobile platforms before release.

The CORS config allows credentials and the headers `Content-Type`, `X-Requested-With`, `X-Client`, and `X-CSRF-Token`. Its default origins are only `http://localhost:5173` and `http://127.0.0.1:5173`; set `CORS_ALLOWED_ORIGINS` for any browser-based mobile development origin. Native requests without an Origin header are not subject to browser CORS enforcement, but cookie and preflight behavior still needs device testing.

## Endpoint Index

`{id}` below is a positive integer supplied as the `id` query parameter, not a URL path segment. There is no general server-side search/filter/pagination for resource lists; lists are unpaged. Only the reports routes accept `range`. The media endpoint supports an HTTP `Range` header.

| Module | Path | Methods | Access |
|---|---|---|---|
| Authentication | `/auth/login.php` | POST | Public |
| Authentication | `/auth/logout.php` | POST | Admin, Calling Executive |
| Authentication | `/auth/me.php` | GET | Admin, Calling Executive |
| Authentication | `/auth/password.php` | POST | Admin, Calling Executive |
| Profile | `/auth/profile.php` | PUT | Admin only |
| Preferences | `/auth/preferences.php` | GET, PUT | Admin, Calling Executive; own account |
| Customers | `/customers/index.php` | GET, POST, PUT, PATCH, DELETE | Admin, Calling Executive; ownership-scoped |
| Leads | `/leads/index.php` | GET, POST, PUT, PATCH, DELETE | Admin, Calling Executive; ownership-scoped |
| Leads | `/leads/convert.php?id={id}` | POST | Admin, Calling Executive; owned, Booking Confirmed lead only |
| Follow-ups | `/followups/index.php` | GET, POST, PUT, PATCH, DELETE | Admin, Calling Executive; ownership-scoped |
| Bookings | `/bookings/index.php` | GET, POST, PUT, PATCH, DELETE | Admin, Calling Executive; ownership-scoped |
| Calls | `/calls/index.php` | GET, POST, PUT, PATCH, DELETE | Admin, Calling Executive; calls scoped to executive |
| Recordings | `/recordings/index.php` | GET | Admin only; list additionally filters to Admin/Public access level |
| Recordings | `/recordings/media.php?id={id}` | GET | Admin only; streams file bytes |
| Tasks | `/tasks/index.php` | GET, POST, PUT, PATCH, DELETE | Admin, Calling Executive; ownership-scoped |
| Activities | `/activities/index.php` | GET | Admin, Calling Executive; scoped for executives |
| Notifications | `/notifications/index.php` | GET, PATCH | Admin, Calling Executive; own notifications |
| Team / Users | `/users/index.php` | GET | Admin list; Calling Executive receives own user only |
| Team / Users | `/users/index.php` | POST, PUT, DELETE | Admin only |
| Dashboard | `/reports/dashboard.php` | GET | Admin, Calling Executive; role-scoped data |
| Reports | `/reports/index.php` | GET | Admin only |

For the six mutable CRM resources (`customers`, `leads`, `followups`, `bookings`, `calls`, `tasks`), `GET` with no `id` lists records and `GET?id={id}` gets one record. `POST` creates (HTTP 201), `PUT?id={id}` updates, `PATCH?id={id}` also runs the same full resource update validation as PUT, and `DELETE?id={id}` permanently deletes the record. These are not partial PATCH semantics. `activities` and `recordings` are read-only; writes return 405. The users route does not implement GET-by-ID: GET returns the Admin list or Calling Executive self record in a one-item array; its `id` query is for Admin PUT/DELETE only.

## Authentication Endpoints

### Login

`POST /auth/login.php` accepts `identifier`, or compatibility aliases `email` / `phone`, plus `password`. Required: non-empty identifier (max 254 chars) and non-empty string password (max 4096 bytes). Only active Admin and Calling Executive accounts can log in.

```json
{"identifier":"executive@example.test","password":"<user password>"}
```

HTTP 200:

```json
{"success":true,"message":"Login successful.","user":{"id":7,"name":"Alex Example","email":"executive@example.test","phone":"+15551234567","role":"executive","timezone":"Asia/Kolkata","bio":null},"csrfToken":"<session CSRF token>"}
```

The session cookie is set via `Set-Cookie` with HttpOnly, SameSite, path `/`, and Secure when configured/HTTPS. Login errors: 400 malformed/missing input; 401 invalid credentials; 403 inactive or unsupported role.

### Current Session

`GET /auth/me.php`; no body or query. HTTP 200:

```json
{"success":true,"user":{"id":7,"name":"Alex Example","email":"executive@example.test","phone":"+15551234567","role":"executive","timezone":"Asia/Kolkata","bio":null},"csrfToken":"<session CSRF token>"}
```

401 means the session is absent, expired, inactive, or no longer valid.

### Logout

`POST /auth/logout.php`; requires cookie and CSRF header; empty JSON body is sufficient. HTTP 200: `{"success":true,"message":"Logout successful."}`. A missing/invalid CSRF token returns 419. It destroys the session and cookie.

### Change Password

`POST /auth/password.php`; authenticated user, CSRF required.

```json
{"currentPassword":"<current password>","newPassword":"<new password, at least 12 characters>"}
```

HTTP 200: `{"success":true,"message":"Password updated."}`. Errors: 401 wrong current password; 419 CSRF; 422 missing/short/same password; 500 save failure. Session ID is regenerated after success; no token refresh endpoint exists.

### Update Admin Profile

`PUT /auth/profile.php`; Admin only, CSRF required. All listed keys are accepted; name/email are required by validation.

```json
{"name":"Alex Example","email":"alex@example.test","phone":"+15551234567","timezone":"Asia/Kolkata","bio":"Operations"}
```

`name`: non-empty, max 150 chars. `email`: valid, max 150 chars. `phone`: max 20 chars, may be empty. `timezone`: PHP timezone identifier, defaults to `Asia/Kolkata`. `bio`: max 2000 chars. HTTP 200 returns `{"success":true,"user":{"id":"7","name":"Alex Example","email":"alex@example.test","phone":"+15551234567","role":"admin","timezone":"Asia/Kolkata","bio":"Operations"}}`. Errors: 403 non-admin; 409 duplicate email; 419 CSRF; 422 validation.

### Preferences

`GET /auth/preferences.php` returns `{"success":true,"data":{}}` or the caller's stored JSON object. `PUT /auth/preferences.php` accepts any JSON object up to 10 KB and requires CSRF; success echoes it as `data`. No preference keys are defined by the backend. Errors: 401, 419, 422.

## CRM Resource Schemas

All IDs in returned resource objects are strings where the shared serializer explicitly casts them; aggregate numeric fields are numbers. Resource endpoints use `?id=<positive integer>` for single-record operations. Unknown query parameters are not a documented filter interface.

### Customers — `/customers/index.php`

Customer create/update also accepts optional `alternateNumber`, `pickupLocation`, and `dropLocation` fields. Responses include those fields plus `updatedOn`; `joinedOn` remains the creation timestamp. `updatedOn` is initialized from `created_at` for existing rows and refreshed on each customer edit.

Create/update JSON:

```json
{"name":"Taylor Example","phone":"+15551234567","email":"taylor@example.test","location":"1 Main Street","city":"Metro","status":"Active","notes":"Gate code provided","tags":["VIP"],"assignedExecutiveId":"7"}
```

`name` and `phone` required (max 150/20 chars). `email`, `location`, `city`, `status`, `notes`, `tags`, and `assignedExecutiveId` optional in body; status defaults `Active`, tags default `[]`. Status: `Active | Inactive | VIP | Lead | Churned`. Non-empty email must validate. For Admin, `assignedExecutiveId` must identify an active Calling Executive (the Admin ID is not a valid assignee). Calling Executives are assigned to themselves; supplied assignment is ignored. Response fields: `id`, `name`, `phone`, `email`, `location`, `city`, `status`, `assignedExecutiveId`, `assignedExecutiveName`, `totalBookings`, `totalSpend`, `lastContact`, `joinedOn`, `notes`, `tags`.

GET response example: `{"success":true,"data":{"id":"12","name":"Taylor Example","phone":"+15551234567","email":"taylor@example.test","location":"1 Main Street","city":"Metro","status":"Active","assignedExecutiveId":"7","assignedExecutiveName":"Alex Example","totalBookings":0,"totalSpend":0,"lastContact":"2026-10-02 10:00:00","joinedOn":"2026-10-02 10:00:00","notes":"","tags":[]}}`. Create returns the same shape with HTTP 201. Common validation errors: 400 malformed JSON/id; 401; 403 ownership/role; 409 unique/FK conflict; 419 CSRF; 422 field validation; 500 persistence failure.

### Leads — `/leads/index.php`

Create/update JSON:

```json
{"name":"Morgan Example","phone":"+15557654321","email":"morgan@example.test","source":"Referral","status":"New","priority":"Medium","interestedService":"Airport transfer","pickupLocation":"Airport","dropLocation":"Hotel","travelAt":"2026-10-10T09:30:00Z","estimatedValue":120,"location":"Metro","nextFollowUp":null,"remarks":"Call after 5 PM","assignedExecutiveId":"7"}
```

Required: `name` (max 150), `phone` (max 20; 7–15 digits after punctuation removal), `interestedService` (max 100), `pickupLocation` and `dropLocation` (max 500), and valid `travelAt`. Admin must provide an active executive `assignedExecutiveId`; executive assignment is the authenticated user. Optional/defaults: `email` (valid if non-empty), `source` defaults `Website` and must be `Website | Facebook | Instagram | Google Ads | Referral | Walk-in | Inbound Call | Outbound Call`; `status` defaults `New`; `priority` defaults `Medium` and must be `Low | Medium | High | Hot`; `estimatedValue` defaults 0 and is clamped at minimum 0; `location` defaults pickup; `nextFollowUp` nullable date; `remarks` max 5000. Create must start at `New`; updates use this allowed progression: New → Contacted → Follow-up → Interested → Booking Confirmed → Lost (same status is accepted; Converted/Lost are terminal). `Follow-up` requires `nextFollowUp`.

Response fields: `id`, `leadId`, `name`, `phone`, `email`, `source`, `interestedService`, `pickupLocation`, `dropLocation`, `travelAt`, `status`, `priority`, `assignedExecutiveId`, `assignedExecutiveName`, `nextFollowUp`, `createdOn`, `updatedOn`, `convertedCustomerId`, `convertedAt`, `estimatedValue`, `remarks`, `location`. Errors include 409 invalid transition/uniqueness, 422 validation, and common CRM errors.

Response example: `{"success":true,"data":{"id":"5","leadId":"LD-000005","name":"Morgan Example","phone":"+15557654321","email":"morgan@example.test","source":"Referral","interestedService":"Airport transfer","pickupLocation":"Airport","dropLocation":"Hotel","travelAt":"2026-10-10 09:30:00","status":"New","priority":"Medium","assignedExecutiveId":"7","assignedExecutiveName":"Alex Example","nextFollowUp":null,"createdOn":"2026-10-02 10:00:00","updatedOn":"2026-10-02 10:00:00","convertedCustomerId":null,"convertedAt":null,"estimatedValue":120,"remarks":"Call after 5 PM","location":"Metro"}}`.

### Convert Lead — `/leads/convert.php?id={leadId}`

POST with CSRF; body is parsed only by JSON validity and can be `{}`. No path parameter; `id` query is required. Only a lead in `Booking Confirmed`, not previously converted, with an active executive assignment, is convertible. HTTP 201:

```json
{"success":true,"data":{"lead":{"id":"5","leadId":"LD-000005","status":"Converted","convertedCustomerId":"13"},"customer":{"id":"13","name":"Morgan Example","phone":"+15557654321","status":"Active"}}}
```

The sample shows representative fields; actual `lead` and `customer` objects include their normal resource response fields. Errors: 400 invalid/missing id or body; 401; 403 inaccessible lead; 404 missing lead; 409 wrong status/already converted; 419 CSRF; 422 no active assignee; 500 conversion failure.

The nested response shapes are the same lead/customer fields documented for their list endpoints; conversion sets lead status to `Converted`, fills `convertedCustomerId`/`convertedAt`, and returns the newly created customer with HTTP 201.

### Follow-ups — `/followups/index.php`

Create/update JSON:

```json
{"type":"Lead","customerOrLeadId":"5","scheduledAt":"2026-10-04T10:00:00Z","status":"Pending","priority":"Medium","channel":"Phone","notes":"Ask about airport pickup","assignedExecutiveId":"7"}
```

Required: existing `customerOrLeadId`; `type` must be `Customer` or `Lead` (implementation defaults to `Lead`); valid `scheduledAt`. Admin must supply active `assignedExecutiveId`; Calling Executive is assigned to self. `status`: `Pending | Completed | Rescheduled | Cancelled` (default Pending); `priority`: `Low | Medium | High | Urgent` (default Medium); `channel`: `Phone | WhatsApp | Email | Visit` (default Phone); notes optional. Returned fields: `id`, `customerOrLeadName`, `customerOrLeadId`, `type`, `assignedExecutiveId`, `assignedExecutiveName`, `scheduledAt`, `status`, `priority`, `notes`, `reminderSent`, `channel`. No separate reminder-send endpoint is implemented. Errors use common CRM statuses.

Response example: `{"success":true,"data":{"id":"18","customerOrLeadName":"Morgan Example","customerOrLeadId":"5","type":"Lead","assignedExecutiveId":"7","assignedExecutiveName":"Alex Example","scheduledAt":"2026-10-04 10:00:00","status":"Pending","priority":"Medium","notes":"Ask about airport pickup","reminderSent":false,"channel":"Phone"}}`.

### Bookings — `/bookings/index.php`

Create/update JSON uses actual shared-handler names:

```json
{"customerOrLeadType":"Customer","customerOrLeadId":"12","mobileNumber":"+15551234567","pickupLocation":"Airport","dropLocation":"Hotel","travelDate":"2026-10-10T09:30:00Z","vehicleType":"Sedan","passengerCount":2,"bookingStatus":"Enquiry","paymentStatus":"Unpaid","amount":85.5,"driverVehicleDetails":"Driver: Pat; vehicle: ABC-123","remarks":"Meet at arrivals"}
```

Required: `customerOrLeadType` (`Customer | Lead`), existing accessible `customerOrLeadId`, valid `mobileNumber` (7–15 digits after punctuation removal, max 20 chars), `travelDate`, `pickupLocation` and `dropLocation` (max 500), `vehicleType` (max 100), and integer `passengerCount >= 1`. `bookingStatus` defaults `Enquiry`; a newly created booking must be Enquiry. Updates allow only `Enquiry → Confirmed → Assigned → Completed` or `Assigned → Cancelled` (same status accepted). `Assigned`/`Completed` require non-empty `driverVehicleDetails`. `paymentStatus` defaults `Unpaid` and must be `Unpaid | Partial | Paid | Refunded`. `amount` defaults 0 and is clamped to at least 0. `remarks` and `driverVehicleDetails` may be empty. Creator is taken from the authenticated session; do not send creator, booking ID, or created date.

Response fields: `id`, `bookingId` (generated `BK-` code), `customerId`, `leadId`, `customerOrLeadType`, `customerOrLeadId`, `customerName`, `mobileNumber`, `pickupLocation`, `dropLocation`, `travelDate`, `vehicleType`, `passengerCount`, `bookingStatus`, `paymentStatus`, `amount`, `driverVehicleDetails`, `remarks`, `createdBy`, `createdAt`.

HTTP 201 example:

```json
{"success":true,"data":{"id":"31","bookingId":"BK-00031","customerId":"12","leadId":null,"customerOrLeadType":"Customer","customerOrLeadId":"12","customerName":"Taylor Example","mobileNumber":"+15551234567","pickupLocation":"Airport","dropLocation":"Hotel","travelDate":"2026-10-10 09:30:00","vehicleType":"Sedan","passengerCount":2,"bookingStatus":"Enquiry","paymentStatus":"Unpaid","amount":85.5,"driverVehicleDetails":"","remarks":"Meet at arrivals","createdBy":"Alex Example","createdAt":"2026-10-02 10:15:00"}}
```

Errors: 409 invalid status transition or foreign-key conflict; 422 invalid relation, mobile, passenger count, or field/status values; plus common CRM errors. Legacy database values `Pending`/`In Progress` are normalized to `Enquiry`/`Assigned` in responses by current backend code.

### Calls — `/calls/index.php`

Create JSON:

```json
{"type":"Lead","customerOrLeadId":"5","phoneNumber":"+15557654321","direction":"Outgoing","status":"Answered","durationSec":120,"timestamp":"2026-10-02T10:15:00Z","notes":"Discussed estimate","followUpId":null}
```

Required: `type` (`Customer | Lead`, implementation default `Lead`), accessible `customerOrLeadId`, and valid `timestamp`. `phoneNumber` optional (loaded from related record if absent); `direction` defaults Outgoing and maps Incoming explicitly, all other values map Outgoing; `status` defaults Answered and must be `Answered | Missed | Busy | Rejected | Failed`; `durationSec` defaults 0 and is clamped at 0; `notes` optional; `followUpId` optional positive integer. Executive is always the caller. Returned fields: `id`, `callId`, `customerOrLeadName`, `customerOrLeadId`, `type`, `phoneNumber`, `executiveId`, `executiveName`, `direction`, `timestamp`, `durationSec`, `status`, `hasRecording`, `recordingId`, `followUpId`, `notes`. HTTP 201; common validation/ownership errors apply.

Response example: `{"success":true,"data":{"id":"42","callId":"CL-42","customerOrLeadName":"Morgan Example","customerOrLeadId":"5","type":"Lead","phoneNumber":"+15557654321","executiveId":"7","executiveName":"Alex Example","direction":"Outgoing","timestamp":"2026-10-02 10:15:00","durationSec":120,"status":"Answered","hasRecording":false,"recordingId":null,"followUpId":null,"notes":"Discussed estimate"}}`.

### Recordings — `/recordings/index.php`

Admin-only GET list or `?id=<recording row id>`. No create/upload endpoint exists. Response fields: `id`, `recordingId`, `customerOrLeadName`, `phoneNumber`, `executiveName`, `callDate`, `durationSec`, `status`, `fileRef`, `fileSizeKb` (currently null), `transcript`, `accessLevel`. The file reference is either null or `/api/recordings/media.php?id=<id>`. List filters to `access_level IN ('Admin','Public')`; the route itself requires Admin, so Calling Executives cannot fetch recordings. Example: `{"success":true,"data":[{"id":"9","recordingId":"REC-9","customerOrLeadName":"Morgan Example","phoneNumber":"+15557654321","executiveName":"Alex Example","callDate":"2026-10-02 10:00:00","durationSec":120,"status":"Available","fileRef":"/api/recordings/media.php?id=9","fileSizeKb":null,"transcript":null,"accessLevel":"Admin"}]}`.

### Recording Media — `/recordings/media.php?id={recordingId}`

Admin-only GET; required positive `id`; optional `download` query parameter (presence selects attachment instead of inline). Streams bytes, not JSON. Supports `Range: bytes=<start>-<end>` with HTTP 206 and range headers. Errors: 400 invalid/missing ID; 401 unauthenticated; 403 non-admin; 404 missing/unavailable file; 416 invalid range; 500 file-open failure. Storage root is `RECORDINGS_DIRECTORY` or backend `storage/recordings`; no upload endpoint is implemented here.

### Tasks — `/tasks/index.php`

Create/update JSON:

```json
{"title":"Call customer","description":"Confirm pickup","assignedToId":"7","dueDate":"2026-10-04T10:00:00Z","priority":"Medium","status":"Todo","relatedToType":"Booking","relatedToId":"31"}
```

Required `title` (max 200); `assignedToId` for Admin must point to active Calling Executive (defaulting to Admin ID fails that executive check); Calling Executive is assigned to self. `description` optional; `dueDate` optional valid date; `priority`: `Low | Medium | High | Urgent` (default Medium); `status`: `Todo | In Progress | Review | Done` (default Todo); optional `relatedToType` is `Customer | Lead | Booking` when `relatedToId` is set; related records are access-checked. Response fields: `id`, `title`, `description`, `status`, `priority`, `dueDate`, `assignedToId`, `assignedToName`, `relatedToType`, `relatedToId`, `relatedToName`, `createdOn`, `completedOn`. Common CRM errors apply.

Response example: `{"success":true,"data":{"id":"24","title":"Call customer","description":"Confirm pickup","status":"Todo","priority":"Medium","dueDate":"2026-10-04 10:00:00","assignedToId":"7","assignedToName":"Alex Example","relatedToType":"Booking","relatedToId":"31","relatedToName":"BK-00031","createdOn":"2026-10-02 10:00:00","completedOn":null}}`.

### Activities — `/activities/index.php`

Admin/Calling Executive GET list or `?id=<activity id>`, no writes. Response fields: `id`, `type`, `title`, `description`, `actor`, `actorRole`, `timestamp`, `relatedId`, `relatedType`. Executive listing is ownership-scoped and includes own activity. Example: `{"success":true,"data":[{"id":"40","type":"booking","title":"Created bookings #31","description":"Created bookings #31","actor":"Alex Example","actorRole":"Calling Executive","timestamp":"2026-10-02 10:15:00","relatedId":"31","relatedType":"Booking"}]}`.

### Notifications — `/notifications/index.php`

`GET` returns at most the latest 100 notifications for the session user; fields: `id`, `title`, `description`, `timestamp`, `read` (boolean). `PATCH` requires CSRF. Mark one read: query `?id=<notification id>`, body `{}` (or any object without truthy `readAll`). Mark all read: no id, body `{"readAll":true}`. Success is `{"success":true}`. Errors: 400 invalid/missing id or malformed JSON; 401; 404 missing/unowned notification; 419 CSRF. There is no create notification API for mobile.

### Team / Users — `/users/index.php`

Admin GET returns user array; Calling Executive GET returns only self in a one-item array. User fields: `id`, `name`, `email`, `phone`, `role` (`Admin | Calling Executive`), `active` (boolean), `leadCount`, `callCount`, `conversionRate`, `joinedOn`, `lastActive`.

Admin POST creates a Calling Executive:

```json
{"name":"Jordan Example","email":"jordan@example.test","phone":"+15559876543","role":"Calling Executive","password":"<initial password, at least 12 characters>"}
```

Name required max 150; email valid max 150; phone required max 20; role must be `Calling Executive`; password length 12–4096. Returns `{"success":true,"data":{"id":"8","name":"Jordan Example","email":"jordan@example.test","phone":"+15559876543","role":"Calling Executive","active":true,"leadCount":0,"callCount":0,"conversionRate":0,"joinedOn":"2026-10-02","lastActive":"Not signed in"}}` with HTTP 201.

Admin PUT `/users/index.php?id=<executiveId>` uses the same required name/email/phone plus optional `active` (defaults true) and optional `password` (if present, at least 12 characters). Admin DELETE `/users/index.php?id=<executiveId>` deactivates an Executive; it does not delete the row. Admin cannot edit/deactivate an Admin via this route. Errors include 403 role, 404 missing/non-executive id, 409 duplicate email/phone, 419 CSRF, 422 validation.

## Dashboard and Reports

### Dashboard — `/reports/dashboard.php?range=7d`

GET for Admin and Calling Executive. Optional `range`: `7d` (default), `30d`, `90d`; unrecognized values fall back to 7 days. Response `data` contains `customers`, `leads`, `calls`, `followups`, `bookings`, `tasks`, `users`, `activities`, `callsOverTime`, `leadsOverTime`, `leadFunnel`, `bookingTrends`, `executivePerformance`, `leadSourceDistribution`. Admin receives global accessible lists/team and activities; Executive receives ownership-filtered records and self-only user/activity data. No pagination. Sample shape: `{"success":true,"data":{"customers":[],"leads":[],"calls":[],"followups":[],"bookings":[],"tasks":[],"users":[],"activities":[],"callsOverTime":[{"day":"Fri","calls":0,"answered":0}],"leadsOverTime":[{"week":"Sep 28","leads":0,"converted":0}],"leadFunnel":[{"stage":"New","value":0,"color":"#0f172a"}],"bookingTrends":[{"month":"Oct","bookings":0,"revenue":0}],"executivePerformance":[],"leadSourceDistribution":[]}}`.

### Reports — `/reports/index.php?range=30d`

Admin only. Optional range: `7d`, `30d` (default), `90d`, `12m`; unrecognized values use 30 days. `data` keys: `callPerformanceByExec`, `leadConversionBySource`, `customerAcquisition`, `followUpCompletion`, `bookingTrends`, `executivePerformance`. There is no report export or custom date range endpoint. Example: `{"success":true,"data":{"callPerformanceByExec":[],"leadConversionBySource":[],"customerAcquisition":[],"followUpCompletion":[],"bookingTrends":[],"executivePerformance":[]}}`.

## Common Errors and HTTP Statuses

All JSON error responses use `{"success":false,"message":"Human-readable reason."}` unless a route explicitly streams media or returns 204.

| Status | Meaning in this API |
|---|---|
| 200 | Successful GET/update/action |
| 201 | Successful resource/user creation or lead conversion |
| 204 | CORS OPTIONS preflight |
| 400 | Malformed JSON, missing/invalid identifier, or invalid request shape |
| 401 | Missing/expired session, invalid login, or incorrect current password |
| 403 | Role, record ownership, or configured CORS origin denied |
| 404 | Record/route/file not found |
| 405 | Unsupported method or write to read-only endpoint |
| 409 | Duplicate/foreign-key conflict, invalid state transition, or already-converted lead |
| 416 | Invalid/out-of-range media byte range (no JSON body) |
| 419 | Missing/invalid/expired CSRF token |
| 422 | Input validation/business rule failure |
| 500 | Database or persistence/file handling failure |

Examples: `{"success":false,"message":"Your session has expired. Please sign in again."}` (401), `{"success":false,"message":"Your security token is invalid or expired. Refresh and try again."}` (419), `{"success":false,"message":"Booking cannot move from Enquiry to Assigned."}` (409), `{"success":false,"message":"Enter a valid mobile number."}` (422). Exact message varies by validation path.

## Database Mapping

| API module | MySQL tables | Key relationships |
|---|---|---|
| Authentication, profile, preferences, users | `users` | Session user ID; role/status controls login; preferences stored as JSON text |
| Customers | `customers`, `users`, `bookings`, `calls` | Customer assigned/created by user; bookings and calls may reference customer |
| Leads | `leads`, `users`, `follow_ups`, `customers` | Lead assigned/created by user; follow-ups may reference lead; conversion links created customer |
| Follow-ups | `follow_ups`, `customers`, `leads`, `users` | Nullable customer or lead foreign key; assigned user |
| Bookings | `bookings`, `customers`, `leads`, `users` | Nullable customer/lead references; assigned user and creator; booking code generated from row ID |
| Calls | `calls`, `customers`, `leads`, `users`, `follow_ups`, `recordings` | Call relates to customer or lead, executive, optional follow-up; recordings reference calls |
| Recordings | `recordings`, `calls`, `customers`, `leads`, `users` | Recording belongs to call; storage path in DB, bytes stored on server filesystem |
| Tasks | `tasks`, `users`, optionally customer/lead/booking | Related entity is polymorphic (`related_type`/`related_id`), no FK for that pair |
| Notifications | `notifications`, `users` | Each notification belongs to one user |
| Activities | `activities`, `users` | Actor is a user; entity type/id is polymorphic, not a foreign key |
| Dashboard/reports | Above tables | Aggregates the same permission-scoped CRM records; reports endpoint is Admin-only |

IDs are integer primary keys in MySQL and usually serialized as strings by resource APIs. Mobile clients should treat IDs as opaque strings, retain `customerOrLeadType` with related ID, and send timestamps as ISO 8601 values with timezone. MySQL stores date-times without a timezone; backend PHP timezone/server configuration determines parsing. No API pagination contract exists.

## Environment and Deployment

Backend database settings are read from `DB_HOST`, `DB_NAME` (defaults `gd_ai_cab_crm`), `DB_USER`, and `DB_PASSWORD`. Other relevant settings: `CORS_ALLOWED_ORIGINS`, `SESSION_SECURE`, `SESSION_SAME_SITE`, `SESSION_COOKIE_DOMAIN`, and `RECORDINGS_DIRECTORY`. The repository's local launch instructions use `php -S localhost:8000 -t backend`. There is no production deployment/base URL verified in this project.

Admin may filter call history with `?executiveId=<executiveId>`.

Admin may filter recording metadata with `?executiveId=<executiveId>`. Each response includes its related `callId`.

Admin may filter one Executive's history with `?userId=<executiveId>`; results include actions by that Executive and Admin actions against the Executive's user row. Activity responses include `actorId`, and user-management events use `relatedType: User`.

Admin may request `?activeExecutives=1` to fetch only active Calling Executives for lead assignment.
