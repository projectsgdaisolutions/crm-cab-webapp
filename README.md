# vehico CRM CAB CRM

React 18, Vite, TypeScript, PHP, and MySQL application for CAB customer operations. The frontend preserves the existing CRM screens and calls the PHP API using an HTTP-only PHP session cookie.

## Project layout

- `frontend/` — React, Vite, and TypeScript web CRM
- `backend/` — PHP API, MySQL schema, and session authentication

## Local setup

1. Install frontend dependencies with `npm install` from the `frontend` folder.
2. Configure `frontend/.env` from `frontend/.env.example`. The example uses `VITE_API_BASE_URL=https://vehicocrm.gdaisolutions.com/api`. For the local PHP server, set `VITE_API_BASE_URL=http://localhost:8000/api` and keep `VITE_API_TIMEOUT=15000`.
3. Configure the PHP server environment with `DB_HOST`, `DB_NAME=gd_ai_cab_crm`, `DB_USER`, `DB_PASSWORD`, and `CORS_ALLOWED_ORIGINS=https://vehicocrm.gdaisolutions.com,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081`.
4. Apply `backend/database/schema.sql` for a new database. For an existing database, run `php backend/database/migrations/001_crm_workflow_fields.php`; it checks `INFORMATION_SCHEMA`, adds only missing columns/indexes, and never recreates tables. Do not recreate `mobile_devices` if it already exists.
5. From the repository root, start the PHP API in PowerShell with `./backend/start-local.ps1`. From the `frontend` folder, start the web app with `npm run dev`. The local launcher loads allowlisted settings from `backend/.env` into the PHP process and prevents hidden files such as `.env` from being served by PHP's development server.

## Password reset email

Install the backend mail dependency with `composer install --working-dir=backend`. Apply the existing-database migration (`php backend/database/migrations/001_crm_workflow_fields.php`) before deploying reset endpoints; a fresh database gets the same fields/table from `backend/database/schema.sql`.

Set these variables in the **PHP server process environment** (not Vite): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_ENCRYPTION` (`tls` or `ssl`), `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `FRONTEND_RESET_URL`, and `PASSWORD_RESET_RATE_KEY`. For local PowerShell development, put assignments for these names in `backend/.env` using `$env:NAME="value"` syntax and start PHP with `./backend/start-local.ps1`; do not start `php -S` directly because it will not load that file. The local launcher creates a temporary random rate key when the configured value is shorter than 32 characters. For persistent and production use, generate a private key with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"` and set it in the PHP server environment. The reset URL is the frontend's full `/reset-password` URL. Local HTTP is permitted only for `localhost`/`127.0.0.1`; production requires HTTPS. Never expose these values through `VITE_` variables.

Password reset requests return a generic response, store only SHA-256 token hashes, expire after one hour, and are limited to 5 requests per IP per 15 minutes and 3 per account per hour. Reset tokens are delivered in the URL fragment, removed from browser history on page load, and consumed once. Resetting a password increments `users.auth_version`, invalidating all older PHP sessions; users with pre-migration sessions will need to sign in again. SMTP delivery is not available until PHPMailer is installed and real PHP SMTP credentials/environment values are configured.

For production, set PHP environment variables in the web server or process manager, use HTTPS, and configure exact trusted frontend origins. On HTTPS, including `https://vehicocrm.gdaisolutions.com`, session cookies default to `Secure` and `SameSite=None` when `SESSION_SECURE` and `SESSION_SAME_SITE` are unset. `SameSite=None` requires HTTPS. Set `SESSION_COOKIE_DOMAIN` when the cookie must be shared across subdomains. Set `RECORDINGS_DIRECTORY` to a private server-side recording store. Do not put database credentials in Vite variables or browser code.

## Authentication and roles

- `POST /api/auth/login.php` accepts `identifier` (email or mobile) and `password`; only active `admin` and `executive` users may sign in.
- `GET /api/auth/me.php` verifies the PHP session and returns the current user and session CSRF token.
- `POST /api/auth/logout.php` invalidates the session and requires the CSRF token.
- `PUT /api/auth/profile.php`, `POST /api/auth/password.php`, and `GET/PUT /api/auth/preferences.php` provide session-backed account settings.
- State-changing requests use `X-CSRF-Token`; API access uses prepared SQL and the shared `backend/middleware/auth.php` role/ownership checks.
- Admin routes include user/team management, reports, settings, and recordings. Calling Executives are scoped to assigned operational records. Their lists and direct record requests are checked in PHP, not only hidden in navigation. The existing database `manager` role is not permitted to log in.
- Both roles can open Account Security from the profile menu to change their own password after verifying the current password.

Admin-created Calling Executive accounts are written to the existing `users` table with `password_hash()`. Passwords and hashes are never returned by the API. Account deactivation is soft and preserves related records. The Admin may set an initial password or reset it through the Team screen; the user may change their password after verifying the current password.

## Data APIs

The frontend service layer calls PHP endpoints for customers, leads, follow-ups, bookings, calls, recordings, tasks, users, notifications, activity history, dashboard analytics, and reports. CRM mutations use database transactions and write activity records. Executive queries and record access are scoped by assignments. Admin-only APIs enforce roles in PHP.

The live database must have `gd_ai_cab_crm` and the `users` table created before running the API. `schema.sql` is the fresh-install schema; migrations are for databases that already exist. Never rerun a destructive schema operation against production data.

## Validation

From the `frontend` folder:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

From the repository root:

- `php -l` on PHP source files

There is no automated integration-test suite yet. Current verification used temporary database users and records for role/login, CRUD, ownership denial, password update, profile/preferences, reporting, and cleanup checks.

## Known remaining work

- The CAB CRM BRS Version 1.1 file was not present in the workspace, so this implementation has not been reconciled against it.
- Android call initiation and call-log synchronization require the separate Android application/integration. The Web CRM does not dial calls itself.
- Recording capture/upload is not implemented here. Playback/download works only for a file already stored under the configured private recordings directory and referenced in MySQL.
- Captain assignment stores the captain name and optional ID on the booking; no captain master table or captain-management workflow exists in the supplied schema.
- Email/SMS delivery, push/realtime notification transport, 2FA, avatar upload, and password recovery are not implemented. Password recovery was not replaced with an insecure placeholder.
- Production deployment still needs a configured HTTPS origin, secrets supplied by the server environment, database backups, rate limiting/monitoring, and a formal automated test suite.
