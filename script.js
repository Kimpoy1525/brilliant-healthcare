"use strict";
const hamburger=document.getElementById('hamburger');
const navLinks=document.getElementById('navLinks');
function setMenu(open){
 if(!hamburger||!navLinks)return;
 navLinks.inert=window.innerWidth<=1100&&!open;
 navLinks.classList.toggle('active',open);
 hamburger.setAttribute('aria-expanded',String(open));
 hamburger.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');
}
if(hamburger&&navLinks){
 setMenu(false);
 hamburger.addEventListener('click',()=>setMenu(hamburger.getAttribute('aria-expanded')!=='true'));
 navLinks.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false)});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&hamburger.getAttribute('aria-expanded')==='true'){setMenu(false);hamburger.focus()}});
 document.addEventListener('click',event=>{if(!event.target.closest('.navbar'))setMenu(false)});
 window.addEventListener('resize',()=>setMenu(false));
}
document.querySelectorAll('.skip-link').forEach(link=>link.addEventListener('click',event=>{const main=document.getElementById('main-content');if(main){event.preventDefault();main.focus();main.scrollIntoView()}}));
const serviceDetails = {
    "hemodialysis": { kicker: "Renal care", title: "Hemodialysis", summary: "A supervised treatment that filters waste, salt, and excess fluid from the blood when the kidneys cannot do so adequately.", about: "Blood travels through a dialyzer outside the body and is safely returned through vascular access. Treatment frequency and duration are prescribed individually after clinical assessment.", expect: ["Pre-treatment weight and vital-sign assessment", "Continuous monitoring by the dialysis care team", "Post-treatment review and care instructions"], prepare: "Bring your medication list and relevant laboratory results. Follow the fluid, food, and medication instructions given by your clinician." },
    "peritoneal-dialysis": { kicker: "Renal care", title: "Peritoneal Dialysis", summary: "A kidney-replacement therapy that uses the lining of the abdomen and prescribed dialysis fluid to remove waste and excess fluid.", about: "Our team provides assessment, education, technique training, and ongoing monitoring for appropriate patients considering or receiving peritoneal dialysis.", expect: ["Suitability and access assessment", "Step-by-step sterile technique training", "Regular follow-up and treatment review"], prepare: "Bring your current medicines and medical records. A clinician will explain access placement, infection prevention, and whether home treatment is appropriate." },
    "hematology": { laboratory: true, kicker: "Laboratory services", title: "Hematology", summary: "Blood testing services that evaluate blood cells, clotting, and other important indicators used in diagnosis and treatment monitoring.", about: "Our hematology services include routine blood studies and selected special-order tests.", expect: ["Blood Typing", "CBC, Platelet", "CTBT", "ESR", "PBS (S.O.)", "Platelet", "Protime (S.O.)", "PTT (S.O.)", "Red Blood Indices", "Retic CT (S.O.)"], prepare: "Preparation varies by test. Please bring your physician's request and contact the laboratory before your visit for special-order tests marked S.O." },
    "microscopy": { laboratory: true, kicker: "Laboratory services", title: "Microscopy", summary: "Careful examination of urine, stool, and other specimens to help identify conditions and support accurate clinical decisions.", about: "Our microscopy services examine patient specimens for findings that can support screening, diagnosis, and follow-up care.", expect: ["Micro Albumin / UACR (S.O.)", "Occult Blood", "Pregnancy Test", "Semen Analysis", "Urinalysis", "Fecalysis"], prepare: "Some tests require a specific specimen container or collection method. Contact the laboratory for collection instructions before your visit." },
    "serology": { laboratory: true, kicker: "Laboratory services", title: "Serology", summary: "Laboratory tests that detect antibodies, antigens, hormones, and immune markers to support screening and diagnosis.", about: "Our serology services include infectious-disease screening, inflammatory markers, thyroid studies, cardiac markers, and selected special-order tests.", expect: ["C3 (S.O.)", "ANTI-HAV (IgG / IgM)", "ANTI-HCV (Qualitative)", "ASO (Quantitative) (S.O.)", "ASO (Qualitative) (S.O.)", "Beta-HCG (S.O.)", "D-Dimer (S.O.)", "Dengue Duo", "Ferritin (S.O.)", "FT3 (S.O.)", "FT4 (S.O.)", "HBsAg (Qualitative)", "PSA (S.O.)", "RF (Qualitative) (S.O.)", "RF (Quantitative) (S.O.)", "Syphilis", "T3 (S.O.)", "T4 (S.O.)", "TROP T (Qualitative) (S.O.)", "TROP I (Quantitative) (S.O.)", "TSH", "Typhidot", "Widal"], prepare: "Requirements vary by test. Please bring your physician's request and contact the laboratory in advance for tests marked S.O." },
    "chemistry": { laboratory: true, kicker: "Laboratory services", title: "Chemistry", summary: "Clinical chemistry tests that measure blood sugar, lipids, enzymes, electrolytes, and organ-function indicators.", about: "Our chemistry services support routine screening, metabolic assessment, and monitoring of liver, kidney, and cardiovascular health.", expect: ["Albumin", "ALP (S.O.)", "Amylase (S.O.)", "B1B2TB (S.O.)", "BUA", "BUN", "Calcium", "Chloride", "Cholesterol", "Complete Hepatitis Profile (S.O.)", "Creatinine", "Creatinine Clearance (S.O.)", "Creatinine Kinase (CK-MB) (S.O.)", "CSF Protein (S.O.)", "CSF Sugar (S.O.)", "FBS / RBS", "Fecalysis", "GGTP (S.O.)", "HbA1c", "HDL / LDL", "Ketones - Non Diabetic (S.O.)", "LDH (S.O.)", "Lipase", "Lipid Profile", "Liver Profile", "Magnesium", "OGCT (50g)", "OGTT (75g) (Non-Pregnant)", "OGTT (100g)", "OGTT (75g) (Pregnant)", "Phosphorous", "Potassium", "SGOT (AST)", "SGPT (ALT)", "Sodium", "Total Protein", "Triglyceride", "VLDL"], prepare: "Some chemistry tests require fasting or timed collection. Confirm instructions with the laboratory before your visit and bring your physician's request, if applicable." }
};

