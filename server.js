const express = require('express');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const { pool, initDatabase, getDoctors, getDoctor, replaceSchedule } = require('./database');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Configure the Supabase transaction-pooler URL.');
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
if (IS_PRODUCTION && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16)) throw new Error('ADMIN_PASSWORD must contain at least 16 characters in production.');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE = '__Host-bh_admin';
const attempts = new Map();
const bookingAttempts = new Map();
const appointmentStatuses = ['pending','confirmed','completed','cancelled','declined'];

function id() { return crypto.randomUUID(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function verifyPassword(password, stored = '') { const [salt,key] = stored.split(':'); if (!salt || !key) return false; const actual=crypto.scryptSync(password,salt,64), expected=Buffer.from(key,'hex'); return actual.length===expected.length && crypto.timingSafeEqual(actual,expected); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
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
    const {rows}=await pool.query(`SELECT a.id,a.name,a.email,'admin' AS role FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[hashToken(token)]);
    if(!rows[0]) return res.status(401).json({error:'Session expired.'}); req.user=rows[0]; next();
  } catch(error){next(error)}
}
async function available(doctor,date,time) {
  if(!doctor||!validDate(date)||!validTime(time)||date<new Date().toISOString().slice(0,10)||doctor.unavailableDates.includes(date)) return false;
  const day=new Date(`${date}T12:00:00`).getDay(), rule=doctor.availability.find(x=>x.day===day); if(!rule) return false;
  const value=minutes(time),start=minutes(rule.start),end=minutes(rule.end); if(value<start||value+rule.slotMinutes>end||(value-start)%rule.slotMinutes!==0) return false;
  const {rows}=await pool.query(`SELECT 1 FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND appointment_time=$3 AND status NOT IN ('cancelled','declined')`,[doctor.id,date,time]);
  return !rows.length;
}

app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https:'],scriptSrc:["'self'"],connectSrc:["'self'"]}},crossOriginEmbedderPolicy:false}));
app.use(express.json({limit:'20kb',type:'application/json'}));
app.use((req,res,next)=>{res.setHeader('Permissions-Policy','geolocation=(), microphone=(), camera=()');next()});
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');next()});

app.get('/health',async(req,res,next)=>{try{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'})}catch(e){next(e)}});
app.post('/api/login',async(req,res,next)=>{try{
  if(rateLimited(attempts,req.ip,8,15*60_000)) return res.status(429).json({error:'Too many attempts. Try again later.'});
  const email=clean(req.body.email,200).toLowerCase(), {rows}=await pool.query('SELECT * FROM admins WHERE email=$1',[email]); const user=rows[0];
  if(!user||!verifyPassword(String(req.body.password||''),user.password_hash)) return res.status(401).json({error:'Invalid email or password.'});
  const token=crypto.randomBytes(32).toString('base64url'), expires=new Date(Date.now()+30*60_000); await pool.query('INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,$3)',[hashToken(token),user.id,expires]);
  res.cookie(COOKIE,token,{httpOnly:true,secure:IS_PRODUCTION,sameSite:'strict',path:'/',maxAge:30*60_000}); res.json({user:{name:user.name,email:user.email,role:'admin'}});
}catch(e){next(e)}});
app.post('/api/logout',auth,async(req,res,next)=>{try{const token=cookies(req)[COOKIE];await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[hashToken(token)]);res.clearCookie(COOKIE,{path:'/'});res.status(204).end()}catch(e){next(e)}});
app.get('/api/me',auth,(req,res)=>res.json(req.user));
app.get('/api/doctors',async(req,res,next)=>{try{res.json(await getDoctors(false))}catch(e){next(e)}});
app.get('/api/doctors/:id/slots',async(req,res,next)=>{try{const doctor=await getDoctor(req.params.id,false),date=clean(req.query.date,10);if(!doctor||!validDate(date))return res.status(400).json({error:'Choose a valid doctor and date.'});const day=new Date(`${date}T12:00:00`).getDay(),rule=doctor.availability.find(x=>x.day===day),slots=[];if(rule)for(let value=minutes(rule.start);value+rule.slotMinutes<=minutes(rule.end);value+=rule.slotMinutes){const time=`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;slots.push({time,available:await available(doctor,date,time)})}res.json({doctor,date,unavailable:doctor.unavailableDates.includes(date),slots})}catch(e){next(e)}});
app.post('/api/appointments',async(req,res,next)=>{try{
  if(rateLimited(bookingAttempts,req.ip,6,10*60_000)) return res.status(429).json({error:'Too many booking requests. Please wait and try again.'});
  const doctorId=clean(req.body.doctorId,40),date=clean(req.body.date,10),time=clean(req.body.time,5),doctor=await getDoctor(doctorId,false);
  const fullName=clean(req.body.fullName,120),phone=clean(req.body.phone,40),email=clean(req.body.email,200),service=clean(req.body.service,80),message=clean(req.body.message,1000);
  if(!fullName||!phone||!service||!(await available(doctor,date,time))) return res.status(400).json({error:'This time is unavailable or required details are missing. Please choose another slot.'});
  const reference=`BH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  try{await pool.query(`INSERT INTO appointments(id,reference,doctor_id,appointment_date,appointment_time,full_name,phone,email,service,message) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id(),reference,doctorId,date,time,fullName,phone,email||null,service,message])}catch(error){if(error.code==='23505')return res.status(409).json({error:'That time was just reserved. Please choose another slot.'});throw error}
  res.status(201).json({reference,status:'pending',message:'Your slot is reserved pending clinic confirmation.'});
}catch(e){next(e)}});

