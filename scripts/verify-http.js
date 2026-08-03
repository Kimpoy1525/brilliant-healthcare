const { pool } = require('../database');

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${body?.error || 'Request failed'}`);
  return { response, body };
}

async function main() {
  const base = process.env.VERIFY_BASE_URL || 'http://localhost:3219';
  const mutationHeaders = { 'Content-Type': 'application/json', Origin: base };
  const login = await request(`${base}/api/login`, {
    method: 'POST',
    headers: mutationHeaders,
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  });
  const cookie = login.response.headers.get('set-cookie').split(';')[0];
  const authenticated = await request(`${base}/api/me`, { headers: { Cookie: cookie } });
  const adminHeaders = { Cookie: cookie, Origin: base, 'X-CSRF-Token': authenticated.body.csrfToken };
  const doctors = (await request(`${base}/api/doctors`)).body;
  const doctor = doctors.find(item => item.name.includes('James Raphael'));
  let chosen;
  for (let offset = 1; offset <= 30 && !chosen; offset++) {
    const date = new Date(Date.now() + offset * 86400000);
    const dateValue = date.toISOString().slice(0, 10);
    const slots = (await request(`${base}/api/doctors/${doctor.id}/slots?date=${dateValue}`)).body.slots;
    const slot = slots.find(item => item.available);
    if (slot) chosen = { date: dateValue, time: slot.time };
  }
  if (!chosen) throw new Error('No verification slot available.');
  const booking = await request(`${base}/api/appointments`, {
    method: 'POST',
    headers: mutationHeaders,
    body: JSON.stringify({ doctorId: doctor.id, ...chosen, fullName: 'Automated Verification', phone: '09171234567', service: 'checkup', message: 'Automatically removed after verification.', smsConsent: true })
  });
  let duplicateRejected = false;
  try {
    await request(`${base}/api/appointments`, {
      method: 'POST',
      headers: mutationHeaders,
      body: JSON.stringify({ doctorId: doctor.id, ...chosen, fullName: 'Duplicate Verification', phone: '09171234567', service: 'checkup', smsConsent: true })
    });
  } catch (error) { duplicateRejected = error.message.startsWith('400:') || error.message.startsWith('409:'); }
  const appointments = (await request(`${base}/api/admin/appointments?search=${encodeURIComponent(booking.body.reference)}`, { headers: { Cookie: cookie } })).body.items;
  const created = appointments.find(item => item.reference === booking.body.reference);
  await pool.query('DELETE FROM appointments WHERE id=$1', [created.id]);
  await pool.end();
  console.log(JSON.stringify({ adminRole: authenticated.body.role, doctor: doctor.name, bookingCreated: true, duplicateRejected, testRecordDeleted: true }));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
