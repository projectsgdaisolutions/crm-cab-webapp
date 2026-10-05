# CAB CRM API implementation status

Based on the supplied repository API documentation, this package now includes the previously missing areas.

## Added
- Notes create/list
- Recording upload
- Bulk call-log sync
- Driver/captain directory: `GET/POST/PUT /api/drivers/index.php`
- Vehicle registry: `GET/POST/PUT /api/vehicles/index.php`
- Booking driver/vehicle assignment: `PUT /api/bookings/assign-driver.php`
- Mobile device push-token registration/unregistration: `/api/mobile/devices.php`
- Notification delivery queue endpoint: `POST /api/mobile/push.php` (creates CRM notification; actual FCM/APNs delivery requires provider credentials/configuration)
- Server-side pagination/search/status/date filtering on existing CRM collection endpoints using `page`, `limit`, `search`/`q`, `status`, `dateFrom`, `dateTo`; pagination metadata is returned in `X-Total-Count`, `X-Page`, `X-Page-Size`, `X-Total-Pages`.
- Server-side CSV report export: `GET /api/reports/export.php?resource=...&format=csv`
- Granular role permission management: `GET/PUT /api/permissions/index.php`
- Public registration: `POST /api/auth/register.php`

## Still environment-dependent
- Production HTTPS API host is still pending.
- FCM/APNs delivery cannot occur until a provider/service and credentials are configured.
- The supplied documentation did not define a detailed production contract for the new driver, vehicle, permission, registration, or push-provider features; therefore the new routes use the documented existing session/CSRF/auth conventions and the request/response shapes are recorded in this package.


## Server-side collection parameters
For customers, leads, followups, bookings, calls, recordings, tasks and activities, collection GET requests accept:
`page`, `limit` (1-200), `search`/`q`, `status`, `dateFrom`, `dateTo`. Existing calls without these parameters retain the original unpaged response shape.

## New route request examples
- `GET /drivers/index.php?search=Rahul&status=active`
- `GET /vehicles/index.php?search=DL01&status=active`
- `PUT /bookings/assign-driver.php?id=123` body `{ "driverId": "7", "vehicleId": "12" }`
- `POST /mobile/devices.php` body `{ "deviceToken": "...", "platform": "android", "appVersion": "1.0.0" }`
- `POST /auth/register.php` body `{ "name": "User", "email": "user@example.com", "phone": "...", "password": "minimum-12-chars" }`
- `PUT /permissions/index.php` body `{ "role": "executive", "permissionKey": "reports.view", "allowed": true }`
- `GET /reports/export.php?resource=calls&format=csv&dateFrom=2026-10-01&dateTo=2026-10-31`
