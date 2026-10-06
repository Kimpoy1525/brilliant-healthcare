const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const profiles = require('../physician-profiles.json');
test('doctor refresh retains legacy IDs and schedules and creates missing physicians only once', async () => {
 const rows=[{id:'legacy-james',name:'Dr. James Raphael'}];
 const statements=[];
 const pool={async query(sql,args=[]) {
  statements.push(sql);
  if(sql.startsWith('SELECT id FROM doctors')) {
   const found=rows.find(row=>args[0].includes(row.name.replace(/^Dr[.]?\s*/i,'').toLowerCase()));
   return {rows:found?[{id:found.id}]:[]};
  }
  if(sql.startsWith('UPDATE doctors')) Object.assign(rows.find(row=>row.id===args[4]),{name:args[0],specialty:args[1],photo:args[3]});
  if(sql.startsWith('INSERT INTO doctors')) rows.push({id:args[0],name:args[1],specialty:args[2],photo:args[4]});
  return {rows:[]};
 }};
 const context={module:{exports:{}},process:{env:{DATABASE_URL:'postgresql://test:test@localhost/test'}},URL,require(name) {
  if(name==='pg') return {Pool:class {constructor(){return pool}},types:{setTypeParser(){}}};
  if(name==='./physician-profiles.json') return profiles;
  return require(name);
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../database'),'utf8'),context);
 const init=context.module.exports.initDatabase;
 for(let i=0;i<2;i++) await init({adminEmail:'test@example.com',adminName:'Test',adminPasswordHash:'fixture'});
 assert.equal(rows.length,4);
 assert.equal(rows[0].id,'legacy-james');
 assert.equal(rows[0].specialty,'Diabetologist');
 assert.equal(rows[0].photo,'/images/doctors/james-estrada.png');
 assert.ok(rows.every(row=>profiles.some(p=>p.name===row.name && p.specialty===row.specialty)));
 assert.ok(!statements.some(sql=>/^(INSERT INTO|UPDATE|DELETE FROM) (doctor_schedules|doctor_unavailable_dates|appointments)\b/.test(sql)));
});
