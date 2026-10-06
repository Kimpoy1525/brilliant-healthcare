// Isolated operational fixture: in-memory records; no PostgreSQL, patient data or SMS.
const {EventEmitter}=require('node:events');
const crypto=require('node:crypto');
process.env.DATABASE_URL='postgresql://fixture:fixture@127.0.0.1/fixture';process.env.NODE_ENV='test';process.env.PUBLIC_BOOKING_ENABLED='true';
delete process.env.RAILWAY_ENVIRONMENT;delete process.env.SEMAPHORE_API_KEY;
const salt='fixture-salt';const passwordHash=`${salt}:${crypto.scryptSync('FixturePassword123!',salt,64).toString('hex')}`;
const users=[{id:'00000000-0000-4000-8000-000000000001',name:'Fixture Admin',email:'admin@example.test',role:'super_admin',password_hash:passwordHash,active:true},{id:'00000000-0000-4000-8000-000000000002',name:'Fixture Viewer',email:'viewer@example.test',role:'viewer',password_hash:passwordHash,active:true}];
const sessions=new Map(),appointments=[];
const profiles=require('../../physician-profiles.json');
const doctors=profiles.map((p,i)=>({...p,id:`00000000-0000-4000-8000-00000000001${i}`,active:true,credentials:'',languages:'',acceptingNewPatients:true,unavailableDates:[],availability:i?[]:Array.from({length:7},(_,day)=>({day,start:'09:00',end:'10:00',slotMinutes:30}))}));
const pool=new EventEmitter();pool.end=async()=>{};
pool.connect=async()=>{const error=new Error('Sensitive connection details should not be returned');error.code='ECONNREFUSED';throw error};
pool.query=async(sql,args=[])=>{
 if(typeof sql==='object')sql=sql.text;
 if(sql.includes('SELECT * FROM admins'))return {rows:users.filter(u=>u.email===args[0])};
 if(sql.includes('JOIN admins a ON'))return {rows:sessions.has(args[0])?[users.find(u=>u.id===sessions.get(args[0]))]:[]};
 if(sql.startsWith('INSERT INTO admin_sessions'))sessions.set(args[0],args[1]);
 if(sql.startsWith('DELETE FROM admin_sessions')){if(sql.includes('token_hash'))sessions.delete(args[0]);else for(const [key,id] of sessions)if(id===args[0])sessions.delete(key)}
 if(sql.startsWith('SELECT 1 FROM appointments'))return {rows:appointments.filter(a=>a.doctorId===args[0]&&a.date===args[1]&&a.time===args[2])};
 if(sql.startsWith('INSERT INTO appointments')){if(appointments.some(a=>a.doctorId===args[2]&&a.date===args[3]&&a.time===args[4])){const error=new Error('duplicate');error.code='23505';throw error}appointments.push({id:args[0],reference:args[1],doctorId:args[2],date:args[3],time:args[4],fullName:args[5],status:'pending'})}
 if(sql.startsWith('SELECT count(*)::integer AS total FROM appointments a'))return {rows:[{total:appointments.length}]};
 if(sql.startsWith('SELECT count(*) FILTER'))return {rows:[{today:0,pending:appointments.length,confirmed:0,total:appointments.length}]};
 if(sql.startsWith('SELECT a.id,a.reference'))return {rows:appointments};
 if(sql.startsWith('SELECT id,name,email,role,active'))return {rows:users.map(({password_hash,...u})=>u)};
 if(sql.startsWith('SELECT count(*)::integer AS total FROM admin_audit_events'))return {rows:[{total:0}]};
 if(sql.startsWith('SELECT e.id,e.action'))return {rows:[]};
 return {rows:[]};
};
require.cache[require.resolve('../../database')]={exports:{pool,initDatabase:async()=>{},getDoctors:async()=>doctors,getDoctor:async id=>doctors.find(d=>d.id===id),isLoginBlocked:async()=>false,recordLoginFailure:async()=>{},clearLoginFailures:async()=>{},replaceSchedule:async()=>{}}};
require.cache[require.resolve('../../sms-reminders')]={exports:{startReminderScheduler(){},normalizePhilippineMobile:value=>/^09\d{9}$/.test(value)?'63'+value.slice(1):null,processAppointmentReminders:async()=>{throw Error('Never send fixture SMS')}}};
require('../../server');
