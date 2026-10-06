"use strict";

const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const selectorGroups=[
    "main > section:not(.hero) > .container > *",
    ".patient-actions > a",
    ".service-summary > article",
    ".category-links > a",
    ".purpose-photo",
    ".values-list > div",
    ".featured-physicians-list > li",
    ".facility-photo",
    ".visit-steps > li",
    ".info-items > .info-item",
    ".doctor-directory > .physician-profile",
    ".services-grid > .service-card",
    ".patient-questions > details",
    ".footer-content > div"
];
const revealElements=new Set();

for(const selector of selectorGroups){
    document.querySelectorAll(selector).forEach((element,index)=>{
        if(element.closest("[hidden]"))return;
        element.classList.add("motion-reveal");
        if(index)element.style.setProperty("--motion-delay",`${Math.min(index,4)*70}ms`);
        element.querySelectorAll("img").forEach(image=>image.classList.add("motion-image"));
        revealElements.add(element);
    });
}

if(!reducedMotion&&"IntersectionObserver" in window){
    document.body.classList.add("motion-ready");
    const observer=new IntersectionObserver(entries=>{
        for(const entry of entries){
            if(!entry.isIntersecting)continue;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        }
    },{threshold:.12,rootMargin:"0px 0px -40px"});
    revealElements.forEach(element=>observer.observe(element));
    window.addEventListener("pageshow",event=>{
        if(event.persisted)revealElements.forEach(element=>element.classList.add("is-visible"));
    });
}
