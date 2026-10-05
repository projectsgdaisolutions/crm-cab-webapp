# CAB CRM Calling Executive Test Report

**Audit date:** 2026-10-02

**Initial implementation status:** Session login, role-gated routes, role-scoped backend lists, and Admin-only areas are present. Verified UI gaps included missing Executive dashboard totals, a misleading notification footer/stale panel, no call-log create UI despite an existing API, follow-up edit/reschedule not exposed, and Executive preferences hidden behind an Admin-only route. The first fix was the notification panel; it now uses the existing per-user list/read APIs, shows unread counts/loading/errors, refreshes on open and periodically, and no longer links to Follow-ups as if that were a notification inbox.

## Verification Legend

All checklist boxes start unchecked so the Executive team can tick them during browser testing. `PASS` means that specific test was actually executed; it does not imply that unexecuted browser steps are complete. `NOT TESTED` means code was inspected or built, but the stated runtime/browser workflow was not exercised. `BLOCKED` means credentials, a provider, or another external prerequisite is unavailable.

## Test Environment and Evidence

- Live MySQL connection succeeded. The database contains four active Calling Executive accounts and non-empty customer/lead/follow-up/booking/task data. No names or credentials were read for this report.
- The shared backend list helper was invoked for four active Executive IDs. Results were isolated by its owner filters: one Executive received 3 customers/3 leads, another 0 customers/1 lead, another 0 customers/1 lead, and another 1 customer/0 leads. This tests the SQL list scoping only; it does **not** test login/session authorization or two authenticated accounts.
- A live unauthenticated `GET /api/bookings/index.php` returned HTTP 401. A temporary local PHP server was stopped after the request.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. PHP syntax checks passed for auth, CRM helpers, notifications, and calls. Editor diagnostics found no errors in changed files.
- No authenticated browser session or Executive passwords were provided. No CRM records or accounts were created/updated/deleted for testing.

## Login and Access

