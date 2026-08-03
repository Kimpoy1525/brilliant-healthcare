# Brilliant Healthcare

Healthcare website with live appointment availability and separate administrator and doctor access.

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
