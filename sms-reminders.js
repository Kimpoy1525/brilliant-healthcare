const { pool } = require('./database');

const MANILA_TIME_ZONE = 'Asia/Manila';
const REMINDER_INTERVAL_MS = 15 * 60 * 1000;
const LOCK_ID = 2147483051;
let timer;
let running = false;

function manilaDate(offsetDays = 0, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function normalizePhilippineMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return `63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return digits;
  return null;
}

function displayTime(value) {
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function displayDate(value) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${value}T12:00:00+08:00`));
}

function reminderMessage(appointment) {
  return `Brilliant Healthcare reminder: Your appointment is tomorrow, ${displayDate(appointment.appointment_date)}, at ${displayTime(appointment.appointment_time)}. Please arrive 15 minutes early. Ref: ${appointment.reference}. Contact the clinic if you need to reschedule.`;
}

async function sendSemaphoreSms({ number, message }) {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) throw new Error('Semaphore is not configured.');
  const body = new URLSearchParams({ apikey: apiKey, number, message });
  if (process.env.SEMAPHORE_SENDER_NAME) body.set('sendername', process.env.SEMAPHORE_SENDER_NAME);
  const response = await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data) || !data[0]?.message_id) {
    const providerMessage = data?.message || data?.[0]?.message || `Semaphore returned HTTP ${response.status}`;
    throw new Error(String(providerMessage).slice(0, 300));
  }
  return String(data[0].message_id);
}

async function processAppointmentReminders({ targetDate = manilaDate(1) } = {}) {
  if (running) return { skipped: true, reason: 'already-running' };
  running = true;
  const client = await pool.connect();
  let locked = false;
  const result = { targetDate, sent: 0, failed: 0, skipped: 0 };
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_ID]);
    locked = lock.rows[0].locked;
    if (!locked) return { ...result, skipped: true, reason: 'another-worker-running' };
    const { rows } = await client.query(`
      SELECT a.id,a.reference,a.appointment_date,a.appointment_time,a.phone
      FROM appointments a
      WHERE a.appointment_date=$1
        AND a.archived_at IS NULL
        AND a.status IN ('pending','confirmed')
        AND a.sms_consent=true
        AND a.reminder_sent_at IS NULL
        AND a.reminder_attempts < 3
      ORDER BY a.appointment_time
    `, [targetDate]);
    for (const appointment of rows) {
      const number = normalizePhilippineMobile(appointment.phone);
      if (!number) {
        await client.query(`UPDATE appointments SET reminder_status='invalid_number',reminder_attempted_at=now(),
          reminder_attempts=reminder_attempts+1,reminder_error='Invalid Philippine mobile number' WHERE id=$1 AND reminder_sent_at IS NULL`, [appointment.id]);
        result.failed++;
        continue;
      }
      try {
        const providerId = await sendSemaphoreSms({ number, message: reminderMessage(appointment) });
        await client.query(`UPDATE appointments SET reminder_status='sent',reminder_sent_at=now(),reminder_attempted_at=now(),
          reminder_attempts=reminder_attempts+1,reminder_provider_id=$2,reminder_error='' WHERE id=$1 AND reminder_sent_at IS NULL`, [appointment.id, providerId]);
        result.sent++;
      } catch (error) {
        await client.query(`UPDATE appointments SET reminder_status='failed',reminder_attempted_at=now(),
          reminder_attempts=reminder_attempts+1,reminder_error=$2 WHERE id=$1 AND reminder_sent_at IS NULL`, [appointment.id, String(error.message).slice(0, 300)]);
        result.failed++;
      }
    }
    return result;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
    running = false;
  }
}

function startReminderScheduler() {
  if (timer) return;
  if (!process.env.SEMAPHORE_API_KEY) {
    console.warn('SMS reminders are disabled until SEMAPHORE_API_KEY is configured.');
    return;
  }
  const run = () => processAppointmentReminders().then(result => {
    if (result.sent || result.failed) console.log('SMS reminder run:', JSON.stringify(result));
  }).catch(error => console.error('SMS reminder run failed:', error.message));
  setTimeout(run, 5000);
  timer = setInterval(run, REMINDER_INTERVAL_MS);
  timer.unref();
}

module.exports = {
  manilaDate,
  normalizePhilippineMobile,
  processAppointmentReminders,
  reminderMessage,
  sendSemaphoreSms,
  startReminderScheduler
};
