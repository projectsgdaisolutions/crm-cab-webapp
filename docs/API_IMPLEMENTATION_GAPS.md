# API Implementation Gaps for Mobile Integration

This is an audit of the code currently present in the repository. Items below are unimplemented or require an environment/mobile decision; no backend changes are proposed as if already available.

## Release Blockers / Decisions

| Area | Current verified behavior | Work needed before production/mobile release |
|---|---|---|
| Production API host | No deployed backend URL is configured. `.env.example` contains a comment about a possible future `https://api.gdaisolutions.com/v1`; no matching `/v1` route exists. | Backend/operations team must provide a deployed HTTPS base URL and configure mobile environments. |
| Mobile authentication | PHP session cookie plus CSRF token; fixed 8-hour expiry. No JWT, bearer token, refresh endpoint, or API key. | Mobile team must verify cookie storage/sending and logout clearing on iOS and Android. If stable native cookie support is not available, backend auth architecture would need an explicit approved change; do not emulate bearer auth client-side. |
| CORS / deployment | Credentials enabled. Default CORS origins allow only local Vite web origins. | Configure `CORS_ALLOWED_ORIGINS` for browser-based testing origins; use HTTPS and secure session cookies for production. Native requests without Origin do not receive browser CORS behavior, but cookie/preflight still needs testing. |
| End-to-end mobile verification | Repository contains the React web app and PHP backend, not a React Native app or its platform configuration. | Validate login → session restore → CSRF-protected mutation → logout on both mobile platforms against a reachable server. |

## Missing APIs

- **Driver/captain directory and assignment:** no driver/captain MySQL table, search/list endpoint, vehicle registry, or assignment endpoint exists. A booking stores `driverVehicleDetails` as free text. The mobile client can display/edit that field, but must not assume it can look up drivers by ID/name.
- **Recording upload:** recording metadata/media retrieval exists; no recording upload/create endpoint exists.
- **Password recovery/admin reset endpoint:** users can change their own password with the current password; there is no forgot-password, email/OTP reset, or public recovery API. Admin may reset an Executive password only through the Admin users PUT endpoint.
- **User registration:** no public signup endpoint. Admin can create Calling Executive accounts through `/users/index.php`.
- **Mobile push registration/delivery:** notification read/list APIs exist; no device-token registration or push delivery endpoint exists.
- **Pagination and general server-side search/filter:** CRM resource list APIs return all records visible to the user. They support optional `?id=<id>` for a single record, not `page`, `limit`, search text, date filters, or status filters. Notifications alone are capped at 100. Reports use fixed `range` values only.
- **Booking driver records:** booking API does not associate a typed driver ID or vehicle ID; `driverVehicleDetails` is a free-form text field. No driver/captain selection should be implemented until a backend data/API contract is added.

## Implemented but Restricted / Incomplete for Some Mobile Roles

- `/recordings/index.php` and `/recordings/media.php` require Admin, even though the recording table has access levels including `Public` and `Manager`. Executive access is blocked by the route-level role check. Confirm this is intended before exposing recordings in an Executive mobile experience.
- `/reports/index.php` is Admin-only. `/reports/dashboard.php` is available to Admin and Calling Executive and scopes records for Executives.
- `/auth/profile.php` is Admin-only. Calling Executives have no profile update endpoint in this backend; they can change their password and preferences.
- `/users/index.php` returns all Admin/Executive users to Admin, but a Calling Executive receives only their own user object in a one-element list. Only Admin can create/update/deactivate users.
- The database enum includes `manager`, but login and `requireRole` application access support only `admin` and `executive`; Manager login is denied.
- Generic CRM `PATCH` requests are accepted but call the same complete field validation and write path as PUT. They are not partial updates. Mobile should use PUT with a complete resource body unless this API contract is deliberately changed.
- Generic DELETE permanently deletes customer/lead/follow-up/booking/call/task records (subject to DB cascade/set-null relations). User DELETE is different: it deactivates a Calling Executive and retains the row. Mobile UX must not treat these as equivalent.
- Authenticated sessions expire after 8 hours from login; no sliding expiration or renewal API exists. A mobile app must handle 401 by re-authenticating.
- The generic resource APIs do not return a formal OpenAPI schema, request IDs, or consistent field-level validation map. Most validation errors are a single message string.
- API date strings are parsed by PHP `strtotime` and written into MySQL `DATETIME` fields, which contain no timezone. Production PHP timezone and the desired mobile timestamp convention should be agreed and tested.

## Existing Environment / Data Setup

- Local development base URL: `http://localhost:8000/api` only when the PHP server is launched as documented. A physical device cannot normally use its own `localhost` to reach the developer computer.
- Production backend URL: pending. The future URL comment in `.env.example` is not a verified deployment.
- Required backend DB env: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Additional settings: `CORS_ALLOWED_ORIGINS`, `SESSION_SECURE`, `SESSION_SAME_SITE`, `SESSION_COOKIE_DOMAIN`, and `RECORDINGS_DIRECTORY`.
- New database install uses `backend/database/schema.sql`; existing database updates use the repository migration described in `README.md`. Coordinate any deployment schema changes with the backend owner; the mobile API documentation task did not change backend logic/schema.
- Do not send database credentials, user passwords, session cookies, or real CSRF tokens in source control, Postman exports, or documentation.

## Ready for Integration

The following are implemented and described in `MOBILE_API_DOCUMENTATION.md`: login/session inspection/logout/password change; customer, lead, follow-up, booking, call, and task CRUD; lead conversion; Admin-only user management; preferences; activities; notifications list/read; dashboard; Admin reports; recording metadata and Admin media streaming.

Before calling a module mobile-ready, exercise it with real Admin and Calling Executive sessions and verify ownership/role failures. In particular, the React Native app must first prove session-cookie and CSRF behavior on both platforms. The code-derived contracts are documented; a deployed host and successful native end-to-end test are still pending.
