const { Pool, types } = require('pg');
const crypto = require('crypto');

types.setTypeParser(1082, value => value);
types.setTypeParser(1083, value => value.slice(0, 5));

function normalizedConnectionString(value) {
  try { new URL(value); return value; } catch {}
  const match = String(value || '').match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@([^@]+)$/);
  if (!match) throw new Error('DATABASE_URL is not a valid PostgreSQL connection URL.');
  return `${match[1]}${encodeURIComponent(decodeURIComponent(match[2]))}:${encodeURIComponent(match[3])}@${match[4]}`;
}

const pool = new Pool({
  connectionString: normalizedConnectionString(process.env.DATABASE_URL),
  ssl: (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) ? { rejectUnauthorized: false } : undefined,
  max: 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const schema = `
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  specialty text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS doctor_schedules (
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day smallint NOT NULL CHECK (day BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes smallint NOT NULL CHECK (slot_minutes IN (15,30,45,60)),
  PRIMARY KEY (doctor_id, day),
  CHECK (start_time < end_time)
);
CREATE TABLE IF NOT EXISTS doctor_unavailable_dates (
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  unavailable_date date NOT NULL,
  PRIMARY KEY (doctor_id, unavailable_date)
);
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  doctor_id uuid NOT NULL REFERENCES doctors(id),
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  service text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot
  ON appointments(doctor_id, appointment_date, appointment_time)
  WHERE status NOT IN ('cancelled','declined');
CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(appointment_date, appointment_time);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_unavailable_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admins, doctors, doctor_schedules, doctor_unavailable_dates, appointments, admin_sessions FROM PUBLIC;
`;

async function initDatabase({ adminEmail, adminName, adminPasswordHash }) {
  await pool.query(schema);
  const admin = await pool.query('SELECT id FROM admins ORDER BY created_at LIMIT 1');
  if (admin.rows.length) {
    await pool.query('UPDATE admins SET name=$1,email=$2,password_hash=$3,updated_at=now() WHERE id=$4',
      [adminName, adminEmail, adminPasswordHash, admin.rows[0].id]);
  } else {
    await pool.query('INSERT INTO admins(id,name,email,password_hash) VALUES($1,$2,$3,$4)',
      [crypto.randomUUID(), adminName, adminEmail, adminPasswordHash]);
  }
  const james = await pool.query("SELECT id FROM doctors WHERE lower(name) LIKE '%james raphael%' LIMIT 1");
  let doctorId = james.rows[0]?.id;
  if (!doctorId) {
    doctorId = crypto.randomUUID();
    await pool.query('INSERT INTO doctors(id,name,specialty) VALUES($1,$2,$3)',
      [doctorId, 'Dr. James Raphael', 'Nephrology & Internal Medicine']);
  }
  const count = await pool.query('SELECT count(*)::int AS count FROM doctor_schedules WHERE doctor_id=$1', [doctorId]);
  if (!count.rows[0].count) {
    for (const day of [1,2,3,4,5]) await pool.query('INSERT INTO doctor_schedules VALUES($1,$2,$3,$4,$5)', [doctorId, day, '09:00', '17:00', 30]);
    await pool.query('INSERT INTO doctor_schedules VALUES($1,$2,$3,$4,$5)', [doctorId, 6, '09:00', '13:00', 30]);
  }
  await pool.query('DELETE FROM admin_sessions WHERE expires_at < now()');
}

async function getDoctors(includeInactive = false) {
  const { rows } = await pool.query(`
    SELECT d.id,d.name,d.specialty,d.active,
      COALESCE(json_agg(DISTINCT jsonb_build_object('day',s.day,'start',to_char(s.start_time,'HH24:MI'),'end',to_char(s.end_time,'HH24:MI'),'slotMinutes',s.slot_minutes))
        FILTER (WHERE s.day IS NOT NULL),'[]') AS availability,
      COALESCE(array_agg(DISTINCT u.unavailable_date) FILTER (WHERE u.unavailable_date IS NOT NULL),'{}') AS unavailable_dates
    FROM doctors d
    LEFT JOIN doctor_schedules s ON s.doctor_id=d.id
    LEFT JOIN doctor_unavailable_dates u ON u.doctor_id=d.id
    ${includeInactive ? '' : 'WHERE d.active=true'}
    GROUP BY d.id ORDER BY d.name`);
  return rows.map(row => ({ id: row.id, name: row.name, specialty: row.specialty, active: row.active,
    availability: row.availability.sort((a,b) => a.day-b.day), unavailableDates: row.unavailable_dates }));
}

async function getDoctor(id, includeInactive = false) {
  return (await getDoctors(includeInactive)).find(doctor => doctor.id === id);
}

async function replaceSchedule(client, doctorId, availability, unavailableDates) {
  await client.query('DELETE FROM doctor_schedules WHERE doctor_id=$1', [doctorId]);
  for (const item of availability) await client.query('INSERT INTO doctor_schedules VALUES($1,$2,$3,$4,$5)', [doctorId,item.day,item.start,item.end,item.slotMinutes]);
  await client.query('DELETE FROM doctor_unavailable_dates WHERE doctor_id=$1', [doctorId]);
  for (const date of unavailableDates) await client.query('INSERT INTO doctor_unavailable_dates VALUES($1,$2)', [doctorId,date]);
}

module.exports = { pool, initDatabase, getDoctors, getDoctor, replaceSchedule };