- [ ] **Status: NOT TESTED** Executive login with that Executive's own credentials. **Observed:** Login accepts email/mobile and password, creates an HTTP-only PHP session, and returns a CSRF token. **Manual steps:** Sign in with an active Executive account; verify the session and user role in `/auth/me.php`. **Reference:** [AuthContext](../src/auth/AuthContext.tsx), [login endpoint](../backend/api/auth/login.php).
- [ ] **Status: NOT TESTED** Executive is redirected to the Executive dashboard. **Observed:** Login navigates to `/`; the root route redirects by the authenticated role to `/executive/dashboard`. **Manual steps:** Sign in as Executive and confirm the dashboard URL/content. **Reference:** [App routes](../src/App.tsx), [LoginPage](../src/features/auth/LoginPage.tsx).
- [ ] **Status: PASS** Unauthenticated direct API access is rejected. **Observed:** Live `GET /api/bookings/index.php` returned 401. **Reproduce:** Clear the PHP session cookie and request that endpoint. **Reference:** [auth middleware](../backend/middleware/auth.php), [bookings route](../backend/api/bookings/index.php).
- [ ] **Status: PASS (helper-level only)** Backend customer/lead list filters return records scoped to the supplied Executive actor. **Observed:** The live `crmList` ownership filter returned different counts for four real Executive IDs. **Manual steps:** Sign in as two Executives with distinct assignments and compare Customers and Leads; verify no cross-account records. **Caveat:** The helper check did not exercise session authentication or the HTTP endpoint. **Reference:** [CRM ownership filters](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Admin access remains available and Executive cannot open Admin-only pages by direct URL. **Observed:** `/reports`, `/team`, `/settings` Admin controls, and `/recordings` are guarded in React; backend has separate role gates. **Manual steps:** Try those URLs as Executive and call their APIs directly; repeat as Admin. **Reference:** [App routes](../src/App.tsx), [PHP role middleware](../backend/middleware/auth.php).

## Executive Dashboard

- [ ] **Status: NOT TESTED** Assigned lead, New lead, converted lead, and assigned customer totals match the Executive's API-visible records. **Observed:** Executive KPI cards now derive from the permission-scoped dashboard arrays. **Manual steps:** Compare card values with `/reports/dashboard.php` arrays and `/leads`/`/customers`. **Reference:** [DashboardPage](../src/features/dashboard/DashboardPage.tsx), [dashboard API](../backend/api/reports/dashboard.php).
- [ ] **Status: NOT TESTED** Pending, today's, and completed follow-up counts match backend-visible follow-ups. **Observed:** New KPI values are calculated from the scoped follow-up list. **Manual steps:** Compare each card with filtered follow-ups for the same Executive and local date. **Timezone caveat:** PHP server and browser timezone may differ. **Reference:** [DashboardPage](../src/features/dashboard/DashboardPage.tsx).
- [ ] **Status: NOT TESTED** Today's call count and answered/missed figures match call history. **Observed:** Values derive from the scoped call records. **Manual steps:** Compare today's local-date calls and outcomes in Call History. **Reference:** [DashboardPage](../src/features/dashboard/DashboardPage.tsx), [CallsPage](../src/features/calls/CallsPage.tsx).
- [ ] **Status: NOT TESTED** Dashboard refreshes when returning to the browser tab. **Observed:** Focus event triggers a fresh dashboard request. **Manual steps:** Change a record in another tab/page, return to dashboard, and verify counts update. **Reference:** [DashboardPage](../src/features/dashboard/DashboardPage.tsx).
- [ ] **Status: NOT TESTED** Dashboard loading, API failure, retry, and zero-record states are usable. **Observed:** Skeleton loading and an error/retry banner are implemented; empty metrics render as zero. **Manual steps:** Test with an empty account and with the API stopped/unreachable. **Reference:** [DashboardPage](../src/features/dashboard/DashboardPage.tsx).
- [ ] **Status: NOT TESTED** Dashboard layout works at desktop and mobile widths. **Manual steps:** Test at desktop width and a narrow phone viewport; inspect card/chart overflow. **Reference:** [DashboardPage](../src/features/dashboard/DashboardPage.tsx).

## Customer Management

- [ ] **Status: NOT TESTED** Executive sees only permitted customers and can search by name, phone, or email and filter by status. **Observed:** The page consumes the scoped customers endpoint and applies those filters locally. **Manual steps:** Compare results against another Executive account. **Reference:** [CustomersPage](../src/features/customers/CustomersPage.tsx), [customer API](../backend/api/customers/index.php).
- [ ] **Status: NOT TESTED** Executive can view a permitted customer's complete details. **Observed:** Customer detail page is protected and loads customer/related data from APIs. **Manual steps:** Open a permitted customer and verify fields and related records. **Reference:** [CustomerDetailPage](../src/features/customers/CustomerDetailPage.tsx).
- [ ] **Status: NOT TESTED** Executive can update an assigned customer and the data persists after refresh. **Observed:** Save uses PUT; backend validates ownership and assigns Executive edits to the authenticated Executive. **Manual steps:** Change a field, save, refresh, and reopen. **Reference:** [CustomerForm](../src/features/customers/CustomerForm.tsx), [CustomersPage](../src/features/customers/CustomersPage.tsx), [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Customer phone and optional email validation accept/reject expected values. **Observed:** Form now accepts 7–15 phone digits with common punctuation and blank email; nonblank email must validate. **Manual steps:** Try valid international/local numbers, too-short/long values, blank email, and malformed email. **Reference:** [CustomerForm](../src/features/customers/CustomerForm.tsx).
- [ ] **Status: NOT TESTED** Executive cannot update another Executive's customer by direct API request. **Observed:** Mutation calls `crmAssertOwned`; unauthenticated requests return 401. **Manual steps:** Use two Executive sessions and PUT the other user's customer ID; expect 403. **Reference:** [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Customer save failure is visible and does not close/discard the form. **Observed:** Parent catches API errors and shows a toast; form awaits the Promise. **Manual steps:** Submit while API is unavailable and verify the modal/values remain. **Reference:** [CustomersPage](../src/features/customers/CustomersPage.tsx), [CustomerForm](../src/features/customers/CustomerForm.tsx).

## Lead Management

- [ ] **Status: NOT TESTED** Executive sees only assigned leads and can search/filter the visible set. **Observed:** Lead list is returned by the ownership-scoped PHP API; UI searches and filters locally. **Manual steps:** Compare two Executive accounts. **Reference:** [LeadsPage](../src/features/leads/LeadsPage.tsx), [lead API](../backend/api/leads/index.php).
- [ ] **Status: NOT TESTED** Lead status can move only through the permitted transition and persists after refresh. **Observed:** UI transition map and backend transition validator both restrict progression. **Manual steps:** Move New → Contacted → Follow-up → Interested → Booking Confirmed; attempt an invalid jump. **Reference:** [LeadsPage](../src/features/leads/LeadsPage.tsx), [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Lead remarks/notes save through edit and remain after refresh. **Observed:** Form sends `remarks`; API writes to `leads.notes`. **Manual steps:** Add a remark, save, refresh, reopen. **Reference:** [LeadForm](../src/features/leads/LeadForm.tsx), [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Lead follow-up date can be scheduled and associated to the correct lead/Executive. **Observed:** Lead update synchronizes a `follow_ups` record; Executive identity/assignment is checked by backend. **Manual steps:** Set a follow-up date, save, and find it under Follow-ups. **Reference:** [LeadForm](../src/features/leads/LeadForm.tsx), [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Follow-up completion updates linked lead state/data as implemented. **Observed:** API completes pending follow-ups on the existing Follow-up → Interested lead transition. **Manual steps:** Exercise the transition and inspect both records after refresh. **Reference:** [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Lead conversion succeeds only for an eligible Booking Confirmed lead and persists the customer. **Observed:** Conversion endpoint enforces status/ownership and is wired in the Leads UI. **Manual steps:** Convert an eligible test lead, refresh both lists, then try converting it again. **Reference:** [convert endpoint](../backend/api/leads/convert.php), [LeadsPage](../src/features/leads/LeadsPage.tsx).

## Follow-up Management

- [ ] **Status: NOT TESTED** Today's, overdue, upcoming, completed, and rescheduled follow-ups appear in the correct list/calendar sections. **Observed:** UI now renders these status/date groups. **Manual steps:** Create records at past/today/future times and inspect list and calendar views. **Reference:** [FollowUpsPage](../src/features/followups/FollowUpsPage.tsx).
- [ ] **Status: NOT TESTED** Executive-created follow-ups are assigned to that Executive. **Observed:** Executive assignment selector is hidden; backend sets `assigned_to` to the session user. **Manual steps:** Create while logged in as Executive and verify returned/API record assignment. **Reference:** [FollowUpsPage](../src/features/followups/FollowUpsPage.tsx), [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Follow-up creation for an accessible Customer or Lead saves time/channel/priority/notes. **Observed:** Form calls existing POST and backend validates relation ownership and date. **Manual steps:** Create one for each relation type and refresh. **Reference:** [FollowUpsPage](../src/features/followups/FollowUpsPage.tsx).
- [ ] **Status: NOT TESTED** Follow-up can be edited/rescheduled and status persists. **Observed:** Existing PUT service is now exposed by an edit/reschedule control and sends the complete resource body. **Manual steps:** Change time/notes/status and refresh. **Reference:** [FollowUpsPage](../src/features/followups/FollowUpsPage.tsx), [service](../src/services/index.ts).
- [ ] **Status: NOT TESTED** Mark complete/cancel actions persist and show useful errors on failure. **Observed:** Existing status update endpoints are used with local state updates and error toasts. **Manual steps:** Complete/cancel records, refresh; repeat with the API unavailable. **Reference:** [FollowUpsPage](../src/features/followups/FollowUpsPage.tsx).
- [ ] **Status: NOT TESTED** Executive cannot update another Executive's follow-up. **Observed:** Backend checks `assigned_to`. **Manual steps:** Attempt PUT by ID from a second Executive session; expect 403. **Reference:** [CRM helper](../backend/helpers/crm_api.php).

## Outbound Calling and Telephony

- [ ] **Status: BLOCKED** Real outbound calls can be initiated from this CRM. **Observed:** No telephony provider SDK/configuration or call-initiation endpoint exists. The new form only logs an outcome and explicitly says it does not place a call. **Required dependency:** Select and configure an approved telephony provider/native integration and define its callback/webhook contract. **Reference:** [CallsPage](../src/features/calls/CallsPage.tsx), [API gaps](API_IMPLEMENTATION_GAPS.md).
- [ ] **Status: NOT TESTED** Manually recorded outbound call relates to an accessible Customer/Lead and stores timestamp, status, duration, and notes. **Observed:** New form sends these fields to existing `POST /calls/index.php`; backend assigns the authenticated Executive. **Manual steps:** Log an outcome and verify the call history after refresh. **Reference:** [CallsPage](../src/features/calls/CallsPage.tsx), [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Failed call-log submission shows an error and does not report success. **Observed:** API failure is caught and shown via toast. **Manual steps:** Submit with API unavailable or invalid relation. **Reference:** [CallsPage](../src/features/calls/CallsPage.tsx).

## Incoming Calls

- [ ] **Status: BLOCKED** Business-number routing assigns incoming calls to the correct Executive. **Observed:** No provider integration, business-number configuration, webhook, or routing endpoint exists. **Required dependency:** Telephony provider, number provisioning, routing rules, and authenticated webhook/API contract. **Reference:** [calls API](../backend/api/calls/index.php), [schema](../backend/database/schema.sql).
- [ ] **Status: NOT TESTED** Incoming call outcome can be manually logged with `Incoming` direction. **Observed:** Call-log form supports Incoming and existing API stores direction. **Manual steps:** Create an Incoming record and verify history. **Reference:** [CallsPage](../src/features/calls/CallsPage.tsx).
- [ ] **Status: BLOCKED** Caller ID lookup/pop-up and missed-call assignment are delivered in real time. **Observed:** No provider event or live routing/polling API exists. **Required fix:** Provider integration and event delivery; do not treat manual call entry as incoming-call handling. **Reference:** [calls API](../backend/api/calls/index.php).

## Call History and Recordings

- [ ] **Status: NOT TESTED** History displays direction, date/time, duration, related record, and call outcome; filters/search work. **Observed:** These fields and client-side filters exist; API list is owner-scoped. **Manual steps:** Create several outcomes and verify filters/search. **Reference:** [CallsPage](../src/features/calls/CallsPage.tsx).
- [ ] **Status: NOT TESTED** Executive can record call outcomes with notes. **Observed:** Manual call form is implemented against the existing POST API. **Manual steps:** Submit as Executive and refresh history. **Reference:** [CallsPage](../src/features/calls/CallsPage.tsx).
- [ ] **Status: PASS (code inspection)** Recording list/media are Admin-only; the change did not weaken these guards. **Observed:** React route and PHP routes both require Admin. **Manual steps:** Try direct recording URL/API as Executive and Admin. **Reference:** [App routes](../src/App.tsx), [recording media route](../backend/api/recordings/media.php).
- [ ] **Status: BLOCKED** Executive recording playback/download. **Observed:** Calling Executives are denied, even though DB access-level values include Public/Manager. No permission change was requested or made. **Required decision:** Confirm whether Executive access is required, then approve and implement a matching backend rule. **Reference:** [gaps report](API_IMPLEMENTATION_GAPS.md).
- [ ] **Status: BLOCKED** Recording capture/upload from a device. **Observed:** No upload endpoint/provider is present; UI depends on files already on the server. **Required dependency:** Approved capture source, upload/auth contract, storage limits, and retention policy. **Reference:** [recordings API](../backend/api/recordings/index.php), [media route](../backend/api/recordings/media.php).

## Booking Management

- [ ] **Status: NOT TESTED** Executive can view only permitted bookings and create/edit within ownership. **Observed:** Frontend uses booking endpoints; backend filters and checks owner/creator. **Manual steps:** Create and edit an assigned booking, refresh, then try another Executive's ID. **Reference:** [BookingsPage](../src/features/bookings/BookingsPage.tsx), [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Booking status update follows the backend workflow and persists. **Observed:** Current booking implementation validates `Enquiry → Confirmed → Assigned → Completed/Cancelled`. **Manual steps:** Move a test booking through allowed transitions and attempt an invalid jump. **Reference:** [BookingsPage](../src/features/bookings/BookingsPage.tsx), [booking API](../backend/api/bookings/index.php).
- [ ] **Status: PASS (code inspection)** Driver/vehicle details are free text; no fake driver directory/assignment flow was added. **Observed:** There is no driver entity or endpoint in the schema/API. **Required backend work:** Define driver/vehicle tables, ownership/access model, and search/assignment routes if selection is required. **Reference:** [schema](../backend/database/schema.sql), [API gaps](API_IMPLEMENTATION_GAPS.md).
- [ ] **Status: NOT TESTED** Booking date/time/customer/remarks persist and survive refresh. **Observed:** Existing form/API supports these fields and response mapping. **Manual steps:** Save a booking, refresh, reopen, compare returned values. **Reference:** [BookingForm](../src/features/bookings/BookingForm.tsx), [CRM helper](../backend/helpers/crm_api.php).

## Notifications

- [ ] **Status: NOT TESTED** Panel loads the signed-in user's notifications, shows loading/error/empty states, and refreshes on open/interval. **Observed:** Implemented using existing GET API; API selects by session `user_id`, max 100. **Manual steps:** Open with notifications, empty account, and API offline; reopen after state changes. **Reference:** [TopNav](../src/components/layout/TopNav.tsx), [notifications API](../backend/api/notifications/index.php).
- [ ] **Status: NOT TESTED** Unread count matches notifications and updates after reading. **Observed:** Count derives from `read` values; mark-one and mark-all update client state only after successful PATCH. **Manual steps:** Mark one/all read, inspect badge, reload. **Reference:** [TopNav](../src/components/layout/TopNav.tsx).
- [ ] **Status: NOT TESTED** Notification state persists after refresh. **Observed:** Backend stores `is_read` in MySQL and reads it by user ID. **Manual steps:** Mark read, reload the app, verify. **Reference:** [notifications API](../backend/api/notifications/index.php), [schema](../backend/database/schema.sql).
- [ ] **Status: NOT TESTED** One Executive cannot read/mark another Executive's notification. **Observed:** GET and PATCH SQL are scoped by authenticated `user_id`. **Manual steps:** Use two sessions and try marking the other user's notification ID; expect not-found/no access. **Reference:** [notifications API](../backend/api/notifications/index.php).
- [ ] **Status: BLOCKED** Notification deep-link navigation. **Observed:** API response has no target entity type/id or route, so panel does not invent a destination. **Required backend change:** Define target metadata and validate per-user access before adding deep links. **Reference:** [notifications schema/API](../backend/api/notifications/index.php), [schema](../backend/database/schema.sql).
- [ ] **Status: NOT TESTED** Notification generation on existing events. **Observed:** Backend generates in-app notifications for lead creation/assignment/status/follow-up and lead conversion. No call, booking, or task notification generation was found. **Manual steps:** Trigger the supported lead events and inspect the owning user's panel; verify missing-event requirements with product/backend owner. **Reference:** [CRM helper](../backend/helpers/crm_api.php), [lead conversion](../backend/api/leads/convert.php).
- [ ] **Status: BLOCKED** Mobile push notifications. **Observed:** No device-token registration or push delivery exists. **Required dependency:** Push provider, device registration API, credentials/configuration, opt-in handling, and delivery/retry logic. **Reference:** [API gaps](API_IMPLEMENTATION_GAPS.md).

## Tasks and Activity History

- [ ] **Status: NOT TESTED** Executive can list/create/update/complete assigned tasks and changes persist. **Observed:** Existing Tasks UI uses the task CRUD API; backend filters assigned records and checks owner on mutation. **Manual steps:** Create, complete, refresh, and reopen a task. **Reference:** [TasksPage](../src/features/tasks/TasksPage.tsx), [tasks API](../backend/api/tasks/index.php).
- [ ] **Status: NOT TESTED** Executive cannot update another Executive's task. **Observed:** Backend ownership check uses `assigned_to` or `created_by`; list is assignment scoped. **Manual steps:** Attempt update by another Executive's task ID; expect 403. **Reference:** [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Accessible activity history is visible for supported records. **Observed:** Activity API supports read/list and applies Executive scoping; customer detail consumes it. **Manual steps:** Open an accessible customer/lead and verify related recent events. **Reference:** [activities API](../backend/api/activities/index.php), [CustomerDetailPage](../src/features/customers/CustomerDetailPage.tsx).
- [ ] **Status: NOT TESTED** Mutations generate activity records. **Observed:** Shared CRUD writes activity rows for successful mutations; this was not verified by a signed-in database mutation. **Manual steps:** Perform a permitted create/update and confirm the actor/entity entry. **Reference:** [CRM helper](../backend/helpers/crm_api.php).

## Profile, Preferences, and Session

- [ ] **Status: NOT TESTED** Executive profile details are visible and preferences can be saved/reloaded. **Observed:** Executive now sees read-only self details and existing per-user preferences UI; preference API is available to both roles. **Manual steps:** Change a preference, save, reload, verify. **Reference:** [SettingsPage](../src/features/settings/SettingsPage.tsx), [preferences API](../backend/api/auth/preferences.php).
- [ ] **Status: PASS (code inspection)** Executive profile update remains unavailable and Admin-only; no permission was widened. **Observed:** PHP `/auth/profile.php` requires Admin; Executive UI exposes profile read-only. **Reference:** [profile API](../backend/api/auth/profile.php), [SettingsPage](../src/features/settings/SettingsPage.tsx).
- [ ] **Status: NOT TESTED** Executive can change password with current-password validation. **Observed:** Account Security calls existing POST password API; backend checks current hash and requires new password of at least 12 characters. **Manual steps:** Try valid change and invalid current password. **Reference:** [AccountSecurityPage](../src/features/auth/AccountSecurityPage.tsx), [password API](../backend/api/auth/password.php).
- [ ] **Status: NOT TESTED** Logout clears session/CSRF client state and redirects to login. **Observed:** Logout endpoint destroys PHP session; AuthContext clears user and CSRF token, protected routes redirect. **Manual steps:** Sign out, verify `/auth/me.php` returns 401, reload protected URL. **Reference:** [AuthContext](../src/auth/AuthContext.tsx), [logout API](../backend/api/auth/logout.php).
- [ ] **Status: NOT TESTED** Expired session is handled. **Observed:** Backend expiry is fixed at 8 hours; Axios handles 401 and client clears auth state. **Manual steps:** Wait/expire session or clear server session, issue protected request. **Reference:** [session config](../backend/config/session.php), [API client](../src/services/apiClient.ts).

## UI, Validation, and Error Handling

- [ ] **Status: NOT TESTED** Notification, customer, follow-up, and call mutations show success/error states and prevent repeated submission where implemented. **Observed:** Notifications have API error/retry handling; customer and call forms use saving/loading states; follow-up mutations catch errors. **Manual steps:** Test valid and invalid requests and double-click save. **References:** [TopNav](../src/components/layout/TopNav.tsx), [CustomerForm](../src/features/customers/CustomerForm.tsx), [FollowUpsPage](../src/features/followups/FollowUpsPage.tsx), [CallsPage](../src/features/calls/CallsPage.tsx).
- [ ] **Status: NOT TESTED** Executive pages fit desktop and narrow mobile widths with no clipping/overlap. **Observed:** Responsive classes exist; no browser/device screenshots were run. **Manual steps:** Test widths around 375px and desktop width. **Reference:** Changed feature pages linked above.
- [ ] **Status: NOT TESTED** Browser console/network has no API failures during Executive workflows. **Observed:** No authenticated browser session was available. **Manual steps:** Follow workflow using DevTools Network/Console and record failing request/status. **Reference:** `VITE_API_BASE_URL` and PHP backend configuration.
- [ ] **Status: PASS** Frontend static checks. **Observed:** `npm run typecheck`, `npm run lint`, and `npm run build` completed successfully after changes. **Reference:** project scripts in [package.json](../package.json).
- [ ] **Status: PASS** Changed PHP syntax checks. **Observed:** `php -l` passed for CRM helper, notifications, calls, login, and auth middleware. No backend code was changed.

## Backend, Database, and Security

- [ ] **Status: PASS** Database connectivity. **Observed:** `backend/test-db.php` reported successful connection; read-only aggregate queries executed.
- [ ] **Status: PASS** Unauthenticated protected API request. **Observed:** Local PHP server returned 401 for `GET /api/bookings/index.php`; server was stopped after testing.
- [ ] **Status: NOT TESTED** Authenticated requests reject missing/invalid CSRF on writes. **Observed:** Shared CRM/auth handlers call CSRF validation; no authenticated request was made. **Manual steps:** With a valid session omit/change `X-CSRF-Token` on POST/PUT/PATCH/DELETE; expect 419. **Reference:** [auth middleware](../backend/middleware/auth.php), [CORS config](../backend/config/cors.php).
- [ ] **Status: NOT TESTED** Authenticated direct record access rejects another Executive's IDs across customers, leads, follow-ups, bookings, calls, and tasks. **Observed:** Backend has role/owner filters and mutation checks; only list-helper behavior was exercised. **Manual steps:** Use two authenticated accounts and try GET/PUT/DELETE against cross-owned IDs; verify 403/404 as implemented. **Reference:** [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: PASS (list helper only)** DB-backed record list scoping for four Executive actor IDs. **Observed:** Real ownership filters returned distinct owner-specific customer/lead counts. This did not test HTTP authentication or cross-owner mutation denial. **Reference:** [CRM helper](../backend/helpers/crm_api.php).
- [ ] **Status: NOT TESTED** Sensitive session/password data is not exposed in API responses. **Observed:** Login removes password/status before returning; no authenticated response audit was performed. **Manual steps:** Inspect login, `/auth/me.php`, and user list responses; confirm no password/hash/cookie/CSRF token is logged or persisted by client beyond its intended use. **Reference:** [login API](../backend/api/auth/login.php), [users API](../backend/api/users/index.php).

## Completed and Verified Features

- Notification panel API integration, unread counter, mark-one/mark-all, open/poll refresh, loading/error/empty state, and incorrect Follow-ups link removed. Code/build verified; browser/API user flow not yet tested.
- Executive dashboard KPI values now derive from the authenticated dashboard API's scoped record lists; refresh-on-focus and retry/error state added. Code/build verified; browser counts not yet tested.
- Follow-up edit/reschedule and Completed/Rescheduled list sections use existing APIs; Executive assignment selector is hidden because backend assigns to the logged-in Executive. Code/build verified; browser CRUD not yet tested.
- Call outcome form uses existing call POST API and does not claim to place a real call. Call history displays a clear no-provider notice; Admin-only recording restriction is preserved.
- Executive Preferences route exposes only notification/CRM preferences and read-only own profile basics. Admin profile/access screens remain unavailable to Executives.
- Customer form validation now accepts blank email and backend-compatible phone format; save errors retain the form and report a toast.
- No database schema, backend logic, credentials, or user records were changed.

## Failed Checks and Fixes

- Dashboard focused lint initially found an unused error state; a visible retry/error banner was added. Final lint passed.
- An intermediate call page TypeScript check found references from the old illustrative telephony workflow after imports changed; the illustration was removed and replaced with an explicit no-provider notice. Final typecheck/build passed.
- Full lint found one unused `PhoneCall` import after that removal; import was deleted and focused/full lint passed.
- One exploratory SQL command had shell-quoting errors and produced no test result; it was rerun successfully with safe quoting. No database mutation occurred.

## Missing Backend APIs and External Dependencies

- No telephony provider, outbound call initiation, incoming call routing, webhook, or business-number assignment is configured.
- No device recording upload endpoint or mobile push-token registration/delivery endpoint exists.
- No notification target metadata exists for record deep links. Current in-app notification events cover lead assignment/status/follow-up and conversion only; call, booking, and task event generation is absent.
- Executive profile updates are unavailable by design in current backend (`/auth/profile.php` is Admin-only). Executive preference storage and password change APIs exist.
- Executive recording access is Admin-only in PHP and frontend. No permission widening was made.
- No general backend pagination or search/filter APIs exist; page filters operate on the returned visible list.
- No driver/captain directory exists; booking driver/vehicle detail remains free text.
- Production mobile base URL and device cookie persistence are not verified. Sessions are PHP cookie-based, fixed 8 hours, with CSRF on mutations; there is no bearer/refresh-token flow.

## Security and Authorization Findings

- PHP session authentication is checked by backend APIs; the unauthenticated booking request returned 401.
- CRM list endpoints apply Executive ownership filters; mutations call `crmAssertOwned` and relation validators. A direct helper-level database check observed owner-specific results for four Executive IDs.
- Notifications GET/PATCH query by authenticated `user_id`; actual two-session notification isolation was not exercised.
- Recordings, Admin reports, team/user management, and Admin profile writes remain Admin-restricted in both relevant route layers.
- Frontend guards improve navigation but do not replace API authorization. Cross-account HTTP denials need authenticated manual verification.

## Remaining Work by Priority

1. **P0:** Run authenticated browser/API workflow with two existing Executive accounts and one Admin account; verify separate lists and cross-owner denial for each record type. Test credentials are required and were not supplied.
2. **P0:** Validate notification and follow-up mutations in a signed-in browser; confirm MySQL persistence and per-user notification isolation.
3. **P1:** Decide whether Executives need profile editing or recording playback; current backend intentionally denies those APIs.
4. **P1:** Select a telephony provider and define outbound/incoming events, business number routing, webhook authentication, and failure behavior before implementing call initiation/routing.
5. **P1:** Define recording upload/capture and push notification providers/APIs if required; neither integration exists.
6. **P2:** Add notification target metadata/event generation for booking/call/task events only if those workflows require deep links/alerts.
7. **P2:** Test mobile viewport, session-cookie persistence, 8-hour expiry, CSRF handling, and production HTTPS/CORS on target browsers/devices.
