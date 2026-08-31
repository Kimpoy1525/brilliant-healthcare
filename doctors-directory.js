"use strict";
const directory=document.getElementById("doctorDirectory");
const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function scheduleText(availability=[]){
    if(!availability.length)return"No clinic schedule published";
    return availability.map(rule=>`${dayNames[rule.day]} ${rule.start}–${rule.end}`).join(" · ");
}

function element(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
}

function renderDoctor(doctor){
    const article=element("article","physician-profile");
    const photo=element("div","physician-photo");
    const image=document.createElement("img");
    const defaultPhoto=doctor.name.includes("James Raphael")?"images/james-raphael.jpg":"images/generic-doctor.png";
    image.src=doctor.photoUrl||defaultPhoto;
    image.alt=`${doctor.name}, ${doctor.specialty}`;
    image.loading="lazy";
    image.referrerPolicy="no-referrer";
    image.onerror=()=>{image.onerror=null;image.src=defaultPhoto};
    photo.append(image);

    const details=element("div","physician-details");
    const specialty=element("span","",doctor.specialty);
    if(doctor.credentials)specialty.append(element("small","physician-credentials",doctor.credentials));
    const name=element("h3","",doctor.name);
    const availability=element("span",`physician-availability${doctor.acceptingNewPatients?"":" closed"}`,doctor.acceptingNewPatients?"Accepting new patients":"Not currently accepting new patients");
    const bio=element("p","",doctor.bio||"Contact the clinic for information about this physician’s services and appointment requirements.");
    const facts=document.createElement("dl");
    const schedule=document.createElement("div");schedule.append(element("dt","","Clinic schedule"),element("dd","",scheduleText(doctor.availability)));
    const languages=document.createElement("div");languages.append(element("dt","","Languages"),element("dd","",doctor.languages||"Contact the clinic"));
    facts.append(schedule,languages);
    const book=document.createElement("a");
    book.className="btn btn-primary";
    book.href=`appointments.html?doctor=${encodeURIComponent(doctor.id)}`;
    book.textContent="View schedule and book";
    if(!doctor.acceptingNewPatients){book.textContent="View physician schedule"}
    details.append(specialty,name,availability,bio,facts,book);
    article.append(photo,details);
    return article;
}

fetch("/api/doctors")
    .then(response=>{if(!response.ok)throw new Error();return response.json()})
    .then(doctors=>{
        if(!doctors.length)return;
        directory.replaceChildren();
        doctors.forEach(doctor=>directory.append(renderDoctor(doctor)));
    })
    .catch(()=>{});
