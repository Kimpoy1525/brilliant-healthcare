"use strict";
const directory=document.getElementById("doctorDirectory");
const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function scheduleText(availability=[]){
    if(!availability.length)return"No clinic schedule published";
    const time = value => {
        const [hour, minute] = value.split(':').map(Number);
        return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
    };
    return [...availability].sort((a,b)=>a.day-b.day).map(rule=>`${dayNames[rule.day]} ${time(rule.start)}–${time(rule.end)}`).join(" · ") + ' (Philippine time)';
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

const directoryStatus = document.getElementById('directoryStatus');
const directoryRetry = document.getElementById('directoryRetry');
let directoryLoading = false;

function validDirectory(data) {
    const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    return Array.isArray(data) && data.every(doctor => doctor &&
        typeof doctor.id === 'string' && typeof doctor.name === 'string' &&
        typeof doctor.specialty === 'string' && Array.isArray(doctor.availability) &&
        doctor.availability.every(rule => rule && Number.isInteger(rule.day) && rule.day >= 0 && rule.day <= 6 && validTime(rule.start) && validTime(rule.end)));
}

async function loadDirectory() {
    if (!directory || directoryLoading) return;
    directoryLoading = true;
    directory.setAttribute('aria-busy', 'true');
    directoryRetry.hidden = true;
    directoryStatus.textContent = 'Checking the latest physician schedules…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch('/api/doctors', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Directory unavailable');
        const doctors = await response.json();
        if (!validDirectory(doctors)) throw new Error('Invalid directory');
        // Build the complete result before replacing the existing fallback.
        const profiles = doctors.map(renderDoctor);
        directory.replaceChildren(...profiles);
        directoryStatus.textContent = doctors.length
            ? 'Clinic hours are shown in Philippine time. Call (0956) 685 7606 to confirm availability before travelling.'
            : 'No physician schedules are currently published. Please call (0956) 685 7606 for assistance.';
    } catch {
        directoryStatus.textContent = 'We couldn’t load the latest schedules. Please call (0956) 685 7606 to confirm availability, or try again.';
        directoryRetry.hidden = false;
    } finally {
        clearTimeout(timeout);
        directoryLoading = false;
        directory.setAttribute('aria-busy', 'false');
    }
}

directoryRetry.addEventListener('click', loadDirectory);
loadDirectory();
