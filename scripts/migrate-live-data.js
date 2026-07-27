const { pool, getDoctors, replaceSchedule } = require('../database');

const source = process.env.MIGRATION_SOURCE || 'https://brilliant-healthcare-production.up.railway.app';

async function sourceRequest(path, options = {}) {
  const response = await fetch(`${source}${path}`, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`Source ${path} returned ${response.status}.`);
  return data;
}

async function main() {
  const login = await sourceRequest('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  });
  if (!login.token) {
    console.log(JSON.stringify({ migrated: false, reason: 'Source already uses secure-cookie backend.' }));
    await pool.end();
    return;
  }
  const headers = { Authorization: `Bearer ${login.token}` };
  const [sourceDoctors, appointments] = await Promise.all([
    sourceRequest('/api/admin/doctors', { headers }),
    sourceRequest('/api/appointments', { headers })
  ]);
  const client = await pool.connect();
  let doctorCount = 0, appointmentCount = 0;
  try {
    await client.query('BEGIN');
    const doctorMap = new Map();
    for (const doctor of sourceDoctors) {
      const existing = (await getDoctors(true)).find(item => item.name.toLowerCase() === doctor.name.toLowerCase());
      const doctorId = existing?.id || doctor.id;
      if (existing) {
        await client.query('UPDATE doctors SET specialty=$1,active=$2,updated_at=now() WHERE id=$3', [doctor.specialty, doctor.active !== false, doctorId]);
      } else {
        await client.query('INSERT INTO doctors(id,name,specialty,active) VALUES($1,$2,$3,$4)', [doctorId, doctor.name, doctor.specialty, doctor.active !== false]);
      }
      await replaceSchedule(client, doctorId, doctor.availability || [], doctor.unavailableDates || []);
      doctorMap.set(doctor.id, doctorId);
      doctorCount++;
    }
    for (const appointment of appointments) {
      await client.query(`INSERT INTO appointments(id,reference,doctor_id,appointment_date,appointment_time,full_name,phone,email,service,message,status,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (reference) DO NOTHING`, [
        appointment.id, appointment.reference, doctorMap.get(appointment.doctorId), appointment.date, appointment.time,
        appointment.fullName, appointment.phone, appointment.email || null, appointment.service, appointment.message || '',
        appointment.status, appointment.createdAt
      ]);
      appointmentCount++;
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ migrated: true, doctors: doctorCount, appointments: appointmentCount }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
