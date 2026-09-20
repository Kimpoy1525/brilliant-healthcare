const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { reportOperationalError, installPoolErrorHandler, createHealthHandler, installShutdown } = require('../public-runtime');

test('operational logs contain a correlation ID and no sensitive error text', () => {
  let logged;
  const reference = reportOperationalError('request_failed', { code: 'ECONNRESET', message: 'patient@example.com secret' }, value => { logged = JSON.parse(value); });
  assert.deepEqual(logged, { event: 'request_failed', code: 'ECONNRESET', reference });
  assert.match(reference, /^[0-9a-f-]{36}$/);
});

test('idle database errors are handled without crashing the process', () => {
  const pool = new EventEmitter();
  const logs = [];
  const remove = installPoolErrorHandler(pool, message => logs.push(JSON.parse(message)));
  pool.emit('error', Object.assign(new Error('private connection string'), { code: 'ECONNRESET' }));
  assert.equal(logs[0].code, 'ECONNRESET');
  assert.equal(logs[0].event, 'database_idle_connection_error');
  remove();
  assert.equal(pool.listenerCount('error'), 0);
});

function response() {
  return { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
}

test('health checks distinguish recovery from database failure without exposing details', async () => {
  let down = true;
  const handler = createHealthHandler({ async query(options) { assert.equal(options.query_timeout, 5000); if (down) throw new Error('private'); } });
  const failed = response();
  await handler({}, failed);
  assert.equal(failed.code, 503);
  assert.deepEqual(failed.body, { status: 'unavailable' });
  assert.equal(failed.headers['Cache-Control'], 'no-store');
  down = false;
  const recovered = response();
  await handler({}, recovered);
  assert.equal(recovered.code, 200);
  assert.deepEqual(recovered.body, { status: 'ok' });
});

test('shutdown drains HTTP before ending the pool and ignores duplicate signals', async () => {
  const signals = new EventEmitter(), order = [];
  let drained;
  const server = { close(callback) { order.push('close'); drained = callback; }, closeIdleConnections() { order.push('idle'); } };
  installShutdown(server, { async end() { order.push('pool'); } }, { signals, exit(code) { order.push(`exit:${code}`); } });
  signals.emit('SIGTERM');
  signals.emit('SIGINT');
  assert.deepEqual(order, ['close', 'idle']);
  await drained();
  assert.deepEqual(order, ['close', 'idle', 'pool', 'exit:0']);
});

test('shutdown reports failure if the pool cannot close', async () => {
  let drained, exitCode;
  const stop = installShutdown({ close(callback) { drained = callback; } }, { async end() { throw new Error('offline'); } }, { signals: new EventEmitter(), exit(code) { exitCode = code; } });
  stop();
  await drained();
  assert.equal(exitCode, 1);
});