app.get('/api/admin/doctors',auth,async(req,res,next)=>{try{res.json(await getDoctors(true))}catch(e){next(e)}});
app.post('/api/admin/doctors',auth,async(req,res,next)=>{const client=await pool.connect();try{const name=clean(req.body.name,120),specialty=clean(req.body.specialty,160),credentials=clean(req.body.credentials,160),bio=clean(req.body.bio,800),languages=clean(req.body.languages,200),photoUrl=clean(req.body.photoUrl,500),accepting=req.body.acceptingNewPatients!==false,availability=req.body.availability||[],dates=(req.body.unavailableDates||[]).filter(validDate);if(!name||!specialty||!validSchedule(availability))return res.status(400).json({error:'Complete the doctor details and review the schedule.'});if(!validPhotoUrl(photoUrl))return res.status(400).json({error:'Use a secure HTTPS photo URL.'});await client.query('BEGIN');const doctor={id:id(),name,specialty};await client.query('INSERT INTO doctors(id,name,specialty,credentials,bio,languages,photo_url,accepting_new_patients) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[doctor.id,name,specialty,credentials,bio,languages,photoUrl,accepting]);await replaceSchedule(client,doctor.id,availability,dates);await client.query('COMMIT');res.status(201).json(await getDoctor(doctor.id,true))}catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}});
app.patch('/api/admin/doctors/:id',auth,async(req,res,next)=>{const client=await pool.connect();try{const current=await getDoctor(req.params.id,true);if(!current)return res.status(404).json({error:'Doctor not found.'});const name=req.body.name===undefined?current.name:clean(req.body.name,120),specialty=req.body.specialty===undefined?current.specialty:clean(req.body.specialty,160),credentials=req.body.credentials===undefined?current.credentials:clean(req.body.credentials,160),bio=req.body.bio===undefined?current.bio:clean(req.body.bio,800),languages=req.body.languages===undefined?current.languages:clean(req.body.languages,200),photoUrl=req.body.photoUrl===undefined?current.photoUrl:clean(req.body.photoUrl,500),accepting=req.body.acceptingNewPatients===undefined?current.acceptingNewPatients:req.body.acceptingNewPatients!==false,availability=req.body.availability===undefined?current.availability:req.body.availability,dates=req.body.unavailableDates===undefined?current.unavailableDates:req.body.unavailableDates.filter(validDate);if(!name||!specialty||!validSchedule(availability))return res.status(400).json({error:'Review the doctor details and schedule.'});if(!validPhotoUrl(photoUrl))return res.status(400).json({error:'Use a secure HTTPS photo URL.'});await client.query('BEGIN');await client.query('UPDATE doctors SET name=$1,specialty=$2,credentials=$3,bio=$4,languages=$5,photo_url=$6,accepting_new_patients=$7,active=$8,updated_at=now() WHERE id=$9',[name,specialty,credentials,bio,languages,photoUrl,accepting,req.body.active===undefined?current.active:req.body.active!==false,req.params.id]);await replaceSchedule(client,req.params.id,availability,dates);await client.query('COMMIT');res.json(await getDoctor(req.params.id,true))}catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}});
app.get('/api/appointments',auth,async(req,res,next)=>{try{const {rows}=await pool.query(`SELECT a.id,a.reference,a.doctor_id AS "doctorId",d.name AS "doctorName",a.appointment_date AS date,to_char(a.appointment_time,'HH24:MI') AS time,a.full_name AS "fullName",a.phone,a.email,a.service,a.message,a.status,a.created_at AS "createdAt" FROM appointments a LEFT JOIN doctors d ON d.id=a.doctor_id ORDER BY a.appointment_date,a.appointment_time`);res.json(rows)}catch(e){next(e)}});
app.patch('/api/appointments/:id',auth,async(req,res,next)=>{try{if(!appointmentStatuses.includes(req.body.status))return res.status(400).json({error:'Invalid status.'});const {rows}=await pool.query('UPDATE appointments SET status=$1,updated_at=now() WHERE id=$2 RETURNING *',[req.body.status,req.params.id]);if(!rows[0])return res.status(404).json({error:'Appointment not found.'});res.json(rows[0])}catch(e){if(e.code==='23505')return res.status(409).json({error:'That time already has an active appointment.'});next(e)}});
app.delete('/api/appointments/:id',auth,async(req,res,next)=>{try{const result=await pool.query('DELETE FROM appointments WHERE id=$1',[req.params.id]);if(!result.rowCount)return res.status(404).json({error:'Appointment not found.'});res.status(204).end()}catch(e){next(e)}});

app.use(express.static(__dirname,{maxAge:'1d',index:'index.html',setHeaders:(res,filePath)=>{if(/\.(?:html|js|css)$/i.test(filePath))res.setHeader('Cache-Control','no-cache, must-revalidate')}}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.use((error,req,res,next)=>{console.error(error.code||error.message);res.status(500).json({error:'The service could not complete your request. Please try again.'})});

async function start(){await initDatabase({adminEmail:(process.env.ADMIN_EMAIL||'admin@brillianthealthcare.com').toLowerCase(),adminName:'Clinic Administrator',adminPasswordHash:hashPassword(process.env.ADMIN_PASSWORD||'ChangeMe123!')});app.listen(PORT,'0.0.0.0',()=>console.log(`Brilliant Healthcare listening on ${PORT} with PostgreSQL`))}
start().catch(error=>{console.error('Startup failed:',error.message);process.exit(1)});
