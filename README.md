# Brilliant Healthcare

Healthcare website with live appointment availability and separate administrator and doctor access.

## Run locally

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `DATA_DIR`, then run `npm start`. Open `/portal.html` to add doctors. Doctors use that same portal to publish weekly hours and unavailable dates.

Patient bookings are validated on the server to prevent double booking. New requests remain pending until staff confirms them.

## Railway

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATA_DIR=/data`. Attach a persistent volume mounted at `/data`; without it, appointments and doctor accounts can be lost during redeployment. `railway.toml` configures the start command and health check.
