"use strict";

document.body.classList.add("motion-ready");

const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealGroups=[
    [".about-image","motion-from-left"],
    [".about-content","motion-from-right"],
    [".section-header",""],
    [".team-heading",""],
    [".physician-profile",""],
    [".why-us-card",""],
    [".visit-path-intro","motion-from-left"],
    [".visit-steps article","motion-from-right"],
    [".contact-info","motion-from-left"],
    [".contact-form","motion-from-right"],
    [".footer-content>div",""]
];

const revealElements=[];
revealGroups.forEach(([selector,direction])=>{
    document.querySelectorAll(selector).forEach((element,index)=>{
        if(element.closest("[hidden]"))return;
        element.classList.add("motion-reveal");
        if(direction)element.classList.add(direction);
        if(index%5)element.classList.add(`motion-delay-${index%5}`);
        revealElements.push(element);
    });
});

if(reducedMotion||!("IntersectionObserver" in window)){
    revealElements.forEach(element=>element.classList.add("is-visible"));
}else{
    const observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(!entry.isIntersecting)return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    },{threshold:.12,rootMargin:"0px 0px -40px"});
    revealElements.forEach(element=>observer.observe(element));
}

window.addEventListener("pageshow",event=>{
    if(event.persisted)revealElements.forEach(element=>element.classList.add("is-visible"));
});
