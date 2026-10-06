"use strict";
// Loaded only on the appointment page. API contracts and pending confirmation remain unchanged.
const form=document.getElementById('contactForm');
const doctorSelect=document.getElementById('doctorSelect');
const dateInput=document.getElementById('appointmentDate');
const timeInput=document.getElementById('appointmentTime');
const slots=document.getElementById('timeSlots');
const slotHelp=document.getElementById('slotHelp');
const calendar=document.getElementById('scheduleCalendar');
const calendarDays=document.getElementById('calendarDays');
const calendarMonth=document.getElementById('calendarMonth');
const retrySlots=document.getElementById('retrySlots');
const result=document.getElementById('bookingResult');
let doctors=[],slotController,slotRequest=0,submitting=false;
function clinicDate(offset=0){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts().filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));const day=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);day.setUTCDate(day.getUTCDate()+offset);return day.toISOString().slice(0,10)}
dateInput.min=clinicDate();dateInput.max=clinicDate(90);
let calendarCursor=new Date(`${dateInput.min.slice(0,7)}-01T12:00:00`);
function message(text,error=false){result.textContent=text;result.setAttribute('role',error?'alert':'status');result.focus();}
function resetTimes(){slotRequest++;slotController?.abort();timeInput.value='';slots.replaceChildren();retrySlots.hidden=true;slots.setAttribute('aria-busy','false');slotHelp.textContent='Choose a doctor and date to see available times.'}
function formatTime(value){const [h,m]=value.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`}
function renderCalendar(){
 const doctor=doctors.find(d=>d.id===doctorSelect.value);calendarDays.replaceChildren();calendar.hidden=!doctor;if(!doctor)return;
 calendarMonth.textContent=calendarCursor.toLocaleDateString('en-PH',{month:'long',year:'numeric'});
 const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
 for(let n=0;n<new Date(year,month,1).getDay();n++)calendarDays.append(document.createElement('span'));
 for(let n=1;n<=new Date(year,month+1,0).getDate();n++){
  const day=new Date(year,month,n,12);const value=`${year}-${String(month+1).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
  const available=value>=dateInput.min&&value<=dateInput.max&&doctor.availability.some(rule=>rule.day===day.getDay())&&!(doctor.unavailableDates||[]).includes(value)&&doctor.acceptingNewPatients!==false;
  const selected=value===dateInput.value;const button=document.createElement('button');button.type='button';button.className=`calendar-day${selected?' calendar-selected':''}`;button.textContent=selected?`${n} ✓`:String(n);button.disabled=!available;button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',`${day.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}, ${selected?'selected':available?'available':'unavailable'}`);
  button.addEventListener('click',()=>{dateInput.value=value;renderCalendar();loadSlots()});calendarDays.append(button);
 }
 document.getElementById('doctorHelp').textContent=doctor.availability.length?'Dates are shown in Philippine time. Clinic confirmation is required.':'No clinic schedule is published for this doctor. Call (0956) 685 7606.';
 document.getElementById('previousMonth').disabled=calendarCursor.toISOString().slice(0,7)<=dateInput.min.slice(0,7);
 document.getElementById('nextMonth').disabled=calendarCursor.toISOString().slice(0,7)>=dateInput.max.slice(0,7);
}
async function loadSlots(){
 resetTimes();if(!doctorSelect.value||!dateInput.value)return;
 const request=slotRequest;const physician=doctorSelect.value,date=dateInput.value;const controller=new AbortController();slotController=controller;
 const timeout=setTimeout(()=>controller.abort(),8000);slotHelp.textContent='Loading available times…';slots.setAttribute('aria-busy','true');
 try{
  const response=await fetch(`/api/doctors/${encodeURIComponent(physician)}/slots?date=${encodeURIComponent(date)}`,{signal:controller.signal,cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Schedule unavailable.');
  if(request!==slotRequest||physician!==doctorSelect.value||date!==dateInput.value)return;
  if(!Array.isArray(data.slots)||data.slots.some(slot=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time)||typeof slot.available!=='boolean'))throw Error('Schedule unavailable.');
  const available=data.slots.some(slot=>slot.available)&&!data.unavailable;
  slotHelp.textContent=available?'Select an available time. Unavailable times are labelled and disabled.':'No appointment times are available on this date. Choose another date or call the clinic.';
  for(const slot of data.slots){const button=document.createElement('button');const open=slot.available&&!data.unavailable;button.type='button';button.className='time-slot';button.disabled=!open;button.textContent=`${formatTime(slot.time)} · ${open?'Available':'Unavailable'}`;button.setAttribute('aria-pressed','false');button.dataset.time=slot.time;button.addEventListener('click',()=>{for(const other of slots.children){other.classList.remove('selected');other.setAttribute('aria-pressed','false');other.textContent=`${formatTime(other.dataset.time)} ? ${other.disabled?'Unavailable':'Available'}`}button.classList.add('selected');button.setAttribute('aria-pressed','true');timeInput.value=slot.time;button.textContent=`${formatTime(slot.time)} · Selected ✓`});slots.append(button)}
 }catch(error){if(request===slotRequest){slotHelp.textContent='We couldn’t load available times. Please try again or call the clinic.';retrySlots.hidden=false}}
 finally{clearTimeout(timeout);if(request===slotRequest)slots.setAttribute('aria-busy','false')}
}
doctorSelect.addEventListener('change',()=>{dateInput.value='';resetTimes();calendarCursor=new Date(`${dateInput.min.slice(0,7)}-01T12:00:00`);renderCalendar()});
for(const [id,direction] of [['previousMonth',-1],['nextMonth',1]])document.getElementById(id).addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+direction,1,12);renderCalendar()});
retrySlots.addEventListener('click',loadSlots);
function validate(){
 form.querySelectorAll('.field-error').forEach(node=>node.remove());form.querySelectorAll('[aria-invalid]').forEach(node=>{node.removeAttribute('aria-invalid');if(node.dataset.originalDescribedby)node.setAttribute('aria-describedby',node.dataset.originalDescribedby);else node.removeAttribute('aria-describedby')});let first;
 for(const input of form.elements){if(!input.willValidate||input.validity.valid)continue;input.setAttribute('aria-invalid','true');const error=document.createElement('p');error.className='field-error';error.id=`error-${input.name}`;error.textContent=input.validity.valueMissing?'This field is required.':input.name==='phone'?'Enter a Philippine mobile number without spaces.':input.validationMessage;input.dataset.originalDescribedby??=input.getAttribute('aria-describedby')||'';input.setAttribute('aria-describedby',`${input.dataset.originalDescribedby} ${error.id}`.trim());input.closest('label')?.after(error);first??=input}
 if(first){first.focus();return false}if(!timeInput.value){slots.focus();message('Please select an available appointment time.',true);return false}return true;
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(submitting||!validate())return;submitting=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;submit.textContent='Sending request…';
 try{const payload=Object.fromEntries(new FormData(form));payload.smsConsent=form.elements.smsConsent.checked;const response=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error||'The clinic could not accept this request.');form.reset();resetTimes();renderCalendar();message(`Request received. Reference: ${data.reference}. Your appointment is pending clinic confirmation. Please contact the clinic to confirm your visit.`)}
 catch(error){message((error.name==='TimeoutError'||error.name==='TypeError')?'We could not confirm whether your request was received. Call the clinic before submitting again.':error.message||'We could not submit your request. Please call the clinic.',true);await loadSlots()}
 finally{submitting=false;submit.disabled=false;submit.textContent='Send appointment request'}
});
async function initialize(){
 try{const statusResponse=await fetch('/api/booking-status',{cache:'no-store'});if(!statusResponse.ok)return;const state=await statusResponse.json();if(!state.enabled)return;
 const response=await fetch('/api/doctors',{cache:'no-store'});if(!response.ok)throw Error('Directory unavailable');const data=await response.json();if(!Array.isArray(data)||data.some(d=>typeof d.id!=='string'||typeof d.name!=='string'||!Array.isArray(d.availability)))throw Error('Directory unavailable');doctors=data;
 for(const doctor of doctors)doctorSelect.add(new Option(`${doctor.name} — ${doctor.specialty}`,doctor.id));
 document.getElementById('bookingClosed').hidden=true;form.hidden=false;
 const params=new URLSearchParams(location.search);if(doctors.some(d=>d.id===params.get('doctor'))){doctorSelect.value=params.get('doctor');renderCalendar()}
 if([...form.elements.service.options].some(o=>o.value===params.get('service')))form.elements.service.value=params.get('service');
 if(!doctors.length)document.getElementById('doctorHelp').textContent='No physician schedules are published. Please call the clinic.';
 }catch{document.getElementById('bookingClosed').hidden=false;form.hidden=true}
}
initialize();
