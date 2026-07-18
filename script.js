"use strict";

const siteHeader = document.getElementById("siteHeader");
const menuToggle = document.getElementById("menuToggle");
const primaryNav = document.getElementById("primaryNav");
const navLinks = [...document.querySelectorAll(".nav-links a")];

function setMenu(open) {
    menuToggle.setAttribute("aria-expanded", String(open));
    primaryNav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    menuToggle.querySelector(".sr-only").textContent = open ? "Close navigation menu" : "Open navigation menu";
}

menuToggle.addEventListener("click", () => {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
});

navLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuToggle.focus();
    }
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 820) setMenu(false);
});

function updateHeader() {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 8);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const observedSections = [...document.querySelectorAll("main section[id]")];
if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navLinks.forEach((link) => {
                const isCurrent = link.getAttribute("href") === `#${entry.target.id}`;
                if (isCurrent) link.setAttribute("aria-current", "location");
                else link.removeAttribute("aria-current");
            });
        });
    }, { rootMargin: "-35% 0px -55%", threshold: 0 });
    observedSections.forEach((section) => sectionObserver.observe(section));
}

const revealItems = document.querySelectorAll(".reveal");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px" });
    revealItems.forEach((item) => revealObserver.observe(item));
}

const appointmentForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");
const submitButton = appointmentForm.querySelector('button[type="submit"]');

function clearFieldError(field) {
    field.removeAttribute("aria-invalid");
    const error = document.getElementById(`${field.id}-error`);
    if (error) error.remove();
    field.removeAttribute("aria-describedby");
}

function showFieldError(field, message) {
    clearFieldError(field);
    field.setAttribute("aria-invalid", "true");
    const error = document.createElement("span");
    error.id = `${field.id}-error`;
    error.className = "field-error";
    error.textContent = message;
    field.setAttribute("aria-describedby", error.id);
    field.insertAdjacentElement("afterend", error);
}

function validateAppointmentForm() {
    let firstInvalid = null;
    const required = [...appointmentForm.querySelectorAll("[required]")];

    required.forEach((field) => {
        clearFieldError(field);
        if (!field.value.trim()) {
            showFieldError(field, "This field is required.");
            if (!firstInvalid) firstInvalid = field;
        }
    });

    const email = appointmentForm.elements.email;
    if (email.value && !email.validity.valid) {
        showFieldError(email, "Enter a valid email address.");
        if (!firstInvalid) firstInvalid = email;
    }

    const phone = appointmentForm.elements.phone;
    if (phone.value && phone.value.replace(/\D/g, "").length < 7) {
        showFieldError(phone, "Enter a valid phone number.");
        if (!firstInvalid) firstInvalid = phone;
    }

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
}

appointmentForm.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => clearFieldError(field));
    field.addEventListener("change", () => clearFieldError(field));
});

appointmentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    formStatus.className = "form-status";
    formStatus.textContent = "";

    if (!validateAppointmentForm()) {
        formStatus.classList.add("error");
        formStatus.textContent = "Please review the highlighted fields and try again.";
        return;
    }

    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    submitButton.querySelector(".button__label").textContent = "Sending request…";

    window.setTimeout(() => {
        appointmentForm.reset();
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
        submitButton.querySelector(".button__label").textContent = "Send appointment request";
        formStatus.classList.add("success");
        formStatus.textContent = "Thank you. Your request has been received. Our team will contact you to confirm availability.";
        formStatus.focus?.();
    }, 700);
});

const dateInput = document.getElementById("preferredDate");
const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
dateInput.min = localToday;

const newsletterForm = document.getElementById("newsletterForm");
const newsletterStatus = document.getElementById("newsletterStatus");
newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = newsletterForm.elements.newsletterEmail;
    if (!email.value || !email.validity.valid) {
        newsletterStatus.textContent = "Please enter a valid email address.";
        email.setAttribute("aria-invalid", "true");
        email.focus();
        return;
    }
    email.removeAttribute("aria-invalid");
    newsletterForm.reset();
    newsletterStatus.textContent = "Thanks — you’re subscribed.";
});
