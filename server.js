const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const sessions = new Map();
const attempts = new Map();

function id() { return crypto.randomUUID(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored = '') {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function seedStore() {
  const adminId = id();
  const doctorUserId = id();
  const doctorId = id();
  return {
    users: [
      { id: adminId, role: 'admin', name: 'Clinic Administrator', email: (process.env.ADMIN_EMAIL || 'admin@brillianthealthcare.com').toLowerCase(), passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'ChangeMe123!') },
      { id: doctorUserId, role: 'doctor', name: 'Dr. James Raphael', email: (process.env.TRIAL_DOCTOR_EMAIL || 'james.raphael@brillianthealthcare.com').toLowerCase(), passwordHash: hashPassword(process.env.TRIAL_DOCTOR_PASSWORD || 'JamesTrial123!') }
    ],
    doctors: [{
      id: doctorId, userId: doctorUserId, name: 'Dr. James Raphael', specialty: 'Nephrology & Internal Medicine', active: true,
      availability: [
        { day: 1, start: '09:00', end: '17:00', slotMinutes: 30 }, { day: 2, start: '09:00', end: '17:00', slotMinutes: 30 },
        { day: 3, start: '09:00', end: '17:00', slotMinutes: 30 }, { day: 4, start: '09:00', end: '17:00', slotMinutes: 30 },
        { day: 5, start: '09:00', end: '17:00', slotMinutes: 30 }, { day: 6, start: '09:00', end: '13:00', slotMinutes: 30 }
      ], unavailableDates: []
    }], appointments: [], createdAt: new Date().toISOString()
  };
}
function loadStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seedStore(), null, 2));
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
let store = loadStore();
function save() {
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, DATA_FILE);
}
function ensureTrialDoctor() {
  if (store.doctors.some(d => d.name.toLowerCase().includes('james raphael'))) return;
  const user = { id: id(), role: 'doctor', name: 'Dr. James Raphael', email: (process.env.TRIAL_DOCTOR_EMAIL || 'james.raphael@brillianthealthcare.com').toLowerCase(), passwordHash: hashPassword(process.env.TRIAL_DOCTOR_PASSWORD || 'JamesTrial123!') };
  store.users.push(user);
  store.doctors.push({ id: id(), userId: user.id, name: user.name, specialty: 'Nephrology & Internal Medicine', active: true, availability: [1, 2, 3, 4, 5].map(day => ({ day, start: '09:00', end: '17:00', slotMinutes: 30 })).concat([{ day: 6, start: '09:00', end: '13:00', slotMinutes: 30 }]), unavailableDates: [] });
  save();
}
ensureTrialDoctor();
function syncAdminCredentials() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  let admin = store.users.find(user => user.role === 'admin');
  if (!admin) {
    admin = { id: id(), role: 'admin', name: 'Clinic Administrator' };
    store.users.push(admin);
  }
  admin.email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  admin.passwordHash = hashPassword(process.env.ADMIN_PASSWORD);
  save();
}
syncAdminCredentials();
function publicDoctor(d) { return { id: d.id, name: d.name, specialty: d.specialty, availability: d.availability || [], unavailableDates: d.unavailableDates || [] }; }
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'Please sign in.' });
  req.user = store.users.find(u => u.id === session.userId);
  if (!req.user) return res.status(401).json({ error: 'Session expired.' });
  next();
}
const role = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Access denied.' });
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00`)); }
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || ''); }
function minutes(value) { const [h, m] = value.split(':').map(Number); return h * 60 + m; }
function slotAvailable(doctor, date, time) {
  if (!doctor || !validDate(date) || !validTime(time) || date < new Date().toISOString().slice(0, 10)) return false;
  if ((doctor.unavailableDates || []).includes(date)) return false;
  const day = new Date(`${date}T12:00:00`).getDay();
  const rule = (doctor.availability || []).find(a => a.day === day);
  if (!rule) return false;
  const value = minutes(time), start = minutes(rule.start), end = minutes(rule.end), duration = rule.slotMinutes || 30;
  if (value < start || value + duration > end || (value - start) % duration !== 0) return false;
  return !store.appointments.some(a => a.doctorId === doctor.id && a.date === date && a.time === time && !['cancelled', 'declined'].includes(a.status));
}

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'https:'], scriptSrc: ["'self'"], connectSrc: ["'self'"] } }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '30kb' }));
app.use((req, res, next) => { res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()'); next(); });
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/login', (req, res) => {
  const key = req.ip; const recent = (attempts.get(key) || []).filter(t => Date.now() - t < 15 * 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = store.users.find(u => u.email === email);
  if (!user || !verifyPassword(String(req.body.password || ''), user.passwordHash)) { recent.push(Date.now()); attempts.set(key, recent); return res.status(401).json({ error: 'Invalid email or password.' }); }
  attempts.delete(key); const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId: user.id, expires: Date.now() + 8 * 60 * 60_000 });
  res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
});
app.post('/api/logout', auth, (req, res) => { sessions.delete((req.headers.authorization || '').replace(/^Bearer /, '')); res.status(204).end(); });
app.get('/api/me', auth, (req, res) => res.json({ name: req.user.name, email: req.user.email, role: req.user.role }));
app.get('/api/doctors', (req, res) => res.json(store.doctors.filter(d => d.active !== false).map(publicDoctor)));
app.get('/api/doctors/:id/slots', (req, res) => {
  const doctor = store.doctors.find(d => d.id === req.params.id && d.active !== false);
  const date = String(req.query.date || '');
  if (!doctor || !validDate(date)) return res.status(400).json({ error: 'Choose a valid doctor and date.' });
  const day = new Date(`${date}T12:00:00`).getDay(); const rule = (doctor.availability || []).find(a => a.day === day); const slots = [];
  if (rule) for (let value = minutes(rule.start); value + rule.slotMinutes <= minutes(rule.end); value += rule.slotMinutes) { const time = `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; slots.push({ time, available: slotAvailable(doctor, date, time) }); }
  res.json({ doctor: publicDoctor(doctor), date, unavailable: (doctor.unavailableDates || []).includes(date), slots });
});
app.post('/api/appointments', (req, res) => {
  const { doctorId, date, time, fullName, phone, email, service, message } = req.body;
  const doctor = store.doctors.find(d => d.id === doctorId && d.active !== false);
  if (!fullName || !phone || !service || !slotAvailable(doctor, date, time)) return res.status(400).json({ error: 'This time is unavailable or required details are missing. Please choose another slot.' });
  const appointment = { id: id(), reference: `BH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, doctorId, date, time, fullName: String(fullName).trim(), phone: String(phone).trim(), email: String(email || '').trim(), service, message: String(message || '').trim(), status: 'pending', createdAt: new Date().toISOString() };
  store.appointments.push(appointment); save(); res.status(201).json({ reference: appointment.reference, status: appointment.status, message: 'Your slot is reserved pending clinic confirmation.' });
});

app.get('/api/admin/doctors', auth, role('admin'), (req, res) => res.json(store.doctors));
app.post('/api/admin/doctors', auth, role('admin'), (req, res) => {
  const { name, specialty, email, password } = req.body; const normalized = String(email || '').trim().toLowerCase();
  if (!name || !specialty || !normalized || String(password || '').length < 10 || store.users.some(u => u.email === normalized)) return res.status(400).json({ error: 'Complete all fields, use a unique email, and a password of at least 10 characters.' });
  const user = { id: id(), name: String(name).trim(), email: normalized, role: 'doctor', passwordHash: hashPassword(password) };
  const doctor = { id: id(), userId: user.id, name: user.name, specialty: String(specialty).trim(), active: true, availability: [], unavailableDates: [] };
  store.users.push(user); store.doctors.push(doctor); save(); res.status(201).json(doctor);
});
app.patch('/api/admin/doctors/:id', auth, role('admin'), (req, res) => { const d = store.doctors.find(x => x.id === req.params.id); if (!d) return res.status(404).json({ error: 'Doctor not found.' }); d.active = req.body.active !== false; save(); res.json(d); });
app.get('/api/appointments', auth, role('admin', 'doctor'), (req, res) => { const doctor = store.doctors.find(d => d.userId === req.user.id); res.json(store.appointments.filter(a => req.user.role === 'admin' || a.doctorId === doctor?.id).sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))); });
app.patch('/api/appointments/:id', auth, role('admin', 'doctor'), (req, res) => { const a = store.appointments.find(x => x.id === req.params.id); const d = store.doctors.find(x => x.userId === req.user.id); if (!a || (req.user.role === 'doctor' && a.doctorId !== d?.id)) return res.status(404).json({ error: 'Appointment not found.' }); if (!['pending','confirmed','completed','cancelled','declined'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' }); a.status = req.body.status; save(); res.json(a); });
app.get('/api/doctor/schedule', auth, role('doctor'), (req, res) => { const d = store.doctors.find(x => x.userId === req.user.id); res.json(d); });
app.put('/api/doctor/schedule', auth, role('doctor'), (req, res) => { const d = store.doctors.find(x => x.userId === req.user.id); const availability = Array.isArray(req.body.availability) ? req.body.availability : []; if (availability.some(a => !Number.isInteger(a.day) || a.day < 0 || a.day > 6 || !validTime(a.start) || !validTime(a.end) || minutes(a.start) >= minutes(a.end) || ![15,30,45,60].includes(Number(a.slotMinutes)))) return res.status(400).json({ error: 'Invalid schedule.' }); d.availability = availability.map(a => ({ day: a.day, start: a.start, end: a.end, slotMinutes: Number(a.slotMinutes) })); d.unavailableDates = [...new Set((req.body.unavailableDates || []).filter(validDate))]; save(); res.json(d); });

app.use(express.static(__dirname, { maxAge: '1h', index: 'index.html' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Brilliant Healthcare listening on ${PORT}`));