const serviceModal=document.getElementById('serviceModal');
if(serviceModal){
 const modalPanel=serviceModal.querySelector('.service-modal-panel');
 const background=new Map();let trigger;
 function closeServiceModal(){serviceModal.hidden=true;document.body.classList.remove('modal-open');for(const [node,previous] of background)node.inert=previous;background.clear();trigger?.focus()}
 function openServiceModal(card){
  const detail=serviceDetails[card.dataset.service];if(!detail)return;trigger=card;
  modalPanel.classList.add('is-laboratory');
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  set('serviceModalKicker',detail.kicker);set('serviceModalTitle',detail.title);set('serviceModalSummary',detail.summary);set('serviceModalAbout',detail.about);set('serviceModalPrepare',detail.prepare);
  set('serviceModalAboutHeading','About this category');set('serviceModalListHeading','Available tests');
  const list=document.getElementById('serviceModalExpect');list.replaceChildren();for(const text of detail.expect){const li=document.createElement('li');li.textContent=text;list.append(li)}
  const action=document.getElementById('serviceModalBook');action.href='tel:+639566857606';action.textContent='Contact the laboratory';
  serviceModal.hidden=false;document.body.classList.add('modal-open');
  let branch=serviceModal;while(branch.parentElement){for(const sibling of branch.parentElement.children){if(sibling!==branch&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){background.set(sibling,sibling.inert);sibling.inert=true}}branch=branch.parentElement;if(branch===document.body)break}
  modalPanel.focus();
 }
 document.querySelectorAll('.service-card[data-service]').forEach(card=>{card.addEventListener('click',()=>openServiceModal(card));card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openServiceModal(card)}})});
 serviceModal.querySelectorAll('[data-close-modal]').forEach(button=>button.addEventListener('click',closeServiceModal));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!serviceModal.hidden)closeServiceModal()});
 modalPanel.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||serviceModal.hidden)return;
  const controls=[...modalPanel.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);
  const first=controls[0],last=controls[controls.length-1];if(!first){event.preventDefault();modalPanel.focus();return}
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===modalPanel)){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===modalPanel)){event.preventDefault();first.focus()}
 });
}
// Search only the visible laboratory directory using the published modal catalogue.
const laboratorySearch = document.getElementById('laboratorySearch');
if (laboratorySearch) {
    const input = document.getElementById('testSearch');
    const status = document.getElementById('testSearchStatus');
    const empty = document.getElementById('testSearchEmpty');
    const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const entries = [...document.querySelectorAll('#laboratoryCategories .service-card')].map(card => {
        const details = serviceDetails[card.dataset.service];
        const matches = document.createElement('p');
        matches.className = 'laboratory-matches';
        matches.hidden = true;
        card.querySelector('.service-card-body').append(matches);
        return { card, details, matches };
    });
    function filterLaboratory() {
        const terms = normalize(input.value).split(' ').filter(Boolean);
        const includesTerms = value => terms.every(term => normalize(value).includes(term));
        let count = 0;
        entries.forEach(({ card, details, matches }) => {
            const matchingTests = terms.length ? details.expect.filter(includesTerms) : [];
            const visible = !terms.length || includesTerms(details.title) || matchingTests.length > 0;
            card.hidden = !visible;
            matches.hidden = !visible || !matchingTests.length;
            matches.textContent = matchingTests.length ? `Matching tests: ${matchingTests.join(', ')}` : '';
            if (visible) count++;
        });
        status.textContent = terms.length
            ? `${count} ${count === 1 ? 'category matches' : 'categories match'} your search. Select a category for details.`
            : 'Showing all four laboratory categories.';
        empty.hidden = count !== 0;
    }
    laboratorySearch.hidden = false;
    input.addEventListener('input', filterLaboratory);
    laboratorySearch.addEventListener('submit', event => { event.preventDefault(); filterLaboratory(); });
    laboratorySearch.addEventListener('reset', event => {
        event.preventDefault();
        input.value = '';
        filterLaboratory();
        input.focus();
    });
}

