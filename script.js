"use strict";
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");
function setMenu(open) { hamburger.classList.toggle("active", open); navLinks.classList.toggle("active", open); hamburger.setAttribute("aria-expanded", String(open)); hamburger.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu"); document.body.classList.toggle("menu-open", open); }
hamburger.addEventListener("click", () => setMenu(hamburger.getAttribute("aria-expanded") !== "true"));
document.querySelectorAll(".nav-links a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });
window.addEventListener("resize", () => { if (window.innerWidth > 768) setMenu(false); });
document.querySelectorAll('a[href^="#"]').forEach((anchor) => anchor.addEventListener("click", function (event) { const target = document.querySelector(this.getAttribute("href")); if (target) { event.preventDefault(); target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } }));

function showNotification(message, type = "success") {
    document.querySelector(".notification")?.remove(); const notice = document.createElement("div"); notice.className = `notification notification-${type}`; notice.setAttribute("role", type === "error" ? "alert" : "status");
    const text = document.createElement("span"); text.className = "notification-message"; text.textContent = message;
    const close = document.createElement("button"); close.type = "button"; close.className = "notification-close"; close.setAttribute("aria-label", "Dismiss notification"); close.textContent = "×";
    notice.append(text, close); document.body.append(notice); requestAnimationFrame(() => notice.classList.add("notification-show"));
    const dismiss = () => { notice.classList.remove("notification-show"); setTimeout(() => notice.remove(), 300); }; const timer = setTimeout(dismiss, 7000); close.addEventListener("click", () => { clearTimeout(timer); dismiss(); });
}

const form = document.getElementById("contactForm");
const doctorSelect = document.getElementById("doctorSelect");
const dateInput = document.getElementById("appointmentDate");
const timeInput = document.getElementById("appointmentTime");
const slotsElement = document.getElementById("timeSlots");
const slotHelp = document.getElementById("slotHelp");
const calendar = document.getElementById("scheduleCalendar");
const calendarDays = document.getElementById("calendarDays");
const calendarMonth = document.getElementById("calendarMonth");
let doctors = [], calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
dateInput.min = new Date().toISOString().slice(0, 10); dateInput.max = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
fetch("/api/doctors").then(r => r.json()).then(data => {
    doctors = data;
    doctors.forEach(d => doctorSelect.add(new Option(`${d.name} — ${d.specialty}`, d.id)));
    if (!doctors.length) { slotHelp.textContent = "Online scheduling is being configured. Please call the clinic."; return; }
    if (document.body.classList.contains("appointments-page")) {
        const params = new URLSearchParams(location.search);
        const requestedService = params.get("service");
        const serviceSelect = form.elements.service;
        if (requestedService && [...serviceSelect.options].some(option => option.value === requestedService)) serviceSelect.value = requestedService;
        const requestedDoctor = params.get("doctor");
        const selectedDoctor = doctors.find(d => d.id === requestedDoctor) || (requestedDoctor === "james-raphael" ? doctors.find(d => d.name.includes("James Raphael")) : null);
        if (selectedDoctor) { doctorSelect.value = selectedDoctor.id; doctorSelect.dispatchEvent(new Event("change")); }
    }
}).catch(() => { slotHelp.textContent = "Schedules could not be loaded."; });
function formatTime(value) { return new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function localDateValue(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function renderCalendar() {
    const doctor = doctors.find(d => d.id === doctorSelect.value); calendarDays.replaceChildren();
    if (!doctor) { calendar.hidden = true; return; }
    calendar.hidden = false; calendarMonth.textContent = calendarCursor.toLocaleDateString([], { month: "long", year: "numeric" });
    const firstDay = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1).getDay();
    const count = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { const blank = document.createElement("span"); blank.className = "calendar-blank"; calendarDays.append(blank); }
    for (let day = 1; day <= count; day++) {
        const value = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), day, 12); const date = localDateValue(value);
        const withinRange = date >= dateInput.min && date <= dateInput.max;
        const scheduled = doctor.availability.some(rule => rule.day === value.getDay()) && !doctor.unavailableDates.includes(date);
        const button = document.createElement("button"); button.type = "button"; button.textContent = day;
        button.className = `calendar-day ${withinRange && scheduled ? "calendar-available" : "calendar-unavailable"}${dateInput.value === date ? " calendar-selected" : ""}`;
        button.disabled = !withinRange || !scheduled; button.setAttribute("aria-label", `${value.toLocaleDateString([], { month: "long", day: "numeric" })}, ${withinRange && scheduled ? "available" : "not available"}`);
        if (withinRange && scheduled) button.addEventListener("click", async () => { dateInput.value = date; renderCalendar(); await loadSlots(); });
        calendarDays.append(button);
    }
}
document.getElementById("previousMonth").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); });
document.getElementById("nextMonth").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); });
async function loadSlots() {
    timeInput.value = ""; slotsElement.replaceChildren();
    if (!doctorSelect.value || !dateInput.value) { slotHelp.textContent = "Choose a doctor and date to see available times."; return; }
    slotHelp.textContent = "Loading schedule…";
    try {
        const response = await fetch(`/api/doctors/${encodeURIComponent(doctorSelect.value)}/slots?date=${encodeURIComponent(dateInput.value)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error);
        slotHelp.textContent = data.slots.length ? "Select a green available time. Red times cannot be booked." : "The doctor has no clinic hours on this date.";
        data.slots.forEach(slot => { const button = document.createElement("button"); button.type = "button"; button.className = `time-slot ${slot.available ? "available" : "unavailable"}`; button.textContent = formatTime(slot.time); button.disabled = !slot.available; button.setAttribute("aria-label", `${formatTime(slot.time)} — ${slot.available ? "available" : "unavailable"}`); button.addEventListener("click", () => { document.querySelectorAll(".time-slot.selected").forEach(x => x.classList.remove("selected")); button.classList.add("selected"); timeInput.value = slot.time; }); slotsElement.append(button); });
    } catch (error) { slotHelp.textContent = error.message || "Could not load this schedule."; }
}
doctorSelect.addEventListener("change", () => { dateInput.value = ""; slotsElement.replaceChildren(); slotHelp.textContent = "Choose a green date from the doctor's calendar."; calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(); });
form.addEventListener("submit", async event => {
    event.preventDefault(); let invalid = form.querySelector(":invalid");
    if (invalid) { invalid.focus(); showNotification("Please complete the required fields.", "error"); return; }
    if (!timeInput.value) { slotsElement.focus(); showNotification("Please select an available appointment time.", "error"); return; }
    const submit = form.querySelector('button[type="submit"]'); const original = submit.innerHTML; submit.disabled = true; submit.textContent = "Reserving time…";
    try { const payload = Object.fromEntries(new FormData(form)); payload.smsConsent=form.elements.smsConsent.checked; const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); form.reset(); slotsElement.replaceChildren(); timeInput.value = ""; slotHelp.textContent = "Choose a doctor and date to see available times."; showNotification(`Time reserved. Your reference is ${result.reference}. An SMS reminder is scheduled for the day before your visit.`); }
    catch (error) { showNotification(error.message || "We could not reserve that time.", "error"); await loadSlots(); }
    finally { submit.disabled = false; submit.innerHTML = original; }
});
const serviceDetails = {
    "hemodialysis": { kicker: "Renal care", title: "Hemodialysis", summary: "A supervised treatment that filters waste, salt, and excess fluid from the blood when the kidneys cannot do so adequately.", about: "Blood travels through a dialyzer outside the body and is safely returned through vascular access. Treatment frequency and duration are prescribed individually after clinical assessment.", expect: ["Pre-treatment weight and vital-sign assessment", "Continuous monitoring by the dialysis care team", "Post-treatment review and care instructions"], prepare: "Bring your medication list and relevant laboratory results. Follow the fluid, food, and medication instructions given by your clinician." },
    "peritoneal-dialysis": { kicker: "Renal care", title: "Peritoneal Dialysis", summary: "A kidney-replacement therapy that uses the lining of the abdomen and prescribed dialysis fluid to remove waste and excess fluid.", about: "Our team provides assessment, education, technique training, and ongoing monitoring for appropriate patients considering or receiving peritoneal dialysis.", expect: ["Suitability and access assessment", "Step-by-step sterile technique training", "Regular follow-up and treatment review"], prepare: "Bring your current medicines and medical records. A clinician will explain access placement, infection prevention, and whether home treatment is appropriate." },
    "hematology": { laboratory: true, kicker: "Laboratory services", title: "Hematology", summary: "Blood testing services that evaluate blood cells, clotting, and other important indicators used in diagnosis and treatment monitoring.", about: "Our hematology services include routine blood studies and selected special-order tests.", expect: ["Blood Typing", "CBC, Platelet", "CTBT", "ESR", "PBS (S.O.)", "Platelet", "Protime (S.O.)", "PTT (S.O.)", "Red Blood Indices", "Retic CT (S.O.)"], prepare: "Preparation varies by test. Please bring your physician's request and contact the laboratory before your visit for special-order tests marked S.O." },
    "microscopy": { laboratory: true, kicker: "Laboratory services", title: "Microscopy", summary: "Careful examination of urine, stool, and other specimens to help identify conditions and support accurate clinical decisions.", about: "Our microscopy services examine patient specimens for findings that can support screening, diagnosis, and follow-up care.", expect: ["Micro Albumin / UACR (S.O.)", "Occult Blood", "Pregnancy Test", "Semen Analysis", "Urinalysis", "Fecalysis"], prepare: "Some tests require a specific specimen container or collection method. Contact the laboratory for collection instructions before your visit." },
    "serology": { laboratory: true, kicker: "Laboratory services", title: "Serology", summary: "Laboratory tests that detect antibodies, antigens, hormones, and immune markers to support screening and diagnosis.", about: "Our serology services include infectious-disease screening, inflammatory markers, thyroid studies, cardiac markers, and selected special-order tests.", expect: ["C3 (S.O.)", "ANTI-HAV (IgG / IgM)", "ANTI-HCV (Qualitative)", "ASO (Quantitative) (S.O.)", "ASO (Qualitative) (S.O.)", "Beta-HCG (S.O.)", "D-Dimer (S.O.)", "Dengue Duo", "Ferritin (S.O.)", "FT3 (S.O.)", "FT4 (S.O.)", "HBsAg (Qualitative)", "PSA (S.O.)", "RF (Qualitative) (S.O.)", "RF (Quantitative) (S.O.)", "Syphilis", "T3 (S.O.)", "T4 (S.O.)", "TROP T (Qualitative) (S.O.)", "TROP I (Quantitative) (S.O.)", "TSH", "Typhidot", "Widal"], prepare: "Requirements vary by test. Please bring your physician's request and contact the laboratory in advance for tests marked S.O." },
    "chemistry": { laboratory: true, kicker: "Laboratory services", title: "Chemistry", summary: "Clinical chemistry tests that measure blood sugar, lipids, enzymes, electrolytes, and organ-function indicators.", about: "Our chemistry services support routine screening, metabolic assessment, and monitoring of liver, kidney, and cardiovascular health.", expect: ["Albumin", "ALP (S.O.)", "Amylase (S.O.)", "B1B2TB (S.O.)", "BUA", "BUN", "Calcium", "Chloride", "Cholesterol", "Complete Hepatitis Profile (S.O.)", "Creatinine", "Creatinine Clearance (S.O.)", "Creatinine Kinase (CK-MB) (S.O.)", "CSF Protein (S.O.)", "CSF Sugar (S.O.)", "FBS / RBS", "Fecalysis", "GGTP (S.O.)", "HbA1c", "HDL / LDL", "Ketones - Non Diabetic (S.O.)", "LDH (S.O.)", "Lipase", "Lipid Profile", "Liver Profile", "Magnesium", "OGCT (50g)", "OGTT (75g) (Non-Pregnant)", "OGTT (100g)", "OGTT (75g) (Pregnant)", "Phosphorous", "Potassium", "SGOT (AST)", "SGPT (ALT)", "Sodium", "Total Protein", "Triglyceride", "VLDL"], prepare: "Some chemistry tests require fasting or timed collection. Confirm instructions with the laboratory before your visit and bring your physician's request, if applicable." }
};
const serviceModal = document.getElementById("serviceModal"), modalPanel = serviceModal.querySelector(".service-modal-panel"); let modalTrigger = null;
function openServiceModal(card) { const detail = serviceDetails[card.dataset.service]; if (!detail) return; const isLaboratory = detail.laboratory === true; modalTrigger = card; modalPanel.classList.toggle("is-laboratory", isLaboratory); modalPanel.dataset.service = card.dataset.service; document.getElementById("serviceModalKicker").textContent = detail.kicker; document.getElementById("serviceModalTitle").textContent = detail.title; document.getElementById("serviceModalSummary").textContent = detail.summary; document.getElementById("serviceModalAbout").textContent = detail.about; document.getElementById("serviceModalPrepare").textContent = detail.prepare; document.getElementById("serviceModalAboutHeading").textContent = isLaboratory ? "About this category" : "About this service"; document.getElementById("serviceModalListHeading").textContent = isLaboratory ? "Available tests" : "What to expect"; document.getElementById("serviceModalDoctor").hidden = isLaboratory; const image = document.getElementById("serviceModalImage"); image.src = isLaboratory ? card.querySelector(".service-photo img").src : "images/generic-doctor.png"; image.alt = isLaboratory ? `Laboratory professional performing ${detail.title.toLowerCase()} testing` : "Dr. James Raphael, handling physician"; document.getElementById("serviceModalVisualLabel").textContent = isLaboratory ? "Brilliant Healthcare · Laboratory services" : "Dr. James Raphael · Handling physician"; const list = document.getElementById("serviceModalExpect"); list.replaceChildren(); detail.expect.forEach(item => { const li = document.createElement("li"); li.textContent = item; list.append(li); }); const action = document.getElementById("serviceModalBook"); action.dataset.service = card.dataset.service; action.dataset.laboratory = String(isLaboratory); action.textContent = isLaboratory ? "Contact the laboratory" : "View schedule & book"; action.href = isLaboratory ? "tel:+639566857606" : "#contact"; serviceModal.hidden = false; document.body.classList.add("modal-open"); modalPanel.focus(); }
function closeServiceModal(restoreFocus = true) { serviceModal.hidden = true; document.body.classList.remove("modal-open"); if (restoreFocus) modalTrigger?.focus(); }
document.querySelectorAll(".service-card[data-service]").forEach(card => { card.addEventListener("click", () => openServiceModal(card)); card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openServiceModal(card); } }); });
serviceModal.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeServiceModal)); document.addEventListener("keydown", event => { if (event.key === "Escape" && !serviceModal.hidden) closeServiceModal(); });
document.getElementById("serviceModalBook").addEventListener("click", function (event) {
    if (this.dataset.laboratory === "true") return;
    event.preventDefault();
    if (!document.body.classList.contains("appointments-page")) {
        location.href = `appointments.html?service=${encodeURIComponent(this.dataset.service)}&doctor=james-raphael`;
        return;
    }
    form.elements.service.value = this.dataset.service;
    const james = doctors.find(d => d.name.includes("James Raphael"));
    if (james) { doctorSelect.value = james.id; doctorSelect.dispatchEvent(new Event("change")); }
    closeServiceModal(false);
    form.classList.remove("booking-highlight");
    requestAnimationFrame(() => { form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); form.classList.add("booking-highlight"); form.setAttribute("tabindex", "-1"); form.focus({ preventScroll: true }); setTimeout(() => form.classList.remove("booking-highlight"), 1600); });
});

const reveal = document.querySelectorAll(".service-card, .why-us-card, .testimonial-card");
if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) reveal.forEach(x => x.classList.add("fade-in")); else { const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("fade-in"); observer.unobserve(entry.target); } }), { threshold: .1 }); reveal.forEach(x => observer.observe(x)); }
