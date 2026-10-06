const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicPages = [
  'index.html',
  'patient-information.html',
  'services.html',
  'doctors.html',
  'appointments.html'
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('public pages retain essential document structure and the production design layer', () => {
  for (const page of publicPages) {
    const html = read(page);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${page} must have one h1`);
    assert.equal((html.match(/<main\b/g) || []).length, 1, `${page} must have one main landmark`);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /production\.css\?v=\d+/);
  }
});

test('homepage follows the patient-first clinic information hierarchy', () => {
  const html = read('index.html');
  const sections = [
    '<section class="hero"',
    '<nav class="patient-actions',
    '<section class="core-services"',
    '<section class="company-purpose"',
    '<section class="featured-physicians"',
    '<section class="facility-section"',
    '<section class="visit-preparation"',
    '<section class="appointment-banner"',
    '<section class="contact"'
  ];
  const positions = sections.map(section => html.indexOf(section));
  assert.ok(positions.every(position => position >= 0), 'homepage is missing a patient-first section');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'homepage sections are out of order');
  assert.match(html, /class="btn btn-primary">Book an appointment<\/a>/);
  assert.match(html, /class="btn btn-secondary">Find a doctor<\/a>/);
  assert.match(html, /Monday–Saturday: 8:00 AM–5:00 PM<br>Sunday: Closed/);
});

test('public pages do not present a non-functional newsletter form', () => {
  for (const page of publicPages) {
    const html = read(page);
    assert.doesNotMatch(html, /newsletter-form|btn-subscribe/, `${page} still contains the retired newsletter form`);
  }
});

test('physician profiles are structurally located on the Doctors page only', () => {
  assert.doesNotMatch(read('index.html'), /<section class="medical-team"/);
  assert.match(read('doctors.html'), /<section class="medical-team"/);
  assert.match(read('doctors.html'), /data-doctor-fallback/);
  assert.match(read('doctors.html'), /images\/doctors\/james-estrada\.jpg/);
});

test('physician directory uses unique approved portraits and individual 4:5 crops', () => {
  const html = read('doctors.html');
  const photos = [...html.matchAll(/data-doctor-fallback[^>]*data-profile-photo="([^"]+)"/g)].map(match => match[1]);
  assert.equal(photos.length, 4);
  assert.equal(new Set(photos).size, photos.length);
  for (const photo of photos) assert.equal(fs.existsSync(path.join(root, photo)), true, `${photo} is not an approved local portrait`);
  const styles = read('production.css');
  assert.match(styles, /\.physician-photo\s*\{\s*aspect-ratio:4\/5/);
  assert.match(styles, /\.physician-photo img\s*\{[^}]*object-fit:cover/);
  for (const slug of ['james-estrada', 'emerlinda-dijamco', 'christian-cheng', 'mae-tapispisan']) {
    assert.match(styles, new RegExp(`#${slug} \\.physician-photo img\\s*\\{\\s*object-position:`));
  }
  assert.match(read('doctors-directory.js'), /usedPhotoSources\.has\(source\)/);
});

test('public pages enable progressive, reduced-motion-aware scroll reveals', () => {
  for (const page of publicPages) assert.match(read(page), /src="motion\.js\?v=\d+"/, `${page} does not load public-site motion`);
  const motion = read('motion.js');
  const styles = read('production.css');
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /observer\.unobserve/);
  assert.match(styles, /translate3d\(0,24px,0\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test('BHCOPC logo watermark appears on every public page', () => {
  const styles = read('production.css');
  assert.match(styles, /background-image:url\("images\/brand-background\.jpeg"\)/);
  assert.match(styles, /\.patient-facing :is\(\.hero,\.page-intro,\.company-purpose,\.contact\)::before/);
  assert.match(styles, /\.privacy-page \.privacy-content::before/);
  for (const page of publicPages) {
    assert.match(read(page), /production\.css\?v=10/, `${page} may retain a cached stylesheet without the watermark`);
  }
});

test('public pages do not contain duplicate element ids', () => {
  for (const page of publicPages) {
    const ids = [...read(page).matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual(duplicates, [], `${page} contains duplicate ids`);
  }
});

test('local image references resolve to files in the repository', () => {
  for (const page of publicPages) {
    const html = read(page);
    for (const match of html.matchAll(/<img[^>]+src="(images\/[^"?]+)(?:\?[^" ]*)?"/g)) {
      assert.equal(fs.existsSync(path.join(root, match[1])), true, `${page} references missing ${match[1]}`);
    }
  }
});

test('laboratory service cards and modal data stay aligned', () => {
  const html = read('services.html');
  const script = read('script.js');
  for (const service of ['hematology', 'microscopy', 'serology', 'chemistry']) {
    assert.match(html, new RegExp(`data-service="${service}"`));
    assert.match(script, new RegExp(`"${service}"\\s*:`));
  }
  assert.equal((html.match(/class="service-card"[^>]*role="button"/g) || []).length, 4);
});

test('every footer links to the current laboratory service categories', () => {
  for (const page of publicPages) {
    const html = read(page);
    for (const service of ['hematology', 'microscopy', 'serology', 'chemistry']) {
      assert.match(html, new RegExp(`href="services\\.html#${service}"`), `${page} footer is missing ${service}`);
    }
    assert.doesNotMatch(html, /<h4>Our Services<\/h4>[\s\S]*?Hemodialysis[\s\S]*?<\/ul>/);
  }
});

test('server serves every directly referenced public stylesheet and script', () => {
  const server = read('server.js');
  const referenced = new Set();
  for (const page of [...publicPages, 'privacy.html', 'portal.html']) {
    const html = read(page);
    for (const match of html.matchAll(/(?:href|src)="([^"?]+\.(?:css|js))/g)) referenced.add(match[1]);
  }
  for (const asset of referenced) assert.match(server, new RegExp(`'${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `server allowlist is missing ${asset}`);
});
