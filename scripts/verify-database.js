const crypto = require('crypto');
const { pool } = require('../database');

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const doctorId = crypto.randomUUID();
    await client.query('INSERT INTO doctors(id,name,specialty) VALUES($1,$2,$3)', [doctorId, 'Database Verification Doctor', 'Test']);
    const values = [crypto.randomUUID(), `VERIFY-${Date.now()}`, doctorId, '2099-01-05', '09:00', 'Verification Patient', '000', 'checkup'];
    await client.query(`INSERT INTO appointments(id,reference,doctor_id,appointment_date,appointment_time,full_name,phone,service)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, values);
    let duplicateRejected = false;
    await client.query('SAVEPOINT duplicate_test');
    try {
      await client.query(`INSERT INTO appointments(id,reference,doctor_id,appointment_date,appointment_time,full_name,phone,service)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [crypto.randomUUID(), `VERIFY-DUP-${Date.now()}`, doctorId, '2099-01-05', '09:00', 'Second Patient', '000', 'checkup']);
    } catch (error) {
      duplicateRejected = error.code === '23505';
      await client.query('ROLLBACK TO SAVEPOINT duplicate_test');
    }
    const rls = await client.query(`SELECT count(*)::int AS count FROM pg_class WHERE relrowsecurity=true AND relname IN ('admins','doctors','doctor_schedules','doctor_unavailable_dates','appointments','admin_sessions','login_attempts','admin_audit_events')`);
    console.log(JSON.stringify({ duplicateRejected, rlsTables: rls.rows[0].count, transactionRolledBack: true }));
    if (!duplicateRejected || rls.rows[0].count !== 8) throw new Error('Database security verification failed.');
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
