"use strict";
const directory=document.getElementById('doctorDirectory');
const status=document.getElementById('directoryStatus');
const retry=document.getElementById('directoryRetry');
const approved=[...directory.querySelectorAll('[data-profile-aliases]')].map(card=>({aliases:JSON.parse(card.dataset.profileAliases),photo:card.dataset.profilePhoto}));
const usedPhotoSources=new Set();
const normalize=name=>name.replace(/^Dr\.?\s*/i,'').trim().toLowerCase();
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
function placeholder(name){const box=element('div','physician-placeholder');const initials=normalize(name).split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0].toUpperCase()).join('');box.append(element('strong','',initials||'BH'),element('span','','Photo coming soon'));box.setAttribute('role','img');box.setAttribute('aria-label',`Photo coming soon for ${name}`);return box}
function renderDoctor(doctor){
 const article=element('article','physician-profile');article.dataset.doctorId=doctor.id;const approvedSlug=normalize(doctor.name).replaceAll(' ','-');article.id=approvedSlug==='james-raphael'?'james-estrada':approvedSlug;
 const photo=element('div','physician-photo');
 const match=approved.find(profile=>profile.aliases.includes(normalize(doctor.name)));
 let source=doctor.photoUrl||'';
 if(match&&(!source||source.includes('generic-doctor')||source===match.photo.replace('.jpg','.png')))source=match.photo;
 // Never assign another approved physician's image to an unrelated identity.
 const owner=approved.find(profile=>source===profile.photo||source===profile.photo.replace('.jpg','.png'));
 if(owner&&owner!==match)source='';
 if(usedPhotoSources.has(source))source=match&&!usedPhotoSources.has(match.photo)?match.photo:'';
 if(source.includes('generic-doctor'))source='';
 if(source&&(/^(?:\/)?images\//.test(source)||/^https:\/\//.test(source))){
  usedPhotoSources.add(source);
  const image=document.createElement('img');image.src=source;image.alt=doctor.name;image.width=640;image.height=800;image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>photo.replaceChildren(placeholder(doctor.name));photo.append(image);
 }else photo.append(placeholder(doctor.name));
 const details=element('div','physician-details');details.append(element('h3','',doctor.name));
 if(doctor.credentials)details.append(element('p','physician-credentials',doctor.credentials));
 details.append(element('p','physician-specialty',doctor.specialty));
 details.append(element('p','physician-schedule','Call the clinic to confirm current availability.'));
 if(doctor.acceptingNewPatients===false)details.append(element('p','physician-availability','Not currently accepting new patients'));
 const bio=element('details','physician-bio');bio.append(element('summary','','View profile'),element('p','',doctor.bio||'Contact the clinic for information about this physician’s services.'));details.append(bio);
 const call=element('a','physician-call','Call for an appointment');call.href='tel:+639566857606';details.append(call);
 article.append(photo,details);return article;
}
function validDirectory(data){
 const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 return Array.isArray(data)&&data.every(doctor=>doctor&&typeof doctor.id==='string'&&typeof doctor.name==='string'&&typeof doctor.specialty==='string'&&Array.isArray(doctor.availability)&&doctor.availability.every(rule=>rule&&Number.isInteger(rule.day)&&rule.day>=0&&rule.day<=6&&validTime(rule.start)&&validTime(rule.end)))&&new Set(data.map(doctor=>doctor.id)).size===data.length;
}
let loading=false;
async function loadDirectory(){
 if(loading)return;loading=true;directory.setAttribute('aria-busy','true');retry.hidden=true;status.textContent='Checking the latest physician information…';
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
 try{const response=await fetch('/api/doctors',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('unavailable');const doctors=await response.json();if(!validDirectory(doctors))throw Error('invalid');usedPhotoSources.clear();directory.replaceChildren(...doctors.map(renderDoctor));applyPhysicianFilters();const target=document.getElementById(location.hash.slice(1));if(target?.classList.contains('physician-profile')){target.querySelector('details').open=true;target.scrollIntoView({block:'start'});}status.textContent=doctors.length?'Online booking is closed while schedules are confirmed. Call (0956) 685 7606 for physician availability.':'No physician schedules are currently published. Please call (0956) 685 7606 for assistance.'}
 catch{status.textContent='We couldn’t load the latest physician information. Please call (0956) 685 7606 to confirm availability, or try again.';retry.hidden=false}
 finally{clearTimeout(timeout);loading=false;directory.setAttribute('aria-busy','false')}
}
applyPhysicianFilters();
retry.addEventListener('click',loadDirectory);loadDirectory();

function applyPhysicianFilters(){
 const filters=document.getElementById('physicianFilters');if(!filters)return;filters.hidden=false;
 const term=document.getElementById('physicianSearch').value.trim().toLowerCase(),specialty=document.getElementById('physicianSpecialty').value;
 let count=0;for(const card of directory.children){const name=card.querySelector('h3')?.textContent.toLowerCase()||'',field=card.querySelector('.physician-specialty')?.textContent||'';card.hidden=!name.includes(term)||(specialty!==''&&specialty!==field);if(!card.hidden)count++;}
 document.getElementById('physicianFilterStatus').textContent=count?count+' '+(count===1?'physician':'physicians')+' shown.':'No physicians match. Clear the filters or call the clinic for assistance.';
}
const filters=document.getElementById('physicianFilters');
filters?.addEventListener('input',applyPhysicianFilters);filters?.addEventListener('submit',event=>{event.preventDefault();applyPhysicianFilters()});filters?.addEventListener('reset',()=>setTimeout(()=>{applyPhysicianFilters();document.getElementById('physicianSearch').focus()},0));
