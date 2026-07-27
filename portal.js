"use strict";
const token=()=>true,headers=()=>({"Content-Type":"application/json"});
const loginView=document.getElementById("loginView"),dashboard=document.getElementById("dashboard"),identity=document.getElementById("identity"),logout=document.getElementById("logout"),notice=document.getElementById("portalNotice");
const loading=document.getElementById("portalLoading"),loadingText=document.getElementById("portalLoadingText"),loginSubmit=document.getElementById("loginSubmit");
const adminPassword=document.getElementById("adminPassword"),togglePassword=document.getElementById("togglePassword");
let currentUser,appointments=[],inactivityTimer;
function showLoading(message){loadingText.textContent=message;loading.hidden=false}
function hideLoading(){loading.hidden=true}
function armSessionTimeout(){clearTimeout(inactivityTimer);if(currentUser)inactivityTimer=setTimeout(()=>secureLogout("You were signed out after 15 minutes of inactivity."),15*60_000)}
function concealPassword(){adminPassword.type="password";togglePassword.textContent="Show";togglePassword.setAttribute("aria-pressed","false")}
togglePassword.addEventListener("click",()=>{const visible=adminPassword.type==="text";adminPassword.type=visible?"password":"text";togglePassword.textContent=visible?"Show":"Hide";togglePassword.setAttribute("aria-pressed",String(!visible));adminPassword.focus()});
function notify(message){notice.textContent=message;notice.classList.add("show");setTimeout(()=>notice.classList.remove("show"),3500)}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{...headers(),...(options.headers||{})}});if(response.status===401){showLogin();throw new Error("Please sign in again.")}const data=response.status===204?null:await response.json();if(!response.ok)throw new Error(data.error||"Request failed.");return data}
function showLogin(){clearTimeout(inactivityTimer);currentUser=undefined;concealPassword();loginView.hidden=false;dashboard.hidden=true;logout.hidden=true;identity.textContent=""}
async function boot(){
    showLoading("Loading your secure dashboard…");
    try{currentUser=await api("/api/me");loginView.hidden=true;dashboard.hidden=false;logout.hidden=false;identity.textContent=`${currentUser.name} · ${currentUser.role}`;document.getElementById("dashboardTitle").textContent=currentUser.role==="admin"?"Administrator dashboard":"Doctor dashboard";document.getElementById("adminTools").hidden=currentUser.role!=="admin";document.getElementById("scheduleTools").hidden=currentUser.role!=="doctor";if(currentUser.role==="admin")await loadDoctors();else await loadSchedule();await loadAppointments();armSessionTimeout()}catch(error){document.getElementById("loginError").textContent=error.message;showLogin()}finally{hideLoading()}
}
document.getElementById("loginForm").addEventListener("submit",async event=>{
    event.preventDefault();const error=document.getElementById("loginError");error.textContent="";loginSubmit.disabled=true;loginSubmit.querySelector("span").textContent="Signing in…";showLoading("Verifying your credentials…");
    try{await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d});event.target.reset();await boot()}catch(e){error.textContent=e.message;hideLoading()}finally{loginSubmit.disabled=false;loginSubmit.querySelector("span").textContent="Sign in securely"}
});
async function secureLogout(message){showLoading("Signing out securely…");try{await fetch("/api/logout",{method:"POST"})}catch{}showLogin();hideLoading();if(message)notify(message)}
logout.addEventListener("click",()=>secureLogout());document.getElementById("refresh").addEventListener("click",boot);
["pointerdown","keydown"].forEach(type=>document.addEventListener(type,()=>{if(currentUser)armSessionTimeout()},{passive:true}));
let adminDoctors=[];
function scheduleSummary(doctor){if(!doctor.availability.length)return "No working schedule published";return doctor.availability.map(rule=>`${days[rule.day].slice(0,3)} ${rule.start}–${rule.end}`).join(" · ")}
async function loadDoctors(){adminDoctors=await api("/api/admin/doctors");const list=document.getElementById("doctorList");list.replaceChildren();if(!document.getElementById("adminWeekSchedule").children.length)buildWeek([],"adminWeekSchedule");adminDoctors.forEach(d=>{const row=document.createElement("div");row.className="doctor-row";const meta=document.createElement("div");meta.className="doctor-meta";const name=document.createElement("strong");name.textContent=`${d.name} — ${d.specialty}`;const schedule=document.createElement("small");schedule.textContent=`${d.active?"Active":"Inactive"} · ${d.acceptingNewPatients?"Accepting new patients":"Not accepting new patients"} · ${scheduleSummary(d)}`;meta.append(name,schedule);const buttons=document.createElement("div");buttons.className="doctor-buttons";const edit=document.createElement("button");edit.type="button";edit.className="button-link admin-link";edit.textContent="Edit profile & schedule";edit.onclick=()=>editDoctor(d);const toggle=document.createElement("button");toggle.type="button";toggle.className="button-link admin-link";toggle.textContent=d.active?"Deactivate":"Activate";toggle.onclick=async()=>{await api(`/api/admin/doctors/${d.id}`,{method:"PATCH",body:JSON.stringify({active:!d.active})});notify("Doctor updated.");loadDoctors()};buttons.append(edit,toggle);row.append(meta,buttons);list.append(row)})}
function updatePhotoPreview(value){const preview=document.getElementById("doctorPhotoPreview");preview.src=value||"images/generic-doctor.png";preview.onerror=()=>{preview.onerror=null;preview.src="images/generic-doctor.png"}}
function editDoctor(doctor){const form=document.getElementById("doctorForm");form.elements.doctorId.value=doctor.id;form.elements.name.value=doctor.name;form.elements.specialty.value=doctor.specialty;form.elements.credentials.value=doctor.credentials||"";form.elements.languages.value=doctor.languages||"";form.elements.bio.value=doctor.bio||"";form.elements.photoUrl.value=doctor.photoUrl||"";form.elements.acceptingNewPatients.checked=doctor.acceptingNewPatients!==false;form.elements.unavailableDates.value=(doctor.unavailableDates||[]).join(", ");updatePhotoPreview(doctor.photoUrl);buildWeek(doctor.availability,"adminWeekSchedule");document.getElementById("doctorFormTitle").textContent="Edit doctor profile and schedule";document.getElementById("doctorSubmitText").textContent="Save profile and schedule";document.getElementById("cancelDoctorEdit").hidden=false;document.getElementById("adminTools").scrollIntoView({behavior:"smooth"})}
function resetDoctorForm(){const form=document.getElementById("doctorForm");form.reset();form.elements.doctorId.value="";form.elements.acceptingNewPatients.checked=true;updatePhotoPreview("");buildWeek([],"adminWeekSchedule");document.getElementById("doctorFormTitle").textContent="Add a doctor and schedule";document.getElementById("doctorSubmitText").textContent="Add doctor and publish schedule";document.getElementById("cancelDoctorEdit").hidden=true}
document.getElementById("cancelDoctorEdit").addEventListener("click",resetDoctorForm);
document.getElementById("doctorForm").addEventListener("submit",async event=>{event.preventDefault();const form=event.target,doctorId=form.elements.doctorId.value;const availability=readWeek("adminWeekSchedule"),unavailableDates=form.elements.unavailableDates.value.split(",").map(x=>x.trim()).filter(Boolean);if(!availability.length){notify("Select at least one working day.");return}const body={name:form.elements.name.value,specialty:form.elements.specialty.value,credentials:form.elements.credentials.value,languages:form.elements.languages.value,bio:form.elements.bio.value,photoUrl:form.elements.photoUrl.value,acceptingNewPatients:form.elements.acceptingNewPatients.checked,availability,unavailableDates};try{if(doctorId)await api(`/api/admin/doctors/${doctorId}`,{method:"PATCH",body:JSON.stringify(body)});else await api("/api/admin/doctors",{method:"POST",body:JSON.stringify(body)});resetDoctorForm();notify(doctorId?"Doctor profile and schedule updated.":"Doctor profile published and is now visible on the website.");loadDoctors()}catch(e){notify(e.message)}});
document.getElementById("doctorForm").elements.photoUrl.addEventListener("input",event=>updatePhotoPreview(event.target.value.trim()));
document.getElementById("loadDoctorTemplate").addEventListener("click",()=>{const form=document.getElementById("doctorForm");form.elements.name.value="Dr. James Estrada";form.elements.specialty.value="Nephrology";form.elements.credentials.value="MD, FPCP, FPSN";form.elements.languages.value="English, Filipino";form.elements.bio.value="Provides evidence-based kidney care, dialysis consultations, and long-term renal health management with a patient-centered approach.";form.elements.photoUrl.value="";form.elements.acceptingNewPatients.checked=true;updatePhotoPreview("");buildWeek([1,2,3,4,5].map(day=>({day,start:"09:00",end:"17:00",slotMinutes:30})),"adminWeekSchedule");notify("Example loaded. Verify every detail and add an approved photo before publishing.")});
const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function buildWeek(schedule=[],rootId="weekSchedule"){const root=document.getElementById(rootId);root.replaceChildren();days.forEach((name,day)=>{const value=schedule.find(x=>x.day===day);const row=document.createElement("div");row.className="day-row";row.dataset.day=day;row.innerHTML=`<label class="day-toggle"><input class="enabled" type="checkbox" ${value?"checked":""}>${name}</label><label>Starts<input class="start" type="time" value="${value?.start||"09:00"}"></label><label>Ends<input class="end" type="time" value="${value?.end||"17:00"}"></label><label>Slot length<select class="duration"><option>15</option><option selected>30</option><option>45</option><option>60</option></select></label>`;row.querySelector(".duration").value=String(value?.slotMinutes||30);root.append(row)})}
function readWeek(rootId){return[...document.querySelectorAll(`#${rootId} .day-row`)].filter(r=>r.querySelector(".enabled").checked).map(r=>({day:Number(r.dataset.day),start:r.querySelector(".start").value,end:r.querySelector(".end").value,slotMinutes:Number(r.querySelector(".duration").value)}))}
async function loadSchedule(){const d=await api("/api/doctor/schedule");buildWeek(d.availability);document.getElementById("unavailableDates").value=(d.unavailableDates||[]).join(", ")}
document.getElementById("scheduleForm").addEventListener("submit",async event=>{event.preventDefault();const availability=[...document.querySelectorAll(".day-row")].filter(r=>r.querySelector(".enabled").checked).map(r=>({day:Number(r.dataset.day),start:r.querySelector(".start").value,end:r.querySelector(".end").value,slotMinutes:Number(r.querySelector(".duration").value)}));const unavailableDates=document.getElementById("unavailableDates").value.split(",").map(x=>x.trim()).filter(Boolean);try{await api("/api/doctor/schedule",{method:"PUT",body:JSON.stringify({availability,unavailableDates})});notify("Schedule published.")}catch(e){notify(e.message)}});
async function loadAppointments(){appointments=await api("/api/appointments");renderAppointments()}
function renderAppointments(){const filter=document.getElementById("statusFilter").value,root=document.getElementById("appointments"),items=appointments.filter(a=>!filter||a.status===filter);root.replaceChildren();if(!items.length){root.innerHTML='<p class="empty">No appointments found.</p>';return}items.forEach(a=>{const card=document.createElement("article");card.className="appointment-card";const when=document.createElement("div");when.className="appointment-time";when.innerHTML=`<strong>${a.date} · ${a.time}</strong><span class="status-pill">${a.status}</span>`;const detail=document.createElement("div");detail.className="appointment-detail";detail.textContent=`${a.fullName} · ${a.phone} · ${a.email||"No email"} · ${a.service} · Ref ${a.reference}${a.message?` · ${a.message}`:""}`;const actions=document.createElement("div");actions.className="appointment-actions";const select=document.createElement("select");["pending","confirmed","completed","cancelled","declined"].forEach(s=>select.add(new Option(s,s,s===a.status,s===a.status)));select.onchange=async()=>{try{await api(`/api/appointments/${a.id}`,{method:"PATCH",body:JSON.stringify({status:select.value})});notify("Appointment updated.");loadAppointments()}catch(e){notify(e.message)}};const remove=document.createElement("button");remove.type="button";remove.className="button-link delete-link";remove.textContent="Delete record";remove.onclick=async()=>{if(!confirm(`Permanently delete appointment ${a.reference}? This cannot be undone.`))return;try{await api(`/api/appointments/${a.id}`,{method:"DELETE"});notify("Appointment record deleted.");loadAppointments()}catch(e){notify(e.message)}};actions.append(select,remove);card.append(when,detail,actions);root.append(card)})}
function localDateValue(date=new Date()){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function appointmentDate(value){return String(value||"").slice(0,10)}
function displayDate(value){const date=appointmentDate(value);return new Date(`${date}T12:00:00`).toLocaleDateString([],{weekday:"short",month:"short",day:"numeric",year:"numeric"})}
function displayTime(value){return new Date(`2000-01-01T${value}:00`).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
function serviceName(value){return({"hemodialysis":"Hemodialysis","peritoneal-dialysis":"Peritoneal Dialysis","lab-diagnostics":"Lab Diagnostics","cardiac":"Cardiac Diagnostics","radiology":"Radiology & Imaging","checkup":"Health Checkup","other":"Other"})[value]||value}
function patientField(label,value,href){
    const field=document.createElement("div");field.className="patient-field";
    const name=document.createElement("small");name.textContent=label;
    const content=document.createElement(href?"a":"span");content.textContent=value||"Not provided";
    if(href&&value)content.href=href+encodeURIComponent(value);
    field.append(name,content);return field;
}
function updateMetrics(){
    const today=localDateValue();
    document.getElementById("todayCount").textContent=appointments.filter(a=>appointmentDate(a.date)===today).length;
    document.getElementById("pendingCount").textContent=appointments.filter(a=>a.status==="pending").length;
    document.getElementById("confirmedCount").textContent=appointments.filter(a=>a.status==="confirmed").length;
    document.getElementById("totalCount").textContent=appointments.length;
}
async function loadAppointments(){appointments=await api("/api/appointments");updateMetrics();renderAppointments()}
function renderAppointments(){
    const status=document.getElementById("statusFilter").value,date=document.getElementById("dateFilter").value,root=document.getElementById("appointments");
    const items=appointments.filter(a=>(!status||a.status===status)&&(!date||appointmentDate(a.date)===date));
    document.getElementById("appointmentResultCount").textContent=`${items.length} ${items.length===1?"record":"records"}`;
    root.replaceChildren();
    if(!items.length){const empty=document.createElement("p");empty.className="empty";empty.textContent=date||status?"No appointments match these filters.":"No appointment records yet.";root.append(empty);return}
    items.forEach(a=>{
        const card=document.createElement("article");card.className="appointment-card";
        const when=document.createElement("div");when.className="appointment-time";
        const dateLine=document.createElement("strong");dateLine.textContent=displayDate(a.date);
        const timeLine=document.createElement("span");timeLine.textContent=displayTime(a.time);
        const pill=document.createElement("span");pill.className=`status-pill status-${a.status}`;pill.textContent=a.status;
        when.append(dateLine,timeLine,pill);
        const detail=document.createElement("div");detail.className="appointment-detail";
        const heading=document.createElement("div");
        const name=document.createElement("strong");name.className="patient-name";name.textContent=a.fullName;
        const reference=document.createElement("span");reference.className="appointment-reference";reference.textContent=`Ref ${a.reference}`;
        heading.append(name,reference);
        const grid=document.createElement("div");grid.className="patient-grid";
        grid.append(patientField("Phone",a.phone,"tel:"),patientField("Email",a.email,a.email?"mailto:":null),patientField("Service",serviceName(a.service)),patientField("Assigned doctor",a.doctorName||"Doctor record unavailable"));
        const question=document.createElement("div");question.className=`patient-question${a.message?"":" empty-question"}`;
        const questionLabel=document.createElement("small");questionLabel.textContent="Patient question or scheduling need";
        const questionText=document.createElement("p");questionText.textContent=a.message||"No question or additional note was provided.";
        question.append(questionLabel,questionText);detail.append(heading,grid,question);
        const actions=document.createElement("div");actions.className="appointment-actions";
        const statusLabel=document.createElement("label");statusLabel.textContent="Update status";
        const select=document.createElement("select");select.setAttribute("aria-label",`Update ${a.fullName}'s appointment status`);
        ["pending","confirmed","completed","cancelled","declined"].forEach(s=>select.add(new Option(s[0].toUpperCase()+s.slice(1),s,s===a.status,s===a.status)));
        select.onchange=async()=>{try{await api(`/api/appointments/${a.id}`,{method:"PATCH",body:JSON.stringify({status:select.value})});notify("Appointment updated.");loadAppointments()}catch(e){notify(e.message)}};
        statusLabel.append(select);
        const remove=document.createElement("button");remove.type="button";remove.className="button-link delete-link";remove.textContent="Delete record";
        remove.onclick=async()=>{if(!confirm(`Permanently delete appointment ${a.reference}? This cannot be undone.`))return;try{await api(`/api/appointments/${a.id}`,{method:"DELETE"});notify("Appointment record deleted.");loadAppointments()}catch(e){notify(e.message)}};
        actions.append(statusLabel,remove);card.append(when,detail,actions);root.append(card);
    })
}
document.getElementById("statusFilter").addEventListener("change",renderAppointments);
document.getElementById("dateFilter").addEventListener("change",renderAppointments);
document.getElementById("clearFilters").addEventListener("click",()=>{document.getElementById("statusFilter").value="";document.getElementById("dateFilter").value="";renderAppointments()});
async function initializePortal(){
    showLoading("Securing the administration portal…");
    try{await fetch("/api/logout",{method:"POST"})}catch{}
    showLogin();hideLoading();document.querySelector('#loginForm input[name="email"]').focus();
}
initializePortal();
