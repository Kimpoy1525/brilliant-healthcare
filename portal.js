"use strict";
let csrfValue="";
const token=()=>true,headers=()=>({"Content-Type":"application/json",...(csrfValue?{"X-CSRF-Token":csrfValue}:{})});
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
function showLogin(){clearTimeout(inactivityTimer);currentUser=undefined;csrfValue="";concealPassword();loginView.hidden=false;dashboard.hidden=true;logout.hidden=true;identity.textContent=""}
async function boot(){
    showLoading("Loading your secure dashboard…");
    try{currentUser=await api("/api/me");csrfValue=currentUser.csrfToken||"";delete currentUser.csrfToken;loginView.hidden=true;dashboard.hidden=false;logout.hidden=false;identity.textContent=`${currentUser.name} · ${currentUser.role.replaceAll("_"," ")}`;document.getElementById("dashboardTitle").textContent="Administrator dashboard";const superAdmin=currentUser.role==="super_admin";document.getElementById("adminTools").hidden=!superAdmin;document.getElementById("staffTools").hidden=!superAdmin;document.getElementById("auditTools").hidden=!superAdmin;await loadDoctors();populateDoctorFilter();await loadAppointments();if(superAdmin)await Promise.all([loadStaff(),loadAudit()]);armSessionTimeout()}catch(error){document.getElementById("loginError").textContent=error.message;showLogin()}finally{hideLoading()}
}
document.getElementById("loginForm").addEventListener("submit",async event=>{
    event.preventDefault();const error=document.getElementById("loginError");error.textContent="";loginSubmit.disabled=true;loginSubmit.querySelector("span").textContent="Signing in…";showLoading("Verifying your credentials…");
    try{await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d});event.target.reset();await boot()}catch(e){error.textContent=e.message;hideLoading()}finally{loginSubmit.disabled=false;loginSubmit.querySelector("span").textContent="Sign in securely"}
});
async function secureLogout(message){showLoading("Signing out securely…");try{await api("/api/logout",{method:"POST"})}catch{}showLogin();hideLoading();if(message)notify(message)}
logout.addEventListener("click",()=>secureLogout());document.getElementById("refresh").addEventListener("click",boot);
["pointerdown","keydown"].forEach(type=>document.addEventListener(type,()=>{if(currentUser)armSessionTimeout()},{passive:true}));
let adminDoctors=[];
function populateDoctorFilter(){const filter=document.getElementById("doctorFilter"),selected=filter.value;filter.replaceChildren(new Option("All doctors",""));adminDoctors.forEach(doctor=>filter.add(new Option(doctor.name,doctor.id)));filter.value=selected}
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
let appointmentPage=1,appointmentPages=1,appointmentTotal=0,appointmentLoadTimer,appointmentMetrics={today:0,pending:0,confirmed:0,total:0};
function updateMetrics(){
    document.getElementById("todayCount").textContent=appointmentMetrics.today;
    document.getElementById("pendingCount").textContent=appointmentMetrics.pending;
    document.getElementById("confirmedCount").textContent=appointmentMetrics.confirmed;
    document.getElementById("totalCount").textContent=appointmentMetrics.total;
}
function appointmentQuery(){const params=new URLSearchParams({page:String(appointmentPage),pageSize:"25"});const fields={search:"appointmentSearch",dateFrom:"dateFromFilter",dateTo:"dateToFilter",status:"statusFilter",doctorId:"doctorFilter"};Object.entries(fields).forEach(([key,id])=>{const value=document.getElementById(id).value.trim();if(value)params.set(key,value)});return params}
async function loadAppointments(){const result=await api(`/api/admin/appointments?${appointmentQuery()}`);appointments=result.items;appointmentMetrics=result.metrics;appointmentTotal=result.pagination.total;appointmentPages=result.pagination.pages;appointmentPage=result.pagination.page;updateMetrics();renderAppointments()}
function renderAppointments(){
    const root=document.getElementById("appointments");
    document.getElementById("appointmentResultCount").textContent=`${appointmentTotal} ${appointmentTotal===1?"record":"records"}`;
    document.getElementById("appointmentPage").textContent=`Page ${appointmentPage} of ${appointmentPages}`;
    document.getElementById("previousAppointments").disabled=appointmentPage<=1;document.getElementById("nextAppointments").disabled=appointmentPage>=appointmentPages;
    root.replaceChildren();
    if(!appointments.length){const empty=document.createElement("p");empty.className="empty";empty.textContent="No appointments match these filters.";root.append(empty);return}
    appointments.forEach(a=>{
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
        const reminder=a.reminderSentAt?`Sent ${new Date(a.reminderSentAt).toLocaleString()}`:a.smsConsent?({"scheduled":"Scheduled","failed":"Delivery retry pending","invalid_number":"Invalid mobile number"})[a.reminderStatus]||"Scheduled":"Not authorized";
        grid.append(patientField("Phone",a.phone,"tel:"),patientField("Email",a.email,a.email?"mailto:":null),patientField("Service",serviceName(a.service)),patientField("Assigned doctor",a.doctorName||"Doctor record unavailable"),patientField("SMS reminder",reminder));
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
        if(currentUser.role==="viewer")select.disabled=true;
        const archive=document.createElement("button");archive.type="button";archive.className="button-link delete-link";archive.textContent="Archive record";archive.hidden=currentUser.role==="viewer";
        archive.onclick=async()=>{const reason=prompt(`Why are you archiving appointment ${a.reference}?`);if(!reason)return;try{await api(`/api/admin/appointments/${a.id}/archive`,{method:"PATCH",body:JSON.stringify({reason})});notify("Appointment archived with an audit record.");loadAppointments()}catch(e){notify(e.message)}};
        actions.append(statusLabel,archive);card.append(when,detail,actions);root.append(card);
    })
}
["dateFromFilter","dateToFilter","statusFilter","doctorFilter"].forEach(id=>document.getElementById(id).addEventListener("change",()=>{appointmentPage=1;loadAppointments()}));
document.getElementById("appointmentSearch").addEventListener("input",()=>{clearTimeout(appointmentLoadTimer);appointmentLoadTimer=setTimeout(()=>{appointmentPage=1;loadAppointments()},350)});
document.getElementById("clearFilters").addEventListener("click",()=>{["appointmentSearch","dateFromFilter","dateToFilter","statusFilter","doctorFilter"].forEach(id=>document.getElementById(id).value="");appointmentPage=1;loadAppointments()});
document.getElementById("previousAppointments").addEventListener("click",()=>{if(appointmentPage>1){appointmentPage--;loadAppointments()}});document.getElementById("nextAppointments").addEventListener("click",()=>{if(appointmentPage<appointmentPages){appointmentPage++;loadAppointments()}});
document.getElementById("runReminders").addEventListener("click",async event=>{const button=event.currentTarget,original=button.textContent;if(currentUser.role==="viewer")return notify("Your account has read-only access.");button.disabled=true;button.textContent="Sending reminders…";try{const result=await api("/api/admin/reminders/run",{method:"POST"});notify(`Reminder check complete: ${result.sent||0} sent, ${result.failed||0} failed.`);await loadAppointments()}catch(e){notify(e.message)}finally{button.disabled=false;button.textContent=original}});
function labeledText(label,value){const wrapper=document.createElement("span"),small=document.createElement("small"),strong=document.createElement("strong");small.textContent=label;strong.textContent=value;wrapper.append(small,strong);return wrapper}
async function loadStaff(){const staff=await api("/api/admin/staff"),root=document.getElementById("staffList");root.replaceChildren();staff.forEach(person=>{const row=document.createElement("article");row.className="staff-row";const details=document.createElement("div");details.append(labeledText("Staff member",person.name),labeledText("Email",person.email));const controls=document.createElement("div");controls.className="staff-controls";const role=document.createElement("select");role.setAttribute("aria-label",`Role for ${person.name}`);[["viewer","Read-only viewer"],["appointment_manager","Appointment manager"],["super_admin","System administrator"]].forEach(([value,label])=>role.add(new Option(label,value,false,value===person.role)));const active=document.createElement("button");active.type="button";active.className="btn btn-secondary";active.textContent=person.active?"Deactivate":"Reactivate";const own=person.id===currentUser.id;role.disabled=own;active.disabled=own;const save=async()=>{try{await api(`/api/admin/staff/${person.id}`,{method:"PATCH",body:JSON.stringify({role:role.value,active:active.textContent==="Deactivate"?false:true})});notify("Staff access updated.");loadStaff();loadAudit()}catch(e){notify(e.message)}};role.addEventListener("change",async()=>{try{await api(`/api/admin/staff/${person.id}`,{method:"PATCH",body:JSON.stringify({role:role.value,active:person.active})});notify("Staff role updated.");loadStaff();loadAudit()}catch(e){notify(e.message)}});active.addEventListener("click",save);controls.append(role,active);row.append(details,controls);root.append(row)})}
document.getElementById("staffForm").addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget,body=Object.fromEntries(new FormData(form));try{await api("/api/admin/staff",{method:"POST",body:JSON.stringify(body)});form.reset();notify("Individual staff account created.");await Promise.all([loadStaff(),loadAudit()])}catch(e){notify(e.message)}});
function auditDescription(event){const action=event.action.replaceAll("_"," ");const target=event.entityId?` · ${event.entityType} ${event.entityId.slice(0,12)}`:"";return`${action}${target}`}
async function loadAudit(){const result=await api("/api/admin/audit-events"),root=document.getElementById("auditList");root.replaceChildren();if(!result.items.length){const empty=document.createElement("p");empty.className="empty";empty.textContent="No administrative activity has been recorded yet.";root.append(empty);return}result.items.forEach(event=>{const row=document.createElement("article");row.className="audit-row";row.append(labeledText(new Date(event.createdAt).toLocaleString(),event.adminName||"System"),labeledText("Activity",auditDescription(event)));root.append(row)})}
document.getElementById("refreshAudit").addEventListener("click",loadAudit);
async function initializePortal(){
    showLoading("Securing the administration portal…");
    showLogin();hideLoading();document.querySelector('#loginForm input[name="email"]').focus();
}
initializePortal();
