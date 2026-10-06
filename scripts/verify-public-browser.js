// Run with BROWSER_PATH pointing to Chrome/Edge. Uses only Node's built-in APIs.
// The fixture server has no database connection and cannot send SMS.
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const browserPath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const previewPort = process.env.PUBLIC_CHECK_PORT || '3229';
const fixture = spawn(process.execPath, ['tests/fixtures/public-server.js'], { cwd: root, env: { ...process.env, PORT: previewPort }, stdio: 'ignore' });
let browser, socket;

async function main() {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'bh-public-check-'));
  browser = spawn(browserPath, ['--headless', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(port, 'Browser did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const previewTarget = targets.find(target => target.type === 'page' && target.url === 'about:blank');
  assert.ok(previewTarget, 'The isolated preview tab was not found');
  socket = new WebSocket(previewTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0, directoryMode = 'success',bookingEnabled=false,slotMode='success',appointmentFailure=false;
  const pending = new Map(), exceptions = [];
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, method === 'Page.captureScreenshot' ? 30000 : 10000);
      pending.set(id, { resolve(value) { clearTimeout(timer); resolve(value); }, reject(error) { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  const doctor = { id: 'fixture-doctor', name: 'Fixture physician', specialty: 'Internal Medicine', acceptingNewPatients: true, unavailableDates: [], availability: Array.from({length:7},(_,day)=>({day,start:'09:00',end:'17:00',slotMinutes:30})) };
  socket.onmessage = async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message)); else request?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    } else if (message.method === 'Fetch.requestPaused') {
      const url = message.params.request.url;
      let code=200, data;
      if(url.includes('/api/booking-status'))data={enabled:bookingEnabled,smsEnabled:false};
      else if(url.includes('/slots?')) {
        const date = new URL(url).searchParams.get('date');
        data={date,doctor,unavailable:false,slots:[{time:'09:00',available:true},{time:'09:30',available:false}]};
        if(slotMode==='error')code=503;
        if(slotMode==='delay')await delay(600);
      }
      else if(url.endsWith('/api/appointments')) {
        const payload=JSON.parse(message.params.request.postData);assert.equal(payload.smsConsent,true);assert.equal(payload.time,'09:00');
        code=appointmentFailure?409:201;data=appointmentFailure?{error:'That time was just reserved. Please choose another slot.'}:{reference:'BH-FIXTURE',status:'pending'};
      }
      else {
        if (directoryMode === 'timeout') return;
        data = directoryMode === 'empty' ? [] : directoryMode === 'malformed' ? [{}] : directoryMode === 'roster' ? require('../physician-profiles.json').map((p,i)=>({...p,id:'fixture-'+i,availability:[],acceptingNewPatients:true})) : [doctor];
        if(directoryMode==='error')code=503;
      }
      try { await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }); } catch(error) { if(slotMode!=='delay')throw error; }

    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/doctors' }, { urlPattern:'*/api/booking-status' }, { urlPattern:'*/api/doctors/*/slots?*' }, { urlPattern:'*/api/appointments' }] });
  const evaluate = async expression => {
    const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
  };
  async function until(expression, attempts = 80) {
    for (let i = 0; i < attempts; i++) { if (await evaluate(expression)) return; await delay(50); }
    throw new Error(`Condition timed out: ${expression}`);
  }
  async function navigate(page, width) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 769 });
    await send('Page.navigate', { url: `http://127.0.0.1:${previewPort}/${page}` });
    await until('document.readyState === "complete"');
    await delay(100);
  }
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    for (const page of ['index.html', 'services.html', 'doctors.html', 'patient-information.html', 'appointments.html', 'portal.html']) {
      await navigate(page, width);
      if (page === 'portal.html') {
        const admin = await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,login:!document.getElementById("loginView").hidden,dashboardHidden:document.getElementById("dashboard").hidden})');
        assert.ok(admin.scrollWidth <= admin.width + 1, 'Portal overflows at '+width);
        assert.ok(admin.login && admin.dashboardHidden, 'Unauthenticated portal state');
        continue;
      }
      const state = await evaluate(`(() => {
        const visible = element => !!element.getClientRects().length;
        const call = document.querySelector('.clinic-call').getBoundingClientRect();
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          callVisible: call.width > 0 && call.left >= 0 && call.right <= innerWidth + 1,
          bookingClosed: [...document.querySelectorAll('.contact-form')].every(element => !visible(element)), noFakeStaff: !document.querySelector('img[src*="generic-doctor"],img[src*="-temp"]') };
      })()`);
      assert.ok(state.scrollWidth <= state.width + 1, `${page} overflows at ${width}: ${JSON.stringify(state)}`);
      assert.ok(state.callVisible, `${page}: call action does not fit at ${width}`);
      assert.ok(state.bookingClosed && state.noFakeStaff, `${page}: closed booking or photo integrity failed`);
      if (page === 'index.html') {
        assert.ok(await evaluate('[...document.querySelectorAll(".contact-info .info-item > div")].every(element => element.getBoundingClientRect().width >= 120)'), `Contact details are squeezed at ${width}`);
      }
    }
  }
  await navigate('services.html', 390);
  assert.equal(await evaluate('document.getElementById("navLinks").inert'), true);
  await evaluate('document.getElementById("hamburger").click()');
  assert.equal(await evaluate('document.getElementById("navLinks").inert'), false);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  assert.equal(await evaluate('document.activeElement.id'), 'hamburger');
  await evaluate('document.querySelector(".skip-link").click()');
  assert.equal(await evaluate('document.activeElement.id'), 'main-content');
  await evaluate('document.querySelector("#hematology").click()');
  assert.equal(await evaluate('document.getElementById("serviceModal").hidden'), false);
  assert.equal(await evaluate('document.querySelector(".site-header").inert'), true);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  assert.equal(await evaluate('document.activeElement.className'), 'service-modal-close');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  assert.equal(await evaluate('document.activeElement.id'), 'serviceModalBook');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  assert.equal(await evaluate('document.activeElement.className'), 'service-modal-close');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  assert.equal(await evaluate('document.activeElement.id'), 'hematology');
  assert.equal(await evaluate('document.querySelector(".site-header").inert'), false);
  await evaluate('document.getElementById("testSearch").value="CBC"; document.getElementById("testSearch").dispatchEvent(new Event("input"))');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#laboratoryCategories .service-card")].filter(card=>!card.hidden).map(card=>card.id)'), ['hematology']);
  assert.match(await evaluate('document.querySelector("#hematology .laboratory-matches").textContent'), /CBC/);
  await evaluate('document.getElementById("testSearch").value="urinalysis"; document.getElementById("testSearch").dispatchEvent(new Event("input"))');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#laboratoryCategories .service-card")].filter(card=>!card.hidden).map(card=>card.id)'), ['microscopy']);
  await evaluate('document.getElementById("testSearch").value="not-a-published-test"; document.getElementById("testSearch").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.getElementById("testSearchEmpty").hidden'), false);
  await evaluate('document.querySelector("#laboratorySearch button").click()');
  assert.equal(await evaluate('document.querySelectorAll("#laboratoryCategories .service-card:not([hidden])").length'), 4);
  assert.equal(await evaluate('document.activeElement.id'), 'testSearch');
  directoryMode = 'error';
  await navigate('doctors.html', 390);
  await until('!document.getElementById("directoryRetry").hidden');
  assert.match(await evaluate('document.getElementById("directoryStatus").textContent'), /couldn’t load/);
  assert.equal(await evaluate('document.querySelectorAll("[data-doctor-fallback]").length'), 4);
  for (let portrait = 0; portrait < 4; portrait++) {
    await evaluate('document.querySelectorAll("[data-doctor-fallback] img")['+portrait+'].scrollIntoView()');
    await until('document.querySelectorAll("[data-doctor-fallback] img")['+portrait+'].complete && document.querySelectorAll("[data-doctor-fallback] img")['+portrait+'].naturalWidth>0');
  }
  assert.match(await evaluate('document.getElementById("doctorDirectory").textContent'), /Diabetologist/);
  assert.match(await evaluate('document.getElementById("doctorDirectory").textContent'), /General Physician/);
  assert.match(await evaluate('document.getElementById("doctorDirectory").textContent'), /Nephrologist/);
  directoryMode = 'success';
  await evaluate('document.getElementById("directoryRetry").click()');
  await until('document.getElementById("doctorDirectory").textContent.includes("Fixture physician")');
  assert.match(await evaluate('document.getElementById("doctorDirectory").textContent'), /Call the clinic to confirm/);
  assert.equal(await evaluate('document.querySelectorAll(".physician-placeholder").length'), 1);
  directoryMode = 'empty';
  await navigate('doctors.html', 390);
  await until('document.getElementById("directoryStatus").textContent.includes("No physician schedules")');
  assert.equal(await evaluate('document.getElementById("doctorDirectory").children.length'), 0);
  directoryMode = 'malformed';
  await navigate('doctors.html', 390);
  await until('!document.getElementById("directoryRetry").hidden');
  directoryMode = 'timeout';
  await navigate('doctors.html', 390);
  await until('!document.getElementById("directoryRetry").hidden', 200);
  assert.equal(await evaluate('document.getElementById("doctorDirectory").getAttribute("aria-busy")'), 'false');
  directoryMode = 'success';
  assert.deepEqual(exceptions, [], 'Unexpected browser JavaScript errors');
  await navigate('patient-information.html', 390);
  await evaluate('document.querySelectorAll(".patient-questions summary")[1].click()');
  assert.equal(await evaluate('document.querySelectorAll(".patient-questions details")[1].open'), true);
  // Reopening is simulated only in this isolated browser fixture.
  bookingEnabled=true;directoryMode='success';
  await navigate('appointments.html',390);
  await until('!document.getElementById("contactForm").hidden');
  await evaluate('document.getElementById("doctorSelect").value="fixture-doctor";document.getElementById("doctorSelect").dispatchEvent(new Event("change"))');
  await evaluate('document.querySelector(".calendar-day:not(:disabled)").click()');
  await until('document.querySelectorAll(".time-slot").length===2');
  assert.equal(await evaluate('document.querySelectorAll(".time-slot")[1].disabled'),true);
  await evaluate('document.querySelector(".time-slot").click()');
  assert.match(await evaluate('document.querySelector(".time-slot").textContent'),/Selected/);
  await evaluate('document.getElementById("contactForm").requestSubmit()');
  assert.equal(await evaluate('document.querySelector("[name=fullName]").getAttribute("aria-invalid")'),'true');
  await evaluate('(()=>{const f=document.getElementById("contactForm");f.elements.fullName.value="Fixture Patient";f.elements.phone.value="09171234567";f.elements.service.value="other";f.elements.smsConsent.checked=true;f.requestSubmit()})()');
  await until('document.getElementById("bookingResult").textContent.includes("BH-FIXTURE")');
  assert.match(await evaluate('document.getElementById("bookingResult").textContent'),/pending clinic confirmation/);
  await evaluate('document.getElementById("doctorSelect").value="fixture-doctor";document.getElementById("doctorSelect").dispatchEvent(new Event("change"))');
  slotMode='delay';
  await evaluate('document.querySelector(".calendar-day:not(:disabled)").click()');
  await delay(50);
  await evaluate('document.getElementById("doctorSelect").value="";document.getElementById("doctorSelect").dispatchEvent(new Event("change"))');
  await delay(800);
  assert.equal(await evaluate('document.querySelectorAll(".time-slot").length'),0,'Stale times reappeared after physician changed');
  slotMode='error';
  await evaluate('document.getElementById("doctorSelect").value="fixture-doctor";document.getElementById("doctorSelect").dispatchEvent(new Event("change"));document.querySelector(".calendar-day:not(:disabled)").click()');
  await until('!document.getElementById("retrySlots").hidden');
  slotMode='success';await evaluate('document.getElementById("retrySlots").click()');
  await until('document.querySelectorAll(".time-slot").length===2');
  await evaluate('document.querySelector(".time-slot").click()');
  appointmentFailure=true;
  await evaluate('(()=>{const f=document.getElementById("contactForm");f.elements.fullName.value="Fixture Patient";f.elements.phone.value="09171234567";f.elements.service.value="other";f.elements.smsConsent.checked=true;f.requestSubmit()})()');
  await until('document.getElementById("bookingResult").textContent.includes("That time was just reserved")');
  bookingEnabled=false;appointmentFailure=false;
  await navigate('appointments.html',390);
  assert.equal(await evaluate('document.getElementById("contactForm").hidden'),true);
  assert.deepEqual(exceptions, [], 'Unexpected browser errors after booking checks');
  await navigate('index.html', 1440);
  const metrics = await send('Page.getLayoutMetrics');
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: metrics.cssContentSize.height, scale: 1 } });
  await writeFile(path.join(profile, 'homepage.png'), Buffer.from(screenshot.data, 'base64'));
  console.log('Passed: 42 responsive page checks; server-controlled closed booking; original physician portraits; laboratory search and clear; mobile navigation; skip link; dialog focus; directory failure, retry, empty, malformed and timeout states.');
  console.log(`Screenshot: ${path.join(profile, 'homepage.png')}`);
  await navigate('services.html', 390);
  const mobile = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(profile, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
  console.log(`Mobile: ${path.join(profile, 'mobile.png')}`);
  for (const page of ['services.html', 'doctors.html', 'patient-information.html']) {
    directoryMode = page === 'doctors.html' ? 'roster' : 'success';
    await navigate(page, 1440);
    const layout = await send('Page.getLayoutMetrics');
    console.log(`Capturing ${page}: ${layout.cssContentSize.width} x ${layout.cssContentSize.height}`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: layout.cssContentSize.height, scale: 1 } });
    await writeFile(path.join(profile, `${page}.png`), Buffer.from(shot.data, 'base64'));
  }
  await send('Browser.close');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close();
  browser?.kill();
  fixture.kill();
});
