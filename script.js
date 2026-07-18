"use strict";

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

function setMenu(open) {
    hamburger.classList.toggle("active", open);
    navLinks.classList.toggle("active", open);
    hamburger.setAttribute("aria-expanded", String(open));
    hamburger.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    document.body.classList.toggle("menu-open", open);
}

hamburger.addEventListener("click", () => setMenu(hamburger.getAttribute("aria-expanded") !== "true"));
document.querySelectorAll(".nav-links a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && hamburger.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        hamburger.focus();
    }
});
window.addEventListener("resize", () => {
    if (window.innerWidth > 768) setMenu(false);
});

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (event) {
        const href = this.getAttribute("href");
        if (href === "#") return;
        const target = document.querySelector(href);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
});

function showNotification(message, type = "success") {
    document.querySelector(".notification")?.remove();
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.setAttribute("role", type === "error" ? "alert" : "status");
    notification.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

    const icon = document.createElement("span");
    icon.className = "notification-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = type === "success" ? "✓" : "!";
    const text = document.createElement("span");
    text.className = "notification-message";
    text.textContent = message;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "notification-close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    notification.append(icon, text, close);
    document.body.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add("notification-show"));

    const dismiss = () => {
        notification.classList.remove("notification-show");
        notification.classList.add("notification-hide");
        window.setTimeout(() => notification.remove(), 300);
    };
    const timeout = window.setTimeout(dismiss, 5000);
    close.addEventListener("click", () => {
        window.clearTimeout(timeout);
        dismiss();
    });
}

const contactForm = document.getElementById("contactForm");
contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    let firstInvalid = null;
    contactForm.querySelectorAll("[required]").forEach((field) => {
        const invalid = !field.value.trim();
        field.setAttribute("aria-invalid", String(invalid));
        field.style.borderColor = invalid ? "#b35454" : "#cbdad7";
        if (invalid && !firstInvalid) firstInvalid = field;
    });

    const email = contactForm.querySelector('input[type="email"]');
    if (email.value && !email.validity.valid) {
        email.setAttribute("aria-invalid", "true");
        email.style.borderColor = "#b35454";
        firstInvalid ||= email;
    }

    if (firstInvalid) {
        firstInvalid.focus();
        showNotification("Please review the highlighted fields.", "error");
        return;
    }

    const submit = contactForm.querySelector('button[type="submit"]');
    const originalText = submit.innerHTML;
    submit.disabled = true;
    submit.textContent = "Sending request…";
    window.setTimeout(() => {
        contactForm.reset();
        submit.disabled = false;
        submit.innerHTML = originalText;
        showNotification("Your request was received. Our team will contact you to confirm availability.");
    }, 650);
});

contactForm.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => {
        field.removeAttribute("aria-invalid");
        field.style.borderColor = "#cbdad7";
    });
});

const newsletterForm = document.querySelector(".newsletter-form");
newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = newsletterForm.querySelector('input[type="email"]');
    if (!email.value || !email.validity.valid) {
        showNotification("Please enter a valid email address.", "error");
        email.focus();
        return;
    }
    newsletterForm.reset();
    showNotification("Thank you for subscribing to our health updates.");
});

const revealItems = document.querySelectorAll(".service-card, .why-us-card, .testimonial-card");
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("fade-in"));
} else {
    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("fade-in");
            currentObserver.unobserve(entry.target);
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px" });
    revealItems.forEach((item) => {
        item.style.opacity = "0";
        item.style.transform = "translateY(18px)";
        item.style.transition = "opacity .5s ease, transform .5s ease";
        observer.observe(item);
    });
}