// Progressive enhancement: content stays visible without JavaScript or motion support.
(() => {
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const header=document.querySelector('.site-header');
 const onScroll=()=>header?.classList.toggle('is-scrolled',scrollY>40);
 addEventListener('scroll',onScroll,{passive:true});onScroll();
 if(!('IntersectionObserver' in window)||!('animate' in Element.prototype)||preference.matches)return;
 const seen=new WeakSet(),animations=new Set();
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);
   if(preference.matches||seen.has(entry.target))continue;seen.add(entry.target);
   const delay=Number(entry.target.dataset.revealDelay||0);
   const animation=entry.target.animate([{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],{duration:620,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'none'});
   animations.add(animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
  }
 },{threshold:.12});
 const register=root=>root.querySelectorAll('.hero-content,.hero-image,.patient-actions a,.section-heading,.service-summary > div,.provider-teaser,.physician-profile,.clinic-confidence .container > div,.visit-preparation .container > div,.contact-info,.service-card').forEach(element=>{
  if(seen.has(element))return;const siblings=[...element.parentElement.children];element.dataset.revealDelay=String(Math.min(siblings.indexOf(element),2)*70);observer.observe(element);
 });
 register(document);
 const directory=document.getElementById('doctorDirectory');
 if(directory)new MutationObserver(()=>register(directory)).observe(directory,{childList:true});
 preference.addEventListener('change',event=>{if(event.matches){observer.disconnect();for(const animation of animations)animation.cancel();}});
})();
