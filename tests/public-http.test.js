const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
let fixture, base;

before(async () => {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  fixture = spawn(process.execPath, ['tests/fixtures/public-server.js'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Fixture startup timed out')), 10000);
    fixture.stdout.on('data', data => { if (data.toString().includes('listening')) { clearTimeout(timer); resolve(); } });
    fixture.once('error', error => { clearTimeout(timer); reject(error); });
    fixture.once('exit', code => { clearTimeout(timer); reject(new Error(`Fixture exited: ${code}`)); });
  });
});
after(() => fixture?.kill());

test('public homepage revalidates content and retains its security policy', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-cache/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await response.text(), /Call the clinic/);
});

test('missing browser pages offer recovery while API errors remain JSON', async () => {
  const page = await fetch(`${base}/missing-page`, { headers: { Accept: 'text/html' } });
  assert.equal(page.status, 404);
  assert.match(await page.text(), /Return to homepage/);
  const api = await fetch(`${base}/api/missing`);
  assert.equal(api.status, 404);
  assert.deepEqual(await api.json(), { error: 'Not found.' });
});

test('mutable clinic images are not cached as immutable', async () => {
  const response = await fetch(`${base}/images/facility-reception.jpeg`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /max-age=3600/);
  assert.doesNotMatch(response.headers.get('cache-control'), /immutable/);
  await response.arrayBuffer();
});

test('health endpoint is available without caching or real database access', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('oversized requests get a useful client error', async () => {
  const response = await fetch(`${base}/api/missing`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ value: 'x'.repeat(21000) }) });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'The request is too large.' });
});
