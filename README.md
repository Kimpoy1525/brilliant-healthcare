# Brilliant Healthcare

Healthcare website with live appointment availability and separate administrator and doctor access.

## Run locally

Set `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run `npm start`. `DATABASE_URL` should use the Supabase transaction pooler. Open `/portal.html` to manage doctors, schedules, unavailable dates, and appointments.

Patient bookings are validated on the server to prevent double booking. New requests remain pending until staff confirms them.

The database schema is created automatically on startup with Row Level Security enabled and public table privileges revoked. Administrator sessions use expiring, HTTP-only, secure cookies. Supabase Free projects can pause after inactivity and do not include automatic backups, so a paid plan is recommended before real clinical use.

## Railway

Set `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in Railway. Appointments, doctors, schedules, and administrator sessions are stored in Supabase PostgreSQL. `railway.toml` configures the start command and database-aware health check.
