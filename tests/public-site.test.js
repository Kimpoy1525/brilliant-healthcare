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
    assert.match(html, /production\.css\?v=1/);
  }
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
  assert.match(read('doctors.html'), /images\/james-raphael\.jpg/);
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
