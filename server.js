const express = require('express');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const { pool, initDatabase, getDoctors, getDoctor, replaceSchedule, isLoginBlocked, recordLoginFailure, clearLoginFailures } = require('./database');
const { normalizePhilippineMobile, processAppointmentReminders, startReminderScheduler } = require('./sms-reminders');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Configure the Supabase transaction-pooler URL.');
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
if (IS_PRODUCTION && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16)) throw new Error('ADMIN_PASSWORD must contain at least 16 characters in production.');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE = '__Host-bh_admin';
const bookingAttempts = new Map();
const appointmentStatuses = ['pending','confirmed','completed','cancelled','declined'];
const adminRoles = ['super_admin','appointment_manager','viewer'];
const SECURITY_PEPPER = process.env.SECURITY_PEPPER || process.env.ADMIN_PASSWORD || 'local-development-only';

function id() { return crypto.randomUUID(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function verifyPassword(password, stored = '') { const [salt,key] = stored.split(':'); if (!salt || !key) return false; const actual=crypto.scryptSync(password,salt,64), expected=Buffer.from(key,'hex'); return actual.length===expected.length && crypto.timingSafeEqual(actual,expected); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function securityKey(kind, value) { return crypto.createHmac('sha256', SECURITY_PEPPER).update(`${kind}:${value}`).digest('hex'); }
function csrfToken(sessionToken) { return crypto.createHmac('sha256', SECURITY_PEPPER).update(`csrf:${sessionToken}`).digest('base64url'); }
function safeEqual(a, b) { const one=Buffer.from(String(a||'')), two=Buffer.from(String(b||'')); return one.length===two.length && crypto.timingSafeEqual(one,two); }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || ''); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || ''); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00`)); }
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || ''); }
function minutes(value) { const [h,m]=value.split(':').map(Number); return h*60+m; }
function clean(value, max = 250) { return String(value || '').trim().slice(0,max); }
function validPhotoUrl(value) { if (!value) return true; if (value.startsWith('/images/')) return true; try { return new URL(value).protocol === 'https:'; } catch { return false; } }
function cookies(req) { return Object.fromEntries(String(req.headers.cookie || '').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]})); }
function rateLimited(map, key, limit, windowMs) { const now=Date.now(), recent=(map.get(key)||[]).filter(t=>now-t<windowMs); if(recent.length>=limit) return true; recent.push(now); map.set(key,recent); return false; }
function validSchedule(availability) { return Array.isArray(availability) && !availability.some(a=>!Number.isInteger(a.day)||a.day<0||a.day>6||!validTime(a.start)||!validTime(a.end)||minutes(a.start)>=minutes(a.end)||![15,30,45,60].includes(Number(a.slotMinutes))); }

async function auth(req,res,next) {
  try {
    const token=cookies(req)[COOKIE]; if(!token) return res.status(401).json({error:'Please sign in.'});
    const {rows}=await pool.query(`SELECT a.id,a.name,a.email,a.role FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.active=true`,[hashToken(token)]);
    if(!rows[0]) return res.status(401).json({error:'Session expired.'}); req.user=rows[0]; req.sessionToken=token; next();
  } catch(error){next(error)}
}
function requireRole(...roles){return(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'You do not have permission to perform this action.'})}
async function audit(req, action, entityType, entityId='', details={}) {
  await pool.query('INSERT INTO admin_audit_events(id,admin_id,action,entity_type,entity_id,details,ip_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',[id(),req.user?.id||null,action,entityType,String(entityId||''),JSON.stringify(details),securityKey('ip',req.ip)]);
}
function csrf(req,res,next) {
  if(!safeEqual(req.get('x-csrf-token'),csrfToken(req.sessionToken))) return res.status(403).json({error:'Security check failed. Refresh the page and try again.'});
  next();
}
async function available(doctor,date,time) {
  if(!doctor||!validDate(date)||!validTime(time)||date<new Date().toISOString().slice(0,10)||doctor.unavailableDates.includes(date)) return false;
  const day=new Date(`${date}T12:00:00`).getDay(), rule=doctor.availability.find(x=>x.day===day); if(!rule) return false;
  const value=minutes(time),start=minutes(rule.start),end=minutes(rule.end); if(value<start||value+rule.slotMinutes>end||(value-start)%rule.slotMinutes!==0) return false;
  const {rows}=await pool.query(`SELECT 1 FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND appointment_time=$3 AND archived_at IS NULL AND status NOT IN ('cancelled','declined')`,[doctor.id,date,time]);
  return !rows.length;
}

app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],baseUri:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],formAction:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https:'],scriptSrc:["'self'"],connectSrc:["'self'"]}},referrerPolicy:{policy:'no-referrer'},crossOriginEmbedderPolicy:false}));
app.use(express.json({limit:'20kb',type:'application/json'}));
app.use((req,res,next)=>{res.setHeader('Permissions-Policy','geolocation=(), microphone=(), camera=()');next()});
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');next()});
app.use('/api',(req,res,next)=>{if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return next();const origin=req.get('origin');const expected=`${req.protocol}://${req.get('host')}`;if(!origin||origin!==expected)return res.status(403).json({error:'Request origin was rejected.'});next()});

app.get('/health',async(req,res,next)=>{try{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'})}catch(e){next(e)}});
app.post('/api/login',async(req,res,next)=>{try{
  const email=clean(req.body.email,200).toLowerCase(), keys=[securityKey('ip',req.ip),securityKey('email',email)];
  if(await isLoginBlocked(keys)) return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});
  const {rows}=await pool.query('SELECT * FROM admins WHERE email=$1 AND active=true',[email]); const user=rows[0];
  if(!user||!verifyPassword(String(req.body.password||''),user.password_hash)){await recordLoginFailure(keys);return res.status(401).json({error:'Invalid email or password.'})}
  await clearLoginFailures(keys);
  const token=crypto.randomBytes(32).toString('base64url'), expires=new Date(Date.now()+30*60_000); await pool.query('DELETE FROM admin_sessions WHERE admin_id=$1 OR expires_at<=now()',[user.id]);await pool.query('INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,$3)',[hashToken(token),user.id,expires]);await pool.query('UPDATE admins SET last_login_at=now() WHERE id=$1',[user.id]);req.user=user;await audit(req,'login','session',user.id);
  res.cookie(COOKIE,token,{httpOnly:true,secure:IS_PRODUCTION,sameSite:'strict',path:'/',maxAge:30*60_000}); res.json({user:{name:user.name,email:user.email,role:'admin'}});
}catch(e){next(e)}});
app.post('/api/logout',auth,csrf,async(req,res,next)=>{try{const token=cookies(req)[COOKIE];await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[hashToken(token)]);res.clearCookie(COOKIE,{path:'/',httpOnly:true,secure:IS_PRODUCTION,sameSite:'strict'});res.status(204).end()}catch(e){next(e)}});
app.get('/api/me',auth,(req,res)=>res.json({...req.user,csrfToken:csrfToken(req.sessionToken)}));
app.get('/api/doctors',async(req,res,next)=>{try{res.json(await getDoctors(false))}catch(e){next(e)}});
app.get('/api/doctors/:id/slots',async(req,res,next)=>{try{const doctor=await getDoctor(req.params.id,false),date=clean(req.query.date,10);if(!doctor||!validDate(date))return res.status(400).json({error:'Choose a valid doctor and date.'});const day=new Date(`${date}T12:00:00`).getDay(),rule=doctor.availability.find(x=>x.day===day),slots=[];if(rule)for(let value=minutes(rule.start);value+rule.slotMinutes<=minutes(rule.end);value+=rule.slotMinutes){const time=`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;slots.push({time,available:await available(doctor,date,time)})}res.json({doctor,date,unavailable:doctor.unavailableDates.includes(date),slots})}catch(e){next(e)}});
app.post('/api/appointments',async(req,res,next)=>{try{
  if(rateLimited(bookingAttempts,req.ip,6,10*60_000)) return res.status(429).json({error:'Too many booking requests. Please wait and try again.'});
  const doctorId=clean(req.body.doctorId,40),date=clean(req.body.date,10),time=clean(req.body.time,5),doctor=await getDoctor(doctorId,false);
  const fullName=clean(req.body.fullName,120),phone=normalizePhilippineMobile(req.body.phone),email=clean(req.body.email,200),service=clean(req.body.service,80),message=clean(req.body.message,1000),smsConsent=req.body.smsConsent===true||req.body.smsConsent==='on';
  if(!fullName||!phone||!service||!smsConsent||!(await available(doctor,date,time))) return res.status(400).json({error:'Complete the required details, use a valid Philippine mobile number, and consent to the appointment reminder.'});
  const reference=`BH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  try{await pool.query(`INSERT INTO appointments(id,reference,doctor_id,appointment_date,appointment_time,full_name,phone,email,service,message,sms_consent,reminder_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'scheduled')`,[id(),reference,doctorId,date,time,fullName,phone,email||null,service,message,smsConsent])}catch(error){if(error.code==='23505')return res.status(409).json({error:'That time was just reserved. Please choose another slot.'});throw error}
  res.status(201).json({reference,status:'pending',message:'Your slot is reserved pending clinic confirmation. An SMS reminder is scheduled for the day before your appointment.'});
}catch(e){next(e)}});

// Administrative policy and audit middleware. Read-only staff may view
// operational data; only super administrators may change physician records.
app.use('/api/admin/doctors',auth,(req,res,next)=>{
  if(req.method!=='GET'&&req.user.role!=='super_admin')return res.status(403).json({error:'Only a system administrator can change physician records.'});
  if(req.method!=='GET')res.on('finish',()=>{if(res.statusCode<400)audit(req,`${req.method.toLowerCase()}_doctor`,'doctor',req.params?.id||'').catch(()=>{})});
  next();
});

app.get('/api/admin/appointments',auth,async(req,res,next)=>{try{
  const page=Math.max(1,Number.parseInt(req.query.page,10)||1),pageSize=Math.min(100,Math.max(10,Number.parseInt(req.query.pageSize,10)||25));
  const values=[],where=['a.archived_at IS NULL'];
  const add=(sql,value)=>{values.push(value);where.push(sql.replace('?',`$${values.length}`))};
  if(validDate(req.query.dateFrom))add('a.appointment_date>=?',req.query.dateFrom);
  if(validDate(req.query.dateTo))add('a.appointment_date<=?',req.query.dateTo);
  if(appointmentStatuses.includes(req.query.status))add('a.status=?',req.query.status);
  if(validUuid(req.query.doctorId))add('a.doctor_id=?',req.query.doctorId);
  const search=clean(req.query.search,100);if(search){values.push(`%${search}%`);where.push(`(a.full_name ILIKE $${values.length} OR a.phone ILIKE $${values.length} OR a.reference ILIKE $${values.length})`)}
  const filter=where.join(' AND '),count=await pool.query(`SELECT count(*)::integer AS total FROM appointments a WHERE ${filter}`,values);
  const metrics=await pool.query(`SELECT count(*) FILTER (WHERE appointment_date=(now() AT TIME ZONE 'Asia/Manila')::date)::integer AS today,count(*) FILTER (WHERE status='pending')::integer AS pending,count(*) FILTER (WHERE status='confirmed')::integer AS confirmed,count(*)::integer AS total FROM appointments WHERE archived_at IS NULL`);
  values.push(pageSize,(page-1)*pageSize);
  const {rows}=await pool.query(`SELECT a.id,a.reference,a.doctor_id AS "doctorId",d.name AS "doctorName",a.appointment_date AS date,to_char(a.appointment_time,'HH24:MI') AS time,a.full_name AS "fullName",a.phone,a.email,a.service,a.message,a.status,a.sms_consent AS "smsConsent",a.reminder_status AS "reminderStatus",a.reminder_sent_at AS "reminderSentAt",a.reminder_attempted_at AS "reminderAttemptedAt",a.reminder_error AS "reminderError",a.created_at AS "createdAt" FROM appointments a LEFT JOIN doctors d ON d.id=a.doctor_id WHERE ${filter} ORDER BY a.appointment_date DESC,a.appointment_time LIMIT $${values.length-1} OFFSET $${values.length}`,values);
  res.json({items:rows,metrics:metrics.rows[0],pagination:{page,pageSize,total:count.rows[0].total,pages:Math.max(1,Math.ceil(count.rows[0].total/pageSize))}});
}catch(e){next(e)}});

app.patch('/api/admin/appointments/:id/archive',auth,csrf,requireRole('super_admin','appointment_manager'),async(req,res,next)=>{try{
  if(!validUuid(req.params.id))return res.status(400).json({error:'Invalid appointment.'});
  const reason=clean(req.body.reason,300);if(!reason)return res.status(400).json({error:'Provide an archive reason.'});
  const {rows}=await pool.query('UPDATE appointments SET archived_at=now(),archived_by=$1,archive_reason=$2,updated_at=now() WHERE id=$3 AND archived_at IS NULL RETURNING reference',[req.user.id,reason,req.params.id]);
  if(!rows[0])return res.status(404).json({error:'Appointment not found or already archived.'});await audit(req,'archive_appointment','appointment',req.params.id,{reference:rows[0].reference,reason});res.json({archived:true});
}catch(e){next(e)}});

app.get('/api/admin/audit-events',auth,requireRole('super_admin'),async(req,res,next)=>{try{
  const page=Math.max(1,Number.parseInt(req.query.page,10)||1),pageSize=25;
  const count=await pool.query('SELECT count(*)::integer AS total FROM admin_audit_events');
  const {rows}=await pool.query(`SELECT e.id,e.action,e.entity_type AS "entityType",e.entity_id AS "entityId",e.details,e.created_at AS "createdAt",a.name AS "adminName",a.email AS "adminEmail" FROM admin_audit_events e LEFT JOIN admins a ON a.id=e.admin_id ORDER BY e.created_at DESC LIMIT $1 OFFSET $2`,[pageSize,(page-1)*pageSize]);
  res.json({items:rows,pagination:{page,total:count.rows[0].total,pages:Math.max(1,Math.ceil(count.rows[0].total/pageSize))}});
}catch(e){next(e)}});

app.get('/api/admin/staff',auth,requireRole('super_admin'),async(req,res,next)=>{try{const {rows}=await pool.query('SELECT id,name,email,role,active,last_login_at AS "lastLoginAt",created_at AS "createdAt" FROM admins ORDER BY name');res.json(rows)}catch(e){next(e)}});
app.post('/api/admin/staff',auth,csrf,requireRole('super_admin'),async(req,res,next)=>{try{
  const name=clean(req.body.name,120),email=clean(req.body.email,200).toLowerCase(),role=clean(req.body.role,40),password=String(req.body.password||'');
  if(!name||!validEmail(email)||!adminRoles.includes(role)||password.length<16)return res.status(400).json({error:'Enter a valid name, email, role, and password of at least 16 characters.'});
  const staffId=id();await pool.query('INSERT INTO admins(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[staffId,name,email,hashPassword(password),role]);await audit(req,'create_staff','staff',staffId,{name,email,role});res.status(201).json({id:staffId,name,email,role,active:true});
}catch(e){if(e.code==='23505')return res.status(409).json({error:'That email already has an account.'});next(e)}});
app.patch('/api/admin/staff/:id',auth,csrf,requireRole('super_admin'),async(req,res,next)=>{try{
  if(!validUuid(req.params.id)||req.params.id===req.user.id)return res.status(400).json({error:'You cannot change your own access from this screen.'});
  const role=clean(req.body.role,40);if(!adminRoles.includes(role)||typeof req.body.active!=='boolean')return res.status(400).json({error:'Choose a valid role and account status.'});
  const {rows}=await pool.query('UPDATE admins SET role=$1,active=$2,updated_at=now() WHERE id=$3 RETURNING id,name,email,role,active',[role,req.body.active,req.params.id]);if(!rows[0])return res.status(404).json({error:'Staff account not found.'});if(!req.body.active)await pool.query('DELETE FROM admin_sessions WHERE admin_id=$1',[req.params.id]);await audit(req,'update_staff','staff',req.params.id,{role,active:req.body.active});res.json(rows[0]);
}catch(e){next(e)}});

// Permanent deletion is intentionally disabled; archive records through the
// administrator endpoint so retention and audit history remain intact.
app.delete('/api/appointments/:id',auth,csrf,(req,res)=>res.status(405).json({error:'Permanent deletion is disabled. Archive the appointment instead.'}));
app.use('/api/appointments/:id',auth,(req,res,next)=>{if(req.method!=='GET'&&!['super_admin','appointment_manager'].includes(req.user.role))return res.status(403).json({error:'Your account has read-only access.'});if(req.method==='PATCH')res.on('finish',()=>{if(res.statusCode<400)audit(req,'update_appointment','appointment',req.params.id,{status:req.body.status}).catch(()=>{})});next()});
app.use('/api/admin/reminders/run',auth,requireRole('super_admin','appointment_manager'));
app.get('/api/appointments',auth,(req,res)=>res.status(410).json({error:'Use the paginated administrator appointment endpoint.'}));

app.get('/api/admin/doctors',auth,async(req,res,next)=>{try{res.json(await getDoctors(true))}catch(e){next(e)}});
app.post('/api/admin/doctors',auth,csrf,async(req,res,next)=>{const client=await pool.connect();try{const name=clean(req.body.name,120),specialty=clean(req.body.specialty,160),credentials=clean(req.body.credentials,160),bio=clean(req.body.bio,800),languages=clean(req.body.languages,200),photoUrl=clean(req.body.photoUrl,500),accepting=req.body.acceptingNewPatients!==false,availability=req.body.availability||[],dates=(req.body.unavailableDates||[]).filter(validDate);if(!name||!specialty||!validSchedule(availability))return res.status(400).json({error:'Complete the doctor details and review the schedule.'});if(!validPhotoUrl(photoUrl))return res.status(400).json({error:'Use a secure HTTPS photo URL.'});await client.query('BEGIN');const doctor={id:id(),name,specialty};await client.query('INSERT INTO doctors(id,name,specialty,credentials,bio,languages,photo_url,accepting_new_patients) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[doctor.id,name,specialty,credentials,bio,languages,photoUrl,accepting]);await replaceSchedule(client,doctor.id,availability,dates);await client.query('COMMIT');res.status(201).json(await getDoctor(doctor.id,true))}catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}});
app.patch('/api/admin/doctors/:id',auth,csrf,async(req,res,next)=>{const client=await pool.connect();try{if(!validUuid(req.params.id))return res.status(400).json({error:'Invalid doctor.'});const current=await getDoctor(req.params.id,true);if(!current)return res.status(404).json({error:'Doctor not found.'});const name=req.body.name===undefined?current.name:clean(req.body.name,120),specialty=req.body.specialty===undefined?current.specialty:clean(req.body.specialty,160),credentials=req.body.credentials===undefined?current.credentials:clean(req.body.credentials,160),bio=req.body.bio===undefined?current.bio:clean(req.body.bio,800),languages=req.body.languages===undefined?current.languages:clean(req.body.languages,200),photoUrl=req.body.photoUrl===undefined?current.photoUrl:clean(req.body.photoUrl,500),accepting=req.body.acceptingNewPatients===undefined?current.acceptingNewPatients:req.body.acceptingNewPatients!==false,availability=req.body.availability===undefined?current.availability:req.body.availability,dates=req.body.unavailableDates===undefined?current.unavailableDates:req.body.unavailableDates.filter(validDate);if(!name||!specialty||!validSchedule(availability))return res.status(400).json({error:'Review the doctor details and schedule.'});if(!validPhotoUrl(photoUrl))return res.status(400).json({error:'Use a secure HTTPS photo URL.'});await client.query('BEGIN');await client.query('UPDATE doctors SET name=$1,specialty=$2,credentials=$3,bio=$4,languages=$5,photo_url=$6,accepting_new_patients=$7,active=$8,updated_at=now() WHERE id=$9',[name,specialty,credentials,bio,languages,photoUrl,accepting,req.body.active===undefined?current.active:req.body.active!==false,req.params.id]);await replaceSchedule(client,req.params.id,availability,dates);await client.query('COMMIT');res.json(await getDoctor(req.params.id,true))}catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}});
app.post('/api/admin/reminders/run',auth,csrf,async(req,res,next)=>{try{if(!process.env.SEMAPHORE_API_KEY)return res.status(503).json({error:'SMS reminders are not active. Add SEMAPHORE_API_KEY in Railway first.'});res.json(await processAppointmentReminders())}catch(e){next(e)}});
app.patch('/api/appointments/:id',auth,csrf,async(req,res,next)=>{try{if(!validUuid(req.params.id)||!appointmentStatuses.includes(req.body.status))return res.status(400).json({error:'Invalid appointment update.'});const {rows}=await pool.query('UPDATE appointments SET status=$1,updated_at=now() WHERE id=$2 AND archived_at IS NULL RETURNING *',[req.body.status,req.params.id]);if(!rows[0])return res.status(404).json({error:'Appointment not found.'});res.json(rows[0])}catch(e){if(e.code==='23505')return res.status(409).json({error:'That time already has an active appointment.'});next(e)}});

const PUBLIC_FILES=new Set(['index.html','patient-information.html','services.html','doctors.html','privacy.html','script.js','motion.js','doctors-directory.js','styles.css','services-modal.css','service-photos.css','private-hospital.css','privacy.css','booking-fix.css','hospital-refresh.css','modern.css','motion.css','launch-visibility.css']);
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/:file',(req,res,next)=>{if(!PUBLIC_FILES.has(req.params.file))return next();res.setHeader('Cache-Control','no-cache, must-revalidate');res.sendFile(path.join(__dirname,req.params.file))});
app.use('/images',express.static(path.join(__dirname,'images'),{dotfiles:'deny',maxAge:'7d',immutable:true}));
app.use((req,res)=>res.status(404).type('text').send('Not found.'));
app.use((error,req,res,next)=>{console.error(error.code||error.message);res.status(500).json({error:'The service could not complete your request. Please try again.'})});

async function start(){await initDatabase({adminEmail:(process.env.ADMIN_EMAIL||'admin@brillianthealthcare.com').toLowerCase(),adminName:'Clinic Administrator',adminPasswordHash:hashPassword(process.env.ADMIN_PASSWORD||'ChangeMe123!')});app.listen(PORT,'0.0.0.0',()=>console.log(`Brilliant Healthcare listening on ${PORT} with PostgreSQL`));startReminderScheduler()}
start().catch(error=>{console.error('Startup failed:',error.message);process.exit(1)});
