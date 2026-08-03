const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const database = fs.readFileSync(path.join(root, 'database.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'portal.js'), 'utf8');

test('admin mutations require authentication and CSRF protection', () => {
  assert.match(server, /appointments\/:id\/archive',auth,csrf,requireRole/);
  assert.match(server, /admin\/staff',auth,csrf,requireRole/);
  assert.match(server, /function csrf\(/);
});

test('permanent appointment deletion is disabled', () => {
  assert.match(server, /Permanent deletion is disabled/);
  assert.match(database, /archived_at timestamptz/);
  assert.match(portal, /Archive record/);
  assert.doesNotMatch(portal, /Delete record/);
  assert.match(database, /archived_at IS NULL AND status NOT IN/);
});

test('audit and staff tables are protected from public Supabase roles', () => {
  assert.match(database, /admin_audit_events ENABLE ROW LEVEL SECURITY/);
  assert.match(database, /admin_audit_events FROM PUBLIC/);
  assert.match(database, /admin_audit_events FROM anon/);
  assert.match(database, /admin_audit_events FROM authenticated/);
});

test('appointment list uses server-side pagination', () => {
  assert.match(server, /api\/admin\/appointments/);
  assert.match(server, /LIMIT \$\$\{values\.length-1\} OFFSET/);
  assert.match(portal, /appointmentQuery\(\)/);
});
