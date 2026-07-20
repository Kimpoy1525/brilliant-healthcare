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
fetch("/api/doctors").then(r => r.json()).then(data => { doctors = data; doctors.forEach(d => doctorSelect.add(new Option(`${d.name} — ${d.specialty}`, d.id))); if (!doctors.length) slotHelp.textContent = "Online scheduling is being configured. Please call the clinic."; }).catch(() => { slotHelp.textContent = "Schedules could not be loaded."; });
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
    try { const payload = Object.fromEntries(new FormData(form)); const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); form.reset(); slotsElement.replaceChildren(); timeInput.value = ""; slotHelp.textContent = "Choose a doctor and date to see available times."; showNotification(`Time reserved. Your reference is ${result.reference}. The clinic will confirm it shortly.`); }
    catch (error) { showNotification(error.message || "We could not reserve that time.", "error"); await loadSlots(); }
    finally { submit.disabled = false; submit.innerHTML = original; }
});
const newsletter = document.querySelector(".newsletter-form"); newsletter.addEventListener("submit", event => { event.preventDefault(); if (!newsletter.checkValidity()) return newsletter.reportValidity(); newsletter.reset(); showNotification("Thank you for subscribing to our health updates."); });
const reveal = document.querySelectorAll(".service-card, .why-us-card, .testimonial-card");
if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) reveal.forEach(x => x.classList.add("fade-in")); else { const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("fade-in"); observer.unobserve(entry.target); } }), { threshold: .1 }); reveal.forEach(x => observer.observe(x)); }
