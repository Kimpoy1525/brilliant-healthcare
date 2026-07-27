const crypto = require('crypto');
const { initDatabase, pool } = require('../database');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.ADMIN_PASSWORD) throw new Error('DATABASE_URL and ADMIN_PASSWORD are required.');
  await initDatabase({
    adminEmail: (process.env.ADMIN_EMAIL || 'admin@brillianthealthcare.com').toLowerCase(),
    adminName: 'Clinic Administrator',
    adminPasswordHash: hashPassword(process.env.ADMIN_PASSWORD)
  });
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM admins) AS admins,
      (SELECT count(*)::int FROM doctors) AS doctors,
      (SELECT count(*)::int FROM doctor_schedules) AS schedule_rules
  `);
  console.log(JSON.stringify({ initialized: true, ...rows[0] }));
  await pool.end();
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
