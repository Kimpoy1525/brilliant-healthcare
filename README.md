# Brilliant Healthcare

Healthcare website with live appointment availability and separate administrator and doctor access.

## Public-site reliability checks

Run `npm ci` and `npm test` for source checks, operational failure tests, and HTTP checks against an isolated fixture. The fixture does not connect to PostgreSQL, initialize clinical data, or send SMS.

Run `npm run test:browser` for responsive checks at 320, 390, 768, 1024, and 1440 pixels, laboratory test search, mobile navigation, service-dialog keyboard focus, and doctor-directory recovery. It uses headless Edge on Windows by default; set `BROWSER_PATH` to a Chrome or Edge executable on another installation. The check requires local port 3229 (override with `PUBLIC_CHECK_PORT`) and creates a temporary browser profile and screenshots. It explicitly verifies that the existing booking and portal links and forms remain hidden.

Public pages provide telephone assistance while the existing launch visibility rules remain in effect. Directory failures provide a retry option and advise patients to confirm schedules by telephone. A successful empty directory response removes fallback profiles instead of presenting an unpublished physician as available.

The `/health` endpoint returns 503 when its database check fails. Idle database connection errors are handled and logged using a code and correlation ID without database error text. SIGTERM/SIGINT stop new HTTP connections, drain requests, and close the pool; shutdown has a ten-second deadline. Images at mutable filenames revalidate after one hour, and HTML revalidates on each visit.

## Run locally

Set `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run `npm start`. `DATABASE_URL` should use the Supabase transaction pooler. Open `/portal.html` to manage doctors, schedules, unavailable dates, and appointments.

Patient bookings are validated on the server to prevent double booking. New requests remain pending until staff confirms them.

The database schema is created automatically on startup with Row Level Security enabled and public table privileges revoked. Administrator sessions use expiring, HTTP-only, secure cookies. Supabase Free projects can pause after inactivity and do not include automatic backups, so a paid plan is recommended before real clinical use.

## Railway

Set `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in Railway. Appointments, doctors, schedules, and administrator sessions are stored in Supabase PostgreSQL. `railway.toml` configures the start command and database-aware health check.

Set a separate random `SECURITY_PEPPER` of at least 32 bytes. When Supabase's CA certificate is available, set `DATABASE_CA_CERT` with the PEM certificate (newlines may be written as `\n`) to enable strict PostgreSQL certificate verification.

## Administrator access

The initial Railway administrator is maintained as a system administrator. From the portal, that account can create individual staff accounts with system-administrator, appointment-manager, or read-only access. Administrative changes are recorded in `admin_audit_events`; appointments are archived with a reason instead of permanently deleted. Appointment search and filters are processed on the server and returned in pages of 25 records.

Supabase Auth MFA and physician-photo uploads through Supabase Storage require project URL/key and bucket configuration and are not enabled by database credentials alone. Keep the existing administrator login active until that migration has been configured and tested.

## SMS appointment reminders

Set `SEMAPHORE_API_KEY` in Railway to enable automatic reminders through Semaphore. Set `SEMAPHORE_SENDER_NAME` after the clinic's sender name is approved; if omitted, Semaphore uses the account default. The server checks every 15 minutes for active, consented appointments scheduled for the following day in the `Asia/Manila` time zone. Each reminder is recorded in PostgreSQL before it can be considered complete, and an advisory lock prevents overlapping deployments from sending duplicates.

The SMS does not contain the requested service, diagnosis, patient question, or other clinical details. Delivery credits and an active Semaphore account are required.
